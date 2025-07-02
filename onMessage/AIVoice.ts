import { Config } from '../config.js';
import { generateVoiceResponse, createSpeechFiles, sendVoiceResponse } from '../helper.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const voiceReplyCache = new Map(); // Store original user message ID and bot reply message ID
const excludedVoiceMessageIds = new Set(); // Store IDs of flagged voice messages
const voiceChatHistory = new Map(); // Store voice chat history per channel

export default async function AIVoice(client: any, message: any) {
    // Check if voice functionality is enabled
    if (!Config.voice_enabled) {
        return;
    }

    // Ignore certain channel_ids
    let ignoredChannelIds: string[] = Config.ignoredChannelIds || [];
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

    // Check if message has voice attachments and bot is mentioned or it's a DM
    const hasVoiceAttachment = message.attachments.some((attachment: any) =>
        attachment.contentType?.startsWith('audio/') ||
        attachment.name?.match(/\.(mp3|wav|ogg|m4a|webm|mp4)$/i)
    );

    const shouldRespond = hasVoiceAttachment && (
        message.channel.type === 1 && // Only DM channels
        !message.author.bot
    );

    if (!shouldRespond) {
        return;
    }

    try {
        // Show that we're typing
        await message.channel.sendTyping();

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        let transcribedText = '';

        // Process each voice attachment
        for (const attachment of message.attachments.values()) {
            if (attachment.contentType?.startsWith('audio/') ||
                attachment.name?.match(/\.(mp3|wav|ogg|m4a|webm|mp4)$/i)) {

                // Download the audio file
                const response = await fetch(attachment.url);
                const audioBuffer = await response.arrayBuffer();

                // Create temporary file
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const tempFilePath = path.join(tempDir, `voice_${Date.now()}_${attachment.name}`);
                fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer));

                try {
                    // Transcribe audio using OpenAI Whisper
                    const transcriptionOptions: any = {
                        file: fs.createReadStream(tempFilePath),
                        model: Config.voice_model || "whisper-1"
                    };

                    // Only specify language if it's not set to auto-detect
                    if (Config.voice_language && Config.voice_language !== "auto") {
                        transcriptionOptions.language = Config.voice_language;
                    }

                    const transcription = await openai.audio.transcriptions.create(transcriptionOptions);

                    transcribedText += transcription.text + ' ';
                } finally {
                    // Clean up temporary file
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            }
        }

        if (!transcribedText.trim()) {
            await message.reply('I couldn\'t understand the audio. Please try again with a clearer recording.');
            return;
        }

        // Get the proper display name (for DMs, just use username since there's no guild)
        let displayName;
        if (message.channel.type === 1) {
            // DM - just use username
            displayName = message.author.displayName || message.author.username;
        } else {
            // Guild message - get nickname
            const member = message.guild?.members.cache.get(message.author.id);
            displayName = member?.nickname || member?.displayName || message.author.displayName || message.author.username;
        }

        // Get or create chat history for this channel
        const channelId = message.channel.id;
        if (!voiceChatHistory.has(channelId)) {
            voiceChatHistory.set(channelId, []);
        }

        const chatHistory = voiceChatHistory.get(channelId);
        const currentTime = Date.now();

        // Clean up old messages (older than 30 minutes)
        const thirtyMinutesAgo = currentTime - (30 * 60 * 1000);
        let systemPrompt = null;

        // Keep system prompt separate
        if (chatHistory.length > 0 && chatHistory[0].role === 'system') {
            systemPrompt = chatHistory[0];
        }

        // Filter out old messages and system prompt
        const recentMessages = chatHistory.filter((msg: any, index: number) => {
            if (index === 0 && msg.role === 'system') return false; // Skip system prompt in filtering
            return msg.timestamp && msg.timestamp > thirtyMinutesAgo;
        });

        // Rebuild chat history with system prompt first, then recent messages
        chatHistory.length = 0; // Clear array

        // Add system prompt if it exists, or create new one
        if (!systemPrompt) {
            systemPrompt = {
                role: 'system' as const,
                content: Config.systemPrompt + '\n\nNote: You are responding to voice messages in a direct message conversation, so keep your responses conversational and natural for speech.',
                timestamp: currentTime
            };
        }
        chatHistory.push(systemPrompt);

        // Add recent messages back
        chatHistory.push(...recentMessages);

        // Add the current voice message to history with timestamp
        chatHistory.push({
            role: 'user' as const,
            content: `${transcribedText.trim()} \n\n Note: Message from ${displayName}`,
            timestamp: currentTime
        });

        // Keep only the last 10 messages + system prompt to prevent context from getting too long
        if (chatHistory.length > 11) {
            const systemMsg = chatHistory[0];
            chatHistory.splice(1, chatHistory.length - 11); // Keep system + last 10 messages
        }

        // Perform content moderation if needed
        let isFlagged = false;

        if (Config.openai_moderation_model) {
            try {
                const moderationResult = await openai.moderations.create({
                    model: Config.openai_moderation_model,
                    input: transcribedText.trim()
                });

                isFlagged = moderationResult.results?.[0]?.categories['self-harm'] ||
                    moderationResult.results?.[0]?.categories['sexual/minors'] ||
                    moderationResult.results?.[0]?.categories['self-harm/intent'] ||
                    moderationResult.results?.[0]?.categories['self-harm/instructions'] ||
                    moderationResult.results?.[0]?.categories['violence'] || false;
            } catch (error) {
                console.error('Error with OpenAI moderation:', error);
                isFlagged = false;
            }
        }

        if (isFlagged) {
            // If the content is flagged, remove the user message from history and add the message ID to the excludedVoiceMessageIds list
            chatHistory.pop(); // Remove the flagged user message
            voiceChatHistory.set(channelId, chatHistory);
            excludedVoiceMessageIds.add(message.id);
            await message.reply('Your voice message contains content that is not allowed.');
            return;
        }

        // Generate response using OpenAI with tools
        const mappedChatHistory = chatHistory.map((msg: any) => ({
            role: msg.role,
            content: msg.content
        }));

        const reply = await generateVoiceResponse(
            openai,
            transcribedText.trim(),
            message.author.id,
            displayName,
            'en', // Default to English for voice messages
            true, // Use tools for voice messages
            message,
            client
        );

        // Add the AI's response to the chat history
        chatHistory.push({
            role: 'assistant' as const,
            content: reply,
            timestamp: Date.now()
        });

        // Update the stored chat history
        voiceChatHistory.set(channelId, chatHistory);

        // Create speech files
        const { mp3Path, oggPath } = await createSpeechFiles(openai, reply, message.author.id);

        // Create context text
        const contextText = `🎤 **Transcribed:** "${transcribedText.trim()}"`;

        // Send voice response
        await sendVoiceResponse(
            mp3Path,
            oggPath,
            reply,
            contextText,
            message.channel.id,
            client.token,
            async (content: any) => {
                const replyMessage = await message.reply(content);
                voiceReplyCache.set(message.id, replyMessage);
                return replyMessage;
            }
        );

    } catch (error) {
        console.error('Error while processing voice message:', error);
        await message.reply('There was an error processing your voice message. Please try again.');
    }
}

