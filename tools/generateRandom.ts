import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'generate_random',
    description: 'Generate random data like numbers, passwords, or UUIDs',
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["number", "password", "uuid", "dice"],
                description: "The type of random data to generate"
            },
            min: {
                type: "number",
                description: "Minimum value for random numbers or dice"
            },
            max: {
                type: "number",
                description: "Maximum value for random numbers or dice"
            },
            length: {
                type: "number",
                description: "Length for passwords (default: 12)"
            },
            sides: {
                type: "number",
                description: "Number of sides for dice (default: 6)"
            }
        },
        required: ["type"]
    },
    systemPrompt: 'Use the generate_random tool to create random numbers, secure passwords, UUIDs, or simulate dice rolls for users.'
};

export default async function generateRandom(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { type, min, max, length, sides } = args;

        if (useEmbed) {
            const embedResult = new EmbedBuilder()
                .setTitle('🎲 Random Generator')
                .setColor(0x9932CC)
                .setTimestamp();

            switch (type) {
                case "number":
                    const minVal = min || 1;
                    const maxVal = max || 100;
                    const randomNum = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
                    embedResult.addFields(
                        { name: 'Range', value: `${minVal} - ${maxVal}`, inline: true },
                        { name: 'Result', value: `**${randomNum}**`, inline: true }
                    );
                    break;

                case "password":
                    const passwordLength = length || 12;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                    let password = '';
                    for (let i = 0; i < passwordLength; i++) {
                        password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    embedResult.setTitle('🔐 Password Generator')
                        .addFields(
                            { name: 'Length', value: passwordLength.toString(), inline: true },
                            { name: 'Password', value: `||${password}||`, inline: false }
                        );
                    break;

                case "uuid":
                    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    embedResult.setTitle('🆔 UUID Generator')
                        .addFields({ name: 'Generated UUID', value: `\`${uuid}\``, inline: false });
                    break;

                case "dice":
                    const diceSides = sides || 6;
                    const diceRoll = Math.floor(Math.random() * diceSides) + 1;
                    embedResult.setTitle('🎲 Dice Roll')
                        .addFields(
                            { name: 'Die Type', value: `D${diceSides}`, inline: true },
                            { name: 'Result', value: `**${diceRoll}**`, inline: true }
                        );
                    break;

                default:
                    embedResult.setTitle('❌ Random Generator Error')
                        .setColor(0xFF0000)
                        .setDescription("Invalid random type requested");
            }

            return embedResult;
        } else {
            switch (type) {
                case "number":
                    const minVal = min || 1;
                    const maxVal = max || 100;
                    const randomNum = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
                    return `Random number between ${minVal} and ${maxVal}: ${randomNum}`;

                case "password":
                    const passwordLength = length || 12;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                    let password = '';
                    for (let i = 0; i < passwordLength; i++) {
                        password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return `Generated password (${passwordLength} characters): ||${password}||`;

                case "uuid":
                    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    return `Generated UUID: ${uuid}`;

                case "dice":
                    const diceSides = sides || 6;
                    const diceRoll = Math.floor(Math.random() * diceSides) + 1;
                    return `🎲 Rolled a ${diceSides}-sided die: ${diceRoll}`;

                default:
                    return "Invalid random type requested";
            }
        }
    } catch (error) {
        if (useEmbed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Random Generator Error')
                .setColor(0xFF0000)
                .setDescription(`Error generating random data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error generating random data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
