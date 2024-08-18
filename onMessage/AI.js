import { splitMessageIntoChunks } from '../helper.js';
import { Config } from '../config.js';

export default async function AI(client, message) {
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

    // 5% chance of answering
    let percentChangeOfAnswring = 0.05;
    let random = Math.random();
    let randomAnswer = false; //random < percentChangeOfAnswring;

    if ((message.mentions.has(client.user) && !message.author.bot) || (!message.author.bot && randomAnswer)) {
        // Show that we're typing
        await message.channel.sendTyping();

        // Fetch last 25 messages
        const messages = await message.channel.messages.fetch({ limit: 25 });

        // Construct the array for OpenAI API with username and message content
        const chatHistory = messages.map(msg => {
            return {
                role: 'user',
                content: msg.content
            };
        }).reverse();  // Reverse the array to maintain chronological order

        // Add the systemPrompt as the first message
        chatHistory.unshift({
            role: 'system',
            content: randomAnswer ? Config.randomAnswerPrompt : Config.systemPrompt
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
                // If the content is flagged, reply with an error message
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

            // Split the reply into chunks if necessary and send them sequentially
            const chunks = splitMessageIntoChunks(reply);

            for (const chunk of chunks) {
                await message.reply(chunk);
            }

        } catch (error) {
            console.error('Error while making API request:', error);
            await message.reply('There was an error processing your request.');
        }
    }
}
