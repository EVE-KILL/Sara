import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Perform mathematical calculations')
    .addStringOption(option =>
        option.setName('expression')
            .setDescription('Mathematical expression (e.g., 2+2, sqrt(16), sin(45))')
            .setRequired(true));

export default async function Calculate(interaction: any, client: any) {
    if (interaction.commandName !== 'calculate') return;

    try {
        const expression = interaction.options.getString('expression');
        const result = performCalculation(expression);

        await interaction.reply({
            embeds: [result],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in calculate command:', error);
        await interaction.reply({
            content: 'Sorry, there was an error performing the calculation.',
            flags: MessageFlags.Ephemeral
        });
    }
}

function performCalculation(expression: string): EmbedBuilder {
    try {
        // Basic security: only allow numbers, operators, and common math functions
        const sanitized = expression.replace(/[^0-9+\-*/().,\s]/g, '');

        // Use a safe eval alternative or implement basic calculator
        const allowedPattern = /^[0-9+\-*/().,\s]+$/;
        if (!allowedPattern.test(sanitized)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Calculation Error')
                .setColor(0xFF0000)
                .setDescription('Invalid expression. Only basic arithmetic operations are allowed.');
            return errorEmbed;
        }

        const result = Function(`"use strict"; return (${sanitized})`)();

        const embed = new EmbedBuilder()
            .setTitle('🔢 Calculator')
            .setColor(0x3498DB)
            .addFields(
                { name: 'Expression', value: `\`${expression}\``, inline: false },
                { name: 'Result', value: `**${result}**`, inline: false }
            )
            .setTimestamp();

        return embed;
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Calculation Error')
            .setColor(0xFF0000)
            .setDescription(`Error calculating expression: ${error instanceof Error ? error.message : 'Invalid expression'}`);
        return errorEmbed;
    }
}
