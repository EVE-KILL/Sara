import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'get_discord_server_info',
    description: 'Get information about the current Discord server/guild',
    parameters: {
        type: "object",
        properties: {
            info_type: {
                type: "string",
                enum: ["member_count", "channel_count", "role_count", "server_name", "creation_date", "all"],
                description: "The type of server information to retrieve"
            }
        },
        required: ["info_type"]
    },
    systemPrompt: 'Use the get_discord_server_info tool to provide information about the current Discord server, such as member count, channels, roles, and server details.'
};

export default async function getDiscordServerInfo(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    if (!message.guild) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Server Info Error')
                .setColor(0xFF0000)
                .setDescription("This command can only be used in a server, not in DMs.");
            return embed;
        } else {
            return "This command can only be used in a server, not in DMs.";
        }
    }

    const guild = message.guild;
    const { info_type } = args;

    try {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle(`🏰 ${guild.name}`)
                .setColor(0x5865F2)
                .setThumbnail(guild.iconURL() || null)
                .setTimestamp();

            switch (info_type) {
                case "member_count":
                    embed.addFields({ name: '👥 Members', value: guild.memberCount.toString(), inline: true });
                    break;

                case "channel_count":
                    const channels = await guild.channels.fetch();
                    embed.addFields({ name: '📋 Channels', value: channels.size.toString(), inline: true });
                    break;

                case "role_count":
                    const roles = await guild.roles.fetch();
                    embed.addFields({ name: '🎭 Roles', value: roles.size.toString(), inline: true });
                    break;

                case "server_name":
                    embed.addFields({ name: '🏷️ Server Name', value: guild.name, inline: false });
                    break;

                case "creation_date":
                    embed.addFields({ name: '📅 Created', value: guild.createdAt.toDateString(), inline: false });
                    break;

                case "all":
                    const allChannels = await guild.channels.fetch();
                    const allRoles = await guild.roles.fetch();
                    embed.addFields(
                        { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
                        { name: '📋 Channels', value: allChannels.size.toString(), inline: true },
                        { name: '🎭 Roles', value: allRoles.size.toString(), inline: true },
                        { name: '📅 Created', value: guild.createdAt.toDateString(), inline: false }
                    );
                    break;

                default:
                    embed.setTitle('❌ Server Info Error')
                        .setColor(0xFF0000)
                        .setDescription("Invalid info type requested");
            }

            return embed;
        } else {
            switch (info_type) {
                case "member_count":
                    return `Server has ${guild.memberCount} members`;

                case "channel_count":
                    const channels = await guild.channels.fetch();
                    return `Server has ${channels.size} channels`;

                case "role_count":
                    const roles = await guild.roles.fetch();
                    return `Server has ${roles.size} roles`;

                case "server_name":
                    return `Server name: ${guild.name}`;

                case "creation_date":
                    return `Server created on: ${guild.createdAt.toDateString()}`;

                case "all":
                    const allChannels = await guild.channels.fetch();
                    const allRoles = await guild.roles.fetch();
                    return `**${guild.name}** Server Info:\n` +
                           `• Members: ${guild.memberCount}\n` +
                           `• Channels: ${allChannels.size}\n` +
                           `• Roles: ${allRoles.size}\n` +
                           `• Created: ${guild.createdAt.toDateString()}`;

                default:
                    return "Invalid info type requested";
            }
        }
    } catch (error) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Server Info Error')
                .setColor(0xFF0000)
                .setDescription(`Error getting server info: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return embed;
        } else {
            return `Error getting server info: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
