import { Database } from "bun:sqlite";
import path from "path";

// Define the interface for our Discord message model
export interface DiscordMessage {
    id: string;
    content: string;
    author_id: string;
    author_username: string;
    author_display_name: string;
    channel_id: string;
    guild_id: string | null;
    created_at: string;
    edited_at: string | null;
    attachments_count: number;
    embeds_count: number;
    reply_to_message_id: string | null;
    is_bot: boolean;
}

// Define the interface for channel activity stats
export interface ChannelActivity {
    author_id: string;
    author_username: string;
    author_display_name: string;
    message_count: number;
}

// Define the interface for user memories
export interface UserMemory {
    id: number;
    user_id: string;
    memory_key: string;
    memory_value: string;
    created_at: string;
    updated_at: string;
}

// Define the interface for user settings
export interface UserSettings {
    user_id: string;
    auto_memory_enabled: boolean;
    created_at: string;
    updated_at: string;
}

// Define the interface for reminders
export interface Reminder {
    id: number;
    user_id: string;
    channel_id: string;
    guild_id: string | null;
    message_content: string;
    reminder_text: string;
    original_message_id: string;
    original_message_url: string;
    remind_at: string;
    created_at: string;
    is_completed: boolean;
}

class DatabaseManager {
    private db: Database;
    private insertMessageStmt: any;
    private getLastMessageStmt: any;
    private getTopActiveUsersStmt: any;
    private updateLastFetchedStmt: any;
    private getLastFetchedStmt: any;
    // Memory-related prepared statements
    private insertMemoryStmt: any;
    private updateMemoryStmt: any;
    private getMemoryStmt: any;
    private getUserMemoriesStmt: any;
    private deleteMemoryStmt: any;
    private getUserSettingsStmt: any;
    private updateUserSettingsStmt: any;
    // Reminder-related prepared statements
    private insertReminderStmt: any;
    private getPendingRemindersStmt: any;
    private markReminderCompletedStmt: any;
    private getUserRemindersStmt: any;
    private deleteReminderStmt: any;

    constructor(dbPath: string = "database.sqlite") {
        // Create database file in the project root
        const fullPath = path.resolve(dbPath);
        console.log(`Initializing database at: ${fullPath}`);

        this.db = new Database(fullPath);
        this.initializeDatabase();
        this.prepareStatements();
    }

    private initializeDatabase() {
        // Enable WAL mode for better performance
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.db.exec("PRAGMA synchronous = NORMAL;");
        this.db.exec("PRAGMA cache_size = 1000;");

        // Create messages table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                author_id TEXT NOT NULL,
                author_username TEXT NOT NULL,
                author_display_name TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                guild_id TEXT,
                created_at TEXT NOT NULL,
                edited_at TEXT,
                attachments_count INTEGER DEFAULT 0,
                embeds_count INTEGER DEFAULT 0,
                reply_to_message_id TEXT,
                is_bot BOOLEAN DEFAULT FALSE,
                inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better query performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_guild_id ON messages(guild_id);
        `);

        // Create table to track fetch progress
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS fetch_progress (
                channel_id TEXT PRIMARY KEY,
                last_message_id TEXT NOT NULL,
                last_fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create memories table for user memory storage
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                memory_key TEXT NOT NULL,
                memory_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, memory_key)
            )
        `);

