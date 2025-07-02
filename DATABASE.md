# Database Implementation

This project now includes SQLite database functionality using Bun's built-in SQLite driver to store and analyze Discord messages.

## Features

### 1. Database Storage (`database.ts`)
- **SQLite Database**: Creates `database.sqlite` in the project root
- **Message Model**: Stores Discord messages with comprehensive metadata
- **Performance Optimized**: Uses prepared statements and indexes
- **Continuation Support**: Tracks fetch progress for resumable operations

### 2. Message Logging (`Logger.ts`)
- **Automatic Storage**: All incoming messages are automatically stored in the database
- **Real-time Processing**: Messages are stored immediately as they arrive
- **Error Handling**: Gracefully handles database errors without breaking message flow

### 3. Top10 Slash Command (`/top10`)
- **Channel-specific**: Shows top 10 most active users in the current channel
- **Beautiful Formatting**: Uses medals (🥇🥈🥉) and proper formatting
- **Statistics**: Displays total message count for the channel

### 4. Enhanced FetchMessages Task
- **Real-time Storage**: Messages are stored as they're fetched (not gathered then inserted)
- **Continuation Support**: Can resume from where it left off using `--continue` flag
- **Progress Tracking**: Saves progress after each batch
- **Statistics**: Shows top users and message counts after completion

## Usage

### Fetch Messages
```bash
# Fetch all messages from a channel (from newest to oldest)
bun run task.ts fetch-messages CHANNEL_ID

# Continue from where the last fetch stopped
bun run task.ts fetch-messages CHANNEL_ID --continue
```

### Top10 Command
Use the `/top10` slash command in any Discord channel to see the most active users.

## Database Schema

### Messages Table
- `id` (TEXT, PRIMARY KEY): Discord message ID
- `content` (TEXT): Message content
- `author_id` (TEXT): Discord user ID
- `author_username` (TEXT): Discord username
- `author_display_name` (TEXT): Display name in the server
- `channel_id` (TEXT): Discord channel ID
- `guild_id` (TEXT): Discord server ID (null for DMs)
- `created_at` (TEXT): ISO timestamp when message was created
- `edited_at` (TEXT): ISO timestamp when message was last edited
- `attachments_count` (INTEGER): Number of attachments
- `embeds_count` (INTEGER): Number of embeds
- `reply_to_message_id` (TEXT): ID of message being replied to
- `is_bot` (BOOLEAN): Whether the author is a bot
- `inserted_at` (DATETIME): When the record was inserted

### Fetch Progress Table
- `channel_id` (TEXT, PRIMARY KEY): Discord channel ID
- `last_message_id` (TEXT): Last message ID that was fetched
- `last_fetched_at` (DATETIME): When the fetch was last updated

## Database Management

The database automatically:
- Creates tables and indexes on first run
- Uses WAL mode for better performance
- Handles duplicate messages gracefully (INSERT OR IGNORE)
- Tracks fetch progress for resumable operations

## Example Output

### FetchMessages Task
```
Fetching messages from channel: 123456789012345678
Found channel: #general in Example Server
Existing messages in database: 0
Starting to fetch messages...
Batch 1: Fetched 100 messages, Stored 100 new messages (Total fetched this run: 100)
Batch 2: Fetched 100 messages, Stored 100 new messages (Total fetched this run: 200)
...
Fetch complete!
Total messages fetched this run: 1,234
Total new messages stored: 1,234
Total messages in database for this channel: 1,234

Top 5 most active users:
1. Alice (@alice): 456 messages
2. Bob (@bob): 234 messages
3. Charlie (@charlie): 123 messages
4. David (@david): 89 messages
5. Eve (@eve): 67 messages
```

### Top10 Slash Command
```
🏆 Top 10 Most Active Users in this Channel:

🥇 Alice (@alice)
   💬 456 messages

🥈 Bob (@bob)
   💬 234 messages

🥉 Charlie (@charlie)
   💬 123 messages

4. David (@david)
   💬 89 messages

5. Eve (@eve)
   💬 67 messages

📊 Total messages in channel: 1,234
```

## Performance Considerations

- Uses prepared statements for optimal performance
- Implements database indexes on frequently queried columns
- Processes messages in batches to respect Discord rate limits
- Uses transactions for bulk inserts
- WAL mode enabled for better concurrent access
