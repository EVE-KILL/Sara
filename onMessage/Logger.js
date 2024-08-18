import { logMessageToTerminal } from '../helper.js';
import { Config } from '../config.js';

export default async function Logger(client, message) {
    // Ignore certain channel_ids
    let ignoredChannelIds = Config.ignoredChannelIds || [];
    if (ignoredChannelIds.includes(message.channel.id)) {
        return;
    }

    // Ignore certain guild_ids
    let ignoredGuildIds = Config.ignoredGuildIds || [];
    if (ignoredGuildIds.includes(message.guild.id)) {
        return;
    }

    logMessageToTerminal(message);
}
