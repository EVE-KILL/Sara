import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { database } from '../database.js';
import { Config } from '../config.js';
import OpenAI from 'openai';

export const command = new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Manage my memory about you')
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add something for me to remember about you')
            .addStringOption(option =>
                option.setName('information')
                    .setDescription('What would you like me to remember?')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Show everything I remember about you'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove a specific memory')
            .addStringOption(option =>
                option.setName('key')
                    .setDescription('The memory key to remove')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('clear')
            .setDescription('Clear all my memories about you'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('auto')
            .setDescription('Toggle automatic memory learning')
            .addBooleanOption(option =>
                option.setName('enabled')
                    .setDescription('Enable or disable automatic memory learning')
                    .setRequired(true)));

export default async function Memory(interaction: any, client: any) {
    if (interaction.commandName !== 'memory') return;

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
        switch (subcommand) {
            case 'add':
                await handleAddMemory(interaction, userId);
                break;

            case 'list':
                await handleListMemories(interaction, userId);
                break;

            case 'remove':
                await handleRemoveMemory(interaction, userId);
                break;

            case 'clear':
                await handleClearMemories(interaction, userId);
                break;

            case 'auto':
                await handleAutoMemory(interaction, userId);
                break;

            default:
                await interaction.reply({
                    content: '❌ Unknown memory command!',
                    flags: MessageFlags.Ephemeral
                });
        }
    } catch (error) {
        console.error('Error in memory command:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your memory command.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleAddMemory(interaction: any, userId: string) {
    const information = interaction.options.getString('information');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Use OpenAI to interpret the information and extract key-value pairs
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: `You are a memory interpreter. Your job is to take user information and convert it into structured key-value pairs for storage.

Extract meaningful information from the user's statement and format it as JSON with the following structure:
{
  "memories": [
    {
      "key": "descriptive_key_name",
      "value": "the actual value"
    }
  ]
}

Guidelines:
- Use clear, descriptive keys (e.g., "favorite_color", "location", "timezone", "occupation", "favorite_food", "hobbies", "language_preference", "news_preference")
- Keep values concise but informative
- Extract multiple pieces of information if present
- Use lowercase with underscores for keys
- If location is mentioned, try to be specific (city, country)

Examples:
"I live in Copenhagen, Denmark" → {"key": "location", "value": "Copenhagen, Denmark"}
"I like roses" → {"key": "favorite_flower", "value": "roses"}
"I'm a software developer and I love pizza" → [{"key": "occupation", "value": "software developer"}, {"key": "favorite_food", "value": "pizza"}]
"I prefer Danish news" → {"key": "news_preference", "value": "Danish"}

Only return the JSON, no other text.`
                },
                {
                    role: 'user',
                    content: information
                }
            ],
            temperature: 0.1
        });

        const responseText = completion.choices[0]?.message?.content?.trim();
        if (!responseText) {
            throw new Error('No response from AI');
        }

        const memoryData = JSON.parse(responseText);
        const memories = Array.isArray(memoryData.memories) ? memoryData.memories : [memoryData];

        let addedCount = 0;
        let addedMemories: string[] = [];

        for (const memory of memories) {
            if (memory.key && memory.value) {
                const success = database.addMemory(userId, memory.key, memory.value);
                if (success) {
                    addedCount++;
                    addedMemories.push(`**${memory.key}**: ${memory.value}`);
                }
            }
        }

        if (addedCount > 0) {
            const embed = new EmbedBuilder()
                .setTitle('🧠 Memory Updated!')
                .setColor(0x5865F2)
                .setDescription(`I've learned ${addedCount} new thing${addedCount > 1 ? 's' : ''} about you:`)
                .addFields({ name: 'Added to memory:', value: addedMemories.join('\n'), inline: false })
                .setFooter({ text: 'Use /memory list to see all your memories' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: '❌ I couldn\'t extract any meaningful information to remember from that.'
            });
        }

    } catch (error) {
        console.error('Error processing memory:', error);
        await interaction.editReply({
            content: '❌ I had trouble understanding that information. Please try rephrasing it.'
        });
    }
}

async function handleListMemories(interaction: any, userId: string) {
    const memories = database.getUserMemories(userId);

    if (memories.length === 0) {
        await interaction.reply({
            content: '🤔 I don\'t have any memories about you yet! Use `/memory add` to teach me about yourself.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🧠 My Memories About You')
        .setColor(0x5865F2)
        .setFooter({ text: `${memories.length} memory item${memories.length > 1 ? 's' : ''} stored` });

    const memoryFields: any[] = [];
    for (const memory of memories) {
        memoryFields.push({
            name: memory.memory_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: memory.memory_value,
            inline: true
        });
    }

    // Discord has a limit of 25 fields per embed
    if (memoryFields.length > 25) {
        embed.addFields(memoryFields.slice(0, 25));
        embed.setFooter({ text: `Showing first 25 of ${memories.length} memories` });
    } else {
        embed.addFields(memoryFields);
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleRemoveMemory(interaction: any, userId: string) {
    const memoryKey = interaction.options.getString('key');

    const success = database.deleteMemory(userId, memoryKey);

    if (success) {
        await interaction.reply({
            content: `✅ I've forgotten about your **${memoryKey.replace(/_/g, ' ')}**.`,
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: `❌ I don't have any memory with the key "${memoryKey}".`,
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleClearMemories(interaction: any, userId: string) {
    const memories = database.getUserMemories(userId);

    if (memories.length === 0) {
        await interaction.reply({
            content: '🤔 I don\'t have any memories about you to clear.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_clear_memory')
        .setLabel('Yes, clear all')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_clear_memory')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

    await interaction.reply({
        content: `⚠️ Are you sure you want me to forget everything I know about you? This will remove ${memories.length} memory item${memories.length > 1 ? 's' : ''}.`,
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    // Handle button interactions
    const filter = (buttonInteraction: any) => buttonInteraction.user.id === userId;
    const collector = interaction.channel?.createMessageComponentCollector({ filter, time: 15000 });

    if (collector) {
        collector.on('collect', async (buttonInteraction: any) => {
            if (buttonInteraction.customId === 'confirm_clear_memory') {
                const cleared = database.clearUserMemories(userId);
                if (cleared) {
                    await buttonInteraction.update({
                        content: '✅ I\'ve cleared all my memories about you.',
                        components: []
                    });
                } else {
                    await buttonInteraction.update({
                        content: '❌ Something went wrong while clearing your memories.',
                        components: []
                    });
                }
            } else if (buttonInteraction.customId === 'cancel_clear_memory') {
                await buttonInteraction.update({
                    content: '✅ Cancelled. Your memories are safe!',
                    components: []
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected: any) => {
            if (collected.size === 0) {
                await interaction.editReply({
                    content: '⏰ Confirmation timed out. Your memories are safe!',
                    components: []
                });
            }
        });
    }
}

async function handleAutoMemory(interaction: any, userId: string) {
    const enabled = interaction.options.getBoolean('enabled');

    const success = database.updateUserSettings(userId, enabled);

    if (success) {
        const status = enabled ? 'enabled' : 'disabled';
        const emoji = enabled ? '🧠' : '🚫';
        await interaction.reply({
            content: `${emoji} Automatic memory learning has been **${status}** for you.`,
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: '❌ Failed to update your memory settings.',
            flags: MessageFlags.Ephemeral
        });
    }
}
