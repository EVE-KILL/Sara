import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { randomBytes } from 'crypto';

export const command = new SlashCommandBuilder()
    .setName('random')
    .setDescription('Generate random data')
    .addSubcommand(subcommand =>
        subcommand
            .setName('number')
            .setDescription('Generate a random number')
            .addIntegerOption(option =>
                option.setName('min')
                    .setDescription('Minimum value (default: 1)')
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('max')
                    .setDescription('Maximum value (default: 100)')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('password')
            .setDescription('Generate a secure password')
            .addIntegerOption(option =>
                option.setName('length')
                    .setDescription('Password length (default: 12)')
                    .setMinValue(4)
                    .setMaxValue(128)
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('uuid')
            .setDescription('Generate a UUID'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('dice')
            .setDescription('Roll dice')
            .addIntegerOption(option =>
                option.setName('sides')
                    .setDescription('Number of sides (default: 6)')
                    .setMinValue(2)
                    .setMaxValue(100)
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('count')
                    .setDescription('Number of dice to roll (default: 1)')
                    .setMinValue(1)
                    .setMaxValue(10)
                    .setRequired(false)));

export default async function Random(interaction: any, client: any) {
    if (interaction.commandName !== 'random') return;

    try {
        const subcommand = interaction.options.getSubcommand();
        let result: EmbedBuilder;

        switch (subcommand) {
            case 'number':
                const min = interaction.options.getInteger('min') ?? 1;
                const max = interaction.options.getInteger('max') ?? 100;
                result = generateRandomNumber(min, max);
                break;
            case 'password':
                const length = interaction.options.getInteger('length') ?? 12;
                result = generateRandomPassword(length);
                break;
            case 'uuid':
                result = generateRandomUUID();
                break;
            case 'dice':
                const sides = interaction.options.getInteger('sides') ?? 6;
                const count = interaction.options.getInteger('count') ?? 1;
                result = generateRandomDice(sides, count);
                break;
            default:
                result = new EmbedBuilder()
                    .setTitle('❌ Random Generator Error')
                    .setColor(0xFF0000)
                    .setDescription('Invalid random type requested');
        }

        await interaction.reply({
            embeds: [result],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in random command:', error);
        await interaction.reply({
            content: 'Sorry, there was an error generating random data.',
            flags: MessageFlags.Ephemeral
        });
    }
}

function generateRandomNumber(min: number, max: number): EmbedBuilder {
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

    return new EmbedBuilder()
        .setTitle('🎲 Random Number')
        .setColor(0x9932CC)
        .addFields(
            { name: 'Range', value: `${min} - ${max}`, inline: true },
            { name: 'Result', value: `**${randomNum}**`, inline: true }
        )
        .setTimestamp();
}

function generateRandomPassword(length: number): EmbedBuilder {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    return new EmbedBuilder()
        .setTitle('🔐 Random Password')
        .setColor(0x9932CC)
        .addFields(
            { name: 'Length', value: `${length} characters`, inline: true },
            { name: 'Password', value: `\`\`\`${password}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Keep this password secure!' })
        .setTimestamp();
}

function generateRandomUUID(): EmbedBuilder {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    return new EmbedBuilder()
        .setTitle('🆔 Random UUID')
        .setColor(0x9932CC)
        .addFields(
            { name: 'UUID', value: `\`\`\`${uuid}\`\`\``, inline: false }
        )
        .setTimestamp();
}

function generateRandomDice(sides: number, count: number): EmbedBuilder {
    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        total += roll;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Roll')
        .setColor(0x9932CC)
        .addFields(
            { name: 'Dice', value: `${count}d${sides}`, inline: true },
            { name: 'Rolls', value: rolls.join(', '), inline: true }
        )
        .setTimestamp();

    if (count > 1) {
        embed.addFields({ name: 'Total', value: `**${total}**`, inline: true });
    }

    return embed;
}
