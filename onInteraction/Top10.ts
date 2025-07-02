import { database } from '../database.js';

export const command = {
    name: 'top10',
    description: 'Show the top 10 most active users in the current channel'
};

export default async function Top10(interaction: any) {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'top10') return;

    await interaction.deferReply();

    try {
        const channelId = interaction.channelId;

        // Get top 10 most active users in this channel
        const topUsers = database.getTopActiveUsers(channelId, 10);

        if (topUsers.length === 0) {
            await interaction.editReply({
                content: "No messages found in this channel yet!"
            });
            return;
        }

        // Build the response
        let response = "🏆 **Top 10 Most Active Users in this Channel:**\n\n";

        const medals = ["🥇", "🥈", "🥉"];

        topUsers.forEach((user, index) => {
            const position = index + 1;
            const medal = index < 3 ? medals[index] : `${position}.`;
            const messageText = user.message_count === 1 ? "message" : "messages";

            response += `${medal} **${user.author_display_name}** (@${user.author_username})\n`;
            response += `   💬 ${user.message_count.toLocaleString()} ${messageText}\n\n`;
        });

        // Add some stats
        const totalMessages = database.getMessageCount(channelId);
        response += `📊 Total messages in channel: ${totalMessages.toLocaleString()}`;

        await interaction.editReply({
            content: response
        });

    } catch (error) {
        console.error('Error getting top active users:', error);
        await interaction.editReply({
            content: "❌ An error occurred while fetching the top active users."
        });
    }
}
