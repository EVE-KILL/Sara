import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('server')
    .setDescription('Get Discord server information')
    .addStringOption(option =>
        option.setName('info')
            .setDescription('Type of server information to get')
            .addChoices(
                { name: 'All Information', value: 'all' },
                { name: 'Member Count', value: 'member_count' },
                { name: 'Channel Count', value: 'channel_count' },
                { name: 'Role Count', value: 'role_count' },
                { name: 'Server Name', value: 'server_name' },
                { name: 'Creation Date', value: 'creation_date' }
            )
            .setRequired(false));

export default async function Server(interaction: any, client: any) {
    if (interaction.commandName !== 'server') return;

    try {
        if (!interaction.guild) {
            await interaction.reply({
                content: "This command can only be used in a server, not in DMs.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const infoType = interaction.options.getString('info') || 'all';
        const result = await getDiscordServerInfo(infoType, interaction);

        await interaction.reply({
            embeds: [result],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Error in server command:', error);
        await interaction.reply({
            content: 'Sorry, there was an error getting server information.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function getDiscordServerInfo(infoType: string, interaction: any): Promise<EmbedBuilder> {
    const guild = interaction.guild;

    try {
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setColor(0x5865F2)
            .setThumbnail(guild.iconURL() || null)
            .setTimestamp();

        switch (infoType) {
            case "member_count":
                embed.addFields({ name: '👥 Members', value: guild.memberCount.toString(), inline: true });
                break;
            case "channel_count":
                embed.addFields({ name: '📺 Channels', value: guild.channels.cache.size.toString(), inline: true });
                break;
            case "role_count":
                embed.addFields({ name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true });
                break;
            case "server_name":
                embed.addFields({ name: '📝 Server Name', value: guild.name, inline: true });
                break;
            case "creation_date":
                embed.addFields({ name: '📅 Created', value: guild.createdAt.toDateString(), inline: true });
                break;
            case "all":
            default:
                embed.addFields(
                    { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                    { name: '📺 Channels', value: guild.channels.cache.size.toString(), inline: true },
                    { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true },
                    { name: '📅 Created', value: guild.createdAt.toDateString(), inline: true },
                    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '🔗 Server ID', value: guild.id, inline: true }
                );

                if (guild.description) {
                    embed.addFields({ name: '📝 Description', value: guild.description, inline: false });
                }
                break;
        }

        return embed;
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Server Info Error')
            .setColor(0xFF0000)
            .setDescription(`Error getting server info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return embed;
    }
}
