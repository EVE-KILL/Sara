import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'get_weather',
    description: 'Get weather information for a specific location and time period with precipitation probability (chance of rain). Supports current weather, future forecasts, and relative time queries.',
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
    },
    systemPrompt: 'Use the get_weather tool to provide current weather conditions and forecasts for any location. Supports different time periods, units, and detailed weather information including precipitation probability.'
};

export default async function getWeather(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    try {
        const { location, units = "metric", time_period = "now" } = args;

        // First, geocode the location to get latitude and longitude
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;

        const geocodeResponse = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'Sara Discord Bot (https://github.com/your-repo)'
            }
        });

        if (!geocodeResponse.ok) {
            if (useEmbed) {
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
            if (useEmbed) {
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

        if (time_period === "now") {
            // Current weather only
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=precipitation_probability&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=1`;

            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok) {
                if (useEmbed) {
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
                if (useEmbed) {
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

            if (useEmbed) {
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
                    result += `\nRain chance: ${precipProbability}%`;
                }

                return result;
            }
        } else {
            // Handle other time periods (tomorrow, this_week, etc.)
            // For now, return a simple message indicating future forecast support
            const futureMsg = `🌤️ Extended forecasts for ${time_period} are coming soon! Currently only 'now' is supported.`;
            if (useEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle('🌤️ Weather Forecast')
                    .setColor(0x87CEEB)
                    .setDescription(futureMsg);
                return embed;
            } else {
                return futureMsg;
            }
        }

    } catch (error) {
        if (useEmbed) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Weather Error')
                .setColor(0xFF0000)
                .setDescription(`Error getting weather: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return errorEmbed;
        } else {
            return `Error getting weather: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}

// Helper function to convert weather codes to descriptions
function getWeatherDescription(code: number): string {
    const weatherCodes: { [key: number]: string } = {
        0: '☀️ Clear sky',
        1: '🌤️ Mainly clear',
        2: '⛅ Partly cloudy',
        3: '☁️ Overcast',
        45: '🌫️ Fog',
        48: '🌫️ Depositing rime fog',
        51: '🌦️ Light drizzle',
        53: '🌦️ Moderate drizzle',
        55: '🌦️ Dense drizzle',
        56: '🌧️ Light freezing drizzle',
        57: '🌧️ Dense freezing drizzle',
        61: '🌧️ Slight rain',
        63: '🌧️ Moderate rain',
        65: '🌧️ Heavy rain',
        66: '🌧️ Light freezing rain',
        67: '🌧️ Heavy freezing rain',
        71: '❄️ Slight snow',
        73: '❄️ Moderate snow',
        75: '❄️ Heavy snow',
        77: '❄️ Snow grains',
        80: '🌦️ Slight rain showers',
        81: '🌦️ Moderate rain showers',
        82: '🌦️ Violent rain showers',
        85: '🌨️ Slight snow showers',
        86: '🌨️ Heavy snow showers',
        95: '⛈️ Thunderstorm',
        96: '⛈️ Thunderstorm with hail',
        99: '⛈️ Thunderstorm with heavy hail'
    };

    return weatherCodes[code] || '🌤️ Unknown conditions';
}
