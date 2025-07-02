import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { database } from '../database';
import OpenAI from 'openai';
import { Config } from '../config';

export const command = new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get latest news articles')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Search for specific news topics (e.g., Tesla, climate change)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('country')
            .setDescription('Country for news')
            .addChoices(
                { name: 'All Countries', value: 'all' },
                { name: 'Denmark', value: 'dk' },
                { name: 'United States', value: 'us' },
                { name: 'United Kingdom', value: 'gb' },
                { name: 'Germany', value: 'de' },
                { name: 'France', value: 'fr' },
                { name: 'Japan', value: 'jp' },
                { name: 'Canada', value: 'ca' },
                { name: 'Australia', value: 'au' }
            )
            .setRequired(false))
    .addStringOption(option =>
        option.setName('category')
            .setDescription('News category')
            .addChoices(
                { name: 'Business', value: 'business' },
                { name: 'Entertainment', value: 'entertainment' },
                { name: 'Health', value: 'health' },
                { name: 'Science', value: 'science' },
                { name: 'Sports', value: 'sports' },
                { name: 'Technology', value: 'technology' }
            )
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('limit')
            .setDescription('Number of articles to show (1-10)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false));

export default async function News(interaction: any, client: any) {
    if (interaction.commandName !== 'news') return;

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let query = interaction.options.getString('query');
        let country = interaction.options.getString('country');
        const category = interaction.options.getString('category');
        const limit = interaction.options.getInteger('limit') || 5;

        const userId = interaction.user.id;

        // If no specific parameters provided, try to derive from user preferences
        if (!query && !country && !category) {
            const allMemories = database.getUserMemories(userId);

            if (allMemories.length > 0) {
                const preferences = await deriveNewsPreferences(allMemories);

                if (preferences.country) {
                    country = preferences.country;
                }
                if (preferences.interests) {
                    query = preferences.interests;
                }
            }
        }

        // If still no country, check for location memory
        if (!country) {
            const locationMemory = database.getMemory(userId, 'location');
            if (locationMemory) {
                country = await deriveCountryFromLocation(locationMemory.memory_value);
            }
        }

        // Check for news preference memory
        if (!country) {
            const newsPreferenceMemory = database.getMemory(userId, 'news_preference');
            if (newsPreferenceMemory) {
                country = await mapNewsPreferenceToCountry(newsPreferenceMemory.memory_value);
            }
        }

        const result = await getNews(query, country, category, undefined, limit);

        if (result instanceof EmbedBuilder) {
            await interaction.editReply({
                embeds: [result]
            });
        } else {
            await interaction.editReply({
                content: result
            });
        }
    } catch (error) {
        console.error('Error in news command:', error);
        await interaction.editReply({
            content: 'Sorry, there was an error getting the news.'
        });
    }
}

async function deriveNewsPreferences(memories: any[]): Promise<{ country?: string, interests?: string }> {
    try {
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        const memoryContext = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join(', ');

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: `You are analyzing user memories to determine news preferences. Return a JSON object with:
                    - "country": country code (dk, us, gb, de, fr, jp, ca, au) if location/nationality is mentioned
                    - "interests": general topic/interest that might be newsworthy (if any professional/hobby interests are mentioned)

                    Examples:
                    - "location: Copenhagen, Denmark" → {"country": "dk"}
                    - "occupation: software developer, location: Tokyo" → {"country": "jp", "interests": "technology"}
                    - "hobbies: football, location: London" → {"country": "gb", "interests": "sports"}

                    Return only the JSON, or {"country": null, "interests": null} if nothing relevant is found.`
                },
                {
                    role: 'user',
                    content: `User memories: ${memoryContext}`
                }
            ],
            temperature: 0.1,
            max_tokens: 100
        });

        const responseText = completion.choices[0]?.message?.content?.trim();
        if (responseText) {
            const preferences = JSON.parse(responseText);
            return {
                country: preferences.country || undefined,
                interests: preferences.interests || undefined
            };
        }
        return {};
    } catch (error) {
        console.error('Error deriving news preferences from memories:', error);
        return {};
    }
}

async function deriveCountryFromLocation(location: string): Promise<string | null> {
    try {
        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        const completion = await openai.chat.completions.create({
            model: Config.openai_model,
            messages: [
                {
                    role: 'system',
                    content: 'Given a location, return the country code for news: dk (Denmark), us (USA), gb (UK), de (Germany), fr (France), jp (Japan), ca (Canada), au (Australia). Return only the code or "NONE" if not supported.'
                },
                {
                    role: 'user',
                    content: `Location: ${location}`
                }
            ],
            temperature: 0.1,
            max_tokens: 10
        });

        const country = completion.choices[0]?.message?.content?.trim();
        return (country && country !== 'NONE') ? country : null;
    } catch (error) {
        console.error('Error deriving country from location:', error);
        return null;
    }
}

async function mapNewsPreferenceToCountry(preference: string): Promise<string | null> {
    const mapping: Record<string, string> = {
        'danish': 'dk',
        'denmark': 'dk',
        'american': 'us',
        'usa': 'us',
        'british': 'gb',
        'uk': 'gb',
        'german': 'de',
        'germany': 'de',
        'french': 'fr',
        'france': 'fr',
        'japanese': 'jp',
        'japan': 'jp',
        'canadian': 'ca',
        'canada': 'ca',
        'australian': 'au',
        'australia': 'au'
    };

    return mapping[preference.toLowerCase()] || null;
}

async function getNews(query?: string, country?: string, category?: string, sources?: string, limit: number = 5): Promise<string | EmbedBuilder> {
    try {
        // Validate limit
        const articleLimit = Math.min(Math.max(limit || 5, 1), 20);

        // Build the API URL
        let apiUrl = 'https://newsapi.org/v2/';
        const params = new URLSearchParams();

        params.append('apiKey', Config.newsapi_api_key);
        params.append('pageSize', articleLimit.toString());
        params.append('sortBy', 'popularity');

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

        const response = await fetch(`${apiUrl}?${params.toString()}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'ok') {
            throw new Error(data.message || 'API returned error status');
        }

        if (!data.articles || data.articles.length === 0) {
            const noNewsEmbed = new EmbedBuilder()
                .setTitle('📰 No News Found')
                .setColor(0xFF9500)
                .setDescription('No news articles found for your search criteria.');
            return noNewsEmbed;
        }

        const articles = data.articles.slice(0, articleLimit);

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

    } catch (error) {
        console.error('Error fetching news:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ News Error')
            .setColor(0xFF0000)
            .setDescription(`Error fetching news: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return errorEmbed;
    }
}
