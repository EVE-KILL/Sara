import { Client, GatewayIntentBits } from 'discord.js';
import { loadPlugins } from './helper.js';
import { Config } from './config.js';
import { replyCache } from './onMessage/AI.js'; // Import replyCache from AI plugin

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Arrays to hold the loaded plugins
const interactionPlugins = [];
const messagePlugins = [];

// Load onInteraction plugins
loadPlugins('./onInteraction', interactionPlugins, 'interaction');

// Load onMessage plugins
loadPlugins('./onMessage', messagePlugins, 'message');

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    for (const plugin of interactionPlugins) {
        plugin(interaction, client);
    }
});

client.on('messageCreate', async message => {
    // Trigger all message plugins on message creation
    for (const plugin of messagePlugins) {
        plugin(client, message);
    }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    // Check if the bot has already replied to this message
    if (replyCache.has(newMessage.id)) {
        const botReply = replyCache.get(newMessage.id);
        for (const plugin of messagePlugins) {
            // Only trigger plugins that handle message updates
            if (plugin.handlesMessageUpdate) {
                await plugin(client, newMessage, botReply);
            }
        }
    }
});

client.on('guildCreate', guild => {
    console.log(`Joined a new guild: ${guild.name}`);
});

client.on('guildDelete', guild => {
    console.log(`Left a guild: ${guild.name}`);
});

client.login(Config.token);

// When the user presses ctrl+c to exit the bot cleanly
process.on('SIGINT', async () => {
    console.log('Exiting...');
    await client.destroy();
    process.exit();
});
