import moment from 'moment';
import { REST, Routes } from 'discord.js';
import { Config } from './config.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { AttachmentBuilder } from 'discord.js';
import OpenAI from 'openai';
import { execSync } from 'child_process';

// Global tools cache to avoid reloading
let globalToolsCache: {
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolExecutors: Map<string, Function>,
    systemPrompts: string[]
} | null = null;

// Media Response Tracking System - Generalized solution for preventing AI responses to media bot replies
interface MediaResponseData {
    type: string;           // 'instagram', 'tiktok', 'reddit', etc.
    timestamp: number;      // When the bot replied
    channelId: string;      // Channel where it happened
    originalMessageId?: string; // The user message that triggered the media processing
}

const mediaResponseCache = new Map<string, MediaResponseData>(); // botMessageId -> data
const MEDIA_RESPONSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Mark a bot message as a media processing response to prevent AI from responding to replies
 * @param botMessageId - The ID of the bot's reply message
 * @param type - Type of media processing ('instagram', 'tiktok', etc.)
 * @param channelId - Channel ID where this happened
 * @param originalMessageId - Optional: the user message that triggered the processing
 */
export function markMediaResponse(botMessageId: string, type: string, channelId: string, originalMessageId?: string) {
    mediaResponseCache.set(botMessageId, {
        type,
        timestamp: Date.now(),
        channelId,
        originalMessageId
    });
}

/**
 * Check if a user message is replying to a tracked media response
 * @param message - The user message to check
 * @param clientId - The bot's user ID to check for explicit mentions
 * @returns true if this is a reply to media content and AI should be suppressed
 */
export function shouldSuppressAIForMediaResponse(message: any, clientId: string): boolean {
    // Check if this message is a direct reply to a tracked media response
    if (message.reference?.messageId) {
        const referencedMessageId = message.reference.messageId;

        if (mediaResponseCache.has(referencedMessageId)) {
            const mediaData = mediaResponseCache.get(referencedMessageId)!;
            return true;
        }
    }

    // Check if the user explicitly mentioned the bot in the message content (not just Discord reply mentions)
    const explicitMention = message.content.includes(`<@${clientId}>`) || message.content.includes(`<@!${clientId}>`);
    if (explicitMention) {
        return false; // Allow AI if user explicitly typed @BotName
    }

    // Check for recent media responses in the same channel (for non-reply messages)
    const recentCutoff = Date.now() - (2 * 60 * 1000); // 2 minutes
    for (const [botMessageId, mediaData] of mediaResponseCache.entries()) {
        if (mediaData.channelId === message.channel.id &&
            mediaData.timestamp > recentCutoff) {
            return true;
        }
    }

    return false;
}

/**
 * Clean up old media response tracking entries to prevent memory leaks
 */
