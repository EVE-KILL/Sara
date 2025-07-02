import OpenAI from 'openai';
import { Config } from './config.js';
import { EmbedBuilder } from 'discord.js';
import { database } from './database.js';

// Tool definitions for GPT-4.1-Mini
export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "get_current_time",
            description: "Get the current time and date, optionally for a specific timezone",
            parameters: {
                type: "object",
                properties: {
                    timezone: {
                        type: "string",
                        description: "The timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Defaults to UTC if not specified."
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "calculate",
            description: "Perform mathematical calculations. Supports basic arithmetic, trigonometry, and common math functions.",
            parameters: {
                type: "object",
                properties: {
                    expression: {
                        type: "string",
                        description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sin(45)', 'sqrt(16)')"
                    }
                },
                required: ["expression"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_discord_server_info",
            description: "Get information about the current Discord server/guild",
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
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_random",
            description: "Generate random data like numbers, passwords, or UUIDs",
            parameters: {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["number", "password", "uuid", "dice"],
                        description: "The type of random data to generate"
                    },
                    min: {
                        type: "number",
                        description: "Minimum value for random numbers or dice"
                    },
                    max: {
                        type: "number",
                        description: "Maximum value for random numbers or dice"
                    },
                    length: {
                        type: "number",
                        description: "Length for passwords (default: 12)"
                    },
                    sides: {
                        type: "number",
                        description: "Number of sides for dice (default: 6)"
                    }
                },
                required: ["type"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "encode_decode_text",
            description: "Encode or decode text using various methods like Base64, URL encoding, etc.",
            parameters: {
                type: "object",
                properties: {
                    text: {
                        type: "string",
                        description: "The text to encode or decode"
                    },
                    method: {
                        type: "string",
                        enum: ["base64_encode", "base64_decode", "url_encode", "url_decode", "hex_encode", "hex_decode"],
                        description: "The encoding/decoding method to use"
                    }
                },
                required: ["text", "method"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_weather",
            description: "Get weather information for a specific location and time period with precipitation probability (chance of rain). Supports current weather, future forecasts, and relative time queries.",
            parameters: {
                type: "object",
                properties: {
                    location: {
                        type: "string",
                        description: "The city name, state/country (e.g., 'London', 'New York, NY', 'Tokyo, Japan')"
                    },
                    units: {
                        type: "string",
                        enum: ["metric", "imperial", "kelvin"],
                        description: "Temperature units - metric (°C), imperial (°F), or kelvin (K). Defaults to metric."
                    },
                    time_period: {
                        type: "string",
                        description: "Time period for weather forecast. Use 'now' for current weather, 'tomorrow' for next day, 'day_after_tomorrow' for day after, 'this_week' for 7-day overview, specify relative time like 'in 3 hours', 'in 6 hours', or time ranges like 'between 16 and 22', 'from 18 to 22'. Defaults to 'now'."
                    }
                },
                required: ["location"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "convert_currency",
            description: "Convert between different currencies with real-time exchange rates",
            parameters: {
                type: "object",
                properties: {
                    amount: {
                        type: "number",
                        description: "The amount to convert"
                    },
                    from_currency: {
                        type: "string",
                        description: "Source currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')"
                    },
                    to_currency: {
                        type: "string",
                        description: "Target currency code (e.g., 'USD', 'EUR', 'GBP', 'JPY')"
                    }
                },
                required: ["amount", "from_currency", "to_currency"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "learn_about_user",
            description: "Learn and remember information about the user for future conversations. Only use this when the user shares personal information that would be helpful to remember.",
            parameters: {
                type: "object",
                properties: {
                    information: {
                        type: "string",
                        description: "The information about the user to remember (e.g., 'lives in Copenhagen', 'likes Danish news', 'works as a developer')"
                    }
                },
                required: ["information"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_news",
            description: "Get latest news articles from various sources. Can search for specific topics, get news from specific countries, or get top headlines.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Search query for news (e.g., 'Tesla', 'climate change', 'technology'). Leave empty for general top headlines."
                    },
                    country: {
                        type: "string",
                        description: "Country code for news (e.g., 'dk' for Denmark, 'us' for USA, 'gb' for UK, 'de' for Germany). Use 'all' or leave empty for international news."
                    },
                    category: {
                        type: "string",
                        enum: ["business", "entertainment", "general", "health", "science", "sports", "technology"],
                        description: "News category to filter by. Only works with top headlines (when no query is specified)."
                    },
                    sources: {
                        type: "string",
                        description: "Specific news sources to search (e.g., 'bbc-news', 'cnn', 'techcrunch'). Use comma-separated list for multiple sources."
                    },
                    limit: {
                        type: "number",
                        description: "Number of articles to return (1-20, default: 5)"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_programming_help",
            description: "Get advanced programming assistance using a specialized coding model. Use this for complex programming questions, code reviews, debugging, algorithm explanations, or technical discussions that require deep reasoning.",
            parameters: {
                type: "object",
                properties: {
                    question: {
                        type: "string",
                        description: "The programming question, code snippet, or technical problem that needs advanced analysis"
                    },
                    context: {
                        type: "string",
                        description: "Additional context about the programming environment, language, or specific requirements"
                    },
                    show_reasoning: {
                        type: "boolean",
                        description: "Whether to show the model's step-by-step reasoning process (default: true for complex problems)"
                    }
                },
                required: ["question"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_channel_history",
            description: "Get a summary of past conversations in the Discord channel. Use this for questions about what happened in the past, who said what, or to get context about previous discussions.",
            parameters: {
                type: "object",
                properties: {
                    time_query: {
                        type: "string",
                        description: "Time-based query describing when to look for messages (e.g., 'last 15 minutes', 'yesterday around this time', 'an hour ago', 'this morning', 'last week')"
                    },
                    user_filter: {
                        type: "string",
                        description: "Filter by username or display name (optional). Use this when the user asks about specific people (e.g., '@KongGal', 'KongGal', or partial names)"
                    },
                    topic_filter: {
                        type: "string",
                        description: "Search for messages containing specific topics or keywords (optional). Use this when looking for discussions about specific subjects"
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of messages to analyze (default: 50, max: 200)"
                    }
                },
                required: ["time_query"]
            }
        }
    }
];

// Tool execution functions
export async function executeToolCall(toolCall: any, message: any, client: any, useEmbed: boolean = false) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    // Smart embed detection: Use text for conversational queries, embeds for formal requests
    const shouldUseEmbed = useEmbed && shouldUseEmbedForQuery(message.content, name, parsedArgs);

    try {
        switch (name) {
            case "get_current_time":
                return getCurrentTime(parsedArgs.timezone, shouldUseEmbed);

            case "calculate":
                return performCalculation(parsedArgs.expression, shouldUseEmbed);

            case "get_discord_server_info":
                return getDiscordServerInfo(parsedArgs.info_type, message, client, shouldUseEmbed);

            case "generate_random":
                return generateRandom(parsedArgs, shouldUseEmbed);

            case "encode_decode_text":
                return encodeDecodeText(parsedArgs.text, parsedArgs.method, shouldUseEmbed);

            case "get_weather":
                return getWeather(parsedArgs.location, parsedArgs.units, parsedArgs.time_period, shouldUseEmbed);

            case "convert_currency":
                return convertCurrency(parsedArgs.amount, parsedArgs.from_currency, parsedArgs.to_currency, shouldUseEmbed);

            case "learn_about_user":
                return learnAboutUser(parsedArgs.information, message, shouldUseEmbed);

            case "get_news":
                return getNews(parsedArgs.query, parsedArgs.country, parsedArgs.category, parsedArgs.sources, parsedArgs.limit, shouldUseEmbed);

            case "get_programming_help":
                return getProgrammingHelp(parsedArgs.question, parsedArgs.context, parsedArgs.show_reasoning);

            case "get_channel_history":
                return getChannelHistory(parsedArgs.time_query, message, parsedArgs.user_filter, parsedArgs.topic_filter, parsedArgs.limit, shouldUseEmbed);

            default:
                return `Unknown tool: ${name}`;
        }
    } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

// Smart embed detection function
function shouldUseEmbedForQuery(userMessage: string, toolName: string, args: any): boolean {
    const lowerMessage = userMessage.toLowerCase();

    // Conversational patterns that should use text responses
    const conversationalPatterns = [
        /how'?s?\s+the\s+weather/,
        /what'?s?\s+the\s+weather/,
        /gonna\s+be/,
        /going\s+to\s+be/,
        /will\s+it\s+be/,
        /between\s+\d+\s+and\s+\d+/,
        /from\s+\d+\s+to\s+\d+/,
        /tonight/,
        /today/,
        /tomorrow/,
        /this\s+(morning|afternoon|evening)/,
        /quick\s+/,
        /just\s+(tell|show)/,
        /what\s+time/,
        /when\s+is/,
        // Programming - quick questions
        /how\s+do\s+i\s+/,
        /what'?s?\s+the\s+difference/,
        /quick\s+(question|help)/
    ];

    // Formal patterns that should use embeds
    const formalPatterns = [
        /weather\s+report/,
        /forecast\s+for/,
        /detailed\s+weather/,
        /weather\s+data/,
        /show\s+me\s+.*\s+embed/,
        /display\s+.*\s+chart/,
        /weather\s+summary/,
        // Programming - complex patterns that benefit from embeds
        /code\s+review/,
        /debug\s+(this|my)/,
        /explain\s+.*\s+algorithm/,
        /help\s+me\s+(understand|with)/,
        /analyze\s+(this|my)\s+code/,
        /step\s+by\s+step/,
        /detailed\s+(explanation|analysis)/,
        /best\s+practices/,
        /optimize\s+(this|my)/,
        /refactor\s+(this|my)/
    ];

    // Check for formal patterns first
    for (const pattern of formalPatterns) {
        if (pattern.test(lowerMessage)) {
            return true;
        }
    }

    // Check for conversational patterns
    for (const pattern of conversationalPatterns) {
        if (pattern.test(lowerMessage)) {
            return false;
        }
    }

    // Tool-specific rules
    switch (toolName) {
        case "get_weather":
            // Time ranges are usually conversational
            if (args.time_period && (
                args.time_period.includes('between') ||
                args.time_period.includes('from') ||
                args.time_period.includes('to')
            )) {
                return false;
            }
            // Weekly forecasts work better as embeds
            if (args.time_period === 'this_week') {
                return true;
            }
            break;

        case "get_news":
            // Multiple articles work better as embeds
            if (!args.limit || args.limit > 3) {
                return true;
            }
            break;

        case "calculate":
            // Simple calculations can be text
            return false;

        case "get_current_time":
            // Time queries are usually conversational
            return false;

        case "get_programming_help":
            // Programming help always uses text format for better code formatting
            return false;

        case "get_channel_history":
            // History summaries work better as embeds for organization
            return true;
    }

    // Default: use text for conversational context, embeds for formal requests
    return false;
}

// Remove the duplicate executeToolCallWithEmbed function

// Main function to handle tool calling with OpenAI (returns embeds when possible)
export async function processWithToolsEmbed(
    openai: OpenAI,
    chatHistory: any[],
    message: any,
    client: any
): Promise<{content?: string, embeds?: any[], memoryMessages?: { embed: any, memoryKeys: string[] }[]}> {
    // Generate response using OpenAI with tools
    const completion = await openai.chat.completions.create({
        model: Config.openai_model,
        messages: chatHistory,
        tools: tools,
        tool_choice: "auto"
    });

    const responseMessage = completion.choices?.[0]?.message;
    if (!responseMessage) {
        throw new Error('No response received from OpenAI');
    }

    // Check if the model wants to use tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add the assistant message with tool calls to the conversation
        chatHistory.push(responseMessage);

        const embeds: any[] = [];
        const memoryMessages: { embed: any, memoryKeys: string[] }[] = [];
        let hasEmbeds = false;

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
            const toolResult = await executeToolCall(toolCall, message, client, true); // Use embed mode

            // Check if this is a memory learning result with special format
            if (toolCall.function.name === "learn_about_user" &&
                typeof toolResult === 'object' &&
                toolResult !== null &&
                'content' in toolResult &&
                'memoryKeys' in toolResult) {

                const memoryResult = toolResult as { content: EmbedBuilder, memoryKeys: string[] };
                embeds.push(memoryResult.content);
                memoryMessages.push({ embed: memoryResult.content, memoryKeys: memoryResult.memoryKeys });
                hasEmbeds = true;

                // Add a summary to the conversation for the AI to reference
                chatHistory.push({
                    role: 'tool' as const,
                    content: `Tool executed successfully: ${toolCall.function.name}`,
                    tool_call_id: toolCall.id
                });
            } else if (toolResult instanceof EmbedBuilder) {
                embeds.push(toolResult);
                hasEmbeds = true;

                // Provide a detailed summary for the AI based on the tool type and actual results
                let toolSummary = `Tool executed successfully: ${toolCall.function.name}`;

                // Extract key information from the embed to provide context to the AI
                const embedTitle = toolResult.data.title || '';
                const embedDescription = toolResult.data.description || '';
                const embedFields = toolResult.data.fields || [];

                if (toolCall.function.name === "get_news") {
                    toolSummary = `Found and displayed news articles in an embed. The news has been retrieved successfully and is shown to the user.`;
                } else if (toolCall.function.name === "get_weather") {
                    toolSummary = `Weather information retrieved and displayed in an embed format.`;
                } else if (toolCall.function.name === "convert_currency") {
                    toolSummary = `Currency conversion completed and displayed in an embed.`;
                } else if (toolCall.function.name === "get_current_time") {
                    toolSummary = `Current time information displayed in an embed.`;
                } else if (toolCall.function.name === "calculate") {
                    toolSummary = `Calculation completed and result displayed in an embed.`;
                } else if (toolCall.function.name === "get_discord_server_info") {
                    toolSummary = `Discord server information retrieved and displayed in an embed.`;
                } else if (toolCall.function.name === "generate_random") {
                    toolSummary = `Random data generated and displayed in an embed.`;
                } else if (toolCall.function.name === "encode_decode_text") {
                    toolSummary = `Text encoding/decoding completed and displayed in an embed.`;
                } else if (toolCall.function.name === "get_programming_help") {
                    const question = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments).question : 'programming question';
                    toolSummary = `Advanced programming assistance provided using specialized coding model. Topic: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}. This was a programming-related question requiring specialized model assistance.`;
                } else if (toolCall.function.name === "get_channel_history") {
                    // Extract results info from the embed to provide proper context
                    const messagesField = embedFields.find((f: any) => f.name === '💬 Messages Found');
                    const messageCount = messagesField ? messagesField.value : '0';
                    const isError = embedTitle.includes('❌');
                    const isNoResults = parseInt(messageCount) === 0 || embedTitle.includes('No messages found');

                    if (isError) {
                        toolSummary = `Channel history tool encountered an error: ${embedDescription}`;
                    } else if (isNoResults) {
                        toolSummary = `Channel history search completed but found no messages matching the criteria. The embed shows this result to the user.`;
                    } else {
                        toolSummary = `Channel history search completed successfully. Found ${messageCount} messages and generated a summary. The complete summary and details are displayed in the embed for the user.`;
                    }
                }

                // Add the tool summary to the conversation for the AI to reference
                chatHistory.push({
                    role: 'tool' as const,
                    content: toolSummary,
                    tool_call_id: toolCall.id
                });
            } else {
                // Add the text result to the conversation
                let contentToAdd = toolResult || 'Tool executed';

                // For programming help, ensure we preserve enough context for follow-up questions
                if (toolCall.function.name === "get_programming_help" && typeof toolResult === 'string') {
                    // Add a marker to help the AI recognize this was programming assistance
                    // Truncate very long responses but preserve key information
                    const maxLength = 4000; // Keep within reasonable token limits
                    if (toolResult.length > maxLength) {
                        contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult.substring(0, maxLength)}... [Response truncated - full programming assistance was provided to user]`;
                    } else {
                        contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult}`;
                    }
                }

                chatHistory.push({
                    role: 'tool' as const,
                    content: contentToAdd,
                    tool_call_id: toolCall.id
                });
            }
        }

        // If we have embeds, the tools have provided complete information - no need for additional AI response
        if (hasEmbeds) {
            const result: any = { embeds: embeds };
            if (memoryMessages.length > 0) {
                result.memoryMessages = memoryMessages;
            }
            return result;
        }

        // Only get a final response from the model if we don't have embeds (text-only tool responses)
        const finalCompletion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: chatHistory
        });

        const finalResponse = finalCompletion.choices?.[0]?.message?.content || 'No response received.';
        return { content: finalResponse };
    } else {
        // No tools used, regular response
        return { content: responseMessage.content || 'No response received.' };
    }
}

// Main function to handle tool calling with OpenAI
export async function processWithTools(
    openai: OpenAI,
    chatHistory: any[],
    message: any,
    client: any
): Promise<string> {
    // Generate response using OpenAI with tools
    const completion = await openai.chat.completions.create({
        model: Config.openai_model,
        messages: chatHistory,
        tools: tools,
        tool_choice: "auto"
    });

    const responseMessage = completion.choices?.[0]?.message;
    if (!responseMessage) {
        throw new Error('No response received from OpenAI');
    }

    // Check if the model wants to use tools
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Add the assistant message with tool calls to the conversation
        chatHistory.push(responseMessage);

        // Execute each tool call
        for (const toolCall of responseMessage.tool_calls) {
            const toolResult = await executeToolCall(toolCall, message, client, false); // Use text mode

            // Add the tool result to the conversation
            let contentToAdd = toolResult instanceof EmbedBuilder ? 'Tool executed successfully' : toolResult;

            // For programming help, ensure we preserve enough context for follow-up questions
            if (toolCall.function.name === "get_programming_help" && typeof toolResult === 'string') {
                // Add a marker to help the AI recognize this was programming assistance
                // Truncate very long responses but preserve key information
                const maxLength = 4000; // Keep within reasonable token limits
                if (toolResult.length > maxLength) {
                    contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult.substring(0, maxLength)}... [Response truncated - full programming assistance was provided to user]`;
                } else {
                    contentToAdd = `[PROGRAMMING_ASSISTANCE] ${toolResult}`;
                }
            }

            chatHistory.push({
                role: 'tool' as const,
                content: contentToAdd,
                tool_call_id: toolCall.id
            });
        }

        // Get the final response from the model after tool execution
        const finalCompletion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: chatHistory
        });

        return finalCompletion.choices?.[0]?.message?.content || 'No response received.';
    } else {
        // No tools used, regular response
        return responseMessage.content || 'No response received.';
    }
}

function getCurrentTime(timezone?: string, useEmbed: boolean = false): string | EmbedBuilder {
    try {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone || 'UTC',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        };

        const formatter = new Intl.DateTimeFormat('en-US', options);
        const timeString = formatter.format(now);

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('🕐 Current Time')
                .setColor(0x5865F2)
                .addFields(
                    { name: 'Time Zone', value: timezone || 'UTC', inline: true },
                    { name: 'Date & Time', value: timeString, inline: false }
                )
                .setTimestamp();
            return embed;
        } else {
            return `Current time${timezone ? ` in ${timezone}` : ' (UTC)'}: ${timeString}`;
        }
    } catch (error) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Time Error')
                .setColor(0xFF0000)
                .setDescription(`Error getting time: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return embed;
        } else {
            return `Error getting time: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}

function performCalculation(expression: string, useEmbed: boolean = false): string | EmbedBuilder {
    try {
        // Basic security: only allow numbers, operators, and common math functions
        const sanitized = expression.replace(/[^0-9+\-*/().,\s]/g, '');

        // Use a safe eval alternative or implement basic calculator
        // For now, using a simple approach with basic operations
        const allowedPattern = /^[0-9+\-*/().,\s]+$/;
        if (!allowedPattern.test(sanitized)) {
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('❌ Calculation Error')
                    .setColor(0xFF0000)
                    .setDescription("Invalid mathematical expression. Only basic arithmetic is supported.");
                return embed;
            } else {
                return "Invalid mathematical expression. Only basic arithmetic is supported.";
            }
        }

        const result = Function(`"use strict"; return (${sanitized})`)();

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('🧮 Calculator')
                .setColor(0x00D166)
                .addFields(
                    { name: 'Expression', value: `\`${expression}\``, inline: false },
                    { name: 'Result', value: `**${result}**`, inline: false }
                );
            return embed;
        } else {
            return `${expression} = ${result}`;
        }
    } catch (error) {
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Calculation Error')
                .setColor(0xFF0000)
                .setDescription(`Error calculating "${expression}": Invalid expression`);
            return embed;
        } else {
            return `Error calculating "${expression}": Invalid expression`;
        }
    }
}

async function getDiscordServerInfo(infoType: string, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
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

    try {
        if (useEmbed) {
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
            switch (infoType) {
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



function generateRandom(params: any, embed: boolean = false): string | EmbedBuilder {
    try {
        if (embed) {
            const embedResult = new EmbedBuilder()
                .setTitle('🎲 Random Generator')
                .setColor(0x9932CC)
                .setTimestamp();

            switch (params.type) {
                case "number":
                    const min = params.min || 1;
                    const max = params.max || 100;
                    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
                    embedResult.addFields(
                        { name: 'Range', value: `${min} - ${max}`, inline: true },
                        { name: 'Result', value: `**${randomNum}**`, inline: true }
                    );
                    break;

                case "password":
                    const length = params.length || 12;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                    let password = '';
                    for (let i = 0; i < length; i++) {
                        password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    embedResult.setTitle('🔐 Password Generator')
                        .addFields(
                            { name: 'Length', value: length.toString(), inline: true },
                            { name: 'Password', value: `||${password}||`, inline: false }
                        );
                    break;

                case "uuid":
                    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    embedResult.setTitle('🆔 UUID Generator')
                        .addFields({ name: 'Generated UUID', value: `\`${uuid}\``, inline: false });
                    break;

                case "dice":
                    const sides = params.sides || 6;
                    const diceRoll = Math.floor(Math.random() * sides) + 1;
                    embedResult.setTitle('🎲 Dice Roll')
                        .addFields(
                            { name: 'Die Type', value: `D${sides}`, inline: true },
                            { name: 'Result', value: `**${diceRoll}**`, inline: true }
                        );
                    break;

                default:
                    embedResult.setTitle('❌ Random Generator Error')
                        .setColor(0xFF0000)
                        .setDescription("Invalid random type requested");
            }

            return embedResult;
        } else {
            switch (params.type) {
                case "number":
                    const min = params.min || 1;
                    const max = params.max || 100;
                    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
                    return `Random number between ${min} and ${max}: ${randomNum}`;

                case "password":
                    const length = params.length || 12;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                    let password = '';
                    for (let i = 0; i < length; i++) {
                        password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    return `Generated password (${length} characters): ||${password}||`;

                case "uuid":
                    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                    return `Generated UUID: ${uuid}`;

                case "dice":
                    const sides = params.sides || 6;
                    const diceRoll = Math.floor(Math.random() * sides) + 1;
                    return `🎲 Rolled a ${sides}-sided die: ${diceRoll}`;

                default:
                    return "Invalid random type requested";
            }
        }
    } catch (error) {
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Random Generator Error')
                .setColor(0xFF0000)
                .setDescription(`Error generating random data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error generating random data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}



function encodeDecodeText(text: string, method: string, embed: boolean = false): string | EmbedBuilder {
    try {
        if (embed) {
            const embedResult = new EmbedBuilder()
                .setTitle('🔐 Text Encoder/Decoder')
                .setColor(0xFF6B35)
                .setTimestamp();

            let result = '';
            let operation = '';

            switch (method) {
                case "base64_encode":
                    result = Buffer.from(text).toString('base64');
                    operation = 'Base64 Encode';
                    break;

                case "base64_decode":
                    result = Buffer.from(text, 'base64').toString('utf8');
                    operation = 'Base64 Decode';
                    break;

                case "url_encode":
                    result = encodeURIComponent(text);
                    operation = 'URL Encode';
                    break;

                case "url_decode":
                    result = decodeURIComponent(text);
                    operation = 'URL Decode';
                    break;

                case "hex_encode":
                    result = Buffer.from(text).toString('hex');
                    operation = 'Hex Encode';
                    break;

                case "hex_decode":
                    result = Buffer.from(text, 'hex').toString('utf8');
                    operation = 'Hex Decode';
                    break;

                default:
                    embedResult.setTitle('❌ Encoder/Decoder Error')
                        .setColor(0xFF0000)
                        .setDescription("Invalid encoding/decoding method");
                    return embedResult;
            }

            embedResult.addFields(
                { name: 'Operation', value: operation, inline: true },
                { name: 'Input', value: `\`\`\`${text.substring(0, 1000)}\`\`\``, inline: false },
                { name: 'Output', value: `\`\`\`${result.substring(0, 1000)}\`\`\``, inline: false }
            );

            if (result.length > 1000) {
                embedResult.setFooter({ text: 'Output truncated - result is longer than 1000 characters' });
            }

            return embedResult;
        } else {
            switch (method) {
                case "base64_encode":
                    return `Base64 encoded: ${Buffer.from(text).toString('base64')}`;

                case "base64_decode":
                    return `Base64 decoded: ${Buffer.from(text, 'base64').toString('utf8')}`;

                case "url_encode":
                    return `URL encoded: ${encodeURIComponent(text)}`;

                case "url_decode":
                    return `URL decoded: ${decodeURIComponent(text)}`;

                case "hex_encode":
                    return `Hex encoded: ${Buffer.from(text).toString('hex')}`;

                case "hex_decode":
                    return `Hex decoded: ${Buffer.from(text, 'hex').toString('utf8')}`;

                default:
                    return "Invalid encoding/decoding method";
            }
        }
    } catch (error) {
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Encoder/Decoder Error')
                .setColor(0xFF0000)
                .setDescription(`Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}



async function getWeather(location: string, units: string = "metric", timePeriod: string = "now", embed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        // First, geocode the location to get latitude and longitude
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;

        const geocodeResponse = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'Sara Discord Bot (https://github.com/your-repo)'
            }
        });

        if (!geocodeResponse.ok) {
            if (embed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Weather Error')
                    .setColor(0xFF0000)
                    .setDescription(`Error finding location "${location}". Please try a different location name.`);
                return errorEmbed;
            } else {
                return `Error finding location "${location}". Please try a different location name.`;
            }
        }

        const geocodeData = await geocodeResponse.json();

        if (!geocodeData || geocodeData.length === 0) {
            if (embed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Weather Error')
                    .setColor(0xFF0000)
                    .setDescription(`Location "${location}" not found. Please try a more specific location name (e.g., "Aalborg, Denmark" or "New York, NY").`);
                return errorEmbed;
            } else {
                return `Location "${location}" not found. Please try a more specific location name (e.g., "Aalborg, Denmark" or "New York, NY").`;
            }
        }

        const { lat, lon, display_name } = geocodeData[0];

        // Determine API parameters based on time period
        const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
        const windUnit = units === "imperial" ? "mph" : "kmh";

        if (timePeriod === "now") {
            // Current weather only - note: current conditions don't include precipitation_probability
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=precipitation_probability&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=1`;

            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok) {
                if (embed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Error getting weather data for "${location}". Please try again later.`);
                    return errorEmbed;
                } else {
                    return `Error getting weather data for "${location}". Please try again later.`;
                }
            }

            const weatherData = await weatherResponse.json();

            if (!weatherData.current) {
                if (embed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Weather data not available for "${location}".`);
                    return errorEmbed;
                } else {
                    return `Weather data not available for "${location}".`;
                }
            }

            const current = weatherData.current;
            const temp = Math.round(current.temperature_2m);
            const humidity = current.relative_humidity_2m;
            const windSpeed = Math.round(current.wind_speed_10m);

            // Get precipitation probability for the current hour
            let precipProbability = null;
            if (weatherData.hourly && weatherData.hourly.precipitation_probability) {
                const now = new Date();
                const currentHourIndex = now.getHours();
                precipProbability = weatherData.hourly.precipitation_probability[currentHourIndex];
            }

            const weatherDescription = getWeatherDescription(current.weather_code);

            const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";
            const windUnitSymbol = units === "imperial" ? "mph" : "km/h";

            let displayTemp = temp;
            if (units === "kelvin") {
                displayTemp = tempUnit === "fahrenheit"
                    ? Math.round(((temp - 32) * 5/9) + 273.15)
                    : Math.round(temp + 273.15);
            }

            if (embed) {
                const weatherEmbed = new EmbedBuilder()
                    .setTitle(`🌤️ Current Weather`)
                    .setColor(0x87CEEB)
                    .addFields(
                        { name: '📍 Location', value: display_name.split(',')[0], inline: false },
                        { name: '🌡️ Temperature', value: `${displayTemp}${tempSymbol}`, inline: true },
                        { name: '☁️ Condition', value: weatherDescription, inline: true },
                        { name: '💧 Humidity', value: `${humidity}%`, inline: true },
                        { name: '💨 Wind Speed', value: `${windSpeed} ${windUnitSymbol}`, inline: true }
                    )
                    .setTimestamp();

                if (precipProbability !== null) {
                    weatherEmbed.addFields({ name: '🌧️ Rain Chance', value: `${precipProbability}%`, inline: true });
                }

                return weatherEmbed;
            } else {
                let result = `🌤️ **Weather in ${display_name.split(',')[0]}**\n` +
                            `Temperature: ${displayTemp}${tempSymbol}\n` +
                            `Condition: ${weatherDescription}\n` +
                            `Humidity: ${humidity}%\n` +
                            `Wind: ${windSpeed} ${windUnitSymbol}`;

                if (precipProbability !== null) {
                    result += `\nChance of rain: ${precipProbability}%`;
                }

                return result;
            }
        } else {
            // Check if this is a relative time period (e.g., "in 6 hours")
            const relativeTime = parseRelativeTime(timePeriod);

            if (relativeTime) {
                // Handle relative time periods like "in 6 hours" or time ranges like "between 16 and 22"
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=7`;

                const weatherResponse = await fetch(weatherUrl);

                if (!weatherResponse.ok) {
                    if (embed) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Weather Error')
                            .setColor(0xFF0000)
                            .setDescription(`Error getting weather data for "${location}". Please try again later.`);
                        return errorEmbed;
                    } else {
                        return `Error getting weather data for "${location}". Please try again later.`;
                    }
                }

                const weatherData = await weatherResponse.json();

                if (!weatherData.hourly) {
                    if (embed) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Weather Error')
                            .setColor(0xFF0000)
                            .setDescription(`Weather forecast data not available for "${location}".`);
                        return errorEmbed;
                    } else {
                        return `Weather forecast data not available for "${location}".`;
                    }
                }

                const hourly = weatherData.hourly;
                const times = hourly.time;
                const now = new Date();

                if ('timeRange' in relativeTime) {
                    // Handle time ranges like "between 16 and 22"
                    const today = new Date(now);
                    today.setHours(0, 0, 0, 0);

                    const targetHours = [];
                    for (let hour = relativeTime.timeRange.start; hour <= relativeTime.timeRange.end; hour++) {
                        targetHours.push(hour);
                    }

                    const weatherResults = [];

                    for (const hour of targetHours) {
                        const targetTime = new Date(today);
                        targetTime.setHours(hour, 0, 0, 0);

                        // If the hour has already passed today, check tomorrow
                        if (targetTime <= now) {
                            targetTime.setDate(targetTime.getDate() + 1);
                        }

                        const timeIndex = times.findIndex((time: string) => {
                            const timeDate = new Date(time);
                            return Math.abs(timeDate.getTime() - targetTime.getTime()) < 30 * 60 * 1000; // Within 30 minutes
                        });

                        if (timeIndex !== -1) {
                            let temp = Math.round(hourly.temperature_2m[timeIndex]);
                            if (units === "kelvin") {
                                temp = tempUnit === "fahrenheit"
                                    ? Math.round(((temp - 32) * 5/9) + 273.15)
                                    : Math.round(temp + 273.15);
                            }

                            const weatherCode = hourly.weather_code[timeIndex];
                            const precipProbability = hourly.precipitation_probability[timeIndex];
                            const weatherDescription = getWeatherDescription(weatherCode);

                            weatherResults.push({
                                hour: hour,
                                temp: temp,
                                condition: weatherDescription,
                                rainChance: precipProbability
                            });
                        }
                    }

                    if (weatherResults.length === 0) {
                        return `Weather data not available for "${relativeTime.label}".`;
                    }

                    const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";

                    // Always use text for time ranges - more natural for conversations
                    const avgTemp = Math.round(weatherResults.reduce((sum, w) => sum + w.temp, 0) / weatherResults.length);
                    const avgRain = Math.round(weatherResults.reduce((sum, w) => sum + w.rainChance, 0) / weatherResults.length);
                    const conditions = [...new Set(weatherResults.map(w => w.condition))];

                    let result = `🌤️ **Weather in ${display_name.split(',')[0]} ${relativeTime.label}**\n`;
                    result += `Average temperature: ${avgTemp}${tempSymbol}\n`;
                    result += `Conditions: ${conditions.join(', ')}\n`;
                    result += `Average chance of rain: ${avgRain}%\n\n`;
                    result += `**Hourly breakdown:**\n`;

                    for (const weather of weatherResults) {
                        result += `• ${weather.hour}:00 - ${weather.temp}${tempSymbol}, ${weather.condition}, ${weather.rainChance}% rain\n`;
                    }

                    return result;
                } else {
                    // Handle relative hours like "in 6 hours"
                    const targetTime = new Date(now.getTime() + (relativeTime.hours * 60 * 60 * 1000));

                    let closestIndex = -1;
                    let minDifference = Infinity;

                    for (let i = 0; i < times.length; i++) {
                        const timeDate = new Date(times[i]);
                        const difference = Math.abs(timeDate.getTime() - targetTime.getTime());
                        if (difference < minDifference) {
                            minDifference = difference;
                            closestIndex = i;
                        }
                    }

                    if (closestIndex === -1) {
                        return `Weather data not available for "${relativeTime.label}".`;
                    }

                    // Extract weather data for that specific time
                    let temp = Math.round(hourly.temperature_2m[closestIndex]);
                    const humidity = hourly.relative_humidity_2m[closestIndex];
                    const windSpeed = Math.round(hourly.wind_speed_10m[closestIndex]);
                    const weatherCode = hourly.weather_code[closestIndex];
                    const precipProbability = hourly.precipitation_probability[closestIndex];

                    const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";
                    const windUnitSymbol = units === "imperial" ? "mph" : "km/h";

                    if (units === "kelvin") {
                        temp = tempUnit === "fahrenheit"
                            ? Math.round(((temp - 32) * 5/9) + 273.15)
                            : Math.round(temp + 273.15);
                    }

                    const weatherDescription = getWeatherDescription(weatherCode);
                    const actualTime = new Date(times[closestIndex]);

                    // Use text response for conversational queries
                    let result = `🌤️ **Weather in ${display_name.split(',')[0]} ${relativeTime.label}**\n` +
                                `Time: ${actualTime.toLocaleString()}\n` +
                                `Temperature: ${temp}${tempSymbol}\n` +
                                `Condition: ${weatherDescription}\n` +
                                `Humidity: ${humidity}%\n` +
                                `Wind: ${windSpeed} ${windUnitSymbol}\n` +
                                `Chance of rain: ${precipProbability}%`;

                    return result;
                }
            }

            // Future weather - need hourly data including precipitation probability
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=7`;

            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok) {
                if (embed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Error getting weather data for "${location}". Please try again later.`);
                    return errorEmbed;
                } else {
                    return `Error getting weather data for "${location}". Please try again later.`;
                }
            }

            const weatherData = await weatherResponse.json();

            if (!weatherData.hourly) {
                if (embed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Weather forecast data not available for "${location}".`);
                    return errorEmbed;
                } else {
                    return `Weather forecast data not available for "${location}".`;
                }
            }

            if (embed) {
                return formatFutureWeatherEmbed(weatherData, display_name, timePeriod, units, tempUnit);
            } else {
                return formatFutureWeather(weatherData, display_name, timePeriod, units, tempUnit);
            }
        }

    } catch (error) {
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Weather Error')
                .setColor(0xFF0000)
                .setDescription(`Error getting weather data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error getting weather data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}

// Helper function to parse relative time periods and time ranges
function parseRelativeTime(timePeriod: string): { hours: number, label: string } | { timeRange: { start: number, end: number }, label: string } | null {
    const lowerTimePeriod = timePeriod.toLowerCase().trim();

    // Match time ranges like "between 16 and 22", "16-22", "from 16 to 22"
    const timeRangeMatch = lowerTimePeriod.match(/(?:between|from)\s+(\d{1,2})(?:\s+and\s+|\s+to\s+|-|–)(\d{1,2})|(\d{1,2})-(\d{1,2})/);
    if (timeRangeMatch) {
        const start = parseInt(timeRangeMatch[1] || timeRangeMatch[3]);
        const end = parseInt(timeRangeMatch[2] || timeRangeMatch[4]);
        if (start >= 0 && start <= 23 && end >= 0 && end <= 23 && start !== end) {
            const timeDesc = start < 12 && end < 12 ? 'morning' :
                           start >= 18 || end >= 18 ? 'evening' :
                           start >= 12 && end < 18 ? 'afternoon' : 'today';
            return { timeRange: { start, end }, label: `between ${start}:00 and ${end}:00 ${timeDesc}` };
        }
    }

    // Match patterns like "in 6 hours", "6 hours", "in 3 hour", etc.
    const hourMatch = lowerTimePeriod.match(/(?:in\s+)?(\d+)\s+hours?/);
    if (hourMatch) {
        const hours = parseInt(hourMatch[1]);
        if (hours >= 1 && hours <= 168) { // Limit to 1 week (168 hours)
            return { hours, label: `in ${hours} hour${hours === 1 ? '' : 's'}` };
        }
    }

    return null;
}

function formatFutureWeather(weatherData: any, displayName: string, timePeriod: string, units: string, tempUnit: string): string {
    const hourly = weatherData.hourly;
    const times = hourly.time;
    const temps = hourly.temperature_2m;
    const humidity = hourly.relative_humidity_2m;
    const windSpeed = hourly.wind_speed_10m;
    const weatherCodes = hourly.weather_code;
    const precipProbability = hourly.precipitation_probability;

    const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";
    const windUnitSymbol = units === "imperial" ? "mph" : "km/h";

    const now = new Date();

    if (timePeriod === "tomorrow") {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // Find the start of tomorrow in the data
        const targetHours = [8, 12, 18, 0]; // 8AM, 12PM, 6PM, midnight

        let result = `🌤️ **Tomorrow's Weather in ${displayName.split(',')[0]}**\n`;

        for (const hour of targetHours) {
            const targetTime = new Date(tomorrow);
            if (hour === 0) {
                targetTime.setDate(targetTime.getDate() + 1); // Midnight of next day
            }
            targetTime.setHours(hour, 0, 0, 0);

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getTime() === targetTime.getTime();
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;
                const timeLabel = hour === 0 ? "Midnight" :
                                 hour === 8 ? "Morning (8 AM)" :
                                 hour === 12 ? "Noon (12 PM)" : "Evening (6 PM)";

                let timeWeather = `• **${timeLabel}**: ${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    timeWeather += `, ${rainChance}% chance of rain`;
                }

                result += timeWeather + '\n';
            }
        }

        return result;
    } else if (timePeriod === "day_after_tomorrow") {
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        dayAfter.setHours(0, 0, 0, 0);

        const targetHours = [8, 12, 18, 0];

        let result = `🌤️ **Day After Tomorrow's Weather in ${displayName.split(',')[0]}**\n`;

        for (const hour of targetHours) {
            const targetTime = new Date(dayAfter);
            if (hour === 0) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
            targetTime.setHours(hour, 0, 0, 0);

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getTime() === targetTime.getTime();
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;
                const timeLabel = hour === 0 ? "Midnight" :
                                 hour === 8 ? "Morning (8 AM)" :
                                 hour === 12 ? "Noon (12 PM)" : "Evening (6 PM)";

                let timeWeather = `• **${timeLabel}**: ${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    timeWeather += `, ${rainChance}% chance of rain`;
                }

                result += timeWeather + '\n';
            }
        }

        return result;
    } else if (timePeriod === "this_week") {
        let result = `🌤️ **7-Day Weather Forecast for ${displayName.split(',')[0]}**\n`;

        for (let day = 0; day < 7; day++) {
            const targetDay = new Date(now);
            targetDay.setDate(targetDay.getDate() + day);
            targetDay.setHours(12, 0, 0, 0); // Noon for each day

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getDate() === targetDay.getDate() &&
                       timeDate.getMonth() === targetDay.getMonth() &&
                       timeDate.getHours() === 12;
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;
                const dayName = day === 0 ? "📅 Today" :
                               day === 1 ? "📅 Tomorrow" :
                               `📅 ${targetDay.toLocaleDateString('en-US', { weekday: 'long' })}`;

                let dayWeather = `• **${dayName}**: ${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    dayWeather += `, ${rainChance}% chance of rain`;
                }
                result += dayWeather + '\n';
            }
        }

        return result;
    }

    return "Unknown time period requested.";
}

// Helper function to convert weather codes to descriptions
function getWeatherDescription(code: number): string {
    const weatherCodes: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    };

    return weatherCodes[code] || "Unknown conditions";
}



function formatFutureWeatherEmbed(weatherData: any, displayName: string, timePeriod: string, units: string, tempUnit: string): EmbedBuilder {
    const hourly = weatherData.hourly;
    const times = hourly.time;
    const temps = hourly.temperature_2m;
    const weatherCodes = hourly.weather_code;
    const precipProbability = hourly.precipitation_probability;

    const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";
    const now = new Date();

    const embed = new EmbedBuilder()
        .setColor(0x87CEEB)
        .setTimestamp()
        .addFields({ name: '📍 Location', value: displayName.split(',')[0], inline: false });

    if (timePeriod === "tomorrow") {
        embed.setTitle('🌤️ Tomorrow\'s Weather');
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const targetHours = [8, 12, 18, 0];
        const timeLabels = ["🌅 Morning (8 AM)", "☀️ Noon (12 PM)", "🌆 Evening (6 PM)", "🌙 Midnight"];

        targetHours.forEach((hour, index) => {
            const targetTime = new Date(tomorrow);
            if (hour === 0) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
            targetTime.setHours(hour, 0, 0, 0);

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getTime() === targetTime.getTime();
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;

                let value = `${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    value += `, ${rainChance}% rain`;
                }

                embed.addFields({ name: timeLabels[index], value: value, inline: true });
            }
        });
    } else if (timePeriod === "day_after_tomorrow") {
        embed.setTitle('🌤️ Day After Tomorrow\'s Weather');
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        dayAfter.setHours(0, 0, 0, 0);

        const targetHours = [8, 12, 18, 0];
        const timeLabels = ["🌅 Morning (8 AM)", "☀️ Noon (12 PM)", "🌆 Evening (6 PM)", "🌙 Midnight"];

        targetHours.forEach((hour, index) => {
            const targetTime = new Date(dayAfter);
            if (hour === 0) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
            targetTime.setHours(hour, 0, 0, 0);

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getTime() === targetTime.getTime();
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;

                let value = `${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    value += `, ${rainChance}% rain`;
                }

                embed.addFields({ name: timeLabels[index], value: value, inline: true });
            }
        });
    } else if (timePeriod === "this_week") {
        embed.setTitle('🌤️ 7-Day Weather Forecast');

        for (let day = 0; day < 7; day++) {
            const targetDay = new Date(now);
            targetDay.setDate(targetDay.getDate() + day);
            targetDay.setHours(12, 0, 0, 0); // Noon for each day

            const timeIndex = times.findIndex((time: string) => {
                const timeDate = new Date(time);
                return timeDate.getDate() === targetDay.getDate() &&
                       timeDate.getMonth() === targetDay.getMonth() &&
                       timeDate.getHours() === 12;
            });

            if (timeIndex !== -1) {
                let temp = Math.round(temps[timeIndex]);
                if (units === "kelvin") {
                    temp = tempUnit === "fahrenheit"
                        ? Math.round(((temp - 32) * 5/9) + 273.15)
                        : Math.round(temp + 273.15);
                }

                const condition = getWeatherDescription(weatherCodes[timeIndex]);
                const rainChance = precipProbability ? precipProbability[timeIndex] : null;
                const dayName = day === 0 ? "📅 Today" :
                               day === 1 ? "📅 Tomorrow" :
                               `📅 ${targetDay.toLocaleDateString('en-US', { weekday: 'long' })}`;

                let value = `${temp}${tempSymbol}, ${condition}`;
                if (rainChance !== null) {
                    value += `, ${rainChance}% rain`;
                }

                embed.addFields({ name: dayName, value: value, inline: true });
            }
        }
    }

    return embed;
}

async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, embed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

        if (fromCurrency === toCurrency) {
            if (embed) {
                const sameCurrencyEmbed = new EmbedBuilder()
                    .setTitle('💱 Currency Conversion')
                    .setColor(0xFFD700)
                    .setDescription(`${amount} ${fromCurrency} = ${amount} ${toCurrency} (same currency)`)
                    .setTimestamp();
                return sameCurrencyEmbed;
            } else {
                return `${amount} ${fromCurrency} = ${amount} ${toCurrency} (same currency)`;
            }
        }

        // Use the free ExchangeRate-API (no API key required)
        const response = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);

        if (!response.ok) {
            if (embed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Currency Error')
                    .setColor(0xFF0000)
                    .setDescription('Error fetching exchange rates. Please try again later.');
                return errorEmbed;
            } else {
                return `Error fetching exchange rates. Please try again later.`;
            }
        }

        const data = await response.json();

        if (data.result !== "success") {
            if (embed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Currency Error')
                    .setColor(0xFF0000)
                    .setDescription(`Error: Unable to get exchange rates for ${fromCurrency}`);
                return errorEmbed;
            } else {
                return `Error: Unable to get exchange rates for ${fromCurrency}`;
            }
        }

        const rate = data.rates[toCurrency];
        if (!rate) {
            if (embed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Currency Error')
                    .setColor(0xFF0000)
                    .setDescription(`Currency "${toCurrency}" not supported or not found in exchange rates.`);
                return errorEmbed;
            } else {
                return `Currency "${toCurrency}" not supported or not found in exchange rates.`;
            }
        }

        const convertedAmount = Math.round((amount * rate) * 100) / 100;
        const lastUpdated = new Date(data.time_last_update_unix * 1000);

        if (embed) {
            const currencyEmbed = new EmbedBuilder()
                .setTitle('💱 Currency Conversion')
                .setColor(0xFFD700)
                .addFields(
                    { name: 'From', value: `${amount} ${fromCurrency}`, inline: true },
                    { name: 'To', value: `${convertedAmount} ${toCurrency}`, inline: true },
                    { name: 'Exchange Rate', value: `1 ${fromCurrency} = ${rate} ${toCurrency}`, inline: false }
                )
                .setFooter({ text: `Last updated: ${lastUpdated.toLocaleDateString()}` })
                .setTimestamp();

            return currencyEmbed;
        } else {
            return `💱 **Currency Conversion**\n` +
                   `${amount} ${fromCurrency} = ${convertedAmount} ${toCurrency}\n` +
                   `Exchange rate: 1 ${fromCurrency} = ${rate} ${toCurrency}\n` +
                   `*Last updated: ${lastUpdated.toLocaleDateString()}*`;
        }

    } catch (error) {
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Currency Error')
                .setColor(0xFF0000)
                .setDescription(`Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}

async function learnAboutUser(information: string, message: any, embed: boolean = false): Promise<string | EmbedBuilder | { content: string | EmbedBuilder, memoryKeys: string[] }> {
    const userId = message.author.id;

    // Check if auto memory is enabled for this user
    if (!database.isAutoMemoryEnabled(userId)) {
        if (embed) {
            const disabledEmbed = new EmbedBuilder()
                .setTitle('🚫 Auto Memory Disabled')
                .setColor(0xFF9500)
                .setDescription('Automatic memory learning is disabled for this user.');
            return disabledEmbed;
        } else {
            return 'Automatic memory learning is disabled for this user.';
        }
    }

    try {
        // Use OpenAI to interpret the information and extract key-value pairs
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: `You are a memory interpreter. Your job is to take user information and convert it into structured key-value pairs for storage.

Extract meaningful information from the user's statement and format it as JSON with the following structure:
{
  "memories": [
    {
      "key": "descriptive_key_name",
      "value": "the actual value"
    }
  ]
}

Guidelines:
- Use clear, descriptive keys (e.g., "favorite_color", "location", "timezone", "occupation", "favorite_food", "hobbies", "language_preference", "news_preference")
- Keep values concise but informative
- Extract multiple pieces of information if present
- Use lowercase with underscores for keys
- If location is mentioned, try to be specific (city, country)
- Only extract information that would be useful to remember for future conversations

Examples:
"I live in Copenhagen, Denmark" → {"key": "location", "value": "Copenhagen, Denmark"}
"I like roses" → {"key": "favorite_flower", "value": "roses"}
"I'm a software developer and I love pizza" → [{"key": "occupation", "value": "software developer"}, {"key": "favorite_food", "value": "pizza"}]
"I prefer Danish news" → {"key": "news_preference", "value": "Danish"}

Only return the JSON, no other text.`
                },
                {
                    role: 'user',
                    content: information
                }
            ],
            temperature: 0.1
        });

        const responseText = completion.choices[0]?.message?.content?.trim();
        if (!responseText) {
            throw new Error('No response from AI');
        }

        const memoryData = JSON.parse(responseText);
        const memories = Array.isArray(memoryData.memories) ? memoryData.memories : [memoryData];

        let addedCount = 0;
        let addedMemories: string[] = [];
        let addedKeys: string[] = [];

        for (const memory of memories) {
            if (memory.key && memory.value) {
                const success = database.addMemory(userId, memory.key, memory.value);
                if (success) {
                    addedCount++;
                    addedMemories.push(`${memory.key}: ${memory.value}`);
                    addedKeys.push(memory.key);
                }
            }
        }

        if (addedCount > 0) {
            if (embed) {
                const memoryEmbed = new EmbedBuilder()
                    .setTitle('🧠 Learned About You!')
                    .setColor(0x5865F2)
                    .setDescription(`I've learned ${addedCount} new thing${addedCount > 1 ? 's' : ''} about you: ${addedMemories.join(', ')}`)
                    .setFooter({ text: 'React with ❌ to remove this from memory' });
                return { content: memoryEmbed, memoryKeys: addedKeys };
            } else {
                return `I've learned about you: ${addedMemories.join(', ')}`;
            }
        } else {
            if (embed) {
                const noInfoEmbed = new EmbedBuilder()
                    .setTitle('🤔 No New Information')
                    .setColor(0xFF9500)
                    .setDescription('I couldn\'t extract any new information to remember from that.');
                return noInfoEmbed;
            } else {
                return 'I couldn\'t extract any new information to remember from that.';
            }
        }

    } catch (error) {
        console.error('Error processing automatic memory:', error);
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Memory Error')
                .setColor(0xFF0000)
                .setDescription('I had trouble processing that information for memory.');
            return errorEmbed;
        } else {
            return 'I had trouble processing that information for memory.';
        }
    }
}

