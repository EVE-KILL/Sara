import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('encode')
    .setDescription('Encode or decode text using various methods')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Text to encode or decode')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('method')
            .setDescription('Encoding/decoding method')
            .addChoices(
                { name: 'Base64 Encode', value: 'base64_encode' },
                { name: 'Base64 Decode', value: 'base64_decode' },
                { name: 'URL Encode', value: 'url_encode' },
                { name: 'URL Decode', value: 'url_decode' },
                { name: 'Hex Encode', value: 'hex_encode' },
                { name: 'Hex Decode', value: 'hex_decode' }
            )
            .setRequired(true));

export default async function Encode(interaction: any, client: any) {
    if (interaction.commandName !== 'encode') return;

    try {
        const text = interaction.options.getString('text');
        const method = interaction.options.getString('method');

        const result = encodeDecodeText(text, method);

        await interaction.reply({
            embeds: [result],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in encode command:', error);
        await interaction.reply({
            content: 'Sorry, there was an error processing the text.',
            flags: MessageFlags.Ephemeral
        });
    }
}

function encodeDecodeText(text: string, method: string): EmbedBuilder {
    try {
        const embedResult = new EmbedBuilder()
            .setTitle('🔐 Text Encoder/Decoder')
            .setColor(0xFF6B35)
            .setTimestamp();

        let result = '';
        let operation = '';

        switch (method) {
            case "base64_encode":
                result = Buffer.from(text, 'utf8').toString('base64');
                operation = 'Base64 Encoded';
                break;
            case "base64_decode":
                try {
                    result = Buffer.from(text, 'base64').toString('utf8');
                    operation = 'Base64 Decoded';
                } catch {
                    throw new Error('Invalid Base64 input');
                }
                break;
            case "url_encode":
                result = encodeURIComponent(text);
                operation = 'URL Encoded';
                break;
            case "url_decode":
                try {
                    result = decodeURIComponent(text);
                    operation = 'URL Decoded';
                } catch {
                    throw new Error('Invalid URL encoded input');
                }
                break;
            case "hex_encode":
                result = Buffer.from(text, 'utf8').toString('hex');
                operation = 'Hex Encoded';
                break;
            case "hex_decode":
                try {
                    result = Buffer.from(text, 'hex').toString('utf8');
                    operation = 'Hex Decoded';
                } catch {
                    throw new Error('Invalid hexadecimal input');
                }
                break;
            default:
                embedResult.setTitle('❌ Encoder/Decoder Error')
                    .setColor(0xFF0000)
                    .setDescription("Invalid encoding/decoding method");
                return embedResult;
        }

        embedResult.addFields(
            { name: 'Operation', value: operation, inline: true },
            { name: 'Input', value: `\`\`\`${text.substring(0, 1000)}\`\`\``, inline: false },
            { name: 'Output', value: `\`\`\`${result.substring(0, 1000)}\`\`\``, inline: false }
        );

        if (result.length > 1000) {
            embedResult.setFooter({ text: 'Output truncated - result is longer than 1000 characters' });
        }

        return embedResult;
    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Encoder/Decoder Error')
            .setColor(0xFF0000)
            .setDescription(`Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return errorEmbed;
    }
}
