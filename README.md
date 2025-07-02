# Sara Discord Bot

Sara is a Discord bot with a variety of features, including AI integration, weather, news, and more.

## Features
- AI chat and coding (OpenAI)
- Weather and news commands
- Currency conversion
- Instagram, TikTok, and Reddit integrations
- Voice and image features

## Prerequisites
- [Bun](https://bun.sh/) (JavaScript runtime)
- A Discord account and server (to add your bot)

## Getting Started

### 1. Clone the Repository
```sh
git clone https://github.com/EVE-KILL/Sara
cd sara
```

### 2. Install Dependencies
```sh
bun install
```

### 3. Configure API Keys
Copy the example config to a new file:
```sh
cp config.example.ts config.ts
```
Edit `config.ts` and fill in the required API keys and settings:

| Key                  | Description                        | Where to get it |
|----------------------|------------------------------------|-----------------|
| `token`              | Discord Bot Token                  | [Discord Developer Portal](https://discord.com/developers/applications) |
| `clientId`           | Discord Application Client ID      | [Discord Developer Portal](https://discord.com/developers/applications) |
| `openai_api_key`     | OpenAI API Key                     | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `newsapi_api_key`    | NewsAPI Key                        | [NewsAPI](https://newsapi.org/) |
| `reddit_api_key`     | Reddit API Key                     | [Reddit Apps](https://www.reddit.com/prefs/apps) |
| `reddit_api_secret`  | Reddit API Secret                  | [Reddit Apps](https://www.reddit.com/prefs/apps) |

Other options in `config.ts` can be left as defaults or adjusted as needed.

### 4. Run the Bot
```sh
bun run bot.ts
```

## Notes
- Make sure your `config.ts` is never committed to git (it's already in `.gitignore`).
- The bot uses a local SQLite database (`database.sqlite`).
- For more info on commands and features, see `TASKS.md` and `TOOLS.md`.

## Troubleshooting
- If you have issues with Bun, see the [Bun documentation](https://bun.sh/docs).
- For Discord bot setup, see the [Discord Developer Portal docs](https://discord.com/developers/docs/intro).

## License
MIT
