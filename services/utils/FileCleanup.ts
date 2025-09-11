import fs from 'fs';
import path from 'path';
import { IFileCleanupService } from '../../types/Services.js';
import { CleanupStats, FileCleanupOptions } from '../../types/Internal.js';

/**
 * Service responsible for cleaning up temporary files
 */
export class FileCleanupService implements IFileCleanupService {
    name = 'FileCleanup';

    private intervals: NodeJS.Timeout[] = [];
    private tempDir: string;

    constructor(tempDir?: string) {
        this.tempDir = tempDir || path.join(process.cwd(), 'temp');
    }

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            console.log(`📁 Created temp directory: ${this.tempDir}`);
        }

        // Run initial cleanup
        this.cleanupTikTokFiles();
        this.cleanupVoiceFiles();
        this.cleanupMediaResponseCache();
    }

    /**
     * Start periodic cleanup jobs
     */
    startPeriodicCleanup(): void {
        console.log('🧹 Starting periodic cleanup jobs...');

        // TikTok files - every hour
        const tikTokInterval = setInterval(() => {
            this.cleanupTikTokFiles();
        }, 60 * 60 * 1000);

        // Voice files - every 10 minutes
        const voiceInterval = setInterval(() => {
            this.cleanupVoiceFiles();
        }, 10 * 60 * 1000);

        // Media cache - every 10 minutes
        const mediaInterval = setInterval(() => {
            this.cleanupMediaResponseCache();
        }, 10 * 60 * 1000);

        this.intervals.push(tikTokInterval, voiceInterval, mediaInterval);

        console.log('✅ Periodic cleanup jobs started');
    }

    /**
     * Stop all periodic cleanup jobs
     */
    stopPeriodicCleanup(): void {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        console.log('🛑 Stopped periodic cleanup jobs');
    }

    /**
     * Clean up TikTok files older than 1 hour
     */
    cleanupTikTokFiles(): void {
        const stats = this.cleanupFilesByPattern({
            directory: this.tempDir,
            filePattern: 'tiktok_*.mp4',
            maxAge: 60 * 60 * 1000 // 1 hour
        });

        if (stats.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${stats.deletedCount} old TikTok file(s)`);
        }
    }

    /**
     * Clean up voice files older than 10 minutes
     */
    cleanupVoiceFiles(): void {
        const stats = this.cleanupFilesByPattern({
            directory: this.tempDir,
            filePattern: 'voice_*',
            maxAge: 10 * 60 * 1000 // 10 minutes
        });

        const responseStats = this.cleanupFilesByPattern({
            directory: this.tempDir,
            filePattern: 'response_*.mp3',
            maxAge: 10 * 60 * 1000 // 10 minutes
        });

        const totalDeleted = stats.deletedCount + responseStats.deletedCount;
        if (totalDeleted > 0) {
            console.log(`🎤 Cleaned up ${totalDeleted} old voice file(s)`);
        }
    }

    /**
     * Clean up media response cache (delegated to MediaCacheService if available)
     */
    cleanupMediaResponseCache(): void {
        // This will be implemented when MediaCacheService is created
        // For now, just log that the cleanup ran
        console.log('📝 Media cache cleanup completed');
    }

    /**
     * Generic file cleanup by pattern and age
     */
    private cleanupFilesByPattern(options: FileCleanupOptions): CleanupStats {
        const stats: CleanupStats = {
            deletedCount: 0,
            totalFiles: 0,
            errors: []
        };

        if (!fs.existsSync(options.directory)) {
            return stats;
        }

        try {
            const files = fs.readdirSync(options.directory);
            let matchingFiles: string[] = [];

            // Handle different pattern types
            if (options.filePattern.includes('*')) {
                const regex = this.patternToRegex(options.filePattern);
                matchingFiles = files.filter(file => regex.test(file));
            } else {
                matchingFiles = files.filter(file => file === options.filePattern);
            }

            stats.totalFiles = matchingFiles.length;

            for (const file of matchingFiles) {
                const filePath = path.join(options.directory, file);
                try {
                    const fileStats = fs.statSync(filePath);
                    const fileAge = Date.now() - fileStats.mtime.getTime();

                    if (fileAge > options.maxAge) {
                        fs.unlinkSync(filePath);
                        stats.deletedCount++;
                    }
                } catch (error) {
                    const errorMsg = `Error processing file ${file}: ${error}`;
                    console.error(errorMsg);
                    stats.errors.push(errorMsg);
                }
            }
        } catch (error) {
            const errorMsg = `Error during cleanup: ${error}`;
            console.error(errorMsg);
            stats.errors.push(errorMsg);
        }

        return stats;
    }

    /**
     * Convert a simple glob pattern to regex
     */
    private patternToRegex(pattern: string): RegExp {
        const escaped = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`);
    }

    /**
     * Clean up all temporary files (useful for shutdown)
     */
    async cleanup(): Promise<void> {
        this.stopPeriodicCleanup();

        // Clean up all temp files regardless of age
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    const filePath = path.join(this.tempDir, file);
                    try {
                        fs.unlinkSync(filePath);
                    } catch (error) {
                        console.error(`Error deleting ${file}:`, error);
                    }
                }
                console.log(`🗑️  Cleaned up temp directory: ${this.tempDir}`);
            }
        } catch (error) {
            console.error('Error during final cleanup:', error);
        }
    }

    /**
     * Get cleanup statistics
     */
    getStats(): { tempDir: string, exists: boolean, fileCount: number } {
        try {
            if (!fs.existsSync(this.tempDir)) {
                return { tempDir: this.tempDir, exists: false, fileCount: 0 };
            }

            const files = fs.readdirSync(this.tempDir);
            return {
                tempDir: this.tempDir,
                exists: true,
                fileCount: files.length
            };
        } catch (error) {
            return { tempDir: this.tempDir, exists: false, fileCount: 0 };
        }
    }
}
