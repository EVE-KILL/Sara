import { EmbedBuilder } from 'discord.js';
import { database, type DiscordMessage } from '../database.js';
import { Config } from '../config.js';
import OpenAI from 'openai';

export const tool = {
    name: 'get_channel_history',
    description: 'Get a summary of past conversations in the Discord channel. Use this for questions about what happened in the past, who said what, or to get context about previous discussions.',
    parameters: {
        type: "object",
        properties: {
            time_query: {
                type: "string",
                description: "Time-based query describing when to look for messages (e.g., 'last 15 minutes', 'yesterday around this time', 'an hour ago', 'this morning', 'last week')"
            },
            user_filter: {
                type: "string",
                description: "Filter by username or display name (optional). Use this when the user asks about specific people (e.g., '@KongGal', 'KongGal', or partial names)"
            },
            topic_filter: {
                type: "string",
                description: "Search for messages containing specific topics or keywords (optional). Use this when looking for discussions about specific subjects"
            },
            limit: {
                type: "number",
                description: "Maximum number of messages to analyze (default: 50, max: 200)"
            }
        },
        required: ["time_query"]
    },
    systemPrompt: 'Use the get_channel_history tool to help users understand what happened in past conversations, find specific discussions, or get context about previous messages in the channel.'
};

export default async function getChannelHistory(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { time_query, user_filter, topic_filter, limit = 50 } = args;
        const channelId = message.channel.id;
        const maxLimit = Math.min(limit, 200);

        // Parse the time query to get a time range
        const timeRange = parseTimeQuery(time_query);
        if (!timeRange) {
            const errorMsg = `❌ Could not understand the time query: "${time_query}". Try formats like "last hour", "yesterday", "this morning", etc.`;
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Time Query Error')
                    .setColor(0xFF0000)
                    .setDescription(errorMsg);
                return embed;
            } else {
                return errorMsg;
            }
        }

        // Get messages from database
        const messages = database.getHistoricalMessages(channelId, {
            timeRange: timeRange,
            limit: maxLimit,
            includeBot: false
        });

        if (!messages || messages.length === 0) {
            const noMessagesMsg = `📝 No messages found in ${message.channel.name} for the specified time period.`;
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('📝 No Messages Found')
                    .setColor(0x5865F2)
                    .setDescription(noMessagesMsg);
                return embed;
            } else {
                return noMessagesMsg;
            }
        }

        // Filter messages by user if specified
        let filteredMessages: DiscordMessage[] = messages;
        if (user_filter) {
            const cleanFilter = user_filter.replace(/[@#<>]/g, '').toLowerCase();
            filteredMessages = messages.filter((msg: DiscordMessage) =>
                msg.author_username?.toLowerCase().includes(cleanFilter) ||
                msg.author_display_name?.toLowerCase().includes(cleanFilter)
            );
        }

        // Filter messages by topic if specified
        if (topic_filter) {
            const topicKeywords = topic_filter.toLowerCase().split(' ');
            filteredMessages = filteredMessages.filter((msg: DiscordMessage) =>
                topicKeywords.some((keyword: string) =>
                    msg.content?.toLowerCase().includes(keyword)
                )
            );
        }

        if (filteredMessages.length === 0) {
            const noFilteredMsg = `📝 No messages found matching your criteria in ${message.channel.name}.`;
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('📝 No Matching Messages')
                    .setColor(0x5865F2)
                    .setDescription(noFilteredMsg);
                return embed;
            } else {
                return noFilteredMsg;
            }
        }

        // Generate summary using AI
        const summary = await generateMessageSummary(filteredMessages, time_query, user_filter, topic_filter);

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('📝 Channel History Summary')
                .setColor(0x5865F2)
                .setDescription(summary)
                .addFields(
                    { name: '⏰ Time Period', value: time_query, inline: true },
                    { name: '💬 Messages Found', value: filteredMessages.length.toString(), inline: true },
                    { name: '📍 Channel', value: message.channel.name || 'Unknown', inline: true }
                );

            if (user_filter) {
                embed.addFields({ name: '👤 User Filter', value: user_filter, inline: true });
            }
            if (topic_filter) {
                embed.addFields({ name: '🔍 Topic Filter', value: topic_filter, inline: true });
            }

            embed.setTimestamp();
            return embed;
        } else {
            let result = `📝 **Channel History Summary**\n\n`;
            result += `**Time Period:** ${time_query}\n`;
            result += `**Messages Found:** ${filteredMessages.length}\n`;
            if (user_filter) result += `**User Filter:** ${user_filter}\n`;
            if (topic_filter) result += `**Topic Filter:** ${topic_filter}\n`;
            result += `\n**Summary:**\n${summary}`;
            return result;
        }

    } catch (error) {
        console.error('Error getting channel history:', error);
        const errorMsg = `❌ Error retrieving channel history: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Channel History Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
            return embed;
        } else {
            return errorMsg;
        }
    }
}

function parseTimeQuery(timeQuery: string): { start: Date, end: Date } | null {
    const now = new Date();
    const lowerQuery = timeQuery.toLowerCase().trim();

    // Helper function to get start of day
    const getStartOfDay = (date: Date) => {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        return start;
    };

    // Helper function to get end of day
    const getEndOfDay = (date: Date) => {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        return end;
    };

    try {
        if (lowerQuery.includes('last') && lowerQuery.includes('minute')) {
            const minutes = parseInt(lowerQuery.match(/(\d+)/)?.[1] || '15');
            return {
                start: new Date(now.getTime() - (minutes * 60 * 1000)),
                end: now
            };
        }

        if (lowerQuery.includes('last') && lowerQuery.includes('hour')) {
            const hours = parseInt(lowerQuery.match(/(\d+)/)?.[1] || '1');
            return {
                start: new Date(now.getTime() - (hours * 60 * 60 * 1000)),
                end: now
            };
        }

        if (lowerQuery.includes('yesterday')) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                start: getStartOfDay(yesterday),
                end: getEndOfDay(yesterday)
            };
        }

        if (lowerQuery.includes('today') || lowerQuery.includes('this day')) {
            return {
                start: getStartOfDay(now),
                end: now
            };
        }

        if (lowerQuery.includes('this morning')) {
            const start = getStartOfDay(now);
            const end = new Date(now);
            end.setHours(12, 0, 0, 0);
            return { start, end };
        }

        if (lowerQuery.includes('last week')) {
            const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            return {
                start: weekAgo,
                end: now
            };
        }

        // Default: last hour
        return {
            start: new Date(now.getTime() - (60 * 60 * 1000)),
            end: now
        };

    } catch (error) {
        console.error('Error parsing time query:', error);
        return null;
    }
}

async function generateMessageSummary(messages: DiscordMessage[], timeQuery: string, userFilter?: string, topicFilter?: string): Promise<string> {
    try {
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        // Prepare message content for summary
        const messageTexts = messages.slice(0, 50).map(msg => {
            const timestamp = new Date(msg.created_at).toLocaleTimeString();
            const author = msg.author_display_name || msg.author_username || 'Unknown';
            const content = msg.content || '[No content]';
            return `[${timestamp}] ${author}: ${content}`;
        }).join('\n');

        let prompt = `Please provide a concise summary of these Discord channel messages from ${timeQuery}. `;
        if (userFilter) prompt += `Focus on messages from ${userFilter}. `;
        if (topicFilter) prompt += `Look specifically for discussions about ${topicFilter}. `;
        prompt += `Summarize the key topics, participants, and important points discussed:\n\n${messageTexts}`;

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that summarizes Discord channel conversations. Provide clear, concise summaries that capture the main topics and participants.'
                },
                { role: 'user', content: prompt }
            ],
            max_completion_tokens: 500,
            temperature: 0.3
        });

        return completion.choices?.[0]?.message?.content || 'Unable to generate summary.';

    } catch (error) {
        console.error('Error generating summary:', error);
        return `Found ${messages.length} messages but could not generate a detailed summary.`;
    }
}
