import { EmbedBuilder } from 'discord.js';
import { Config } from '../config.js';

export const tool = {
    name: 'get_news',
    description: 'Get latest news articles from various sources. For Danish news (dk), uses DR Nyheder RSS feed. For other countries, uses NewsAPI to search for specific topics, get news from specific countries, or get top headlines.',
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query for news (e.g., 'Tesla', 'climate change', 'technology'). Leave empty for general top headlines. For Danish news, filters DR articles by this query."
            },
            country: {
                type: "string",
                description: "Country code for news (e.g., 'dk' for Denmark uses DR RSS, 'us' for USA, 'gb' for UK, 'de' for Germany). Use 'all' or leave empty for international news."
            },
            category: {
                type: "string",
                enum: ["business", "entertainment", "general", "health", "science", "sports", "technology"],
                description: "News category to filter by. Only works with top headlines (when no query is specified) and not available for Danish news."
            },
            sources: {
                type: "string",
                description: "Specific news sources to search (e.g., 'bbc-news', 'cnn', 'techcrunch'). Use comma-separated list for multiple sources. Not applicable for Danish news."
            },
            limit: {
                type: "number",
                description: "Number of articles to return (1-20, default: 5)"
            }
        }
    },
    systemPrompt: 'Use the get_news tool to fetch current news articles and headlines for users. For Danish news (country: dk), it uses DR Nyheder RSS feed for reliable local news. For other countries, it uses NewsAPI to search for topics, filter by country or category, and specify news sources.'
};

