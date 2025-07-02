import { logMessageToTerminal } from '../helper.js';
import { Config } from '../config.js';
import { database, discordMessageToDbMessage } from '../database.js';

export default async function Logger(client: any, message: any) {
    // Ignore certain channel_ids
    let ignoredChannelIds = Config.ignoredChannelIds || [];
    if (ignoredChannelIds.includes(message.channel.id)) {
        return;
    }

    // Ignore certain guild_ids (only for guild messages)
    if (message.guild) {
        let ignoredGuildIds: string[] = Config.ignoredGuildIds || [];
        if (ignoredGuildIds.includes(message.guild.id)) {
            return;
        }
    }

    // Log to terminal (existing functionality)
    logMessageToTerminal(message);

    // Store message in database
    try {
        const dbMessage = discordMessageToDbMessage(message);
        const success = database.insertMessage(dbMessage);

        if (!success) {
            console.error('Failed to store message in database:', message.id);
        }
    } catch (error) {
        console.error('Error storing message in database:', error);
    }
}
