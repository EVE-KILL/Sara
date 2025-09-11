export interface MediaResponseData {
    type: string;           // 'instagram', 'tiktok', 'reddit', etc.
    timestamp: number;      // When the bot replied
    channelId: string;      // Channel where it happened
    originalMessageId?: string; // The user message that triggered the media processing
}

export interface CleanupStats {
    deletedCount: number;
    totalFiles: number;
    errors: string[];
}

export interface FileCleanupOptions {
    maxAge: number;         // Maximum age in milliseconds
    filePattern: string;    // File pattern to match
    directory: string;      // Directory to clean
}

export interface PluginLoadResult {
    plugins: any[];
    commands: any[];
    errors: string[];
}

export interface ToolLoadResult {
    tools: any[];
    executors: Map<string, Function>;
    systemPrompts: string[];
    errors: string[];
}
