import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('currency')
    .setDescription('Convert between different currencies')
    .addNumberOption(option =>
        option.setName('amount')
            .setDescription('Amount to convert')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('from')
            .setDescription('Currency to convert from (e.g., USD, EUR, GBP)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('to')
            .setDescription('Currency to convert to (e.g., USD, EUR, GBP)')
            .setRequired(true));

export default async function Currency(interaction: any, client: any) {
    if (interaction.commandName !== 'currency') return;

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const amount = interaction.options.getNumber('amount');
        const fromCurrency = interaction.options.getString('from');
        const toCurrency = interaction.options.getString('to');

        const result = await convertCurrency(amount, fromCurrency, toCurrency);

        await interaction.editReply({
            embeds: [result]
        });
    } catch (error) {
        console.error('Error in currency command:', error);
        await interaction.editReply({
            content: 'Sorry, there was an error converting the currency.'
        });
    }
}

async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<EmbedBuilder> {
    try {
        const fromCur = fromCurrency.toUpperCase();
        const toCur = toCurrency.toUpperCase();

        if (fromCur === toCur) {
            const sameCurrencyEmbed = new EmbedBuilder()
                .setTitle('💱 Currency Conversion')
                .setColor(0xFFD700)
                .setDescription(`${amount} ${fromCur} = ${amount} ${toCur} (same currency)`)
                .setTimestamp();
            return sameCurrencyEmbed;
        }

        // Use the free ExchangeRate-API (no API key required)
        const response = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);

        if (!response.ok) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Currency Error')
                .setColor(0xFF0000)
                .setDescription('Error fetching exchange rates. Please try again later.');
            return errorEmbed;
        }

        const data = await response.json();

        if (data.result !== "success") {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Currency Error')
                .setColor(0xFF0000)
                .setDescription(`Error: Unable to get exchange rates for ${fromCur}`);
            return errorEmbed;
        }

        const rate = data.rates[toCur];
        if (!rate) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Currency Error')
                .setColor(0xFF0000)
                .setDescription(`Currency "${toCur}" not supported or not found in exchange rates.`);
            return errorEmbed;
        }

        const convertedAmount = Math.round((amount * rate) * 100) / 100;
        const lastUpdated = new Date(data.time_last_update_unix * 1000);

        const currencyEmbed = new EmbedBuilder()
            .setTitle('💱 Currency Conversion')
            .setColor(0xFFD700)
            .addFields(
                { name: 'From', value: `${amount} ${fromCur}`, inline: true },
                { name: 'To', value: `${convertedAmount} ${toCur}`, inline: true },
                { name: 'Exchange Rate', value: `1 ${fromCur} = ${rate} ${toCur}`, inline: false }
            )
            .setFooter({ text: `Last updated: ${lastUpdated.toLocaleDateString()}` })
            .setTimestamp();

        return currencyEmbed;

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Currency Error')
            .setColor(0xFF0000)
            .setDescription(`Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return errorEmbed;
    }
}
