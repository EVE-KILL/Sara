import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { database } from '../database';
import OpenAI from 'openai';
import { Config } from '../config';

export const command = new SlashCommandBuilder()
    .setName('time')
    .setDescription('Get the current time and date')
    .addStringOption(option =>
        option.setName('timezone')
            .setDescription('Timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)')
            .setRequired(false));

export default async function Time(interaction: any, client: any) {
    if (interaction.commandName !== 'time') return;

    try {
        let timezone = interaction.options.getString('timezone');

        // If no timezone specified, try to get from user memory or use AI
        if (!timezone) {
            const userId = interaction.user.id;

            // First check for specific timezone memory
            const timezoneMemory = database.getMemory(userId, 'timezone');
            if (timezoneMemory) {
                timezone = timezoneMemory.memory_value;
            } else {
                // Check for location memory and derive timezone
                const locationMemory = database.getMemory(userId, 'location');
                if (locationMemory) {
                    timezone = await deriveTimezoneFromLocation(locationMemory.memory_value);
                }
            }
        }

        const result = getCurrentTime(timezone);

        await interaction.reply({
            embeds: [result],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in time command:', error);
        await interaction.reply({
            content: 'Sorry, there was an error getting the time.',
            flags: MessageFlags.Ephemeral
        });
    }
}

function getCurrentTime(timezone?: string): EmbedBuilder {
    try {
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

        const embed = new EmbedBuilder()
            .setTitle('🕒 Current Time')
            .setColor(0x00AE86)
            .addFields(
                { name: 'Time Zone', value: timezone || 'UTC', inline: true },
                { name: 'Date & Time', value: timeString, inline: false }
            )
            .setTimestamp();
        return embed;
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Time Error')
            .setColor(0xFF0000)
            .setDescription(`Invalid timezone: ${timezone}. Please use format like 'America/New_York' or 'Europe/London'.`);
        return embed;
    }
}

async function deriveTimezoneFromLocation(location: string): Promise<string | null> {
    try {
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a timezone expert. Given a location, return ONLY the timezone identifier in IANA format (e.g., "America/New_York", "Europe/London", "Asia/Tokyo"). If the location is ambiguous or unknown, return "UTC".'
                },
                {
                    role: 'user',
                    content: `What is the timezone for: ${location}`
                }
            ],
            temperature: 0.1,
            max_completion_tokens: 50
        });

        const timezone = completion.choices[0]?.message?.content?.trim();
        return timezone || null;
    } catch (error) {
        console.error('Error deriving timezone from location:', error);
        return null;
    }
}
