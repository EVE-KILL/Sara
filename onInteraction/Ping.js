export const commands = {
    name: 'ping',
    description: 'Replies with Pong!'
};

export default async function Ping(interaction) {
    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
}
