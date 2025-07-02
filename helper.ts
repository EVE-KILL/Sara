import moment from 'moment';
import { REST, Routes } from 'discord.js';
import { Config } from './config.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { AttachmentBuilder } from 'discord.js';
import OpenAI from 'openai';
import { execSync } from 'child_process';

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

    const languageName = languageNames[language] || 'English';

    if (useTools && message && client) {
        // Use tool calling with proper chat history
        const { processWithTools } = await import('./toolHelper.js');

        const chatHistory = [
            {
                role: 'system' as const,
                content: `${Config.systemPrompt}\n\nNote: Respond in ${languageName}. Keep your response conversational and natural for speech.`
            },
            {
                role: 'user' as const,
                content: inputText + `\n\nNote: Message sent by ${displayName}.`
            }
        ];

        return await processWithTools(openai, chatHistory, message, client);
    } else {
        // Simple response without tools (for slash commands)
        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: `${Config.systemPrompt}\n\nNote: Respond in ${languageName}. Keep your response conversational and natural for speech.`
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