export function cleanupMediaResponseCache() {
    const cutoff = Date.now() - MEDIA_RESPONSE_TIMEOUT;
    let cleaned = 0;

    for (const [botMessageId, mediaData] of mediaResponseCache.entries()) {
        if (mediaData.timestamp < cutoff) {
            mediaResponseCache.delete(botMessageId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old media response entries`);
    }
}

/**
 * Get current media response cache stats (for debugging)
 */
export function getMediaResponseStats() {
    const stats = new Map<string, number>();
    for (const mediaData of mediaResponseCache.values()) {
        stats.set(mediaData.type, (stats.get(mediaData.type) || 0) + 1);
    }
    return {
        total: mediaResponseCache.size,
        byType: Object.fromEntries(stats.entries())
    };
}

// Function to log messages to the terminal with timestamp and context
export const logMessageToTerminal = (message: any) => {
    const timestamp = chalk.green(moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'));
    const authorName = chalk.cyan(message.member ? message.member.displayName : message.author.username);
    const originalAuthorName = chalk.cyan(message.author.username);
    const serverName = chalk.magenta(message.guild ? message.guild.name : 'DM');
    const channelName = chalk.yellow(message.channel.name || 'DM');
    // Convert IDs in the message content to names
    let content = message.content.replace(/<@!?(.*?)>/g, (match: string, id: string) => {
        if (message.guild) {
            const user = message.guild.members.cache.get(id);
            return user ? `@${user.displayName}` : match;
        } else {
            // In DMs, just return the original match since we can't resolve guild members
            return match;
        }
    });
    const logMessage = `${timestamp} / ${authorName} (${originalAuthorName}) / #${channelName} / ${serverName}: ${chalk.white(content)}`;
    console.log(logMessage);
};

// Function to split long messages into chunks of up to 2000 characters
export const splitMessageIntoChunks = (message, chunkSize = 2000) => {
    const chunks: string[] = [];
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

// Function to register all slash commands at once
export async function registerAllSlashCommands(commands) {
    const rest = new REST({ version: '10' }).setToken(Config.token);

    console.log(`Registering ${commands.length} slash commands...`);

    try {
        await rest.put(Routes.applicationCommands(Config.clientId), { body: commands });
        console.log(`Successfully registered ${commands.length} slash commands.`);
    } catch (error) {
        console.error('Failed to register slash commands:', error);
        throw error;
    }
}

// Function to dynamically load plugins
export async function loadPlugins(pluginDirectory, pluginList, type = '') {
    const pluginPath = path.resolve(pluginDirectory);
    const files = fs.readdirSync(pluginPath);
    const commands: any[] = [];

    for (const file of files) {
        console.log('Loading plugin: ' + file);
        const { default: handler, command } = await import(path.join(pluginPath, file));
        if (command) {
            commands.push(command);
        }
        if (type === 'interaction') {
            pluginList.push(handler);
        }
        if (type === 'message') {
            pluginList.push(handler);
        }
    }

    // Register all commands at once for interaction plugins
    if (type === 'interaction' && commands.length > 0) {
        await registerAllSlashCommands(commands);
    }
}

// Function to dynamically load tasks
export async function loadTasks(taskDirectory, taskMap) {
    const taskPath = path.resolve(taskDirectory);
    const files = fs.readdirSync(taskPath);

    for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
            try {
                const { default: task } = await import(path.join(taskPath, file));
                if (task && task.name && task.execute) {
                    taskMap.set(task.name, task);
                } else {
                    console.warn(`Task ${file} is missing required properties (name, execute)`);
                }
            } catch (error) {
                console.error(`Failed to load task ${file}:`, error);
            }
        }
    }
}

// Function to dynamically load tools
export async function loadTools(toolDirectory: string): Promise<{
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolExecutors: Map<string, Function>,
    systemPrompts: string[]
}> {
    // Check global cache first
    if (globalToolsCache) {
        return globalToolsCache;
    }

    const toolPath = path.resolve(toolDirectory);
    const files = fs.readdirSync(toolPath);

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
    const toolExecutors = new Map<string, Function>();
    const systemPrompts: string[] = [];

    for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
            try {
                console.log('Loading tool: ' + file);
                const { default: handler, tool } = await import(path.join(toolPath, file));

                if (tool && handler) {
                    // Create OpenAI tool definition
                    const openAITool: OpenAI.Chat.Completions.ChatCompletionTool = {
                        type: "function",
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.parameters
                        }
                    };

                    tools.push(openAITool);
                    toolExecutors.set(tool.name, handler);

                    if (tool.systemPrompt) {
                        systemPrompts.push(tool.systemPrompt);
                    }
                } else {
                    console.warn(`Tool ${file} is missing required exports (tool config or default function)`);
                }
            } catch (error) {
                console.error(`Failed to load tool ${file}:`, error);
            }
        }
    }

    // Update global cache
    globalToolsCache = { tools, toolExecutors, systemPrompts };

    console.log(`Loaded ${tools.length} tools successfully`);
    return { tools, toolExecutors, systemPrompts };
}

