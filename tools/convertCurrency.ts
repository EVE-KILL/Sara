import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'convert_currency',
    description: 'Convert between different currencies with real-time exchange rates',
    parameters: {
        type: "object",
        properties: {
            amount: {
                type: "number",
                description: "The amount to convert"
            },
            from_currency: {
                type: "string",
                description: "Source currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')"
            },
            to_currency: {
                type: "string",
                description: "Target currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')"
            }
        },
        required: ["amount", "from_currency", "to_currency"]
    },
    systemPrompt: 'Use the convert_currency tool to help users convert between different currencies using real-time exchange rates.'
};

export default async function convertCurrency(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { amount, from_currency, to_currency } = args;

        // Use a free exchange rate API (example: exchangerate-api.com)
        const apiUrl = `https://api.exchangerate-api.com/v4/latest/${from_currency.toUpperCase()}`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }

        const data = await response.json();
        const exchangeRate = data.rates[to_currency.toUpperCase()];

        if (!exchangeRate) {
            const errorMsg = `Currency ${to_currency.toUpperCase()} not found or not supported.`;
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Currency Error')
                    .setColor(0xFF0000)
                    .setDescription(errorMsg);
                return embed;
            } else {
                return errorMsg;
            }
        }

        const convertedAmount = (amount * exchangeRate).toFixed(2);
        const lastUpdated = new Date(data.date).toLocaleDateString();

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('💱 Currency Converter')
                .setColor(0x00D4AA)
                .addFields(
                    { name: 'From', value: `${amount} ${from_currency.toUpperCase()}`, inline: true },
                    { name: 'To', value: `${convertedAmount} ${to_currency.toUpperCase()}`, inline: true },
                    { name: 'Exchange Rate', value: `1 ${from_currency.toUpperCase()} = ${exchangeRate} ${to_currency.toUpperCase()}`, inline: false }
                )
                .setFooter({ text: `Exchange rates updated: ${lastUpdated}` })
                .setTimestamp();
            return embed;
        } else {
            return `💱 **Currency Conversion**\n` +
                   `${amount} ${from_currency.toUpperCase()} = ${convertedAmount} ${to_currency.toUpperCase()}\n` +
                   `Exchange rate: 1 ${from_currency.toUpperCase()} = ${exchangeRate} ${to_currency.toUpperCase()}\n` +
                   `_Rates updated: ${lastUpdated}_`;
        }
    } catch (error) {
        const errorMsg = `Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Currency Conversion Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
            return embed;
        } else {
            return errorMsg;
        }
    }
}
