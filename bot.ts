import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadPlugins, loadTools } from './helper.js';
import { Config } from './config.js';
import { database } from './database.js';
import { replyCache } from './onMessage/AI.js'; // Import replyCache from AI plugin
import { voiceReplyCache } from './onMessage/AIVoice.js'; // Import voiceReplyCache from AIVoice plugin
import { initializeRedditAccessToken, refreshRedditAccessToken } from './redditAccessToken.js';
import fs from 'fs';
import path from 'path';

// Reddit token refresh function
async function refreshRedditToken() {
    try {
        console.log('🔑 Refreshing Reddit access token...');
        await refreshRedditAccessToken();
        console.log('✅ Reddit access token refreshed successfully');
    } catch (error) {
        console.error('❌ Failed to refresh Reddit access token:', error);
    }
}

// TikTok cleanup function
function cleanupTikTokFiles() {
    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) {
        return;
    }

    try {
        const files = fs.readdirSync(tempDir);
        const tikTokFiles = files.filter(file => file.startsWith('tiktok_') && file.endsWith('.mp4'));

        let deletedCount = 0;
        for (const file of tikTokFiles) {
            const filePath = path.join(tempDir, file);
            try {
                const stats = fs.statSync(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

                // Delete files older than 1 hour
                if (fileAge > oneHour) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
            }
        }

        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} old TikTok file(s)`);
        }
    } catch (error) {
        console.error('Error during TikTok cleanup:', error);
    }
}

// Voice files cleanup function
function cleanupVoiceFiles() {
    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) {
        return;
    }

    try {
        const files = fs.readdirSync(tempDir);
        const voiceFiles = files.filter(file =>
            (file.startsWith('voice_') && file.match(/\.(mp3|wav|ogg|m4a|webm|mp4)$/i)) ||
            (file.startsWith('response_') && file.endsWith('.mp3'))
        );

        let deletedCount = 0;
        for (const file of voiceFiles) {
            const filePath = path.join(tempDir, file);
            try {
                const stats = fs.statSync(filePath);
                const fileAge = Date.now() - stats.mtime.getTime();
                const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

                // Delete voice files older than 10 minutes
                if (fileAge > tenMinutes) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch (error) {
                console.error(`Error processing voice file ${file}:`, error);
            }
        }

        if (deletedCount > 0) {
            console.log(`🎤 Cleaned up ${deletedCount} old voice file(s)`);
        }
    } catch (error) {
        console.error('Error during voice cleanup:', error);
    }
}

const client = new Client({
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

client.on('ready', async () => {
    if (client.user) {
        console.log(`Logged in as ${client.user.tag}!`);
        // Emit invite link when we start the bot so we don't have to rely on the /about
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=274881571905&scope=bot`;
        console.log(`Invite link: ${inviteLink}`);
        // What servers are we connected to ?
        console.log('Connected to servers:');
        for (const guild of client.guilds.cache) {
            console.log(guild[1].name);
        }

        // Load plugins after the client is ready
        console.log('Loading interaction plugins...');
        await loadPlugins('./onInteraction', interactionPlugins, 'interaction');
        console.log('Loading message plugins...');
        await loadPlugins('./onMessage', messagePlugins, 'message');
        console.log('All plugins loaded successfully!');

        // Load tools
        console.log('Loading tools...');
        try {
            globalTools = await loadTools('./tools');
            console.log(`✅ Successfully loaded ${globalTools.tools.length} tools at startup!`);
        } catch (error) {
            console.error('❌ Failed to load tools at startup:', error);
        }

        // Initialize Reddit access token
        await initializeRedditAccessToken();

        pluginsLoaded = true;

        // Start cleanup jobs
        console.log('🧹 Starting TikTok cleanup job (runs every hour)');
        console.log('🎤 Starting voice file cleanup job (runs every 10 minutes)');
        console.log('🔑 Starting Reddit token refresh job (runs every 30 minutes)');
        cleanupTikTokFiles(); // Run initial TikTok cleanup
        cleanupVoiceFiles(); // Run initial voice cleanup
        setInterval(cleanupTikTokFiles, 60 * 60 * 1000); // Run TikTok cleanup every hour
        setInterval(cleanupVoiceFiles, 10 * 60 * 1000); // Run voice cleanup every 10 minutes
        setInterval(refreshRedditToken, 30 * 60 * 1000); // Refresh Reddit token every 30 minutes
    }
});

// Arrays to hold the loaded plugins
const interactionPlugins: any[] = [];
const messagePlugins: any[] = [];
let pluginsLoaded = false;

// Tools storage
let globalTools: any = null;

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || !pluginsLoaded) return;
    for (const plugin of interactionPlugins) {
        plugin(interaction, client);
    }
});

client.on('messageCreate', async message => {
    if (!pluginsLoaded) return;

    // Handle partial messages (mainly for DMs)
    if (message.partial) {
        try {
            await message.fetch();
        } catch (error) {
            console.error('Error fetching partial message:', error);
            return;
        }
    }

    // Trigger all message plugins on message creation
    for (const plugin of messagePlugins) {
        plugin(client, message);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!pluginsLoaded) return;
    // Check if the bot has already replied to this message (text or voice)
    if (replyCache.has(newMessage.id) || voiceReplyCache.has(newMessage.id)) {
        const botReply = replyCache.get(newMessage.id) || voiceReplyCache.get(newMessage.id);
        for (const plugin of messagePlugins) {
            // Only trigger plugins that handle message updates
            if (plugin.handlesMessageUpdate) {
                await plugin(client, newMessage, botReply);
            }
        }
    }
});

client.on('guildCreate', guild => {
    console.log(`Joined a new guild: ${guild.name}`);
});

client.on('guildDelete', guild => {
    console.log(`Left a guild: ${guild.name}`);
});

// Reaction handler for memory removal functionality
client.on('messageReactionAdd', async (reaction, user) => {
    if (!pluginsLoaded) return;

    // Ignore bot reactions
    if (user.bot) return;

    // Handle partial reactions
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching partial reaction:', error);
            return;
        }
    }

    // Check if this is an ❌ reaction on a memory learning message
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
                console.error('Error updating memory removal message:', error);
            }
        }
    }
});

// Perform cleanup on startup
cleanupTikTokFiles();
cleanupVoiceFiles();

client.login(Config.token);

// When the user presses ctrl+c to exit the bot cleanly
process.on('SIGINT', async () => {
    console.log('Exiting...');
    await client.destroy();
    process.exit();
});

// Export function to get globally loaded tools
export function getGlobalTools() {
    return globalTools;
}
