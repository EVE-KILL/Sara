import { splitMessageIntoChunks, processWithToolsEmbed, loadTools, generateSystemPromptWithMemories, shouldSuppressAIForMediaResponse } from '../helper.js';
import { Config } from '../config.js';
import { database } from '../database.js';
import OpenAI from 'openai';

const replyCache = new Map(); // Store original user message ID and bot reply message ID
const excludedMessageIds = new Set(); // Store IDs of flagged messages
const channelMessageHistory = new Map(); // Store message history per channel
const MAX_HISTORY_SIZE = 10; // Maximum number of messages to keep in history

// Function to check if a message has image attachments
function hasImageAttachments(message: any): boolean {
    return message.attachments.some((attachment: any) =>
        attachment.contentType?.startsWith('image/') ||
        attachment.name?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    );
}

// Function to process image attachments for vision models
function processImageAttachments(message: any): any[] {
    const imageUrls: any[] = [];

    message.attachments.forEach((attachment: any) => {
        if (attachment.contentType?.startsWith('image/') ||
            attachment.name?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
            imageUrls.push({
                type: "image_url",
                image_url: {
                    url: attachment.url
                }
            });
        }
    });

    return imageUrls;
}

// Function to get image description from OpenAI vision model
async function getImageDescription(imageUrls: any[], openai: OpenAI, userMessage: string = ""): Promise<string> {
    try {
        const textPrompt = userMessage || "Please describe what you see in this image.";

        const visionCompletion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: 'Respond to the user\'s request about the image(s). If they ask a specific question, answer it. If they just want a description, describe what you see in a clear and concise way.'
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: "text",
                            text: textPrompt
                        },
                        ...imageUrls
                    ]
                }
            ],
            max_completion_tokens: 300
        });

        return visionCompletion.choices?.[0]?.message?.content || 'Unable to describe image.';
    } catch (error) {
        console.error('Error getting image description:', error);
        return 'Image description unavailable.';
    }
}

// Function to initialize or update message history for a channel
async function initializeChannelHistory(channelId: string, channel: any) {
    if (!channelMessageHistory.has(channelId)) {
        // Fetch initial message history
        const messages = await channel.messages.fetch({ limit: MAX_HISTORY_SIZE });
        const messageArray = Array.from(messages.values())
            .filter((msg: any) => !excludedMessageIds.has(msg.id))
            .reverse(); // Chronological order
        channelMessageHistory.set(channelId, messageArray);
    }
}

// Function to add a new message to the channel history
function addMessageToHistory(channelId: string, message: any) {
    // Don't add if message is flagged
    if (excludedMessageIds.has(message.id)) {
        return;
    }

    const history = channelMessageHistory.get(channelId) || [];
    history.push(message);

    // Keep only the latest MAX_HISTORY_SIZE messages
    if (history.length > MAX_HISTORY_SIZE) {
        history.shift();
    }

    channelMessageHistory.set(channelId, history);
}

