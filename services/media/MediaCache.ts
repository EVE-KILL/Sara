import { Message } from 'discord.js';
import { IMediaCacheService } from '../../types/Services.js';
import { MediaResponseData } from '../../types/Internal.js';

/**
 * Service for tracking media responses to prevent AI from responding to media content replies
 */
export class MediaCacheService implements IMediaCacheService {
    name = 'MediaCache';
    
    private mediaResponseCache = new Map<string, MediaResponseData>();
    private readonly MEDIA_RESPONSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    /**
     * Mark a bot message as a media processing response
     */
    markMediaResponse(botMessageId: string, type: string, channelId: string, originalMessageId?: string): void {
        this.mediaResponseCache.set(botMessageId, {
            type,
            timestamp: Date.now(),
            channelId,
            originalMessageId
        });

        console.log(`📝 Marked media response: ${type} in channel ${channelId}`);
    }

    /**
     * Check if a user message is replying to tracked media content
     */
    isMediaReply(message: Message, clientId: string): boolean {
        // Check if this message is a direct reply to a tracked media response
        if (message.reference?.messageId) {
            const referencedMessageId = message.reference.messageId;

            if (this.mediaResponseCache.has(referencedMessageId)) {
                const mediaData = this.mediaResponseCache.get(referencedMessageId)!;
                console.log(`🚫 Suppressing AI for reply to ${mediaData.type} content`);
                return true;
            }
        }

        // Check if the user explicitly mentioned the bot in the message content
        const explicitMention = message.content.includes(`<@${clientId}>`) || 
                               message.content.includes(`<@!${clientId}>`);
        if (explicitMention) {
            console.log(`✅ Allowing AI due to explicit bot mention`);
            return false; // Allow AI if user explicitly mentioned the bot
        }

        // Check for recent media responses in the same channel (for non-reply messages)
        const recentCutoff = Date.now() - (2 * 60 * 1000); // 2 minutes
        for (const [botMessageId, mediaData] of this.mediaResponseCache.entries()) {
            if (mediaData.channelId === message.channel.id &&
                mediaData.timestamp > recentCutoff) {
                console.log(`🚫 Suppressing AI due to recent ${mediaData.type} activity`);
                return true;
            }
        }

        return false;
    }

    /**
     * Clean up expired media response entries
     */
    cleanupExpiredEntries(): void {
        const cutoff = Date.now() - this.MEDIA_RESPONSE_TIMEOUT;
        let cleaned = 0;

        for (const [botMessageId, mediaData] of this.mediaResponseCache.entries()) {
            if (mediaData.timestamp < cutoff) {
                this.mediaResponseCache.delete(botMessageId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old media response entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats(): { total: number, byType: Record<string, number> } {
        const stats: Record<string, number> = {};
        
        for (const mediaData of this.mediaResponseCache.values()) {
            stats[mediaData.type] = (stats[mediaData.type] || 0) + 1;
        }

        return {
            total: this.mediaResponseCache.size,
            byType: stats
        };
    }

    /**
     * Clear all cached entries (useful for testing)
     */
    clearCache(): void {
        this.mediaResponseCache.clear();
        console.log('🗑️  Cleared media response cache');
    }

    /**
     * Get all cache entries (for debugging)
     */
    getAllEntries(): Map<string, MediaResponseData> {
        return new Map(this.mediaResponseCache);
    }

    /**
     * Remove a specific cache entry
     */
    removeEntry(botMessageId: string): boolean {
        return this.mediaResponseCache.delete(botMessageId);
    }
}
