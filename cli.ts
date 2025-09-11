import inquirer from 'inquirer';
import readline from 'readline';
import chalk from 'chalk';
import { Client, Guild, TextChannel, GuildChannel, ChannelType, CategoryChannel } from 'discord.js';

interface CLIState {
    selectedGuild: Guild | null;
    selectedChannel: TextChannel | null;
    isActive: boolean;
}

export class InteractiveCLI {
    private client: Client;
    private state: CLIState;
    private rl: readline.Interface;

    constructor(client: Client) {
        this.client = client;
        this.state = {
            selectedGuild: null,
            selectedChannel: null,
            isActive: false
        };

        // Create readline interface but don't start it yet
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });
    }

    public async initialize() {
        console.log(chalk.blue('\n🎮 Interactive CLI Mode Available!'));
        console.log(chalk.gray('Type /cli to start interactive mode, or use these commands:'));
        console.log(chalk.gray('/servers - List all servers'));
        console.log(chalk.gray('/channels - List channels in current server'));
        console.log(chalk.gray('/switch - Change server/channel'));
        console.log(chalk.gray('/status - Show current selection'));
        console.log(chalk.gray('/help - Show all commands'));

        this.setupInputHandler();
    }

    private setupInputHandler() {
        // Set up readline to handle input
        this.rl.on('line', async (input: string) => {
            const trimmedInput = input.trim();

            if (trimmedInput.startsWith('/')) {
                await this.handleCommand(trimmedInput);
            } else if (trimmedInput.length > 0 && this.state.selectedChannel) {
                await this.sendMessage(trimmedInput);
            } else if (trimmedInput.length > 0) {
                console.log(chalk.red('❌ No channel selected. Use /switch to select a channel first.'));
            }

            if (this.state.isActive) {
                this.showPrompt();
            }
        });

        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            if (this.state.isActive) {
                this.state.isActive = false;
                console.log(chalk.yellow('\n📱 Exited CLI mode. Bot continues running.'));
                console.log(chalk.gray('Type /cli to re-enter interactive mode.'));
            } else {
                process.emit('SIGINT', 'SIGINT');
            }
        });
    }

    private async handleCommand(command: string) {
        const [cmd, ...args] = command.slice(1).split(' ');

        switch (cmd) {
            case 'cli':
                await this.startInteractiveMode();
                break;
            case 'servers':
                this.listServers();
                break;
            case 'channels':
                this.listChannels();
                break;
            case 'switch':
                await this.switchChannel();
                break;
            case 'status':
                this.showStatus();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'exit':
                if (this.state.isActive) {
                    this.state.isActive = false;
                    console.log(chalk.yellow('📱 Exited CLI mode.'));
                }
                break;
            default:
                console.log(chalk.red(`❌ Unknown command: /${cmd}`));
                console.log(chalk.gray('Type /help for available commands.'));
        }
    }

    private async startInteractiveMode() {
        if (this.state.isActive) {
            console.log(chalk.yellow('📱 Already in interactive mode!'));
            return;
        }

        console.log(chalk.blue('\n🎮 Starting Interactive CLI Mode...'));

        // If no channel is selected, prompt for selection
        if (!this.state.selectedChannel) {
            await this.switchChannel();
        }

        if (this.state.selectedChannel) {
            this.state.isActive = true;
            console.log(chalk.green('✅ Interactive mode started!'));
            console.log(chalk.gray('Type messages to send, or /exit to leave interactive mode.'));
            this.showPrompt();
        }
    }

    private listServers() {
        const guilds = Array.from(this.client.guilds.cache.values());

        if (guilds.length === 0) {
            console.log(chalk.red('❌ No servers found.'));
            return;
        }

        console.log(chalk.blue('\n📋 Available Servers:'));
        guilds.forEach((guild, index) => {
            const prefix = this.state.selectedGuild?.id === guild.id ? chalk.green('→') : ' ';
            console.log(`${prefix} ${index + 1}. ${chalk.cyan(guild.name)} (${guild.memberCount} members)`);
        });
    }

    private listChannels() {
        if (!this.state.selectedGuild) {
            console.log(chalk.red('❌ No server selected. Use /switch to select a server first.'));
            return;
        }

        const allChannels = Array.from(this.state.selectedGuild.channels.cache.values());
        const channels: TextChannel[] = [];

        for (const channel of allChannels) {
            if (channel && (channel as any).type === ChannelType.GuildText) {
                channels.push(channel as TextChannel);
            }
        }

        // Sort by category, then by name
        channels.sort((a, b) => {
            const aCategoryName = a.parent?.name || 'No Category';
            const bCategoryName = b.parent?.name || 'No Category';

            if (aCategoryName !== bCategoryName) {
                return aCategoryName.localeCompare(bCategoryName);
            }
            return a.name.localeCompare(b.name);
        });

        if (channels.length === 0) {
            console.log(chalk.red('❌ No text channels found in this server.'));
            return;
        }

        console.log(chalk.blue(`\n📋 Text Channels in ${chalk.cyan(this.state.selectedGuild.name)}:`));

        let currentCategory = '';
        channels.forEach((channel, index) => {
            const categoryName = channel.parent?.name || 'No Category';

            // Show category header when it changes
            if (categoryName !== currentCategory) {
                currentCategory = categoryName;
                console.log(chalk.gray(`\n  📁 ${categoryName}`));
            }

            const prefix = this.state.selectedChannel?.id === channel.id ? chalk.green('  →') : '   ';
            console.log(`${prefix} #${chalk.yellow(channel.name)}`);
        });
    }

    private async switchChannel() {
        try {
            // Pause readline while using inquirer
            this.rl.pause();

            const guilds = Array.from(this.client.guilds.cache.values());

            if (guilds.length === 0) {
                console.log(chalk.red('❌ No servers available.'));
                this.rl.resume();
                return;
            }

            // Select server
            const guildChoices = guilds.map((guild, index) => ({
                name: `${guild.name} (${guild.memberCount} members)`,
                value: guild,
                short: guild.name
            }));

            const { selectedGuild } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedGuild',
                message: 'Select a server:',
                choices: guildChoices,
                default: this.state.selectedGuild
            }]);

            this.state.selectedGuild = selectedGuild;

            // Get text channels for the selected server
            const allChannels = Array.from(selectedGuild.channels.cache.values());
            const channels: TextChannel[] = [];

            for (const channel of allChannels) {
                if (channel && (channel as any).type === ChannelType.GuildText) {
                    channels.push(channel as TextChannel);
                }
            }

            // Sort by category, then by name
            channels.sort((a, b) => {
                const aCategoryName = a.parent?.name || 'No Category';
                const bCategoryName = b.parent?.name || 'No Category';

                if (aCategoryName !== bCategoryName) {
                    return aCategoryName.localeCompare(bCategoryName);
                }
                return a.name.localeCompare(b.name);
            });

            if (channels.length === 0) {
                console.log(chalk.red('❌ No text channels found in this server.'));
                this.rl.resume();
                return;
            }

            // Select channel with category information
            const channelChoices = channels.map(channel => {
                const categoryName = channel.parent?.name || 'No Category';
                return {
                    name: `#${channel.name} (${categoryName})`,
                    value: channel,
                    short: channel.name
                };
            });

            const { selectedChannel } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedChannel',
                message: 'Select a channel:',
                choices: channelChoices,
                default: this.state.selectedChannel
            }]);

            this.state.selectedChannel = selectedChannel;

            const categoryName = selectedChannel.parent?.name || 'No Category';
            console.log(chalk.green(`✅ Selected: #${selectedChannel.name} in ${selectedGuild.name} (${categoryName})`));

            // Resume readline
            this.rl.resume();

        } catch (error) {
            console.error(chalk.red('❌ Error selecting channel:'), error);
            this.rl.resume();
        }
    }

    private showStatus() {
        console.log(chalk.blue('\n📊 Current CLI Status:'));
        console.log(`Mode: ${this.state.isActive ? chalk.green('Interactive') : chalk.gray('Command')}`);

        if (this.state.selectedGuild) {
            console.log(`Server: ${chalk.cyan(this.state.selectedGuild.name)}`);
        } else {
            console.log(`Server: ${chalk.gray('None selected')}`);
        }

        if (this.state.selectedChannel) {
            const categoryName = this.state.selectedChannel.parent?.name || 'No Category';
            console.log(`Channel: ${chalk.yellow('#' + this.state.selectedChannel.name)} ${chalk.gray('(' + categoryName + ')')}`);
        } else {
            console.log(`Channel: ${chalk.gray('None selected')}`);
        }
    }

    private showHelp() {
        console.log(chalk.blue('\n📚 Available CLI Commands:'));
        console.log(chalk.white('/cli') + chalk.gray(' - Start interactive messaging mode'));
        console.log(chalk.white('/servers') + chalk.gray(' - List all available servers'));
        console.log(chalk.white('/channels') + chalk.gray(' - List channels in current server'));
        console.log(chalk.white('/switch') + chalk.gray(' - Change server/channel selection'));
        console.log(chalk.white('/status') + chalk.gray(' - Show current server/channel selection'));
        console.log(chalk.white('/help') + chalk.gray(' - Show this help message'));
        console.log(chalk.white('/exit') + chalk.gray(' - Exit interactive mode (when active)'));
        console.log(chalk.gray('\nIn interactive mode, just type your message and press Enter to send.'));
        console.log(chalk.gray('Use Ctrl+C to exit interactive mode.'));
    }

    private async sendMessage(content: string) {
        if (!this.state.selectedChannel) {
            console.log(chalk.red('❌ No channel selected.'));
            return;
        }

        try {
            // Check if bot has permission to send messages
            const permissions = this.state.selectedChannel.permissionsFor(this.client.user!);
            if (!permissions?.has('SendMessages')) {
                console.log(chalk.red('❌ Bot does not have permission to send messages in this channel.'));
                return;
            }

            const message = await this.state.selectedChannel.send(content);

            // Log our sent message with special formatting including category
            const timestamp = chalk.green(new Date().toLocaleString());
            const serverName = chalk.magenta(this.state.selectedGuild?.name || 'Unknown');
            const channelName = chalk.yellow(this.state.selectedChannel.name);
            const categoryName = this.state.selectedChannel.parent?.name || 'No Category';
            const sentMessage = chalk.blue('[SENT]');

            console.log(`${timestamp} / ${sentMessage} / #${channelName} ${chalk.gray('(' + categoryName + ')')} / ${serverName}: ${chalk.white(content)}`);

        } catch (error) {
            console.error(chalk.red('❌ Failed to send message:'), error);

            // Additional debugging
            if (error instanceof Error) {
                console.error(chalk.red('Error details:'), error.message);
                if ('code' in error) {
                    console.error(chalk.red('Error code:'), (error as any).code);
                }
            }
        }
    }

    private showPrompt() {
        const serverName = this.state.selectedGuild?.name || 'Unknown';
        const channelName = this.state.selectedChannel?.name || 'unknown';
        const categoryName = this.state.selectedChannel?.parent?.name;

        let promptText;
        if (categoryName) {
            promptText = `[${serverName}/${categoryName}/#${channelName}]`;
        } else {
            promptText = `[${serverName}/#${channelName}]`;
        }

        const prompt = chalk.cyan(promptText) + chalk.white(' > ');
        this.rl.setPrompt(prompt);
        this.rl.prompt();
    }

    // Method to pause readline when we want to show inquirer prompts
    public pauseInput() {
        this.rl.pause();
    }

    // Method to resume readline after inquirer prompts
    public resumeInput() {
        this.rl.resume();
        if (this.state.isActive) {
            this.showPrompt();
        }
    }
}
