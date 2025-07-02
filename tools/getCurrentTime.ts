import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'get_current_time',
    description: 'Get the current time and date for display purposes ONLY. NEVER use this tool when users ask to be reminded of something - that requires set_reminder tool instead.',
    parameters: {
        type: "object",
        properties: {
            timezone: {
                type: "string",
                description: "The timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Defaults to UTC if not specified."
            }
        }
    },
    systemPrompt: 'Use the get_current_time tool to show users the current time and date. This tool can display time for different timezones.'
};

export default async function getCurrentTime(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { timezone } = args;
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone || 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        };

        const formatter = new Intl.DateTimeFormat('en-US', options);
        const timeString = formatter.format(now);

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('🕐 Current Time')
                .setColor(0x5865F2)
                .addFields(
                    { name: 'Time Zone', value: timezone || 'UTC', inline: true },
                    { name: 'Date & Time', value: timeString, inline: false }
                )
                .setTimestamp();
            return embed;
        } else {
            return `Current time${timezone ? ` in ${timezone}` : ' (UTC)'}: ${timeString}`;
        }
    } catch (error) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Time Error')
                .setColor(0xFF0000)
                .setDescription(`Error getting time: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return embed;
        } else {
            return `Error getting time: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
