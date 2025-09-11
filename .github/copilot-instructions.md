# Sara Discord Bot - Copilot Instructions

## Project Overview

Sara is a TypeScript Discord bot built with Bun runtime that provides AI-powered chat capabilities, social media integrations, utility commands, and various interactive features. The bot is designed for the EVE-KILL community but can be used in any Discord server.

## Architecture & Tech Stack

- **Runtime**: Bun (JavaScript runtime)
- **Language**: TypeScript
- **Main Framework**: Discord.js v14
- **AI Integration**: OpenAI API (GPT models, Whisper, TTS)
- **Database**: SQLite with custom database layer
- **Package Manager**: Bun

## Core Structure

```
bot.ts           # Main bot entry point
helper.ts        # Core utilities and plugin loading system
config.ts        # Configuration management
database.ts      # Database operations and schema
cli.ts           # Interactive CLI for bot management
task.ts          # Task runner for background operations

onInteraction/   # Slash command handlers
onMessage/       # Message event handlers
tools/          # OpenAI function tools for AI capabilities
tasks/          # Background task implementations
temp/           # Temporary file storage
```

## Key Features & Functionality

### 1. AI Integration (OpenAI)
- **Chat AI**: Natural language conversations with context memory
- **Voice AI**: Whisper speech-to-text and TTS capabilities
- **Image Analysis**: Vision model support for image attachments
- **Function Tools**: 11 specialized tools for various tasks
- **Memory System**: Persistent user memory and conversation context
- **Moderation**: Content moderation using OpenAI moderation API

### 2. Social Media Integrations
- **Instagram**: Post and reel downloading
- **TikTok**: Video downloading and processing
- **Reddit**: Content fetching with API integration

### 3. Utility Commands
- Weather information
- News fetching (NewsAPI + Danish DR RSS)
- Currency conversion
- Mathematical calculations
- Text encoding/decoding
- Random number/text generation
- Server information and user profiles

### 4. Core Bot Features
- Slash command system
- Message logging and history
- Plugin-based architecture
- Background task system
- Temporary file cleanup
- Database-backed memory system

## Development Guidelines

### File Structure Conventions

#### Interaction Handlers (`onInteraction/`)
```typescript
import { MessageFlags } from 'discord.js';

export const command = {
    name: 'command_name',
    description: 'Command description'
    // Additional Discord.js command options
};

export default async function CommandName(interaction: any, client: any) {
    if (interaction.commandName === 'command_name') {
        // Command implementation
        await interaction.reply({ content: 'Response', flags: MessageFlags.Ephemeral });
    }
}
```

#### Message Handlers (`onMessage/`)
```typescript
export default async function HandlerName(message: any, client: any) {
    // Message processing logic
    // Should handle specific message patterns or conditions
}
```

#### AI Tools (`tools/`)
```typescript
import { EmbedBuilder } from 'discord.js';

export const tool = {
    name: 'tool_name',
    description: 'Tool description for AI context',
    parameters: {
        type: "object",
        properties: {
            // OpenAI function parameters schema
        },
        required: ["param1"]
    },
    systemPrompt: 'Instructions for AI on when/how to use this tool'
};

export default async function toolName(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string | EmbedBuilder> {
    // Tool implementation
    // Return string for text response or EmbedBuilder for rich embeds
}
```

#### Background Tasks (`tasks/`)
```typescript
export default async function TaskName(client: any) {
    // Background task implementation
    // These run periodically via the task system
}
```

### Code Style & Best Practices

1. **TypeScript**: Use proper TypeScript typing where possible
2. **Async/Await**: Prefer async/await over promises
3. **Error Handling**: Always wrap external API calls in try-catch blocks
4. **Logging**: Use `console.log` with appropriate emoji prefixes (✅ ❌ 🔑 📝)
5. **Discord.js**: Use latest v14 features and patterns
6. **File Management**: Clean up temporary files appropriately
7. **Memory Management**: Clear caches and maps when appropriate

### Configuration System

The bot uses a TypeScript configuration file (`config.ts`) based on `config.example.ts`:

```typescript
export const Config = {
    // Discord settings
    'token': '',
    'clientId': '',
    'prefix': '%%',
    'botName': 'Sara',

    // OpenAI configuration
    'openai_api_key': '',
    'openai_model': 'gpt-5-mini',          // Main chat model
    'openai_model_cheap': 'gpt-5-nano',    // Quick responses
    'openai_model_coding': 'gpt-5',        // Programming help
    'openai_model_image': 'gpt-5',         // Image analysis

    // Feature flags
    'voice_enabled': true,
    'auto_memory_enabled': true,

    // External APIs
    'newsapi_api_key': '',
    'reddit_api_key': '',
    'reddit_api_secret': '',
    'instagram_cookies_b64': '',

    // Bot behavior
    'baseSystemPrompt': '...',
    'ignoredChannelIds': []
};
```

### Database Operations

The bot uses SQLite with a custom database layer. Key tables:
- `memories`: User memory storage for AI context
- `message_history`: Discord message logging
- Additional tables for various features

Database operations should use the imported `database` object from `database.ts`.

### Plugin System

The bot uses a dynamic plugin loading system:
1. **Interactions**: Auto-loaded from `onInteraction/` directory
2. **Message Handlers**: Auto-loaded from `onMessage/` directory
3. **Tools**: Auto-loaded from `tools/` directory for AI function calling
4. **Tasks**: Manually registered background tasks

### AI System Prompts & Behavior

Sara's AI personality:
- Friendly, helpful, and cheerful but not overly enthusiastic
- Natural conversational tone
- Concise responses without repetition
- Uses Discord Markdown and emojis appropriately
- Integrates tool results naturally without mentioning "tool usage"
- Maintains user memories for context

### External Integrations

#### OpenAI Models
- **Chat**: Multiple model tiers for different use cases
- **Voice**: Whisper for STT, TTS for voice synthesis
- **Vision**: Image analysis capabilities
- **Moderation**: Content filtering

#### Social Media APIs
- **Instagram**: Private API for media downloading
- **TikTok**: API for video processing
- **Reddit**: Official API with token refresh system
- **NewsAPI**: Global news with Danish DR RSS fallback

### Common Patterns

#### Error Handling
```typescript
try {
    // API call or operation
    const result = await externalAPI();
    return result;
} catch (error) {
    console.error('❌ Operation failed:', error);
    return 'Error message for user';
}
```

#### Discord Embeds
```typescript
const embed = new EmbedBuilder()
    .setTitle('Title')
    .setDescription('Description')
    .setColor('#0099ff')
    .addFields({ name: 'Field', value: 'Value', inline: true });

return embed;
```

#### File Cleanup
```typescript
// Always clean up temporary files
if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
}
```

## Development Workflow

1. **Setup**: Copy `config.example.ts` to `config.ts` and fill in API keys
2. **Install**: Run `bun install` to install dependencies
3. **Development**: Run `bun run bot.ts` to start the bot
4. **Tasks**: Use `bun run task.ts` for background task management
5. **Testing**: Test features in a development Discord server

## Important Notes

- The bot requires multiple API keys for full functionality
- Temporary files are automatically cleaned up periodically
- Voice features require additional OpenAI credits
- Memory system stores user context for improved AI interactions
- Background tasks handle periodic maintenance and data fetching
- Plugin system allows easy addition of new features

When working on this project, always consider:
1. User privacy and data handling
2. Rate limiting for external APIs
3. Error graceful degradation
4. Discord API best practices
5. Resource cleanup and memory management
