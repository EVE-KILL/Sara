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
        } else if (time_period === "tomorrow") {
            // Tomorrow's weather
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${tempUnit}&timezone=auto&forecast_days=2`;

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

            if (!weatherData.daily || weatherData.daily.time.length < 2) {
                if (useEmbed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Tomorrow's weather data not available for "${location}".`);
                    return errorEmbed;
                } else {
                    return `Tomorrow's weather data not available for "${location}".`;
                }
            }

            // Get tomorrow's data (index 1)
            const tomorrowData = {
                weather_code: weatherData.daily.weather_code[1],
                temp_max: Math.round(weatherData.daily.temperature_2m_max[1]),
                temp_min: Math.round(weatherData.daily.temperature_2m_min[1]),
                precipitation_probability: weatherData.daily.precipitation_probability_max[1]
            };

            const weatherDescription = getWeatherDescription(tomorrowData.weather_code);
            const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";

            let displayTempMax = tomorrowData.temp_max;
            let displayTempMin = tomorrowData.temp_min;

            if (units === "kelvin") {
                displayTempMax = tempUnit === "fahrenheit"
                    ? Math.round(((tomorrowData.temp_max - 32) * 5/9) + 273.15)
                    : Math.round(tomorrowData.temp_max + 273.15);
                displayTempMin = tempUnit === "fahrenheit"
                    ? Math.round(((tomorrowData.temp_min - 32) * 5/9) + 273.15)
                    : Math.round(tomorrowData.temp_min + 273.15);
            }

            const tomorrowDate = new Date();
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);
            const dateStr = tomorrowDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });

            if (useEmbed) {
                const weatherEmbed = new EmbedBuilder()
                    .setTitle(`🌤️ Tomorrow's Weather`)
                    .setColor(0x87CEEB)
                    .addFields(
                        { name: '📍 Location', value: display_name.split(',')[0], inline: false },
                        { name: '📅 Date', value: dateStr, inline: false },
                        { name: '🌡️ High', value: `${displayTempMax}${tempSymbol}`, inline: true },
                        { name: '🌡️ Low', value: `${displayTempMin}${tempSymbol}`, inline: true },
                        { name: '☁️ Condition', value: weatherDescription, inline: true },
                        { name: '🌧️ Rain Chance', value: `${tomorrowData.precipitation_probability}%`, inline: true }
                    )
                    .setTimestamp();

                return weatherEmbed;
            } else {
                return `🌤️ **Tomorrow's Weather in ${display_name.split(',')[0]}** (${dateStr})\n` +
                       `High: ${displayTempMax}${tempSymbol} | Low: ${displayTempMin}${tempSymbol}\n` +
                       `Condition: ${weatherDescription}\n` +
                       `Rain chance: ${tomorrowData.precipitation_probability}%`;
            }
        } else if (time_period === "day_after_tomorrow") {
            // Day after tomorrow's weather
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${tempUnit}&timezone=auto&forecast_days=3`;

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

            if (!weatherData.daily || weatherData.daily.time.length < 3) {
                if (useEmbed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`Day after tomorrow's weather data not available for "${location}".`);
                    return errorEmbed;
                } else {
                    return `Day after tomorrow's weather data not available for "${location}".`;
                }
            }

            // Get day after tomorrow's data (index 2)
            const dayAfterData = {
                weather_code: weatherData.daily.weather_code[2],
                temp_max: Math.round(weatherData.daily.temperature_2m_max[2]),
                temp_min: Math.round(weatherData.daily.temperature_2m_min[2]),
                precipitation_probability: weatherData.daily.precipitation_probability_max[2]
            };

            const weatherDescription = getWeatherDescription(dayAfterData.weather_code);
            const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";

            let displayTempMax = dayAfterData.temp_max;
            let displayTempMin = dayAfterData.temp_min;

            if (units === "kelvin") {
                displayTempMax = tempUnit === "fahrenheit"
                    ? Math.round(((dayAfterData.temp_max - 32) * 5/9) + 273.15)
                    : Math.round(dayAfterData.temp_max + 273.15);
                displayTempMin = tempUnit === "fahrenheit"
                    ? Math.round(((dayAfterData.temp_min - 32) * 5/9) + 273.15)
                    : Math.round(dayAfterData.temp_min + 273.15);
            }

            const dayAfterDate = new Date();
            dayAfterDate.setDate(dayAfterDate.getDate() + 2);
            const dateStr = dayAfterDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });

            if (useEmbed) {
                const weatherEmbed = new EmbedBuilder()
                    .setTitle(`🌤️ Day After Tomorrow's Weather`)
                    .setColor(0x87CEEB)
                    .addFields(
                        { name: '📍 Location', value: display_name.split(',')[0], inline: false },
                        { name: '📅 Date', value: dateStr, inline: false },
                        { name: '🌡️ High', value: `${displayTempMax}${tempSymbol}`, inline: true },
                        { name: '🌡️ Low', value: `${displayTempMin}${tempSymbol}`, inline: true },
                        { name: '☁️ Condition', value: weatherDescription, inline: true },
                        { name: '🌧️ Rain Chance', value: `${dayAfterData.precipitation_probability}%`, inline: true }
                    )
                    .setTimestamp();

                return weatherEmbed;
            } else {
                return `🌤️ **Day After Tomorrow's Weather in ${display_name.split(',')[0]}** (${dateStr})\n` +
                       `High: ${displayTempMax}${tempSymbol} | Low: ${displayTempMin}${tempSymbol}\n` +
                       `Condition: ${weatherDescription}\n` +
                       `Rain chance: ${dayAfterData.precipitation_probability}%`;
            }
        } else if (time_period === "this_week") {
            // 7-day forecast
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${tempUnit}&timezone=auto&forecast_days=7`;

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

            if (!weatherData.daily || weatherData.daily.time.length < 7) {
                if (useEmbed) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Weather Error')
                        .setColor(0xFF0000)
                        .setDescription(`7-day forecast not available for "${location}".`);
                    return errorEmbed;
                } else {
                    return `7-day forecast not available for "${location}".`;
                }
            }

            const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";

            if (useEmbed) {
                const weatherEmbed = new EmbedBuilder()
                    .setTitle(`🌤️ 7-Day Weather Forecast`)
                    .setColor(0x87CEEB)
                    .addFields({ name: '📍 Location', value: display_name.split(',')[0], inline: false });

                for (let i = 0; i < 7; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : date.toLocaleDateString('en-US', { weekday: 'short' });

                    let tempMax = Math.round(weatherData.daily.temperature_2m_max[i]);
                    let tempMin = Math.round(weatherData.daily.temperature_2m_min[i]);

                    if (units === "kelvin") {
                        tempMax = tempUnit === "fahrenheit"
                            ? Math.round(((tempMax - 32) * 5/9) + 273.15)
                            : Math.round(tempMax + 273.15);
                        tempMin = tempUnit === "fahrenheit"
                            ? Math.round(((tempMin - 32) * 5/9) + 273.15)
                            : Math.round(tempMin + 273.15);
                    }

                    const condition = getWeatherDescription(weatherData.daily.weather_code[i]);
                    const rainChance = weatherData.daily.precipitation_probability_max[i];

                    weatherEmbed.addFields({
                        name: dayName,
                        value: `${tempMax}°/${tempMin}° ${condition} (${rainChance}% rain)`,
                        inline: false
                    });
                }

                weatherEmbed.setTimestamp();
                return weatherEmbed;
            } else {
                let result = `🌤️ **7-Day Weather Forecast for ${display_name.split(',')[0]}**\n\n`;

                for (let i = 0; i < 7; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : date.toLocaleDateString('en-US', { weekday: 'long' });

                    let tempMax = Math.round(weatherData.daily.temperature_2m_max[i]);
                    let tempMin = Math.round(weatherData.daily.temperature_2m_min[i]);

                    if (units === "kelvin") {
                        tempMax = tempUnit === "fahrenheit"
                            ? Math.round(((tempMax - 32) * 5/9) + 273.15)
                            : Math.round(tempMax + 273.15);
                        tempMin = tempUnit === "fahrenheit"
                            ? Math.round(((tempMin - 32) * 5/9) + 273.15)
                            : Math.round(tempMin + 273.15);
                    }

                    const condition = getWeatherDescription(weatherData.daily.weather_code[i]);
                    const rainChance = weatherData.daily.precipitation_probability_max[i];

                    result += `**${dayName}**: ${tempMax}°${tempSymbol}/${tempMin}°${tempSymbol} ${condition} (${rainChance}% rain)\n`;
                }

                return result;
            }
        } else {
            // Handle other time periods (hourly forecasts, relative times, etc.)
            const hourlyMatch = parseTimeQuery(time_period);

            if (hourlyMatch) {
                // Get hourly forecast data
                const forecastDays = Math.ceil(hourlyMatch.endHour / 24) + 1;
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation_probability,precipitation&temperature_unit=${tempUnit}&timezone=auto&forecast_days=${forecastDays}`;

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

                if (!weatherData.hourly) {
                    if (useEmbed) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Weather Error')
                            .setColor(0xFF0000)
                            .setDescription(`Hourly weather data not available for "${location}".`);
                        return errorEmbed;
                    } else {
                        return `Hourly weather data not available for "${location}".`;
                    }
                }

                return formatHourlyWeather(weatherData, hourlyMatch, display_name, units, time_period, useEmbed);
            } else {
                const futureMsg = `🌤️ Extended forecasts for "${time_period}" are not yet supported. Try:\n- "now", "tomorrow", "day_after_tomorrow", "this_week"\n- "in X hours" (e.g., "in 3 hours")\n- "next X hours" (e.g., "next 6 hours")\n- "between X and Y" (e.g., "between 14 and 18")`;
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

// Helper function to parse time queries into hour ranges
function parseTimeQuery(timeQuery: string): { startHour: number; endHour: number; type: 'specific' | 'range' | 'next' } | null {
    const query = timeQuery.toLowerCase().trim();

    // Match "in X hours" or "in X hour"
    const inHoursMatch = query.match(/^in (\d+) hours?$/);
    if (inHoursMatch) {
        const hours = parseInt(inHoursMatch[1]);
        return { startHour: hours, endHour: hours, type: 'specific' };
    }

    // Match "next X hours" or "next X hour"
    const nextHoursMatch = query.match(/^(?:next|in the next) (\d+) hours?$/);
    if (nextHoursMatch) {
        const hours = parseInt(nextHoursMatch[1]);
        return { startHour: 0, endHour: hours, type: 'next' };
    }

    // Match "between X and Y" or "from X to Y"
    const rangeMatch = query.match(/^(?:between|from) (\d+) (?:and|to) (\d+)$/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        return { startHour: start, endHour: end, type: 'range' };
    }

    // Match "X-Y hours" or "X to Y hours"
    const dashRangeMatch = query.match(/^(\d+)-(\d+) hours?$/);
    if (dashRangeMatch) {
        const start = parseInt(dashRangeMatch[1]);
        const end = parseInt(dashRangeMatch[2]);
        return { startHour: start, endHour: end, type: 'range' };
    }

    return null;
}

// Helper function to format hourly weather data
function formatHourlyWeather(weatherData: any, timeQuery: { startHour: number; endHour: number; type: 'specific' | 'range' | 'next' }, displayName: string, units: string, originalQuery: string, useEmbed: boolean): string | EmbedBuilder {
    const tempSymbol = units === "imperial" ? "°F" : units === "kelvin" ? "K" : "°C";
    const now = new Date();
    const currentHour = now.getHours();

    let startIndex: number;
    let endIndex: number;

    if (timeQuery.type === 'specific') {
        // "in X hours" - specific hour
        startIndex = endIndex = currentHour + timeQuery.startHour;
    } else if (timeQuery.type === 'next') {
        // "next X hours" - range from now to X hours from now
        startIndex = currentHour;
        endIndex = currentHour + timeQuery.endHour;
    } else {
        // "between X and Y" - specific time range
        startIndex = timeQuery.startHour;
        endIndex = timeQuery.endHour;
    }

    // Ensure we don't go beyond available data
    const maxHours = weatherData.hourly.time.length;
    endIndex = Math.min(endIndex, maxHours - 1);
    startIndex = Math.max(0, Math.min(startIndex, maxHours - 1));

    const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";

    if (timeQuery.type === 'specific' && startIndex < maxHours) {
        // Single hour forecast
        const hourData = {
            time: weatherData.hourly.time[startIndex],
            temperature: Math.round(weatherData.hourly.temperature_2m[startIndex]),
            humidity: weatherData.hourly.relative_humidity_2m[startIndex],
            weather_code: weatherData.hourly.weather_code[startIndex],
            precipitation_probability: weatherData.hourly.precipitation_probability[startIndex],
            precipitation: weatherData.hourly.precipitation ? weatherData.hourly.precipitation[startIndex] : 0
        };

        let displayTemp = hourData.temperature;
        if (units === "kelvin") {
            displayTemp = tempUnit === "fahrenheit"
                ? Math.round(((hourData.temperature - 32) * 5/9) + 273.15)
                : Math.round(hourData.temperature + 273.15);
        }

        const weatherDescription = getWeatherDescription(hourData.weather_code);
        const hourTime = new Date(hourData.time).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        if (useEmbed) {
            const weatherEmbed = new EmbedBuilder()
                .setTitle(`🌤️ Weather ${originalQuery}`)
                .setColor(0x87CEEB)
                .addFields(
                    { name: '📍 Location', value: displayName.split(',')[0], inline: false },
                    { name: '🕐 Time', value: hourTime, inline: false },
                    { name: '🌡️ Temperature', value: `${displayTemp}${tempSymbol}`, inline: true },
                    { name: '☁️ Condition', value: weatherDescription, inline: true },
                    { name: '💧 Humidity', value: `${hourData.humidity}%`, inline: true },
                    { name: '🌧️ Rain Chance', value: `${hourData.precipitation_probability}%`, inline: true }
                )
                .setTimestamp();

            if (hourData.precipitation > 0) {
                weatherEmbed.addFields({ name: '🌦️ Precipitation', value: `${hourData.precipitation}mm`, inline: true });
            }

            return weatherEmbed;
        } else {
            let result = `🌤️ **Weather ${originalQuery} in ${displayName.split(',')[0]}** (${hourTime})\n` +
                        `Temperature: ${displayTemp}${tempSymbol}\n` +
                        `Condition: ${weatherDescription}\n` +
                        `Humidity: ${hourData.humidity}%\n` +
                        `Rain chance: ${hourData.precipitation_probability}%`;

            if (hourData.precipitation > 0) {
                result += `\nPrecipitation: ${hourData.precipitation}mm`;
            }

            return result;
        }
    } else {
        // Range forecast
        let totalPrecipProb = 0;
        let maxPrecipProb = 0;
        let totalPrecip = 0;
        let avgTemp = 0;
        let conditions: string[] = [];
        let hourCount = 0;

        // Track precipitation periods for detailed rain timing
        const precipThreshold = 30; // Consider >30% as significant chance of rain
        const rainPeriods: { start: number; end: number; avgChance: number }[] = [];
        let currentPeriodStart: number | null = null;
        let currentPeriodProbs: number[] = [];

        for (let i = startIndex; i <= endIndex && i < maxHours; i++) {
            const precipProb = weatherData.hourly.precipitation_probability[i] || 0;
            const precip = weatherData.hourly.precipitation ? weatherData.hourly.precipitation[i] : 0;
            const temp = weatherData.hourly.temperature_2m[i];
            const weatherCode = weatherData.hourly.weather_code[i];

            totalPrecipProb += precipProb;
            maxPrecipProb = Math.max(maxPrecipProb, precipProb);
            totalPrecip += precip;
            avgTemp += temp;

            const condition = getWeatherDescription(weatherCode);
            if (!conditions.includes(condition)) {
                conditions.push(condition);
            }

            // Track rain periods
            if (precipProb >= precipThreshold) {
                if (currentPeriodStart === null) {
                    currentPeriodStart = i;
                    currentPeriodProbs = [precipProb];
                } else {
                    currentPeriodProbs.push(precipProb);
                }
            } else {
                if (currentPeriodStart !== null) {
                    // End of rain period
                    const avgChance = Math.round(currentPeriodProbs.reduce((a, b) => a + b, 0) / currentPeriodProbs.length);
                    rainPeriods.push({
                        start: currentPeriodStart,
                        end: i - 1,
                        avgChance
                    });
                    currentPeriodStart = null;
                    currentPeriodProbs = [];
                }
            }

            hourCount++;
        }

        // Handle case where rain period extends to the end
        if (currentPeriodStart !== null) {
            const avgChance = Math.round(currentPeriodProbs.reduce((a, b) => a + b, 0) / currentPeriodProbs.length);
            rainPeriods.push({
                start: currentPeriodStart,
                end: Math.min(endIndex, maxHours - 1),
                avgChance
            });
        }

        if (hourCount === 0) {
            const errorMsg = `No weather data available for the requested time period.`;
            if (useEmbed) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Weather Error')
                    .setColor(0xFF0000)
                    .setDescription(errorMsg);
                return errorEmbed;
            } else {
                return errorMsg;
            }
        }

        const avgPrecipProb = Math.round(totalPrecipProb / hourCount);
        avgTemp = Math.round(avgTemp / hourCount);

        let displayTemp = avgTemp;
        if (units === "kelvin") {
            displayTemp = tempUnit === "fahrenheit"
                ? Math.round(((avgTemp - 32) * 5/9) + 273.15)
                : Math.round(avgTemp + 273.15);
        }

        const startTime = new Date(weatherData.hourly.time[startIndex]).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true
        });
        const endTime = new Date(weatherData.hourly.time[Math.min(endIndex, maxHours - 1)]).toLocaleTimeString('en-US', {
            hour: 'numeric',
            hour12: true
        });

        // Format rain periods
        const formatRainPeriods = (periods: { start: number; end: number; avgChance: number }[]) => {
            if (periods.length === 0) return 'No significant rain expected';

            return periods.map(period => {
                const startTime = new Date(weatherData.hourly.time[period.start]).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true
                });
                const endTime = new Date(weatherData.hourly.time[period.end]).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true
                });

                if (period.start === period.end) {
                    return `${startTime} (${period.avgChance}%)`;
                } else {
                    return `${startTime}-${endTime} (${period.avgChance}%)`;
                }
            }).join(', ');
        };

        const rainPeriodsText = formatRainPeriods(rainPeriods);

        if (useEmbed) {
            const weatherEmbed = new EmbedBuilder()
                .setTitle(`🌤️ Weather ${originalQuery}`)
                .setColor(0x87CEEB)
                .addFields(
                    { name: '📍 Location', value: displayName.split(',')[0], inline: false },
                    { name: '🕐 Time Range', value: `${startTime} - ${endTime}`, inline: false },
                    { name: '🌡️ Avg Temperature', value: `${displayTemp}${tempSymbol}`, inline: true },
                    { name: '☁️ Conditions', value: conditions.slice(0, 3).join(', '), inline: true },
                    { name: '🌧️ Rain Chance', value: `${avgPrecipProb}% avg, ${maxPrecipProb}% max`, inline: true }
                )
                .setTimestamp();

            if (totalPrecip > 0) {
                weatherEmbed.addFields({ name: '🌦️ Total Precipitation', value: `${totalPrecip.toFixed(1)}mm`, inline: true });
            }

            // Add rain periods if any significant rain is expected
            if (rainPeriods.length > 0) {
                weatherEmbed.addFields({
                    name: '⏰ Rain Times',
                    value: rainPeriodsText.length > 1024 ? rainPeriodsText.substring(0, 1021) + '...' : rainPeriodsText,
                    inline: false
                });
            }

            return weatherEmbed;
        } else {
            let result = `🌤️ **Weather ${originalQuery} in ${displayName.split(',')[0]}** (${startTime} - ${endTime})\n` +
                        `Average temperature: ${displayTemp}${tempSymbol}\n` +
                        `Conditions: ${conditions.slice(0, 3).join(', ')}\n` +
                        `Rain chance: ${avgPrecipProb}% average, ${maxPrecipProb}% maximum`;

            if (totalPrecip > 0) {
                result += `\nTotal precipitation: ${totalPrecip.toFixed(1)}mm`;
            }

            // Add rain periods if any significant rain is expected
            if (rainPeriods.length > 0) {
                result += `\nRain expected: ${rainPeriodsText}`;
            }

            return result;
        }
    }
}
