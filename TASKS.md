# Task System

## Overview

The task system allows you to run standalone Discord bot tasks for various operations like data fetching, maintenance, etc.

## Usage

### Running Tasks

```bash
# Show available tasks and their usage
bun run task.ts

# Run a specific task
bun run task.ts <task-name> [args...]

# Using npm script
npm run task <task-name> [args...]
```

**Example output when listing tasks:**
```
Sara Task System
Available tasks:

info
  Information task that prints bot status and connected servers
  Usage: bun run task.ts info

fetch-messages
  Fetch ALL messages from a channel, from latest to oldest
  Usage: bun run task.ts fetch-messages <channel-id>
```

### Available Tasks

#### info
Shows information about the bot's status and connected servers.

```bash
bun run task.ts info
```

#### fetch-messages
Fetches ALL messages from a Discord channel, from newest to oldest.

```bash
bun run task.ts fetch-messages <channel-id>
```

**Example:**
```bash
bun run task.ts fetch-messages 123456789012345678
```

This task will:
- Connect to Discord
- Fetch the specified channel
- Retrieve all messages in batches of 100
- Show progress and statistics
- Prepare data for database insertion

## Creating New Tasks

Create a new file in the `tasks/` directory with the following structure:

```typescript
import chalk from 'chalk';

export default {
    name: 'my-task-name',
    description: 'Description of what this task does',

    async execute(client, args) {
        // Task implementation
        console.log(chalk.green('Task executed!'));

        // Access Discord client
        console.log(`Connected to ${client.guilds.cache.size} servers`);

        // Use command line arguments
        if (args.length > 0) {
            console.log('Arguments:', args);
        }
    }
};
```

### Task Properties

- **name**: Unique identifier for the task (used in command line)
- **description**: Brief description shown in task list
- **execute(client, args)**: Main task function
  - `client`: Discord.js client instance (already logged in)
  - `args`: Array of command line arguments passed after task name

### Best Practices

1. Use `chalk` for colored console output
2. Validate required arguments at the start
3. Provide helpful error messages
4. Add progress indicators for long-running tasks
5. Handle errors gracefully
6. Log meaningful information about what the task is doing
