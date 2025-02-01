import moment from 'moment';
import { REST, Routes } from 'discord.js';
import { Config } from './config.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Function to log messages to the terminal with timestamp and context
export const logMessageToTerminal = (message) => {
    const timestamp = chalk.green(moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'));
    const authorName = chalk.cyan(message.member ? message.member.displayName : message.author.username);
    const serverName = chalk.magenta(message.guild ? message.guild.name : 'DM');
    const channelName = chalk.yellow(message.channel.name || 'DM');
    // Convert IDs in the message content to names
    let content = message.content.replace(/<@!?(.*?)>/g, (match, id) => {
        const user = message.guild.members.cache.get(id);
        return user ? `@${user.displayName}` : match;
    });
    const logMessage = `${timestamp} / ${authorName} / #${channelName} / ${serverName}: ${chalk.white(content)}`;
    console.log(logMessage);
};

// Function to split long messages into chunks of up to 2000 characters
export const splitMessageIntoChunks = (message, chunkSize = 2000) => {
    const chunks = [];
    let currentChunk = '';

    for (const word of message.split(' ')) {
        if (currentChunk.length + word.length + 1 > chunkSize) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
};

// Function to register slash commands for a plugin
export async function registerSlashCommands(commands) {
    const rest = new REST({ version: '10' }).setToken(Config.token);

    console.log('Registering slash command: ' + commands[0].name);

    await rest.put(Routes.applicationCommands(Config.clientId), { body: commands });

    console.log(commands[0].name + ' registered successfully.');
}

// Function to dynamically load plugins
export async function loadPlugins(pluginDirectory, pluginList, type = '') {
    const pluginPath = path.resolve(pluginDirectory);
    fs.readdirSync(pluginPath).forEach(async file => {
        console.log('Loading plugin: ' + file);
        const { default: handler, command } = await import(path.join(pluginPath, file));
        if (command) {
            await registerSlashCommands([command]);
        }
        if (type === 'interaction') {
            pluginList.push(handler);
        }
        if (type === 'message') {
            pluginList.push(handler);
        }
    });
}

export async function resolveIdToUser(client, userId) {
    try {
        return await client.users.fetch(userId);
    } catch (error) {
        console.error(`Failed to fetch user with ID ${userId}: ${error.message}`);
        return null;
    }
}
