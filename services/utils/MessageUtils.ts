import moment from 'moment';
import chalk from 'chalk';

/**
 * Utility functions for message processing
 */
export class MessageUtils {
    /**
     * Log messages to the terminal with timestamp and context
     */
    static logMessageToTerminal(message: any): void {
        const timestamp = chalk.green(moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'));
        const authorName = chalk.cyan(message.member ? message.member.displayName : message.author.username);
        const originalAuthorName = chalk.cyan(message.author.username);
        const serverName = chalk.magenta(message.guild ? message.guild.name : 'DM');
        const channelName = chalk.yellow(message.channel.name || 'DM');
        
        // Convert IDs in the message content to names
        let content = message.content.replace(/<@!?(.*?)>/g, (match: string, id: string) => {
            if (message.guild) {
                const user = message.guild.members.cache.get(id);
                return user ? `@${user.displayName}` : match;
            } else {
                // In DMs, just return the original match since we can't resolve guild members
                return match;
            }
        });
        
        const logMessage = `${timestamp} / ${authorName} (${originalAuthorName}) / #${channelName} / ${serverName}: ${chalk.white(content)}`;
        console.log(logMessage);
    }

    /**
     * Split long messages into chunks of up to specified size
     */
    static splitMessageIntoChunks(message: string, chunkSize: number = 2000): string[] {
        const chunks: string[] = [];
        let currentChunk = '';

        for (const word of message.split(' ')) {
            if (currentChunk.length + word.length + 1 > chunkSize) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            currentChunk += (currentChunk.length > 0 ? ' ' : '') + word;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Resolve a user ID to a user object
     */
    static async resolveIdToUser(client: any, userId: string) {
        try {
            return await client.users.fetch(userId);
        } catch (error) {
            console.error(`❌ Failed to fetch user with ID ${userId}: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Check if a message mentions a specific user
     */
    static mentionsUser(message: any, userId: string): boolean {
        return message.content.includes(`<@${userId}>`) || 
               message.content.includes(`<@!${userId}>`);
    }

    /**
     * Extract mentioned user IDs from a message
     */
    static extractMentions(message: any): string[] {
        const mentionRegex = /<@!?(\d+)>/g;
        const mentions: string[] = [];
        let match;

        while ((match = mentionRegex.exec(message.content)) !== null) {
            mentions.push(match[1]);
        }

        return mentions;
    }

    /**
     * Check if a message is a reply to another message
     */
    static isReply(message: any): boolean {
        return message.reference && message.reference.messageId;
    }

    /**
     * Get the referenced message ID if this is a reply
     */
    static getReferencedMessageId(message: any): string | null {
        return message.reference?.messageId || null;
    }

    /**
     * Sanitize message content for logging or processing
     */
    static sanitizeContent(content: string): string {
        return content
            .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]') // Replace code blocks
            .replace(/`[^`]+`/g, '[CODE]')              // Replace inline code
            .replace(/https?:\/\/[^\s]+/g, '[LINK]')   // Replace URLs
            .trim();
    }

    /**
     * Check if a message contains sensitive information
     */
    static hasSensitiveContent(content: string): boolean {
        const sensitivePatterns = [
            /password/i,
            /token/i,
            /api[_\s]?key/i,
            /secret/i,
            /private[_\s]?key/i
        ];

        return sensitivePatterns.some(pattern => pattern.test(content));
    }
}