export async function resolveIdToUser(client, userId) {
    try {
        return await client.users.fetch(userId);
    } catch (error) {
        console.error(`Failed to fetch user with ID ${userId}: ${error.message}`);
        return null;
    }
}

// Voice helper functions - shared between AIVoice.ts and Voice.ts

// Function to select a consistent voice for each author
export function selectVoiceForAuthor(authorId: string): string {
    // Available female voices from OpenAI TTS
    const femaleVoices = ['nova'];

    // Convert author ID to a number and use modulo to get consistent voice
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) {
        hash = ((hash << 5) - hash + authorId.charCodeAt(i)) & 0xffffffff;
    }

    // Use absolute value and modulo to select voice
    const voiceIndex = Math.abs(hash) % femaleVoices.length;
    return femaleVoices[voiceIndex];
}

// Function to get audio duration (approximate)
export function getAudioDuration(filePath: string): number {
    try {
        // Try to get duration using ffprobe if available
        const output = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return Math.ceil(parseFloat(output.trim()));
    } catch (error) {
        // Fallback: estimate based on file size (very rough estimate)
        const stats = fs.statSync(filePath);
        return Math.ceil(stats.size / 8000); // Rough estimate: 8KB per second for opus
    }
}

// Function to generate a simple waveform (base64 encoded byte array)
export function generateSimpleWaveform(): string {
    // Generate a simple random waveform pattern
    const waveformData = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        // Create a wave-like pattern
        waveformData[i] = Math.floor(128 + 100 * Math.sin(i * 0.1) * Math.random());
    }
    return Buffer.from(waveformData).toString('base64');
}

// Function to send Discord voice message using Discord API
export async function sendDiscordVoiceMessage(oggFilePath: string, channelId: string, botToken: string): Promise<boolean> {
    try {
        const fileStats = fs.statSync(oggFilePath);
        const fileSize = fileStats.size;
        const duration = getAudioDuration(oggFilePath);
        const waveform = generateSimpleWaveform();

        // Step 1: Request upload URL
        const attachmentResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/attachments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bot ${botToken}`
            },
            body: JSON.stringify({
                files: [{
                    filename: 'voice-message.ogg',
                    file_size: fileSize,
                    id: '2'
                }]
            })
        });

        if (!attachmentResponse.ok) {
            console.error('Failed to get upload URL:', await attachmentResponse.text());
            return false;
        }

        const attachmentData = await attachmentResponse.json();
        const uploadUrl = attachmentData.attachments[0].upload_url;
        const uploadFilename = attachmentData.attachments[0].upload_filename;

        // Step 2: Upload the OGG file
        const fileData = fs.readFileSync(oggFilePath);
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'audio/ogg'
            },
            body: fileData
        });

        if (!uploadResponse.ok) {
            console.error('Failed to upload voice file:', await uploadResponse.text());
            return false;
        }

        // Step 3: Send the voice message
        const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bot ${botToken}`
            },
            body: JSON.stringify({
                flags: 8192, // IS_VOICE_MESSAGE flag
                attachments: [{
                    id: '0',
                    filename: 'voice-message.ogg',
                    uploaded_filename: uploadFilename,
                    duration_secs: duration,
                    waveform: waveform
                }]
            })
        });

        if (!messageResponse.ok) {
            console.error('Failed to send voice message:', await messageResponse.text());
            return false;
        }

        return true;

    } catch (error) {
        console.error('Error sending Discord voice message:', error);
        return false;
    }
}

