import { splitMessageIntoChunks } from '../helper.js';
import { Config } from '../config.js';

const replyCache = new Map(); // Store original user message ID and bot reply message ID
const excludedMessageIds = new Set(); // Store IDs of flagged messages

export default async function AI(client, message, botReply = null) {
    // Ignore certain channel_ids
    let ignoredChannelIds = Config.ignoredChannelIds || [];
    if (ignoredChannelIds.includes(message.channel.id)) {
        return;
    }

    // Ignore certain guild_ids
    let ignoredGuildIds = Config.ignoredGuildIds || [];
    if (ignoredGuildIds.includes(message.guild.id)) {
        return;
    }

    if ((message.mentions.has(client.user) && !message.author.bot)) {
        // Show that we're typing
        await message.channel.sendTyping();

        // Fetch last 25 messages
        const messages = await message.channel.messages.fetch({ limit: 50 });

        // Filter out excluded messages and construct the array for OpenAI API
        const chatHistory = messages
            .filter(msg => !excludedMessageIds.has(msg.id)) // Exclude flagged messages
            .map(msg => {
                let response = JSON.stringify({
                    content: msg.content,
                    author: (msg.member?.nickname || msg.author.username),
                    authorId: msg.author.id,
                    time: msg.createdTimestamp
                });

                return {
                    role: 'user',
                    content: response
                };
            }).reverse();  // Reverse the array to maintain chronological order

        // Add the systemPrompt as the first message
        chatHistory.unshift({
            role: 'system',
            content: Config.systemPrompt
        });

        // Prepare the request payload for OpenAI moderation
        const moderationPayload = {
            input: chatHistory.map(chat => chat.content).join('\n')
        };

        try {
            // Make the POST request to OpenAI Moderations API
            const moderationResponse = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.openai_api_key}`
                },
                body: JSON.stringify(moderationPayload)
            });

            const moderationData = await moderationResponse.json();

            // Check if any of the categories flagged by moderation
            const flagged = moderationData.results[0].categories['self-harm'] ||
                moderationData.results[0].categories['sexual/minors'] ||
                moderationData.results[0].categories['self-harm/intent'] ||
                moderationData.results[0].categories['self-harm/instructions'] ||
                moderationData.results[0].categories['violence'];

            if (flagged) {
                // If the content is flagged, add the message ID to the excludedMessageIds list
                messages.forEach(msg => excludedMessageIds.add(msg.id));

                // Reply with an error message and exit
                await message.reply('Your message contains content that is not allowed.');
                return;
            }

            // If the content passes moderation, proceed to OpenAI chat completion
            const payload = {
                model: Config.openai_model,
                messages: chatHistory
            };

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.openai_api_key}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            // If the content is a JSON string, parse it
            let messageContent = data.choices?.[0]?.message?.content;
            const reply = messageContent?.message || messageContent || 'No response received.';

            // Replace <@name> and @name with proper <@id>
            const formattedReply = await replaceMentionsWithIds(reply, message.guild);

            // Split the reply into chunks if necessary
            const chunks = splitMessageIntoChunks(formattedReply);

            if (botReply) {
                // If botReply is defined, edit the existing bot message
                await botReply.edit(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            } else {
                // Otherwise, send a new reply and store it in the cache
                const replyMessage = await message.reply(chunks[0]);
                replyCache.set(message.id, replyMessage); // Cache the user message ID and bot reply message
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]);
                }
            }

        } catch (error) {
            console.error('Error while making API request:', error);
            if (botReply) {
                await botReply.edit('There was an error processing your request.');
            } else {
                await message.reply('There was an error processing your request.');
            }
        }
    }
}

// Function to replace mentions with proper <@id> format
async function replaceMentionsWithIds(reply, guild) {
    // Regex to find all instances of <@name> and @name
    const mentionRegex = /<@(\w+)>|@(\w+)/g;
    let matches;

    // Replace the matches
    while ((matches = mentionRegex.exec(reply)) !== null) {
        const username = matches[1] || matches[2];

        // Try to find a member by nickname or username
        const member = guild.members.cache.find(m =>
            m.user.username.toLowerCase() === username.toLowerCase() ||
            (m.nickname && m.nickname.toLowerCase() === username.toLowerCase())
        );

        if (member) {
            // Replace the mention with the proper <@id> format
            reply = reply.replace(matches[0], `<@${member.user.id}>`);
        }
    }

    return reply;
}

// Export the replyCache so that it can be accessed by other parts of the bot
export { replyCache };
