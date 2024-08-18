export const command = {
    name: 'ping',
    description: 'Replies with Pong!'
};

export default async function Ping(interaction, client) {
    if (interaction.commandName === 'ping') {
        await interaction.reply('Ping!', { ephemeral: true });
    }
}