// Function to generate voice response with tool support
export async function generateVoiceResponse(
    openai: OpenAI,
    inputText: string,
    authorId: string,
    displayName: string,
    language: string = 'en',
    useTools: boolean = true,
    message: any = null,
    client: any = null
): Promise<string> {
    const languageNames: { [key: string]: string } = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
    };

    const languageName = languageNames[language] || 'English';    if (useTools && message && client) {
        // Use cached tools if available, otherwise load them
        const { tools, toolExecutors } = globalToolsCache || await loadTools('./tools');
        const systemPrompt = await generateSystemPrompt('./tools');

        // Use tool calling with proper chat history
        const chatHistory = [
            {
                role: 'system' as const,
                content: `${systemPrompt}\n\nNote: Respond in ${languageName}. Keep your response conversational and natural for speech.`
            },
            {
                role: 'user' as const,
                content: inputText + `\n\nNote: Message sent by ${displayName}.`
            }
        ];

        return await processWithTools(openai, chatHistory, message, client, tools, toolExecutors);
    } else {
        // Simple response without tools (for slash commands)
        const systemPrompt = await generateSystemPrompt('./tools');
        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: `${systemPrompt}\n\nNote: Respond in ${languageName}. Keep your response conversational and natural for speech.`
                },
                {
                    role: 'user',
                    content: inputText + `\n\nNote: Message sent by ${displayName}.`
                }
            ]
        });

        return completion.choices?.[0]?.message?.content || 'No response received.';
    }
}

