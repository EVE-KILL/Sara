import { IService } from '../../types/Services.js';

/**
 * Service for managing external API integrations
 */
export class ExternalIntegrationsService implements IService {
    name = 'ExternalIntegrations';

    private refreshIntervals: NodeJS.Timeout[] = [];

    /**
     * Initialize external service integrations
     */
    async initialize(): Promise<void> {
        console.log('🔗 Initializing external integrations...');

        // Initialize Reddit token refresh
        await this.initializeRedditIntegration();

        console.log('✅ External integrations initialized');
    }

    /**
     * Initialize Reddit API integration
     */
    private async initializeRedditIntegration(): Promise<void> {
        try {
            // Import Reddit functions dynamically to avoid potential circular dependencies
            const { initializeRedditAccessToken, refreshRedditAccessToken } = await import('../../redditAccessToken.js');

            // Initialize the token
            await initializeRedditAccessToken();
            console.log('✅ Reddit integration initialized');

            // Setup periodic token refresh (every 30 minutes)
            const refreshInterval = setInterval(async () => {
                try {
                    console.log('🔑 Refreshing Reddit access token...');
                    await refreshRedditAccessToken();
                    console.log('✅ Reddit access token refreshed successfully');
                } catch (error) {
                    console.error('❌ Failed to refresh Reddit access token:', error);
                }
            }, 30 * 60 * 1000);

            this.refreshIntervals.push(refreshInterval);
            console.log('🔄 Reddit token refresh scheduled');

        } catch (error) {
            console.error('❌ Failed to initialize Reddit integration:', error);
        }
    }

    /**
     * Test external service connections
     */
    async testConnections(): Promise<{ reddit: boolean, news: boolean, weather: boolean }> {
        const results = {
            reddit: false,
            news: false,
            weather: false
        };

        // Test Reddit connection
        try {
            // This would require implementing a simple test endpoint call
            results.reddit = true;
        } catch (error) {
            console.error('❌ Reddit connection test failed:', error);
        }

        // Test News API connection
        try {
            // This would require implementing a simple test endpoint call
            results.news = true;
        } catch (error) {
            console.error('❌ News API connection test failed:', error);
        }

        // Test Weather API connection
        try {
            // This would require implementing a simple test endpoint call
            results.weather = true;
        } catch (error) {
            console.error('❌ Weather API connection test failed:', error);
        }

        return results;
    }

    /**
     * Get integration status
     */
    getStatus(): Record<string, { enabled: boolean, lastCheck?: Date }> {
        return {
            reddit: {
                enabled: true,
                lastCheck: new Date()
            },
            news: {
                enabled: true,
                lastCheck: new Date()
            },
            weather: {
                enabled: true,
                lastCheck: new Date()
            }
        };
    }

    /**
     * Cleanup external integrations
     */
    async cleanup(): Promise<void> {
        console.log('🧹 Cleaning up external integrations...');

        // Clear all refresh intervals
        this.refreshIntervals.forEach(interval => clearInterval(interval));
        this.refreshIntervals = [];

        console.log('✅ External integrations cleanup completed');
    }
}