// Helper function to clear voice chat history for a channel
export function clearVoiceChatHistory(channelId: string): boolean {
    return voiceChatHistory.delete(channelId);
}

// Helper function to get voice chat history length for a channel
export function getVoiceChatHistoryLength(channelId: string): number {
    const history = voiceChatHistory.get(channelId);
    return history ? history.length : 0;
}

// Helper function to clean old messages from voice chat history (for manual cleanup)
export function cleanOldVoiceChatHistory(channelId: string, maxAgeMinutes: number = 30): number {
    const history = voiceChatHistory.get(channelId);
    if (!history) return 0;

    const maxAge = Date.now() - (maxAgeMinutes * 60 * 1000);
    const originalLength = history.length;

    // Keep system prompt and recent messages
    const systemPrompt = history[0]?.role === 'system' ? history[0] : null;
    const recentMessages = history.filter((msg: any, index: number) => {
        if (index === 0 && msg.role === 'system') return false;
        return msg.timestamp && msg.timestamp > maxAge;
    });

    history.length = 0;
    if (systemPrompt) history.push(systemPrompt);
    history.push(...recentMessages);

    return originalLength - history.length;
}

// Export the voiceReplyCache and voiceChatHistory so that they can be accessed by other parts of the bot
export { voiceReplyCache, voiceChatHistory };
