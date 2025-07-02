# Sara Bot - Tool Capabilities

Sara has enhanced capabilities with GPT-4.1-Mini's tool calling features! Here are the exciting new things you can ask Sara to do:

## 🕐 Time & Date Tools

- **Current Time**: "What time is it?" or "What time is it in Tokyo?"
- **Timezone Support**: Ask for time in any timezone like "America/New_York", "Europe/London", "Asia/Tokyo"

**Examples:**

- `@Sara what time is it?`
- `@Sara what's the current time in London?`
- `@Sara show me the time in America/Los_Angeles`

## 🧮 Calculator Tools

- **Math Operations**: Basic arithmetic, percentages, and more
- **Safe Evaluation**: Only allows mathematical expressions

**Examples:**

- `@Sara calculate 15% of 250`
- `@Sara what's 2 + 2 * 5?`
- `@Sara solve (100 - 25) / 3`

## 🌤️ Weather Information

- **Current Weather**: Get real-time weather for any location worldwide
- **Future Forecasts**: Tomorrow, day after tomorrow, or weekly forecasts
- **Precipitation Probability**: Chance of rain for current and future weather
- **Automatic Geocoding**: Just provide city names, no coordinates needed
- **Multiple Units**: Celsius, Fahrenheit, or Kelvin
- **Detailed Info**: Temperature, conditions, humidity, wind, and chance of rain
- **Hourly Breakdowns**: Future forecasts show key times of day
- **Powered by**: Open-Meteo (free API, no key required)

**Examples:**

- `@Sara what's the weather in Aalborg?`
- `@Sara show me tomorrow's weather in Tokyo`
- `@Sara how's the weather in New York this week?`
- `@Sara weather for day after tomorrow in London`
- `@Sara weather in Paris in Fahrenheit`

## 💱 Currency Conversion

- **Real-time Rates**: Live exchange rates updated daily
- **170+ Currencies**: Support for all major world currencies
- **Accurate Calculations**: Precise conversion with current exchange rates
- **Rate Information**: Shows exchange rates and last update time
- **Powered by**: ExchangeRate-API (free tier, no key required)

**Examples:**

- `@Sara convert 100 USD to EUR`
- `@Sara how much is 50 GBP in JPY?`
- `@Sara convert 1000 DKK to USD`
- `@Sara 250 EUR to CAD`

## 🏠 Discord Server Information

- **Server Stats**: Get member count, channel count, role count, etc.
- **Server Details**: Creation date, server name, and comprehensive info

**Examples:**

- `@Sara how many members are in this server?`
- `@Sara show me all server info`
- `@Sara when was this server created?`

## 🎲 Random Generators

- **Random Numbers**: Generate numbers within a range
- **Passwords**: Secure password generation (shown in spoiler tags)
- **UUIDs**: Generate unique identifiers
- **Dice Rolls**: Virtual dice with custom sides

**Examples:**

- `@Sara give me a random number between 1 and 100`
- `@Sara generate a secure password`
- `@Sara roll a 20-sided die`
- `@Sara create a UUID`

## 🔐 Text Encoding/Decoding

- **Base64**: Encode and decode Base64 text
- **URL Encoding**: Handle URL-safe text encoding
- **Hex Encoding**: Convert text to/from hexadecimal

**Examples:**

- `@Sara encode "hello world" in base64`
- `@Sara decode SGVsbG8gV29ybGQ= from base64`
- `@Sara URL encode this text: hello world!`
- `@Sara hex encode "test"`

## 🖼️ Image Analysis (Already Available)

Sara can also analyze images you share and answer questions about them!

**Examples:**

- Share an image and ask: `@Sara what do you see in this image?`
- `@Sara describe this picture`
- `@Sara what's in this photo?`

## How It Works

Sara uses GPT-4.1-Mini's function calling capabilities to intelligently decide when to use tools based on your requests. Simply mention Sara and ask naturally - she'll automatically use the right tool for the job!

The tools are executed securely and results are integrated naturally into Sara's responses, making interactions feel seamless and helpful.

## Weather Time Periods Explained

When asking for weather, Sara can understand different time periods:

- **"now"** or current weather: Real-time conditions with current hour's precipitation probability
- **"tomorrow"**: Hourly breakdown for tomorrow (8 AM, 12 PM, 6 PM, Midnight) with chance of rain
- **"day after tomorrow"**: Hourly breakdown for the day after tomorrow with chance of rain
- **"this week"**: 7-day forecast overview with daily conditions and precipitation probability

Sara will automatically detect your intent from natural language like "tomorrow's weather", "weather this week", etc.

---

**Note**: All tools work in both servers and DMs. Some server-specific tools (like server info) will only work in server channels, not in DMs.
