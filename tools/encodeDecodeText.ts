import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'encode_decode_text',
    description: 'Encode or decode text using various methods like Base64, URL encoding, etc.',
    parameters: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "The text to encode or decode"
            },
            method: {
                type: "string",
                enum: ["base64_encode", "base64_decode", "url_encode", "url_decode", "hex_encode", "hex_decode"],
                description: "The encoding/decoding method to use"
            }
        },
        required: ["text", "method"]
    },
    systemPrompt: 'Use the encode_decode_text tool to help users encode or decode text using various methods like Base64, URL encoding, and hexadecimal.'
};

export default async function encodeDecodeText(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { text, method } = args;

        if (useEmbed) {
            const embedResult = new EmbedBuilder()
                .setTitle('🔐 Text Encoder/Decoder')
                .setColor(0xFF6B35)
                .setTimestamp();

            let result = '';
            let operation = '';

            switch (method) {
                case "base64_encode":
                    result = Buffer.from(text).toString('base64');
                    operation = 'Base64 Encode';
                    break;

                case "base64_decode":
                    result = Buffer.from(text, 'base64').toString('utf8');
                    operation = 'Base64 Decode';
                    break;

                case "url_encode":
                    result = encodeURIComponent(text);
                    operation = 'URL Encode';
                    break;

                case "url_decode":
                    result = decodeURIComponent(text);
                    operation = 'URL Decode';
                    break;

                case "hex_encode":
                    result = Buffer.from(text).toString('hex');
                    operation = 'Hex Encode';
                    break;

                case "hex_decode":
                    result = Buffer.from(text, 'hex').toString('utf8');
                    operation = 'Hex Decode';
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
        } else {
            switch (method) {
                case "base64_encode":
                    return `Base64 encoded: ${Buffer.from(text).toString('base64')}`;

                case "base64_decode":
                    return `Base64 decoded: ${Buffer.from(text, 'base64').toString('utf8')}`;

                case "url_encode":
                    return `URL encoded: ${encodeURIComponent(text)}`;

                case "url_decode":
                    return `URL decoded: ${decodeURIComponent(text)}`;

                case "hex_encode":
                    return `Hex encoded: ${Buffer.from(text).toString('hex')}`;

                case "hex_decode":
                    return `Hex decoded: ${Buffer.from(text, 'hex').toString('utf8')}`;

                default:
                    return "Invalid encoding/decoding method";
            }
        }
    } catch (error) {
        if (useEmbed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Encoder/Decoder Error')
                .setColor(0xFF0000)
                .setDescription(`Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