// Function to create speech from text and save as files
export async function createSpeechFiles(
    openai: OpenAI,
    text: string,
    authorId: string
): Promise<{ mp3Path: string; oggPath?: string }> {
    const selectedVoice = selectVoiceForAuthor(authorId);

    // Generate speech from the text response
    const speechResponse = await openai.audio.speech.create({
        model: Config.tts_model || "tts-1",
        voice: selectedVoice,
        input: text,
        response_format: "mp3"
    });

    // Save the MP3 audio response
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const mp3FilePath = path.join(tempDir, `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
    const mp3Buffer = Buffer.from(await speechResponse.arrayBuffer());
    fs.writeFileSync(mp3FilePath, mp3Buffer);

    // Convert to OGG if native voice messages are enabled
    let oggFilePath: string | undefined;
    if (Config.voice_native_messages) {
        try {
            oggFilePath = path.join(tempDir, `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.ogg`);
            execSync(`ffmpeg -i "${mp3FilePath}" -c:a libopus -b:a 64k "${oggFilePath}"`, { stdio: 'ignore' });
        } catch (ffmpegError) {
            console.warn('ffmpeg not available, falling back to regular audio attachment');
            oggFilePath = undefined;
        }
    }

    return { mp3Path: mp3FilePath, oggPath: oggFilePath };
}

// Function to handle voice response sending (either native voice message or attachment)
export async function sendVoiceResponse(
    mp3Path: string,
    oggPath: string | undefined,
    responseText: string,
    contextText: string,
    channelId: string,
    botToken: string,
    replyFunction: Function
): Promise<void> {
    try {
        if (oggPath && Config.voice_native_messages) {
            // Try to send as native Discord voice message
            const voiceMessageSent = await sendDiscordVoiceMessage(oggPath, channelId, botToken);

            if (voiceMessageSent) {
                // Send context message separately
                await replyFunction(contextText);
                return;
            }
        }

        // Fallback to audio attachment
        const audioAttachment = new AttachmentBuilder(mp3Path, {
            name: 'voice_response.mp3',
            description: 'AI voice response'
        });

        await replyFunction({
            content: `${contextText}\n\n💬 **Response:** ${responseText}`,
            files: [audioAttachment]
        });

    } finally {
        // Clean up files
        setTimeout(() => {
            if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
            if (oggPath && fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        }, 60000);
    }
}

// ===== MODULAR TOOL EXECUTION SYSTEM =====

// Smart embed detection function
function shouldUseEmbedForQuery(userMessage: string, toolName: string, args: any): boolean {
    const lowerMessage = userMessage.toLowerCase();

    // Conversational patterns that should use text responses
    const conversationalPatterns = [
        /how'?s?\s+the\s+weather/,
        /what'?s?\s+the\s+weather/,
        /gonna\s+be/,
        /going\s+to\s+be/,
        /will\s+it\s+be/,
        /between\s+\d+\s+and\s+\d+/,
        /from\s+\d+\s+to\s+\d+/,
        /tonight/,
        /today/,
        /tomorrow/,
        /this\s+(morning|afternoon|evening)/,
        /quick\s+/,
        /just\s+(tell|show)/,
        /what\s+time/,
        /when\s+is/,
        // Programming - quick questions
        /how\s+do\s+i\s+/,
        /what'?s?\s+the\s+difference/,
        /quick\s+(question|help)/
    ];

    // Formal patterns that should use embeds
    const formalPatterns = [
        /weather\s+report/,
        /forecast\s+for/,
        /detailed\s+weather/,
        /weather\s+data/,
        /show\s+me\s+.*\s+embed/,
        /display\s+.*\s+chart/,
        /weather\s+summary/,
        // Programming - complex patterns that benefit from embeds
        /code\s+review/,
        /debug\s+(this|my)/,
        /explain\s+.*\s+algorithm/,
        /help\s+me\s+(understand|with)/,
        /analyze\s+(this|my)\s+code/,
        /step\s+by\s+step/,
        /detailed\s+(explanation|analysis)/,
        /best\s+practices/,
        /optimize\s+(this|my)/,
        /refactor\s+(this|my)/
    ];

    // Check for formal patterns first
    for (const pattern of formalPatterns) {
        if (pattern.test(lowerMessage)) {
            return true;
        }
    }

    // Check for conversational patterns
    for (const pattern of conversationalPatterns) {
        if (pattern.test(lowerMessage)) {
            return false;
        }
    }

    // Tool-specific rules
    switch (toolName) {
        case "get_weather":
            // Time ranges are usually conversational
            if (args.time_period && (
                args.time_period.includes('between') ||
                args.time_period.includes('from') ||
                args.time_period.includes('to')
            )) {
                return false;
            }
            // Weekly forecasts work better as embeds
            if (args.time_period === 'this_week') {
                return true;
            }
            break;

        case "get_news":
            // Multiple articles work better as embeds
            if (!args.limit || args.limit > 3) {
                return true;
            }
            break;

        case "calculate":
            // Simple calculations can be text
            return false;

        case "get_current_time":
            // Time queries are usually conversational
            return false;

        case "get_programming_help":
            // Programming help always uses text format for better code formatting
            return false;

        case "get_channel_history":
            // History summaries work better as embeds for organization
            return true;
    }

    // Default: use text for conversational context, embeds for formal requests
    return false;
}

// Tool execution function for the modular system
export async function executeToolCall(
    toolCall: any,
    message: any,
    client: any,
    useEmbed: boolean = false,
    toolExecutors: Map<string, Function>
) {
    console.log(`Using tool: ${toolCall.function.name} with args: ${toolCall.function.arguments}`);
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    // Smart embed detection: Use text for conversational queries, embeds for formal requests
    const shouldUseEmbed = useEmbed && shouldUseEmbedForQuery(message.content, name, parsedArgs);

    try {
        // Get the tool executor from our modular system
        const toolExecutor = toolExecutors.get(name);
        if (!toolExecutor) {
            return `Unknown tool: ${name}`;
        }

        // Execute the tool with the modular system
        return await toolExecutor(parsedArgs, message, client, shouldUseEmbed);
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// Main function to handle tool calling with OpenAI (returns embeds when possible)
export async function processWithToolsEmbed(
    openai: OpenAI,
    chatHistory: any[],
    message: any,
    client: any,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolExecutors: Map<string, Function>
): Promise<{content?: string, embeds?: any[], memoryMessages?: { embed: any, memoryKeys: string[] }[]}> {
    // Generate response using OpenAI with tools
    const completion = await openai.chat.completions.create({
        model: Config.openai_model,
        messages: chatHistory,
        tools: tools,
        tool_choice: "auto"
    });

    const responseMessage = completion.choices?.[0]?.message;
    if (!responseMessage) {
        throw new Error('No response received from OpenAI');
    }

    // Check if the model wants to use tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add the assistant message with tool calls to the conversation
        chatHistory.push(responseMessage);

        const embeds: any[] = [];
        const memoryMessages: { embed: any, memoryKeys: string[] }[] = [];
        let hasEmbeds = false;

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
            const toolResult = await executeToolCall(toolCall, message, client, true, toolExecutors); // Use embed mode

            // Check if this is a memory learning result with special format
            if (toolCall.function.name === "learn_about_user" &&
                typeof toolResult === 'object' &&
                toolResult !== null &&
                'content' in toolResult &&
                'memoryKeys' in toolResult) {

                const memoryResult = toolResult as { content: any, memoryKeys: string[] };
                embeds.push(memoryResult.content);
                memoryMessages.push({ embed: memoryResult.content, memoryKeys: memoryResult.memoryKeys });
                hasEmbeds = true;

                // Add a summary to the conversation for the AI to reference
                chatHistory.push({
                    role: 'tool' as const,
                    content: `Tool executed successfully: ${toolCall.function.name}`,
                    tool_call_id: toolCall.id
                });
            } else if (toolResult && typeof toolResult === 'object' && 'data' in toolResult) {
                // This is an EmbedBuilder
                embeds.push(toolResult);
                hasEmbeds = true;

                // Provide a detailed summary for the AI based on the tool type
                let toolSummary = `Tool executed successfully: ${toolCall.function.name}`;

                if (toolCall.function.name === "get_news") {
                    toolSummary = `Found and displayed news articles in an embed. The news has been retrieved successfully and is shown to the user.`;
                } else if (toolCall.function.name === "get_weather") {
                    toolSummary = `Weather information retrieved and displayed in an embed format.`;
                } else if (toolCall.function.name === "convert_currency") {
                    toolSummary = `Currency conversion completed and displayed in an embed.`;
                } else if (toolCall.function.name === "get_current_time") {
                    toolSummary = `Current time information displayed in an embed.`;
                } else if (toolCall.function.name === "calculate") {
                    toolSummary = `Calculation completed and result displayed in an embed.`;
                } else if (toolCall.function.name === "get_discord_server_info") {
                    toolSummary = `Discord server information retrieved and displayed in an embed.`;
                } else if (toolCall.function.name === "generate_random") {
                    toolSummary = `Random data generated and displayed in an embed.`;
                } else if (toolCall.function.name === "encode_decode_text") {
                    toolSummary = `Text encoding/decoding completed and displayed in an embed.`;
                } else if (toolCall.function.name === "get_programming_help") {
                    const question = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments).question : 'programming question';
                    toolSummary = `Advanced programming assistance provided using specialized coding model. Topic: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}. This was a programming-related question requiring specialized model assistance.`;
                } else if (toolCall.function.name === "get_channel_history") {
                    toolSummary = `Channel history search completed successfully. The complete summary and details are displayed in the embed for the user.`;
                }

                // Add the tool summary to the conversation for the AI to reference
                chatHistory.push({
                    role: 'tool' as const,
                    content: toolSummary,
                    tool_call_id: toolCall.id
                });
            } else {
                // Add the text result to the conversation
                let contentToAdd = toolResult || 'Tool executed';

                // For programming help, ensure we preserve enough context for follow-up questions
                if (toolCall.function.name === "get_programming_help" && typeof toolResult === 'string') {
                    // Add a marker to help the AI recognize this was programming assistance
                    // Truncate very long responses but preserve key information
                    const maxLength = 4000; // Keep within reasonable token limits
                    if (toolResult.length > maxLength) {
                        contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult.substring(0, maxLength)}... [Response truncated - full programming assistance was provided to user]`;
                    } else {
                        contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult}`;
                    }
                }

                chatHistory.push({
                    role: 'tool' as const,
                    content: contentToAdd,
                    tool_call_id: toolCall.id
                });
            }
        }

        // If we have embeds, the tools have provided complete information - no need for additional AI response
        if (hasEmbeds) {
            const result: any = { embeds: embeds };
            if (memoryMessages.length > 0) {
                result.memoryMessages = memoryMessages;
            }
            return result;
        }

        // Only get a final response from the model if we don't have embeds (text-only tool responses)
        const finalCompletion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: chatHistory
        });

        const finalResponse = finalCompletion.choices?.[0]?.message?.content || 'No response received.';
        return { content: finalResponse };
    } else {
        // No tools used, regular response
        return { content: responseMessage.content || 'No response received.' };
    }
}

// Main function to handle tool calling with OpenAI
export async function processWithTools(
    openai: OpenAI,
    chatHistory: any[],
    message: any,
    client: any,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolExecutors: Map<string, Function>
): Promise<string> {
    // Generate response using OpenAI with tools
    const completion = await openai.chat.completions.create({
        model: Config.openai_model,
        messages: chatHistory,
        tools: tools,
        tool_choice: "auto"
    });

    const responseMessage = completion.choices?.[0]?.message;
    if (!responseMessage) {
        throw new Error('No response received from OpenAI');
    }

    // Check if the model wants to use tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add the assistant message with tool calls to the conversation
        chatHistory.push(responseMessage);

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
            const toolResult = await executeToolCall(toolCall, message, client, false, toolExecutors); // Use text mode

            // Add the tool result to the conversation
            let contentToAdd = (toolResult && typeof toolResult === 'object' && 'data' in toolResult) ? 'Tool executed successfully' : toolResult;

            // For programming help, ensure we preserve enough context for follow-up questions
            if (toolCall.function.name === "get_programming_help" && typeof toolResult === 'string') {
                // Add a marker to help the AI recognize this was programming assistance
                // Truncate very long responses but preserve key information
                const maxLength = 4000; // Keep within reasonable token limits
                if (toolResult.length > maxLength) {
                    contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult.substring(0, maxLength)}... [Response truncated - full programming assistance was provided to user]`;
                } else {
                    contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult}`;
                }
            }

            chatHistory.push({
                role: 'tool' as const,
                content: contentToAdd,
                tool_call_id: toolCall.id
            });
        }

        // Get the final response from the model after tool execution
        const finalCompletion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: chatHistory
        });

        return finalCompletion.choices?.[0]?.message?.content || 'No response received.';
    } else {
        // No tools used, regular response
        return responseMessage.content || 'No response received.';
    }
}

// Function to generate complete system prompt with tool information
export async function generateSystemPrompt(toolDirectory: string = './tools'): Promise<string> {
    // Use cached tools if available, otherwise load them
    const { tools, systemPrompts } = globalToolsCache || await loadTools(toolDirectory);

    let systemPrompt = Config.baseSystemPrompt;

    if (tools.length > 0) {
        systemPrompt += '\n\nYou have access to the following tools that you can use to help users:\n';

        // Generate tool descriptions from the loaded tools
        const toolDescriptions = tools.map(tool => {
            const name = tool.function.name.replace(/([A-Z])/g, ' $1').trim(); // Convert camelCase to readable
            const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
            return `- **${capitalizedName}**: ${tool.function.description}`;
        }).join('\n');

        systemPrompt += toolDescriptions;

        // Add any additional system prompts from individual tools
        if (systemPrompts.length > 0) {
            systemPrompt += '\n\n' + systemPrompts.join('\n');
        }
    }

    return systemPrompt;
}

// Function to generate system prompt with user memories
export async function generateSystemPromptWithMemories(userMemories: Array<{memory_key: string, memory_value: string}>, toolDirectory: string = './tools'): Promise<string> {
    let systemPrompt = await generateSystemPrompt(toolDirectory);

    if (userMemories.length > 0) {
        const memoryText = userMemories
            .map(memory => `${memory.memory_key}: ${memory.memory_value}`)
            .join(', ');
        systemPrompt += `\n\nWhat I remember about this user: ${memoryText}`;
    }

    return systemPrompt;
}
