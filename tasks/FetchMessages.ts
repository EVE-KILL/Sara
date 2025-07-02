import chalk from 'chalk';
import { TextChannel, Message } from 'discord.js';
import { database, discordMessageToDbMessage } from '../database.js';

export default {
    name: 'fetch-messages',
    description: 'Fetch ALL messages from a channel, from latest to oldest, with database storage and continuation support',

    async execute(client: any, args: string[]) {
        if (args.length === 0) {
            console.log(chalk.red('Error: Channel ID is required'));
            console.log(chalk.yellow('Usage: bun run task.ts fetch-messages <channel-id> [--continue]'));
            console.log(chalk.yellow('  --continue: Continue from where the last fetch stopped'));
            return;
        }

        const channelId = args[0];
        const shouldContinue = args.includes('--continue');

        console.log(chalk.blue(`Fetching messages from channel: ${channelId}`));
        if (shouldContinue) {
            console.log(chalk.cyan('Continuing from last fetch position...'));
        }

        try {
            // Get the channel
            const channel = await client.channels.fetch(channelId);

            if (!channel) {
                console.log(chalk.red('Channel not found!'));
                return;
            }

            if (!(channel instanceof TextChannel)) {
                console.log(chalk.red('Channel is not a text channel!'));
                return;
            }

            console.log(chalk.green(`Found channel: #${channel.name} in ${channel.guild.name}`));

            // Check existing messages in database
            const existingCount = database.getMessageCount(channelId);
            console.log(chalk.blue(`Existing messages in database: ${existingCount}`));

            // Determine starting point
            let lastMessageId: string | undefined = undefined;

            if (shouldContinue) {
                // Try to get the last fetched message ID from fetch progress
                const lastFetched = database.getLastFetchedMessageId(channelId);
                if (lastFetched) {
                    lastMessageId = lastFetched;
                    console.log(chalk.cyan(`Continuing from message ID: ${lastMessageId}`));
                } else {
                    // Fallback to the most recent message in database
                    const lastInDb = database.getLastMessageId(channelId);
                    if (lastInDb) {
                        lastMessageId = lastInDb;
                        console.log(chalk.cyan(`No fetch progress found, continuing from most recent message in DB: ${lastMessageId}`));
                    } else {
                        console.log(chalk.yellow('No previous fetch progress found, starting from the beginning...'));
                    }
                }
            }

            let fetchedCount = 0;
            let storedCount = 0;
            let batchCount = 0;
            let totalFetchedThisRun = 0;

            console.log(chalk.blue('Starting to fetch messages...'));

            while (true) {
                try {
                    const options: { limit: number; before?: string } = { limit: 100 };
                    if (lastMessageId) {
                        options.before = lastMessageId;
                    }

                    const messages = await channel.messages.fetch(options);

                    if (messages.size === 0) {
                        console.log(chalk.green('No more messages to fetch.'));
                        break;
                    }

                    // Convert to array and process immediately
                    const messageArray = Array.from(messages.values());

                    // Convert Discord messages to database format
                    const dbMessages = messageArray.map(msg => discordMessageToDbMessage(msg));

                    // Store messages in database immediately
                    const insertedCount = database.insertMessages(dbMessages);

                    fetchedCount += messages.size;
                    storedCount += insertedCount;
                    totalFetchedThisRun += messages.size;
                    batchCount++;
                    lastMessageId = messageArray[messageArray.length - 1].id;

                    // Update fetch progress
                    database.updateFetchProgress(channelId, lastMessageId);

                    console.log(chalk.cyan(`Batch ${batchCount}: Fetched ${messages.size} messages, Stored ${insertedCount} new messages (Total fetched this run: ${totalFetchedThisRun})`));

                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    console.error(chalk.red('Error fetching batch:'), error);

                    // Save progress even if we hit an error
                    if (lastMessageId) {
                        database.updateFetchProgress(channelId, lastMessageId);
                        console.log(chalk.yellow(`Progress saved. You can continue with: bun run task.ts fetch-messages ${channelId} --continue`));
                    }
                    break;
                }
            }

            console.log(chalk.green(`\nFetch complete!`));
            console.log(chalk.blue(`Total messages fetched this run: ${totalFetchedThisRun}`));
            console.log(chalk.blue(`Total new messages stored: ${storedCount}`));

            // Get updated counts
            const finalCount = database.getMessageCount(channelId);
            console.log(chalk.blue(`Total messages in database for this channel: ${finalCount}`));

            // Show some statistics from database
            const topUsers = database.getTopActiveUsers(channelId, 5);
            if (topUsers.length > 0) {
                console.log(chalk.magenta('\nTop 5 most active users:'));
                topUsers.forEach((user, index) => {
                    console.log(chalk.magenta(`${index + 1}. ${user.author_display_name} (@${user.author_username}): ${user.message_count} messages`));
                });
            }

        } catch (error) {
            console.error(chalk.red('Error:'), error);
        }
    }
};
