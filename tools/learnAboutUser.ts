import { EmbedBuilder } from 'discord.js';
import { database } from '../database.js';

export const tool = {
    name: 'learn_about_user',
    description: 'Learn and remember information about the user for future conversations. Only use this when the user shares personal information that would be helpful to remember.',
    parameters: {
        type: "object",
        properties: {
            information: {
                type: "string",
                description: "The information about the user to remember (e.g., 'lives in Copenhagen', 'likes Danish news', 'works as a developer')"
            }
        },
        required: ["information"]
    },
    systemPrompt: 'Use the learn_about_user tool to remember important personal information that users share, which will help you provide more personalized assistance in future conversations.'
};

export default async function learnAboutUser(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder | { content: EmbedBuilder, memoryKeys: string[] }> {
    try {
        const { information } = args;
        const userId = message.author.id;
        const username = message.author.username;
        const displayName = message.member?.displayName || message.author.displayName || username;

        // Store the information in the database
        // Use user info as key and the information as value
        const memoryKey = `user_info_${Date.now()}`;
        const success = database.addMemory(userId, memoryKey, information);

        if (!success) {
            const errorMsg = '❌ Failed to store the information. Please try again.';
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Memory Error')
                    .setColor(0xFF0000)
                    .setDescription(errorMsg);
                return embed;
            } else {
                return errorMsg;
            }
        }

        // Extract key information for future reference
        const memoryKeys = extractMemoryKeys(information);

        const successMsg = `✅ **Information Learned!**\n📝 **About:** ${displayName}\n💾 **Information:** ${information}\n\n💡 *I'll remember this for our future conversations*`;

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Information Learned!')
                .setColor(0x00FF00)
                .addFields(
                    { name: '👤 User', value: displayName, inline: true },
                    { name: '📝 Information', value: information, inline: false },
                    { name: '🆔 Memory Key', value: memoryKey, inline: true }
                )
                .setFooter({ text: 'I\'ll remember this for our future conversations' })
                .setTimestamp();

            return { content: embed, memoryKeys };
        } else {
            return successMsg;
        }
    } catch (error) {
        console.error('Error storing user memory:', error);
        const errorMsg = '❌ Error storing information. Please try again.';
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Memory Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
            return embed;
        } else {
            return errorMsg;
        }
    }
}

function extractMemoryKeys(information: string): string[] {
    const keys: string[] = [];
    const lowerInfo = information.toLowerCase();

    // Location keywords
    if (lowerInfo.includes('live') || lowerInfo.includes('from') || lowerInfo.includes('in ')) {
        keys.push('location');
    }

    // Work/profession keywords
    if (lowerInfo.includes('work') || lowerInfo.includes('job') || lowerInfo.includes('developer') ||
        lowerInfo.includes('engineer') || lowerInfo.includes('designer') || lowerInfo.includes('student')) {
        keys.push('profession');
    }

    // Preferences/interests
    if (lowerInfo.includes('like') || lowerInfo.includes('love') || lowerInfo.includes('enjoy') ||
        lowerInfo.includes('hobby') || lowerInfo.includes('interest')) {
        keys.push('preferences');
    }

    // Personal details
    if (lowerInfo.includes('age') || lowerInfo.includes('birthday') || lowerInfo.includes('born')) {
        keys.push('personal');
    }

    // Tech/programming related
    if (lowerInfo.includes('code') || lowerInfo.includes('program') || lowerInfo.includes('language') ||
        lowerInfo.includes('framework') || lowerInfo.includes('typescript') || lowerInfo.includes('javascript')) {
        keys.push('technology');
    }

    return keys.length > 0 ? keys : ['general'];
}
