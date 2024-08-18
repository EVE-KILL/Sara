import { Client, GatewayIntentBits } from 'discord.js';
import { loadPlugins } from './helper.js';
import { Config } from './config.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Arrays to hold the loaded plugins
const interactionPlugins = [];
const messagePlugins = [];

// Load onInteraction plugins
await loadPlugins('./onInteraction', interactionPlugins, null);

// Load onMessage plugins
await loadPlugins('./onMessage', null, messagePlugins);

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    for (const plugin of interactionPlugins) {
        await plugin(interaction);
    }
});

client.on('messageCreate', async message => {
    for (const plugin of messagePlugins) {
        await plugin(client, message);
    }
});

client.login(Config.token);
