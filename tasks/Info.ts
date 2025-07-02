import chalk from 'chalk';

export default {
    name: 'info',
    description: 'Information task that prints bot status and connected servers',

    async execute(client, args) {
        console.log(chalk.cyan(`Bot is connected to ${client.guilds.cache.size} servers`));

        // List all servers
        if (client.guilds.cache.size > 0) {
            console.log(chalk.magenta('Connected servers:'));
            client.guilds.cache.forEach(guild => {
                console.log(chalk.white(`  - ${guild.name} (${guild.memberCount} members)`));
            });
        }
    }
};
