import { BotService } from './services/core/BotService.js';

// Create and initialize the bot service
const botService = new BotService();

// Initialize the bot
async function startBot() {
    try {
        await botService.initialize();
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
async function shutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    try {
        await botService.cleanup();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Setup signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});

// Export function to get globally loaded tools (backwards compatibility)
export function getGlobalTools() {
    return botService.getGlobalTools();
}

// Start the bot
startBot();