async function getNews(query?: string, country?: string, category?: string, sources?: string, limit: number = 5, embed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        // Validate limit
        const articleLimit = Math.min(Math.max(limit || 5, 1), 20);

        // Build the API URL
        let apiUrl = 'https://newsapi.org/v2/';
        const params = new URLSearchParams();

        params.append('apiKey', Config.newsapi_api_key);
        params.append('pageSize', articleLimit.toString());
        params.append('sortBy', 'publishedAt');

        // Determine endpoint based on parameters
        if (query && query.trim()) {
            // Use everything endpoint for search queries
            apiUrl += 'everything';
            params.append('q', query.trim());

            if (sources) {
                params.append('sources', sources);
            } else if (country && country !== 'all') {
                // For everything endpoint, we can't use country directly
                // We'll add language preference based on country
                const languageMap: Record<string, string> = {
                    'dk': 'da', 'de': 'de', 'fr': 'fr', 'es': 'es', 'it': 'it',
                    'nl': 'nl', 'no': 'no', 'se': 'sv', 'gb': 'en', 'us': 'en',
                    'jp': 'ja'
                };
                if (languageMap[country]) {
                    params.append('language', languageMap[country]);
                }
            }
        } else {
            // Check if country is supported for top-headlines endpoint
            const supportedCountries = ['us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'nl', 'no', 'se'];

            if (country === 'dk' || country === 'jp' || (country && !supportedCountries.includes(country))) {
                // For Denmark, Japan and other unsupported countries, use everything endpoint with language
                apiUrl += 'everything';

                if (country === 'dk') {
                    params.append('language', 'da');
                    params.append('q', 'Denmark OR dansk OR Copenhagen');
                } else if (country === 'jp') {
                    params.append('language', 'ja');
                    params.append('q', 'Japan OR 日本 OR Tokyo');
                } else {
                    // Fallback to English language news
                    params.append('language', 'en');
                    if (country && country !== 'all') {
                        const countryNames: Record<string, string> = {
                            'dk': 'Denmark', 'de': 'Germany', 'fr': 'France', 'es': 'Spain', 'it': 'Italy',
                            'nl': 'Netherlands', 'no': 'Norway', 'se': 'Sweden', 'ca': 'Canada', 'au': 'Australia',
                            'jp': 'Japan'
                        };
                        const countryName = countryNames[country] || country;
                        params.append('q', countryName);
                    }
                }
            } else {
                // Use top-headlines endpoint for supported countries
                apiUrl += 'top-headlines';

                if (sources) {
                    params.append('sources', sources);
                } else {
                    if (country && country !== 'all') {
                        params.append('country', country);
                    } else if (!country && !category) {
                        // Default to US top headlines when no specific parameters are given
                        params.append('country', 'us');
                    }
                    if (category) {
                        params.append('category', category);
                    }
                }
            }
        }

        console.log(`News API URL: ${apiUrl}?${params.toString()}`); // Debug log

        const response = await fetch(`${apiUrl}?${params.toString()}`);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('News API Error:', errorData); // Debug log
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'ok') {
            throw new Error(data.message || 'API returned error status');
        }

        if (!data.articles || data.articles.length === 0) {
            if (embed) {
                const noNewsEmbed = new EmbedBuilder()
                    .setTitle('📰 No News Found')
                    .setColor(0xFF9500)
                    .setDescription('No news articles found for your search criteria.');
                return noNewsEmbed;
            } else {
                return 'No news articles found for your search criteria.';
            }
        }

        const articles = data.articles.slice(0, articleLimit);

        if (embed) {
            const newsEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTimestamp();

            // Set title based on search criteria
            let title = '📰 Latest News';
            if (query) {
                title = `📰 News: ${query}`;
            } else if (country && country !== 'all') {
                const countryNames: Record<string, string> = {
                    'dk': 'Denmark', 'us': 'USA', 'gb': 'UK', 'de': 'Germany',
                    'fr': 'France', 'es': 'Spain', 'it': 'Italy', 'nl': 'Netherlands',
                    'no': 'Norway', 'se': 'Sweden', 'ca': 'Canada', 'au': 'Australia',
                    'jp': 'Japan'
                };
                title = `📰 News from ${countryNames[country] || country.toUpperCase()}`;
            } else if (category) {
                title = `📰 ${category.charAt(0).toUpperCase() + category.slice(1)} News`;
            }

            newsEmbed.setTitle(title);

            // Add articles as fields
            for (let i = 0; i < Math.min(articles.length, 5); i++) {
                const article = articles[i];
                const publishedDate = new Date(article.publishedAt).toLocaleDateString();
                const source = article.source.name;

                let description = article.description || 'No description available';
                if (description.length > 200) {
                    description = description.substring(0, 197) + '...';
                }

                const fieldValue = `${description}\n\n**Source:** ${source} • **Date:** ${publishedDate}\n[Read more](${article.url})`;

                newsEmbed.addFields({
                    name: article.title.length > 256 ? article.title.substring(0, 253) + '...' : article.title,
                    value: fieldValue.length > 1024 ? fieldValue.substring(0, 1021) + '...' : fieldValue,
                    inline: false
                });
            }

            if (articles.length > 5) {
                newsEmbed.setFooter({ text: `Showing 5 of ${articles.length} articles` });
            }

            return newsEmbed;
        } else {
            // Text format
            let result = '';

            if (query) {
                result = `📰 **Latest news about "${query}":**\n\n`;
            } else if (country && country !== 'all') {
                const countryNames: Record<string, string> = {
                    'dk': 'Denmark', 'us': 'USA', 'gb': 'UK', 'de': 'Germany',
                    'fr': 'France', 'es': 'Spain', 'it': 'Italy', 'nl': 'Netherlands',
                    'no': 'Norway', 'se': 'Sweden', 'ca': 'Canada', 'au': 'Australia',
                    'jp': 'Japan'
                };
                result = `📰 **Latest news from ${countryNames[country] || country.toUpperCase()}:**\n\n`;
            } else if (category) {
                result = `📰 **Latest ${category} news:**\n\n`;
            } else {
                result = `📰 **Latest news:**\n\n`;
            }

            for (let i = 0; i < Math.min(articles.length, 3); i++) {
                const article = articles[i];
                const publishedDate = new Date(article.publishedAt).toLocaleDateString();
                const source = article.source.name;

                result += `**${article.title}**\n`;
                if (article.description) {
                    let desc = article.description;
                    if (desc.length > 150) {
                        desc = desc.substring(0, 147) + '...';
                    }
                    result += `${desc}\n`;
                }
                result += `*${source} • ${publishedDate}* • [Read more](${article.url})\n\n`;
            }

            if (articles.length > 3) {
                result += `*Showing 3 of ${articles.length} articles*`;
            }

            return result;
        }

    } catch (error) {
        console.error('Error fetching news:', error);
        if (embed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ News Error')
                .setColor(0xFF0000)
                .setDescription(`Error fetching news: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error fetching news: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}

async function getProgrammingHelp(question: string, context?: string, showReasoning: boolean = true, embed: boolean = false): Promise<string> {
    console.log(`Getting coding help`);
    try {
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        // Create a focused programming context without chat history to avoid escalation
        const programmingPrompt = `You are an expert programming assistant with deep knowledge of software development, algorithms, debugging, and best practices.

${context ? `Context: ${context}\n\n` : ''}Question: ${question}

Please provide a comprehensive answer with:
- Clear explanations
- Code examples when relevant
- Best practices and considerations
- Step-by-step reasoning when helpful

Be thorough but concise. Use proper formatting for code blocks.`;        const completion = await openai.chat.completions.create({
            model: Config.openai_model_coding, // o4-mini
            messages: [
                {
                    role: 'user',
                    content: programmingPrompt
                }
            ]
            // Note: o4-mini only supports default temperature (1), so we omit this parameter
        });

        const response = completion.choices?.[0]?.message;
        if (!response) {
            throw new Error('No response received from coding model');
        }

        let result = '';

        // For o1 models, reasoning might be in a different property or not exposed
        // We'll just use the content for now, but this is where reasoning would go
        const reasoning = (response as any).reasoning; // Type assertion for potential reasoning field

        // Show reasoning if available and requested
        if (showReasoning && reasoning && reasoning.trim()) {
            result += `**🧠 Reasoning Process:**\n\`\`\`\n${reasoning}\n\`\`\`\n\n`;
        }

        // Add the main content
        result += response.content || 'No response content available';

        // Always return text format for programming help - code looks better in Discord with proper formatting
        return `💻 **Programming Assistance**\n\n${result}`;

    } catch (error) {
        console.error('Error getting programming help:', error);
        return `❌ **Programming Help Error**\n\nError getting programming assistance: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function getChannelHistory(
    timeQuery: string,
    message: any,
    userFilter?: string,
    topicFilter?: string,
    limit: number = 50,
    embed: boolean = false
): Promise<string | EmbedBuilder> {
    try {
        const channelId = message.channel.id;
        const now = new Date();

        // Parse the time query to determine the time range
        const timeRange = parseTimeQuery(timeQuery, now);
        if (!timeRange) {
            const errorMsg = `Could not understand time query: "${timeQuery}". Try queries like "last 15 minutes", "yesterday around this time", "an hour ago", "this morning", "last week" etc.`;
            if (embed) {
                return new EmbedBuilder()
                    .setTitle('❌ Time Query Error')
                    .setColor(0xFF0000)
                    .setDescription(errorMsg);
            } else {
                return errorMsg;
            }
        }

        // Clean up user filter (remove @ symbols, etc.)
        let authorUsername: string | undefined;
        let authorId: string | undefined;

        if (userFilter) {
            // Remove @ symbol and <@userid> mentions
            const cleanedFilter = userFilter.replace(/[@<>]/g, '').trim();

            // Check if it's a user ID (numeric)
            if (/^\d+$/.test(cleanedFilter)) {
                authorId = cleanedFilter;
            } else {
                authorUsername = cleanedFilter;
            }
        }

        // Build query options
        const queryOptions: any = {
            timeRange,
            limit: Math.min(limit || 50, 200), // Cap at 200 messages
            includeBot: false
        };

        if (authorId) queryOptions.authorId = authorId;
        if (authorUsername) queryOptions.authorUsername = authorUsername;
        if (topicFilter) queryOptions.contentSearch = topicFilter;

        // Get messages from database
        const messages = database.getHistoricalMessages(channelId, queryOptions);

        if (messages.length === 0) {
            const noResultsMsg = `No messages found for the time period "${timeQuery}"${userFilter ? ` from user "${userFilter}"` : ''}${topicFilter ? ` about "${topicFilter}"` : ''}.`;
            if (embed) {
                return new EmbedBuilder()
                    .setTitle('📝 Channel History')
                    .setColor(0xFF9500)
                    .setDescription(noResultsMsg);
            } else {
                return noResultsMsg;
            }
        }

        // Use OpenAI to create an intelligent summary
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        // Prepare messages for summarization (reverse to chronological order)
        const messagesForSummary = messages.reverse().map(msg => {
            const timestamp = new Date(msg.created_at).toLocaleString();
            return `[${timestamp}] ${msg.author_display_name}: ${msg.content}`;
        }).join('\n');

        const summaryPrompt = `You are summarizing Discord channel conversations. Analyze these messages and provide a helpful summary.

Time period: ${timeQuery}
${userFilter ? `User filter: ${userFilter}\n` : ''}${topicFilter ? `Topic filter: ${topicFilter}\n` : ''}
Message count: ${messages.length}

Messages:
${messagesForSummary}

Please provide:
1. A brief overview of what was discussed
2. Key topics and themes
3. Notable quotes or important information
4. Any questions asked or decisions made
5. Main participants in the conversation

Keep the summary conversational and helpful. If specific users were mentioned in the query, focus on their contributions.`;

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'user',
                    content: summaryPrompt
                }
            ],
            temperature: 0.3 // Lower temperature for more focused summaries
        });

        const summary = completion.choices?.[0]?.message?.content || 'Unable to generate summary.';

        if (embed) {
            const historyEmbed = new EmbedBuilder()
                .setTitle('📝 Channel History Summary')
                .setColor(0x5865F2)
                .setDescription(summary)
                .addFields(
                    { name: '⏰ Time Period', value: timeQuery, inline: true },
                    { name: '💬 Messages Found', value: messages.length.toString(), inline: true }
                )
                .setTimestamp();

            if (userFilter) {
                historyEmbed.addFields({ name: '👤 User Filter', value: userFilter, inline: true });
            }
            if (topicFilter) {
                historyEmbed.addFields({ name: '🔍 Topic Filter', value: topicFilter, inline: true });
            }

            // Add some sample messages if the summary is short
            if (summary.length < 500 && messages.length <= 5) {
                const sampleMessages = messages.slice(0, 3).map(msg => {
                    const time = new Date(msg.created_at).toLocaleTimeString();
                    return `**${time}** ${msg.author_display_name}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
                }).join('\n');

                if (sampleMessages) {
                    historyEmbed.addFields({ name: '💭 Sample Messages', value: sampleMessages, inline: false });
                }
            }

            return historyEmbed;
        } else {
            let result = `📝 **Channel History Summary**\n\n${summary}\n\n`;
            result += `**Details:**\n`;
            result += `• Time period: ${timeQuery}\n`;
            result += `• Messages found: ${messages.length}\n`;
            if (userFilter) result += `• User filter: ${userFilter}\n`;
            if (topicFilter) result += `• Topic filter: ${topicFilter}\n`;

            return result;
        }

    } catch (error) {
        console.error('Error getting channel history:', error);
        const errorMsg = `Error retrieving channel history: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (embed) {
            return new EmbedBuilder()
                .setTitle('❌ Channel History Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
        } else {
            return errorMsg;
        }
    }
}

// Helper function to parse time queries into date ranges
function parseTimeQuery(timeQuery: string, now: Date): { start: Date, end: Date } | null {
    const lower = timeQuery.toLowerCase().trim();
    const currentTime = new Date(now);

    // "last X minutes/hours/days"
    const lastMatch = lower.match(/last\s+(\d+)\s+(minutes?|hours?|days?|weeks?)/);
    if (lastMatch) {
        const amount = parseInt(lastMatch[1]);
        const unit = lastMatch[2];
        const start = new Date(currentTime);

        if (unit.startsWith('minute')) {
            start.setMinutes(start.getMinutes() - amount);
        } else if (unit.startsWith('hour')) {
            start.setHours(start.getHours() - amount);
        } else if (unit.startsWith('day')) {
            start.setDate(start.getDate() - amount);
        } else if (unit.startsWith('week')) {
            start.setDate(start.getDate() - (amount * 7));
        }

        return { start, end: currentTime };
    }

    // "X minutes/hours/days ago"
    const agoMatch = lower.match(/(\d+)\s+(minutes?|hours?|days?|weeks?)\s+ago/);
    if (agoMatch) {
        const amount = parseInt(agoMatch[1]);
        const unit = agoMatch[2];
        const targetTime = new Date(currentTime);

        if (unit.startsWith('minute')) {
            targetTime.setMinutes(targetTime.getMinutes() - amount);
            return { start: new Date(targetTime.getTime() - 30 * 60000), end: new Date(targetTime.getTime() + 30 * 60000) }; // ±30 minutes
        } else if (unit.startsWith('hour')) {
            targetTime.setHours(targetTime.getHours() - amount);
            return { start: new Date(targetTime.getTime() - 60 * 60000), end: new Date(targetTime.getTime() + 60 * 60000) }; // ±1 hour
        } else if (unit.startsWith('day')) {
            targetTime.setDate(targetTime.getDate() - amount);
            return { start: new Date(targetTime.getTime() - 4 * 3600000), end: new Date(targetTime.getTime() + 4 * 3600000) }; // ±4 hours
        } else if (unit.startsWith('week')) {
            targetTime.setDate(targetTime.getDate() - (amount * 7));
            return { start: new Date(targetTime.getTime() - 12 * 3600000), end: new Date(targetTime.getTime() + 12 * 3600000) }; // ±12 hours
        }
    }

    // "yesterday"
    if (lower.includes('yesterday')) {
        const yesterday = new Date(currentTime);
        yesterday.setDate(yesterday.getDate() - 1);

        if (lower.includes('around this time') || lower.includes('same time')) {
            // Yesterday around the same time (±2 hours)
            const start = new Date(yesterday.getTime() - 2 * 3600000);
            const end = new Date(yesterday.getTime() + 2 * 3600000);
            return { start, end };
        } else {
            // All of yesterday
            yesterday.setHours(0, 0, 0, 0);
            const start = yesterday;
            const end = new Date(yesterday.getTime() + 24 * 3600000);
            return { start, end };
        }
    }

    // "today" or "this morning/afternoon/evening"
    if (lower.includes('today') || lower.includes('this morning') || lower.includes('this afternoon') || lower.includes('this evening')) {
        const today = new Date(currentTime);
        today.setHours(0, 0, 0, 0);

        if (lower.includes('morning')) {
            return { start: today, end: new Date(today.getTime() + 12 * 3600000) }; // 0-12
        } else if (lower.includes('afternoon')) {
            const afternoon = new Date(today.getTime() + 12 * 3600000);
            return { start: afternoon, end: new Date(afternoon.getTime() + 6 * 3600000) }; // 12-18
        } else if (lower.includes('evening')) {
            const evening = new Date(today.getTime() + 18 * 3600000);
            return { start: evening, end: currentTime }; // 18-now
        } else {
            return { start: today, end: currentTime }; // All of today
        }
    }

    // "this week"
    if (lower.includes('this week')) {
        const startOfWeek = new Date(currentTime);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Go to Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        return { start: startOfWeek, end: currentTime };
    }

    // "last week"
    if (lower.includes('last week')) {
        const lastWeekStart = new Date(currentTime);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7); // Go to last Sunday
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date(lastWeekStart.getTime() + 7 * 24 * 3600000);
        return { start: lastWeekStart, end: lastWeekEnd };
    }

    return null; // Unable to parse
}


