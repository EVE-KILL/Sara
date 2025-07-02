import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { database } from '../database';
import OpenAI from 'openai';
import { Config } from '../config';

export const command = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather information for a location')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('City name, state/country (e.g., London, New York NY, Tokyo Japan)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('units')
            .setDescription('Temperature units')
            .addChoices(
                { name: 'Celsius (°C)', value: 'metric' },
                { name: 'Fahrenheit (°F)', value: 'imperial' },
                { name: 'Kelvin (K)', value: 'kelvin' }
            )
            .setRequired(false))
    .addStringOption(option =>
        option.setName('period')
            .setDescription('Time period for forecast')
            .addChoices(
                { name: 'Current Weather', value: 'now' },
                { name: 'Tomorrow', value: 'tomorrow' },
                { name: 'Day After Tomorrow', value: 'day_after_tomorrow' },
                { name: 'This Week (7 days)', value: 'this_week' }
            )
            .setRequired(false));

export default async function Weather(interaction: any, client: any) {
    if (interaction.commandName !== 'weather') return;

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let location = interaction.options.getString('location');
        const units = interaction.options.getString('units') || 'metric';
        const period = interaction.options.getString('period') || 'now';

        const userId = interaction.user.id;

        // If no location specified, try to get from user memory or ask AI
        if (!location) {
            // Check for location memory
            const locationMemory = database.getMemory(userId, 'location');
            if (locationMemory) {
                location = locationMemory.memory_value;
            } else {
                // Get all user memories and see if AI can derive a location
                const allMemories = database.getUserMemories(userId);
                if (allMemories.length > 0) {
                    location = await deriveLocationFromMemories(allMemories);
                }

                if (!location) {
                    await interaction.editReply({
                        content: '🌤️ Please tell me which location you want the weather for! You can also use `/memory add location "your city"` to set a default location.'
                    });
                    return;
                }
            }
        }

        const result = await getWeather(location, units, period);

        await interaction.editReply({
            embeds: [result]
        });
    } catch (error) {
        console.error('Error in weather command:', error);
        await interaction.editReply({
            content: 'Sorry, there was an error getting the weather information.'
        });
    }
}

async function getWeather(location: string, units: string = "metric", timePeriod: string = "now"): Promise<EmbedBuilder> {
    try {
        // First, geocode the location to get latitude and longitude
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;

        const geocodeResponse = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'Sara Discord Bot (https://github.com/your-repo)'
            }
        });

        if (!geocodeResponse.ok) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Weather Error')
                .setColor(0xFF0000)
                .setDescription(`Error finding location "${location}". Please try a different location name.`);
            return errorEmbed;
        }

        const geocodeData = await geocodeResponse.json();

        if (!geocodeData || geocodeData.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Weather Error')
                .setColor(0xFF0000)
                .setDescription(`Location "${location}" not found. Please try a more specific location name.`);
            return errorEmbed;
        }

        const { lat, lon, display_name } = geocodeData[0];

        // Determine API parameters based on time period
        const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
        const windUnit = units === "imperial" ? "mph" : "kmh";

        if (timePeriod === "now") {
            // Current weather
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=precipitation_probability&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=1`;

            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Weather Error')
                    .setColor(0xFF0000)
                    .setDescription(`Error getting weather data for "${location}".`);
                return errorEmbed;
            }

            const weatherData = await weatherResponse.json();

            if (!weatherData.current) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Weather Error')
                    .setColor(0xFF0000)
                    .setDescription(`Weather data not available for "${location}".`);
                return errorEmbed;
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
            // Future weather - simplified for now
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Feature Not Available')
                .setColor(0xFF9500)
                .setDescription('Future weather forecasts are not yet implemented in the slash command. Please use the chat interface for now.');
            return errorEmbed;
        }

    } catch (error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Weather Error')
            .setColor(0xFF0000)
            .setDescription(`Error getting weather data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return errorEmbed;
    }
}

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

async function deriveLocationFromMemories(memories: any[]): Promise<string | null> {
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
                    content: 'You are analyzing user memories to find a location for weather information. Look for any mention of city, country, or location. Return ONLY the location name in a format suitable for weather lookup (e.g., "Copenhagen, Denmark", "New York, NY", "London"). If no clear location is found, return "NONE".'
                },
                {
                    role: 'user',
                    content: `User memories: ${memoryContext}`
                }
            ],
            temperature: 0.1,
            max_completion_tokens: 50
        });

        const location = completion.choices[0]?.message?.content?.trim();
        return (location && location !== 'NONE') ? location : null;
    } catch (error) {
        console.error('Error deriving location from memories:', error);
        return null;
    }
}
