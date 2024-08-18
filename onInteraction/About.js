export const commands = {
    name: 'about',
    description: 'Emits the bot version and other information'
};

export default async function About(interaction) {
    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
}
