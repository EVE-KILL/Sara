import { Client, GatewayIntentBits } from 'discord.js';
import { Config } from './config.js';
import { loadTasks } from './helper.js';
import chalk from 'chalk';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Array to hold the loaded tasks
const tasks = new Map();

client.on('ready', async () => {
    if (client.user) {
        // Load all tasks
        await loadTasks('./tasks', tasks);

        // Get task name from command line arguments
        const taskName = process.argv[2];

        if (!taskName) {
            // Show task system info when no task specified
            console.log(chalk.blue('Sara Task System'));
            console.log(chalk.gray('Available tasks:\n'));

            for (const [name, task] of tasks) {
                // Show task name and description with usage
                console.log(chalk.cyan(`${name}`));
                console.log(chalk.white(`  ${task.description || 'No description'}`));

                // Show usage examples based on task name
                if (name === 'fetch-messages') {
                    console.log(chalk.gray(`  Usage: bun run task.ts ${name} <channel-id>`));
                } else {
                    console.log(chalk.gray(`  Usage: bun run task.ts ${name}`));
                }
                console.log(); // Empty line between tasks
            }

            process.exit(0);
        }

        // Check if task exists
        if (!tasks.has(taskName)) {
            console.log(chalk.red(`Task "${taskName}" not found!`));
            console.log(chalk.yellow('Run "bun run task.ts" to see available tasks.'));
            process.exit(1);
        }

        // Get the task and run it (no extra logging)
        const task = tasks.get(taskName);
        const taskArgs = process.argv.slice(3); // Get additional arguments

        try {
            await task.execute(client, taskArgs);
        } catch (error) {
            console.error(chalk.red(`Task failed:`), error);
            process.exit(1);
        }

        // Cleanup and exit
        await client.destroy();
        process.exit(0);
    }
});

// Handle errors
client.on('error', (error) => {
    console.error(chalk.red('Discord client error:'), error);
    process.exit(1);
});

// Login to Discord
client.login(Config.token);

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down task runner...'));
    await client.destroy();
    process.exit(0);
});
