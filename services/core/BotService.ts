import { Client, GatewayIntentBits, Partials, Message, CommandInteraction } from 'discord.js';
import { Config } from '../../config.js';
import { database } from '../../database.js';
import { IService, IServiceContext } from '../../types/Services.js';
import { Container } from './Container.js';
import { PluginLoaderService } from './PluginLoader.js';
import { FileCleanupService } from '../utils/FileCleanup.js';
import { MediaCacheService } from '../media/MediaCache.js';
import { initializeRedditAccessToken, refreshRedditAccessToken } from '../../redditAccessToken.js';
import { InteractiveCLI } from '../../cli.js';
import { ExternalIntegrationsService } from '../external/ExternalIntegrations.js';
import { AIService } from '../ai/AIService.js';

/**
 * Main bot service that coordinates all other services
 */
export class BotService implements IService {
    name = 'Bot';

    private client: Client;
    private container: Container;
    private interactionPlugins: any[] = [];
    private messagePlugins: any[] = [];
    private globalTools: any = null;
    private cliInterface?: InteractiveCLI;
    private pluginsLoaded = false;

    constructor() {
        this.container = new Container();
        this.setupClient();
        this.registerServices();
    }

    /**
     * Initialize the Discord client
     */
    private setupClient(): void {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMessageReactions
            ],
            partials: [Partials.Message, Partials.Channel, Partials.Reaction]
        });

        this.setupEventHandlers();
    }

    /**
     * Register all services in the container
     */
    private registerServices(): void {
        // Core services
        this.container.register('pluginLoader', new PluginLoaderService());
        this.container.register('fileCleanup', new FileCleanupService());
        this.container.register('mediaCache', new MediaCacheService());

        // AI services
        this.container.register('ai', new AIService());

        // External integration services
        this.container.register('externalIntegrations', new ExternalIntegrationsService());

        // Register the client and container themselves for plugin access
        this.container.register('client', this.client);
        this.container.register('container', this.container);
    }

    /**
     * Setup Discord event handlers
     */
    private setupEventHandlers(): void {
        this.client.on('clientReady', () => this.onClientReady());
        this.client.on('interactionCreate', (interaction) => this.onInteractionCreate(interaction));
        this.client.on('messageCreate', (message) => this.onMessageCreate(message));
        this.client.on('messageUpdate', (oldMessage, newMessage) => this.onMessageUpdate(oldMessage, newMessage));
        this.client.on('messageReactionAdd', (reaction, user) => this.onMessageReactionAdd(reaction, user));
        this.client.on('guildCreate', (guild) => this.onGuildCreate(guild));
        this.client.on('guildDelete', (guild) => this.onGuildDelete(guild));
    }

    /**
     * Initialize the bot service
     */
    async initialize(): Promise<void> {
        console.log('🚀 Initializing Bot Service...');

        // Initialize all services
        await this.container.initializeAll();

        // Login to Discord
        await this.client.login(Config.token);
    }

    /**
     * Handle client ready event
     */
    private async onClientReady(): Promise<void> {
        if (!this.client.user) return;

        console.log(`✅ Logged in as ${this.client.user.tag}!`);

        // Emit invite link
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=274881571905&scope=bot`;
        console.log(`🔗 Invite link: ${inviteLink}`);

        // Log connected servers
        console.log('🌐 Connected to servers:');
        for (const guild of this.client.guilds.cache) {
            console.log(`  - ${guild[1].name}`);
        }

        await this.loadAllPlugins();
        await this.initializeExternalServices();

        this.pluginsLoaded = true;
        console.log('🎉 Bot is fully ready!');
    }

    /**
     * Load all plugins and tools
     */
    private async loadAllPlugins(): Promise<void> {
        const pluginLoader = this.container.get<PluginLoaderService>('pluginLoader');

        try {
            // Load interaction plugins
            this.interactionPlugins = await pluginLoader.loadInteractionPlugins('./onInteraction');

            // Load message plugins
            this.messagePlugins = await pluginLoader.loadMessagePlugins('./onMessage');

            // Load AI tools
            this.globalTools = await pluginLoader.loadTools('./tools');

            // Setup AI service with tools
            const aiService = this.container.get<AIService>('ai');
            aiService.setTools(
                this.globalTools.tools,
                this.globalTools.toolExecutors,
                this.globalTools.systemPrompts
            );

            console.log('✅ All plugins loaded successfully!');
        } catch (error) {
            console.error('❌ Failed to load plugins:', error);
        }
    }

    /**
     * Initialize external services
     */
    private async initializeExternalServices(): Promise<void> {
        // Initialize Reddit access token
        await initializeRedditAccessToken();

        // Initialize CLI interface
        this.cliInterface = new InteractiveCLI(this.client);
        await this.cliInterface.initialize();

        // Start cleanup jobs
        const fileCleanup = this.container.get<FileCleanupService>('fileCleanup');
        fileCleanup.startPeriodicCleanup();

        // Initialize external integrations
        const externalIntegrations = this.container.get<ExternalIntegrationsService>('externalIntegrations');
        await externalIntegrations.initialize();
    }

    /**
     * Handle interaction events
     */
    private async onInteractionCreate(interaction: any): Promise<void> {
        if (!interaction.isChatInputCommand() || !this.pluginsLoaded) return;

        const context: IServiceContext = {
            client: this.client,
            container: this.container,
            interaction
        };

        for (const plugin of this.interactionPlugins) {
            try {
                await plugin(interaction, this.client);
            } catch (error) {
                console.error('❌ Error in interaction plugin:', error);
            }
        }
    }

    /**
     * Handle message creation events
     */
    private async onMessageCreate(message: Message): Promise<void> {
        if (!this.pluginsLoaded) return;

        // Handle partial messages (mainly for DMs)
        if (message.partial) {
            try {
                await message.fetch();
            } catch (error) {
                console.error('❌ Error fetching partial message:', error);
                return;
            }
        }

        // Ignore messages from bots
        if (message.author.bot) return;

        const context: IServiceContext = {
            client: this.client,
            container: this.container,
            message
        };

        // Trigger all message plugins
        for (const plugin of this.messagePlugins) {
            try {
                await plugin(this.client, message);
            } catch (error) {
                console.error('❌ Error in message plugin:', error);
            }
        }
    }

    /**
     * Handle message update events
     */
    private async onMessageUpdate(oldMessage: any, newMessage: any): Promise<void> {
        if (!this.pluginsLoaded) return;

        // For now, we'll handle message updates in a simplified way
        // The AI cache will be handled by the AI service once we create it
        for (const plugin of this.messagePlugins) {
            // Only trigger plugins that handle message updates
            if (plugin.handlesMessageUpdate) {
                try {
                    await plugin(this.client, newMessage, null);
                } catch (error) {
                    console.error('❌ Error in message update plugin:', error);
                }
            }
        }
    }

    /**
     * Handle message reaction events
     */
    private async onMessageReactionAdd(reaction: any, user: any): Promise<void> {
        if (!this.pluginsLoaded || user.bot) return;

        // Handle partial reactions
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('❌ Error fetching partial reaction:', error);
                return;
            }
        }

        // Handle memory removal functionality
        if (reaction.emoji.name === '❌') {
            const messageId = reaction.message.id;
            const memoryData = database.getMemoryMessage(messageId);

            if (memoryData && memoryData.userId === user.id) {
                // Remove the memories associated with this message
                for (const memoryKey of memoryData.memoryKeys) {
                    database.deleteMemory(user.id, memoryKey);
                }

                // Remove the tracking entry
                database.removeMemoryMessage(messageId);

                // Edit the message to show the memory was removed
                try {
                    const embed = reaction.message.embeds[0];
                    if (embed) {
                        const updatedEmbed = {
                            ...embed,
                            title: '🗑️ Memory Removed',
                            description: `Removed ${memoryData.memoryKeys.length} memory item${memoryData.memoryKeys.length > 1 ? 's' : ''} as requested.`,
                            color: 0xFF6B6B,
                            footer: { text: 'Memory successfully deleted' }
                        };
                        await reaction.message.edit({ embeds: [updatedEmbed] });
                    }

                    // Remove all reactions from the message
                    await reaction.message.reactions.removeAll();
                } catch (error) {
                    console.error('❌ Error updating memory removal message:', error);
                }
            }
        }
    }

    /**
     * Handle guild join events
     */
    private onGuildCreate(guild: any): void {
        console.log(`🎉 Joined a new guild: ${guild.name}`);
    }

    /**
     * Handle guild leave events
     */
    private onGuildDelete(guild: any): void {
        console.log(`👋 Left a guild: ${guild.name}`);
    }

    /**
     * Get the global tools (for backwards compatibility)
     */
    getGlobalTools() {
        return this.globalTools;
    }

    /**
     * Get the service container
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Get the Discord client
     */
    getClient(): Client {
        return this.client;
    }

    /**
     * Cleanup and shutdown the bot
     */
    async cleanup(): Promise<void> {
        console.log('🛑 Shutting down bot...');

        // Cleanup all services
        await this.container.cleanupAll();

        // Destroy the Discord client
        await this.client.destroy();

        console.log('✅ Bot shutdown complete');
    }
}
