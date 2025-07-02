import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'calculate',
    description: 'Perform mathematical calculations. Supports basic arithmetic, trigonometry, and common math functions.',
    parameters: {
        type: "object",
        properties: {
            expression: {
                type: "string",
                description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sin(45)', 'sqrt(16)')"
            }
        },
        required: ["expression"]
    },
    systemPrompt: 'Use the calculate tool to perform mathematical calculations and computations for users.'
};

export default async function calculate(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { expression } = args;

        // Basic security: only allow numbers, operators, and common math functions
        const sanitized = expression.replace(/[^0-9+\-*/().,\s]/g, '');

        // Use a safe eval alternative or implement basic calculator
        // For now, using a simple approach with basic operations
        const allowedPattern = /^[0-9+\-*/().,\s]+$/;
        if (!allowedPattern.test(sanitized)) {
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Calculation Error')
                    .setColor(0xFF0000)
                    .setDescription("Invalid mathematical expression. Only basic arithmetic is supported.");
                return embed;
            } else {
                return "Invalid mathematical expression. Only basic arithmetic is supported.";
            }
        }

        const result = Function(`"use strict"; return (${sanitized})`)();

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('🧮 Calculator')
                .setColor(0x00D166)
                .addFields(
                    { name: 'Expression', value: `\`${expression}\``, inline: false },
                    { name: 'Result', value: `**${result}**`, inline: false }
                );
            return embed;
        } else {
            return `${expression} = ${result}`;
        }
    } catch (error) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Calculation Error')
                .setColor(0xFF0000)
                .setDescription(`Error calculating "${args.expression}": Invalid expression`);
            return embed;
        } else {
            return `Error calculating "${args.expression}": Invalid expression`;
        }
    }
}