        // Create indexes for memories table
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(memory_key);
        `);

        // Create user settings table for auto memory preferences
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                auto_memory_enabled BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create table to track memory learning messages for reaction removal
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS memory_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                memory_keys TEXT NOT NULL, -- JSON array of memory keys that were learned
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_memory_messages_message_id ON memory_messages(message_id);
        `);

        // Create reminders table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                guild_id TEXT,
                message_content TEXT NOT NULL,
                reminder_text TEXT NOT NULL,
                original_message_id TEXT NOT NULL,
                original_message_url TEXT NOT NULL,
                remind_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_completed BOOLEAN DEFAULT FALSE
            )
        `);

        // Create indexes for reminders table
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
        `);
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);
        `);

        console.log("Database initialized successfully");
    }

    private prepareStatements() {
        // Prepare statements for better performance
        this.insertMessageStmt = this.db.prepare(`
            INSERT OR IGNORE INTO messages (
                id, content, author_id, author_username, author_display_name,
                channel_id, guild_id, created_at, edited_at, attachments_count,
                embeds_count, reply_to_message_id, is_bot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        this.getLastMessageStmt = this.db.prepare(`
            SELECT id FROM messages
            WHERE channel_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `);

        this.getTopActiveUsersStmt = this.db.prepare(`
            SELECT
                author_id,
                author_username,
                author_display_name,
                COUNT(*) as message_count
            FROM messages
            WHERE channel_id = ?
            GROUP BY author_id, author_username, author_display_name
            ORDER BY message_count DESC
            LIMIT ?
        `);

        this.updateLastFetchedStmt = this.db.prepare(`
            INSERT OR REPLACE INTO fetch_progress (channel_id, last_message_id)
            VALUES (?, ?)
        `);

        this.getLastFetchedStmt = this.db.prepare(`
            SELECT last_message_id FROM fetch_progress WHERE channel_id = ?
        `);

        // Memory-related statements
        this.insertMemoryStmt = this.db.prepare(`
            INSERT OR REPLACE INTO memories (user_id, memory_key, memory_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);

        this.updateMemoryStmt = this.db.prepare(`
            UPDATE memories SET memory_value = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND memory_key = ?
        `);

        this.getMemoryStmt = this.db.prepare(`
            SELECT * FROM memories WHERE user_id = ? AND memory_key = ?
        `);

        this.getUserMemoriesStmt = this.db.prepare(`
            SELECT * FROM memories WHERE user_id = ? ORDER BY updated_at DESC
        `);

        this.deleteMemoryStmt = this.db.prepare(`
            DELETE FROM memories WHERE user_id = ? AND memory_key = ?
        `);

        this.getUserSettingsStmt = this.db.prepare(`
            SELECT * FROM user_settings WHERE user_id = ?
        `);

        this.updateUserSettingsStmt = this.db.prepare(`
            INSERT OR REPLACE INTO user_settings (user_id, auto_memory_enabled, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);

        // Reminder-related statements
        this.insertReminderStmt = this.db.prepare(`
            INSERT INTO reminders (
                user_id, channel_id, guild_id, message_content, reminder_text,
                original_message_id, original_message_url, remind_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        this.getPendingRemindersStmt = this.db.prepare(`
            SELECT * FROM reminders
            WHERE is_completed = FALSE AND remind_at <= CURRENT_TIMESTAMP
            ORDER BY remind_at ASC
        `);

        this.markReminderCompletedStmt = this.db.prepare(`
            UPDATE reminders SET is_completed = TRUE
            WHERE id = ?
        `);

        this.getUserRemindersStmt = this.db.prepare(`
            SELECT * FROM reminders
            WHERE user_id = ? AND is_completed = FALSE
            ORDER BY remind_at ASC
        `);

        this.deleteReminderStmt = this.db.prepare(`
            DELETE FROM reminders WHERE id = ?
        `);
    }

    // Insert a single message
    insertMessage(message: DiscordMessage): boolean {
        try {
            this.insertMessageStmt.run(
                message.id,
                message.content,
                message.author_id,
                message.author_username,
                message.author_display_name,
                message.channel_id,
                message.guild_id,
                message.created_at,
                message.edited_at,
                message.attachments_count,
                message.embeds_count,
                message.reply_to_message_id,
                message.is_bot
            );
            return true;
        } catch (error) {
            console.error("Error inserting message:", error);
            return false;
        }
    }

    // Insert multiple messages in a transaction
    insertMessages(messages: DiscordMessage[]): number {
        let inserted = 0;
        const transaction = this.db.transaction((msgs: DiscordMessage[]) => {
            for (const message of msgs) {
                try {
                    this.insertMessageStmt.run(
                        message.id,
                        message.content,
                        message.author_id,
                        message.author_username,
                        message.author_display_name,
                        message.channel_id,
                        message.guild_id,
                        message.created_at,
                        message.edited_at,
                        message.attachments_count,
                        message.embeds_count,
                        message.reply_to_message_id,
                        message.is_bot
                    );
                    inserted++;
                } catch (error) {
                    // Message probably already exists (IGNORE constraint)
                    continue;
                }
            }
        });

        transaction(messages);
        return inserted;
    }

    // Get the most recent message ID for a channel
    getLastMessageId(channelId: string): string | null {
        const result = this.getLastMessageStmt.get(channelId);
        return result?.id || null;
    }

    // Get top active users in a channel
    getTopActiveUsers(channelId: string, limit: number = 10): ChannelActivity[] {
        return this.getTopActiveUsersStmt.all(channelId, limit) as ChannelActivity[];
    }

    // Update fetch progress
    updateFetchProgress(channelId: string, lastMessageId: string): void {
        this.updateLastFetchedStmt.run(channelId, lastMessageId);
    }

    // Get last fetched message ID for continuing fetch
    getLastFetchedMessageId(channelId: string): string | null {
        const result = this.getLastFetchedStmt.get(channelId);
        return result?.last_message_id || null;
    }

    // Get total message count for a channel
    getMessageCount(channelId: string): number {
        const result = this.db.query("SELECT COUNT(*) as count FROM messages WHERE channel_id = ?").get(channelId) as any;
        return result?.count || 0;
    }

    // Get historical messages with filters
    getHistoricalMessages(
        channelId: string,
        options: {
            timeRange?: { start: Date, end: Date },
            authorId?: string,
            authorUsername?: string,
            contentSearch?: string,
            limit?: number,
            includeBot?: boolean
        } = {}
    ): DiscordMessage[] {
        try {
            let query = `SELECT * FROM messages WHERE channel_id = ?`;
            const params: any[] = [channelId];

            // Time range filter
            if (options.timeRange) {
                query += ` AND created_at BETWEEN ? AND ?`;
                params.push(options.timeRange.start.toISOString(), options.timeRange.end.toISOString());
            }

            // Author ID filter
            if (options.authorId) {
                query += ` AND author_id = ?`;
                params.push(options.authorId);
            }

            // Author username filter (case-insensitive)
            if (options.authorUsername) {
                query += ` AND (author_username LIKE ? OR author_display_name LIKE ?)`;
                const searchPattern = `%${options.authorUsername}%`;
                params.push(searchPattern, searchPattern);
            }

            // Content search (case-insensitive)
            if (options.contentSearch) {
                query += ` AND content LIKE ?`;
                params.push(`%${options.contentSearch}%`);
            }

            // Bot filter
            if (options.includeBot === false) {
                query += ` AND is_bot = 0`;
            }

            // Order by created_at descending and limit
            query += ` ORDER BY created_at DESC`;
            if (options.limit) {
                query += ` LIMIT ?`;
                params.push(options.limit);
            }

            const stmt = this.db.prepare(query);
            return stmt.all(...params) as DiscordMessage[];
        } catch (error) {
            console.error("Error getting historical messages:", error);
            return [];
        }
    }

    // Get messages around a specific time period
    getMessagesAroundTime(
        channelId: string,
        targetTime: Date,
        windowMinutes: number = 60,
        limit: number = 50
    ): DiscordMessage[] {
        try {
            const startTime = new Date(targetTime.getTime() - (windowMinutes * 60 * 1000));
            const endTime = new Date(targetTime.getTime() + (windowMinutes * 60 * 1000));

            return this.getHistoricalMessages(channelId, {
                timeRange: { start: startTime, end: endTime },
                limit,
                includeBot: false
            });
        } catch (error) {
            console.error("Error getting messages around time:", error);
            return [];
        }
    }

    // Memory-related methods
    addMemory(userId: string, memoryKey: string, memoryValue: string): boolean {
        try {
            this.insertMemoryStmt.run(userId, memoryKey, memoryValue);
            return true;
        } catch (error) {
            console.error("Error adding memory:", error);
            return false;
        }
    }

    getMemory(userId: string, memoryKey: string): UserMemory | null {
        try {
            return this.getMemoryStmt.get(userId, memoryKey) as UserMemory || null;
        } catch (error) {
            console.error("Error getting memory:", error);
            return null;
        }
    }

    getUserMemories(userId: string): UserMemory[] {
        try {
            return this.getUserMemoriesStmt.all(userId) as UserMemory[];
        } catch (error) {
            console.error("Error getting user memories:", error);
            return [];
        }
    }

    deleteMemory(userId: string, memoryKey: string): boolean {
        try {
            const result = this.deleteMemoryStmt.run(userId, memoryKey);
            return result.changes > 0;
        } catch (error) {
            console.error("Error deleting memory:", error);
            return false;
        }
    }

    clearUserMemories(userId: string): boolean {
        try {
            const result = this.db.query("DELETE FROM memories WHERE user_id = ?").run(userId);
            return result.changes > 0;
        } catch (error) {
            console.error("Error clearing user memories:", error);
            return false;
        }
    }

    // User settings methods
    getUserSettings(userId: string): UserSettings | null {
        try {
            return this.getUserSettingsStmt.get(userId) as UserSettings || null;
        } catch (error) {
            console.error("Error getting user settings:", error);
            return null;
        }
    }

    updateUserSettings(userId: string, autoMemoryEnabled: boolean): boolean {
        try {
            this.updateUserSettingsStmt.run(userId, autoMemoryEnabled);
            return true;
        } catch (error) {
            console.error("Error updating user settings:", error);
            return false;
        }
    }

    isAutoMemoryEnabled(userId: string): boolean {
        const settings = this.getUserSettings(userId);
        return settings?.auto_memory_enabled ?? true; // Default to true if no settings found
    }

    // Memory message tracking methods
    addMemoryMessage(messageId: string, userId: string, memoryKeys: string[]): boolean {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO memory_messages (message_id, user_id, memory_keys)
                VALUES (?, ?, ?)
            `);
            stmt.run(messageId, userId, JSON.stringify(memoryKeys));
            return true;
        } catch (error) {
            console.error("Error adding memory message:", error);
            return false;
        }
    }

    getMemoryMessage(messageId: string): { userId: string, memoryKeys: string[] } | null {
        try {
            const stmt = this.db.prepare(`
                SELECT user_id, memory_keys FROM memory_messages
                WHERE message_id = ?
            `);
            const result = stmt.get(messageId) as any;
            if (result) {
                return {
                    userId: result.user_id,
                    memoryKeys: JSON.parse(result.memory_keys)
                };
            }
            return null;
        } catch (error) {
            console.error("Error getting memory message:", error);
            return null;
        }
    }

    removeMemoryMessage(messageId: string): boolean {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM memory_messages WHERE message_id = ?
            `);
            stmt.run(messageId);
            return true;
        } catch (error) {
            console.error("Error removing memory message:", error);
            return false;
        }
    }

    // Reminder methods
    addReminder(
        userId: string,
        channelId: string,
        guildId: string | null,
        messageContent: string,
        reminderText: string,
        originalMessageId: string,
        originalMessageUrl: string,
        remindAt: Date
    ): number | null {
        try {
            const result = this.insertReminderStmt.run(
                userId,
                channelId,
                guildId,
                messageContent,
                reminderText,
                originalMessageId,
                originalMessageUrl,
                remindAt.toISOString()
            );
            return result.lastInsertRowid as number;
        } catch (error) {
            console.error("Error adding reminder:", error);
            return null;
        }
    }

    getPendingReminders(): Reminder[] {
        try {
            return this.getPendingRemindersStmt.all() as Reminder[];
        } catch (error) {
            console.error("Error getting pending reminders:", error);
            return [];
        }
    }

    markReminderCompleted(reminderId: number): boolean {
        try {
            this.markReminderCompletedStmt.run(reminderId);
            return true;
        } catch (error) {
            console.error("Error marking reminder as completed:", error);
            return false;
        }
    }

    getUserReminders(userId: string): Reminder[] {
        try {
            return this.getUserRemindersStmt.all(userId) as Reminder[];
        } catch (error) {
            console.error("Error getting user reminders:", error);
            return [];
        }
    }

    deleteReminder(reminderId: number): boolean {
        try {
            this.deleteReminderStmt.run(reminderId);
            return true;
        } catch (error) {
            console.error("Error deleting reminder:", error);
            return false;
        }
    }

    // Close database connection
    close(): void {
        this.db.close();
    }

    // Get database instance for custom queries
    getDatabase(): Database {
        return this.db;
    }
}

// Export a singleton instance
export const database = new DatabaseManager();

// Export helper function to convert Discord message to our format
export function discordMessageToDbMessage(discordMessage: any): DiscordMessage {
    return {
        id: discordMessage.id,
        content: discordMessage.content || "",
        author_id: discordMessage.author.id,
        author_username: discordMessage.author.username,
        author_display_name: discordMessage.member?.displayName || discordMessage.author.displayName || discordMessage.author.username,
        channel_id: discordMessage.channel.id,
        guild_id: discordMessage.guild?.id || null,
        created_at: discordMessage.createdAt.toISOString(),
        edited_at: discordMessage.editedAt?.toISOString() || null,
        attachments_count: discordMessage.attachments.size || 0,
        embeds_count: discordMessage.embeds.length || 0,
        reply_to_message_id: discordMessage.reference?.messageId || null,
        is_bot: discordMessage.author.bot || false
    };
}