export default async function getNews(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { query, country, category, sources, limit = 5 } = args;

        // Special handling for Danish news using DR RSS feed
        if (country && country.toLowerCase() === 'dk') {
            return await getDanishNews(limit, useEmbed, query);
        }

        // Use NewsAPI for all other countries/requests
        return await getNewsFromAPI(args, useEmbed);
    } catch (error) {
        console.error('Error fetching news:', error);
        const errorMsg = `❌ Error fetching news: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ News Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
            return embed;
        } else {
            return errorMsg;
        }
    }
}

// Function to fetch Danish news from DR RSS feed
async function getDanishNews(limit: number = 5, useEmbed: boolean = false, query?: string): Promise<string | EmbedBuilder> {
    try {
        const response = await fetch('https://www.dr.dk/nyheder/service/feeds/senestenyt');

        if (!response.ok) {
            throw new Error(`DR RSS feed failed: ${response.statusText}`);
        }

        const xmlText = await response.text();

        // Simple XML parsing for RSS items
        const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g);

        if (!itemMatches || itemMatches.length === 0) {
            const noNewsMsg = '📰 No Danish news articles found at the moment.';
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('📰 No Danish News Found')
                    .setColor(0x5865F2)
                    .setDescription(noNewsMsg);
                return embed;
            } else {
                return noNewsMsg;
            }
        }

        // Parse each item
        const articles = itemMatches.slice(0, Math.min(limit, 20)).map(item => {
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                        item.match(/<title>(.*?)<\/title>/)?.[1] || 'No title';
            const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
                              item.match(/<description>(.*?)<\/description>/)?.[1] || 'No description';
            const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

            return {
                title: title.trim(),
                description: description.trim().replace(/<[^>]*>/g, ''), // Remove HTML tags
                url: link.trim(),
                publishedAt: pubDate ? new Date(pubDate).toLocaleDateString('da-DK') : 'Unknown date',
                source: 'DR Nyheder'
            };
        });

        // Filter by query if provided
        let filteredArticles = articles;
        if (query) {
            const queryLower = query.toLowerCase();
            filteredArticles = articles.filter(article =>
                article.title.toLowerCase().includes(queryLower) ||
                article.description.toLowerCase().includes(queryLower)
            );
        }

        if (filteredArticles.length === 0) {
            const noMatchMsg = query ?
                `📰 No Danish news articles found matching "${query}".` :
                '📰 No Danish news articles found at the moment.';
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('📰 No Matching Danish News')
                    .setColor(0x5865F2)
                    .setDescription(noMatchMsg);
                return embed;
            } else {
                return noMatchMsg;
            }
        }

        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('📰 Danish News (DR Nyheder)')
                .setColor(0xD42C00) // DR red color
                .setTimestamp();

            if (query) {
                embed.setDescription(`Danish news matching: **${query}**`);
            } else {
                embed.setDescription('Latest news from Denmark');
            }

            for (let i = 0; i < Math.min(filteredArticles.length, 5); i++) {
                const article = filteredArticles[i];

                embed.addFields({
                    name: `${i + 1}. ${article.title.substring(0, 100)}${article.title.length > 100 ? '...' : ''}`,
                    value: `${article.description.substring(0, 150)}${article.description.length > 150 ? '...' : ''}\n\n**Source:** ${article.source} | **Date:** ${article.publishedAt}\n${article.url ? `[Læs mere](${article.url})` : ''}`,
                    inline: false
                });
            }

            if (filteredArticles.length > 5) {
                embed.setFooter({ text: `Viser 5 af ${filteredArticles.length} artikler` });
            }

            return embed;
        } else {
            let result = '📰 **Danish News (DR Nyheder)**\n\n';

            if (query) {
                result += `Danish news matching: **${query}**\n\n`;
            } else {
                result += 'Latest news from Denmark\n\n';
            }

            for (let i = 0; i < Math.min(filteredArticles.length, 3); i++) {
                const article = filteredArticles[i];
                result += `**${i + 1}. ${article.title}**\n`;
                result += `${article.description.substring(0, 200)}${article.description.length > 200 ? '...' : ''}\n`;
                result += `*${article.source} • ${article.publishedAt}*\n`;
                if (article.url) result += `🔗 ${article.url}\n`;
                result += '\n';
            }

            if (filteredArticles.length > 3) {
                result += `*Viser 3 af ${filteredArticles.length} artikler*`;
            }

            return result;
        }
    } catch (error) {
        console.error('Error fetching Danish news:', error);
        throw new Error(`Failed to fetch Danish news: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Function to fetch news from NewsAPI (original functionality)
async function getNewsFromAPI(args: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    const { query, country, category, sources, limit = 5 } = args;
    const apiKey = Config.newsapi_api_key;

    if (!apiKey) {
        const errorMsg = '❌ News API key not configured.';
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('❌ News Error')
                .setColor(0xFF0000)
                .setDescription(errorMsg);
            return embed;
        } else {
            return errorMsg;
        }
    }

    let apiUrl = '';
    const params = new URLSearchParams();
    params.append('apiKey', apiKey);
    params.append('pageSize', Math.min(limit, 20).toString());

    // List of countries known to be supported by NewsAPI for top headlines
    const supportedCountries = ['us', 'gb', 'ca', 'au'];

    if (query) {
        // Search for specific news using Everything endpoint
        apiUrl = 'https://newsapi.org/v2/everything';
        params.append('q', query);
        if (sources) {
            params.append('sources', sources);
        }
        params.append('sortBy', 'publishedAt');
    } else {
        // Get top headlines
        if (country && country !== 'all' && supportedCountries.includes(country.toLowerCase())) {
            // Use top headlines for supported countries
            apiUrl = 'https://newsapi.org/v2/top-headlines';
            params.append('country', country);
            if (category) {
                params.append('category', category);
            }
            if (sources) {
                params.append('sources', sources);
            }
        } else {
            // International top headlines
            apiUrl = 'https://newsapi.org/v2/top-headlines';
            if (category) {
                params.append('category', category);
            }
            if (sources) {
                params.append('sources', sources);
            }
        }
    }

    const response = await fetch(`${apiUrl}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'ok') {
        throw new Error(data.message || 'API returned error status');
    }

    const articles = data.articles || [];

    if (articles.length === 0) {
        const noNewsMsg = '📰 No news articles found for your search criteria.';
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setTitle('📰 No News Found')
                .setColor(0x5865F2)
                .setDescription(noNewsMsg);
            return embed;
        } else {
            return noNewsMsg;
        }
    }

    if (useEmbed) {
        const embed = new EmbedBuilder()
            .setTitle('📰 Latest News')
            .setColor(0x5865F2)
            .setTimestamp();

        if (query) {
            embed.setDescription(`Search results for: **${query}**`);
        } else {
            let desc = 'Top headlines';
            if (country && country !== 'all') desc += ` from ${country.toUpperCase()}`;
            if (category) desc += ` in ${category}`;
            embed.setDescription(desc);
        }

        for (let i = 0; i < Math.min(articles.length, 5); i++) {
            const article = articles[i];
            const title = article.title || 'No title';
            const description = article.description || 'No description available';
            const url = article.url || '';
            const source = article.source?.name || 'Unknown source';
            const publishedAt = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown date';

            embed.addFields({
                name: `${i + 1}. ${title.substring(0, 100)}${title.length > 100 ? '...' : ''}`,
                value: `${description.substring(0, 150)}${description.length > 150 ? '...' : ''}\n\n**Source:** ${source} | **Date:** ${publishedAt}\n${url ? `[Read more](${url})` : ''}`,
                inline: false
            });
        }

        if (articles.length > 5) {
            embed.setFooter({ text: `Showing 5 of ${articles.length} articles` });
        }

        return embed;
    } else {
        let result = '📰 **Latest News**\n\n';

        if (query) {
            result += `Search results for: **${query}**\n\n`;
        } else {
            let desc = 'Top headlines';
            if (country && country !== 'all') desc += ` from ${country.toUpperCase()}`;
            if (category) desc += ` in ${category}`;
            result += `${desc}\n\n`;
        }

        for (let i = 0; i < Math.min(articles.length, 3); i++) {
            const article = articles[i];
            const title = article.title || 'No title';
            const description = article.description || 'No description available';
            const url = article.url || '';
            const source = article.source?.name || 'Unknown source';
            const publishedAt = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown date';

            result += `**${i + 1}. ${title}**\n`;
            result += `${description.substring(0, 200)}${description.length > 200 ? '...' : ''}\n`;
            result += `*${source} • ${publishedAt}*\n`;
            if (url) result += `🔗 ${url}\n`;
            result += '\n';
        }

        if (articles.length > 3) {
            result += `*Showing 3 of ${articles.length} articles*`;
        }

        return result;
    }
}