export default async function AI(client: any, message: any, botReply: any = null) {
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

    // Skip voice messages - let AIVoice.ts handle them
    const hasVoiceAttachment = message.attachments.some((attachment: any) =>
        attachment.contentType?.startsWith('audio/') ||
        attachment.name?.match(/\.(mp3|wav|ogg|m4a|webm|mp4)$/i)
    );

    if (hasVoiceAttachment) {
        return;
    }

    // Check if this message should be suppressed due to media response context
    if (shouldSuppressAIForMediaResponse(message, client.user.id)) {
        return;
    }

    // Respond if mentioned in guild OR if it's a DM (and not from a bot)
    if (((message.mentions.has(client.user) && message.guild) || message.channel.type === 1) && !message.author.bot) {
        // Initialize or update message history for this channel
        await initializeChannelHistory(message.channel.id, message.channel);

        // Add the current message to history (it will be filtered out if flagged later)
        addMessageToHistory(message.channel.id, message);

        // Show that we're typing
        await message.channel.sendTyping();

        // Get message history from our cache
        const messages = channelMessageHistory.get(message.channel.id) || [];

        // Initialize OpenAI client early so we can use it for image descriptions
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        // Process messages and handle images by getting descriptions
        const chatHistory = [];
        for (const msg of messages.filter((msg: any) => !excludedMessageIds.has(msg.id))) {
            // For DMs, there's no member, so just use author info
            const displayName = message.guild
                ? (msg.member?.nickname || msg.author.username)
                : msg.author.username;

            // Check if this message has images
            const messageHasImages = hasImageAttachments(msg);

            if (messageHasImages) {
                // Get image description instead of including raw images
                const imageUrls = processImageAttachments(msg);
                const imageDescription = await getImageDescription(imageUrls, openai, msg.content);

                const response = JSON.stringify({
                    content: msg.content + (msg.content ? '\n\n' : '') + `[Image: ${imageDescription}]`,
                    author: displayName,
                    time: msg.createdTimestamp
                });

                chatHistory.push({
                    role: 'user' as const,
                    content: response
                });
            } else {
                // For text-only messages, use the original format
                const response = JSON.stringify({
                    content: msg.content,
                    author: displayName,
                    time: msg.createdTimestamp
                });

                chatHistory.push({
                    role: 'user' as const,
                    content: response
                });
            }
        }

        // Add the systemPrompt as the first message with user memories
        const userMemories = database.getUserMemories(message.author.id);
        const systemPromptWithMemories = await generateSystemPromptWithMemories(userMemories);

        chatHistory.unshift({
            role: 'system' as const,
            content: systemPromptWithMemories
        });

        try {
            // Check if the current message has images for immediate processing
            const currentMessageHasImages = hasImageAttachments(message);

            if (currentMessageHasImages) {
                // Process the current message with images for immediate response
                const imageUrls = processImageAttachments(message);
                const imageDescription = await getImageDescription(imageUrls, openai, message.content);

                // Add current message with image description to chat history
                const displayName = message.guild
                    ? (message.member?.nickname || message.author.username)
                    : message.author.username;

                const currentMessageContent = JSON.stringify({
                    content: message.content + (message.content ? '\n\n' : '') + `[Image: ${imageDescription}]`,
                    author: displayName,
                    time: message.createdTimestamp
                });

                chatHistory.push({
                    role: 'user' as const,
                    content: currentMessageContent
                });
            }

            // Perform content moderation if needed
            const content = chatHistory.map((chat: any) => chat.content).join('\n');

            let isFlagged = false;

            if (Config.openai_moderation_model) {
                try {
                    const moderationResult = await openai.moderations.create({
                        model: Config.openai_moderation_model,
                        input: content
                    });

                    isFlagged = moderationResult.results?.[0]?.categories['self-harm'] ||
                        moderationResult.results?.[0]?.categories['sexual/minors'] ||
                        moderationResult.results?.[0]?.categories['self-harm/intent'] ||
                        moderationResult.results?.[0]?.categories['self-harm/instructions'] ||
                        moderationResult.results?.[0]?.categories['violence'] || false;
                } catch (error) {
                    console.error('Error with OpenAI moderation:', error);
                    isFlagged = false; // Default to not flagged if there's an error
                }
            }

            if (isFlagged) {
                // If the content is flagged, add the current message ID to the excludedMessageIds list
                excludedMessageIds.add(message.id);

                // Remove the flagged message from our history cache
                const history = channelMessageHistory.get(message.channel.id) || [];
                const filteredHistory = history.filter((msg: any) => msg.id !== message.id);
                channelMessageHistory.set(message.channel.id, filteredHistory);

                // Reply with an error message and exit
                await message.reply('Your message contains content that is not allowed.');
                return;
            }

            // Load tools for this request
            const { tools, toolExecutors } = await loadTools('./tools');

            // Generate response using OpenAI with tools (with embeds)
            const result = await processWithToolsEmbed(openai, chatHistory, message, client, tools, toolExecutors);

            // Replace <@name> and @name with proper <@id>
            const formattedReply = await replaceMentionsWithIds(result.content || '', message.guild);

            // Split the reply into chunks if necessary
            const chunks = splitMessageIntoChunks(formattedReply);

            if (botReply) {
                // If botReply is defined, edit the existing bot message
                const replyOptions: any = { content: chunks[0] };
                if (result.embeds && result.embeds.length > 0) {
                    replyOptions.embeds = result.embeds;
                }
                await botReply.edit(replyOptions);

                for (let i = 1; i < chunks.length; i++) {
                    const additionalReply = await message.channel.send(chunks[i]);
                    // Add bot replies to history as well
                    addMessageToHistory(message.channel.id, additionalReply);
                }
            } else {
                // Otherwise, send a new reply and store it in the cache
                const replyOptions: any = { content: chunks[0] };
                if (result.embeds && result.embeds.length > 0) {
                    replyOptions.embeds = result.embeds;
                }
                const replyMessage = await message.reply(replyOptions);
                replyCache.set(message.id, replyMessage); // Cache the user message ID and bot reply message
                // Add the bot reply to history
                addMessageToHistory(message.channel.id, replyMessage);

                // Handle memory messages - add reactions and track them
                if (result.memoryMessages && result.memoryMessages.length > 0) {
                    for (const memoryMessage of result.memoryMessages) {
                        // Add the memory message to database for tracking
                        database.addMemoryMessage(replyMessage.id, message.author.id, memoryMessage.memoryKeys);
                        // Add the ❌ reaction for removal
                        await replyMessage.react('❌');
                    }
                }

                for (let i = 1; i < chunks.length; i++) {
                    const additionalReply = await message.channel.send(chunks[i]);
                    // Add bot replies to history as well
                    addMessageToHistory(message.channel.id, additionalReply);
                }
            }

        } catch (error) {
            console.error('Error while processing message:', error);
            if (botReply) {
                await botReply.edit('There was an error processing your request.');
            } else {
                await message.reply('There was an error processing your request.');
            }
        }
    } else {
        // Even if we're not responding, add non-bot messages to history for context
        if (!message.author.bot && !hasVoiceAttachment) {
            // Initialize history if needed
            await initializeChannelHistory(message.channel.id, message.channel);
            // Add the message to history
            addMessageToHistory(message.channel.id, message);
        }
    }
}

// Function to replace mentions with proper <@id> format
async function replaceMentionsWithIds(reply: any, guild: any) {
    // Skip mention replacement for DMs since there's no guild
    if (!guild) {
        return reply;
    }

    // Regex to find all instances of <@name> and @name
    const mentionRegex = /<@(\w+)>|@(\w+)/g;
    let matches;

    // Replace the matches
    while ((matches = mentionRegex.exec(reply)) !== null) {
        const username = matches[1] || matches[2];

        // Try to find a member by nickname or username
        const member = guild.members.cache.find((m: any) =>
            m.user.username.toLowerCase() === username.toLowerCase() ||
            (m.nickname && m.nickname.toLowerCase() === username.toLowerCase())
        );

        if (member) {
            // Replace the mention with the proper <@id> format
            reply = reply.replace(matches[0], `<@${member.user.id}>`);
        }
    }

    return reply;
}

// Export the replyCache so that it can be accessed by other parts of the bot
export { replyCache, excludedMessageIds, channelMessageHistory, addMessageToHistory };
