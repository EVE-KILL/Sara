import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Config } from '../config.js';
import { generateVoiceResponse, createSpeechFiles, sendVoiceResponse } from '../helper.js';
import OpenAI from 'openai';

const command = new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Convert text to voice message')
    .addStringOption(option =>
        option.setName('message')
            .setDescription('The text message to convert to voice')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('language')
            .setDescription('Language for the voice output')
            .setRequired(false)
            .addChoices(
                { name: 'English', value: 'en' },
                { name: 'Spanish', value: 'es' },
                { name: 'French', value: 'fr' },
                { name: 'German', value: 'de' },
                { name: 'Italian', value: 'it' },
                { name: 'Portuguese', value: 'pt' },
                { name: 'Russian', value: 'ru' },
                { name: 'Japanese', value: 'ja' },
                { name: 'Korean', value: 'ko' },
                { name: 'Chinese', value: 'zh' }
            )
    );

export default async function Voice(interaction: any, client: any) {
    if (interaction.commandName !== 'voice') return;

    // Check if voice functionality is enabled
    if (!Config.voice_enabled) {
        await interaction.reply({
            content: 'Voice functionality is currently disabled.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Ignore certain channel_ids
    let ignoredChannelIds: string[] = Config.ignoredChannelIds || [];
    if (ignoredChannelIds.includes(interaction.channel.id)) {
        await interaction.reply({
            content: 'Voice commands are not allowed in this channel.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Ignore certain guild_ids (only for guild messages)
    if (interaction.guild) {
        let ignoredGuildIds: string[] = Config.ignoredGuildIds || [];
        if (ignoredGuildIds.includes(interaction.guild.id)) {
            await interaction.reply({
                content: 'Voice commands are not allowed in this server.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

    const message = interaction.options.getString('message');
    const language = interaction.options.getString('language') || 'en';

    if (!message) {
        await interaction.reply({
            content: 'Please provide a message to convert to voice.'
        });
        return;
    }

    try {
        // Acknowledge the interaction
        await interaction.deferReply();

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        // Perform content moderation if needed
        let isFlagged = false;

        if (Config.openai_moderation_model) {
            try {
                const moderationResult = await openai.moderations.create({
                    model: Config.openai_moderation_model,
                    input: message
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
            await interaction.editReply('Your message contains content that is not allowed.');
            return;
        }

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

        // Get the proper display name
        let displayName;
        if (interaction.channel.type === 1) {
            // DM - just use username
            displayName = interaction.user.displayName || interaction.user.username;
        } else {
            // Guild message - get nickname
            const member = interaction.guild?.members.cache.get(interaction.user.id);
            displayName = member?.nickname || member?.displayName || interaction.user.displayName || interaction.user.username;
        }

        console.log(`🎤 Generating voice response in ${languageName} for user ${interaction.user.username}`);

        // Generate AI response with tool support
        // For slash commands, we can enable tools now that we have proper infrastructure
        const reply = await generateVoiceResponse(
            openai,
            message,
            interaction.user.id,
            displayName,
            language,
            true, // Enable tools for slash commands too!
            { // Create a mock message object for tool calls
                channel: interaction.channel,
                guild: interaction.guild,
                author: interaction.user
            },
            client
        );

        // Create speech files
        const { mp3Path, oggPath } = await createSpeechFiles(openai, reply, interaction.user.id);

        // Create context text
        const contextText = `🎤 **Your message:** "${message}"\n🌍 **Language:** ${languageName}`;

        // Send voice response
        await sendVoiceResponse(
            mp3Path,
            oggPath,
            reply,
            contextText,
            interaction.channel.id,
            client.token,
            (content: any) => interaction.editReply(content)
        );

    } catch (error) {
        console.error('Error while processing voice command:', error);
        await interaction.editReply('There was an error processing your voice command. Please try again.');
    }
}

export { command };
