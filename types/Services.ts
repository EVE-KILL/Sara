import { Client, Message, CommandInteraction } from 'discord.js';
import OpenAI from 'openai';

// Base service interface
export interface IService {
    name: string;
    initialize?(): Promise<void>;
    cleanup?(): Promise<void>;
}

// Plugin loading service interface
export interface IPluginLoader extends IService {
    loadInteractionPlugins(directory: string): Promise<any[]>;
    loadMessagePlugins(directory: string): Promise<any[]>;
    loadTools(directory: string): Promise<{
        tools: OpenAI.Chat.Completions.ChatCompletionTool[],
        toolExecutors: Map<string, Function>,
        systemPrompts: string[]
    }>;
    registerSlashCommands(commands: any[]): Promise<void>;
}

// File cleanup service interface
export interface IFileCleanupService extends IService {
    cleanupTikTokFiles(): void;
    cleanupVoiceFiles(): void;
    cleanupMediaResponseCache(): void;
    startPeriodicCleanup(): void;
    stopPeriodicCleanup(): void;
}

// Media cache service interface
export interface IMediaCacheService extends IService {
    markMediaResponse(botMessageId: string, type: string, channelId: string, originalMessageId?: string): void;
    isMediaReply(message: Message, clientId: string): boolean;
    cleanupExpiredEntries(): void;
    getStats(): { total: number, byType: Record<string, number> };
}

// Container interface for dependency injection
export interface IContainer {
    register<T>(name: string, instance: T): void;
    get<T>(name: string): T;
    has(name: string): boolean;
}

// Service context for plugin execution
export interface IServiceContext {
    client: Client;
    container: IContainer;
    message?: Message;
    interaction?: CommandInteraction;
}

// Plugin interfaces
export interface ICommandPlugin {
    command: any; // Discord.js command definition
    execute(interaction: CommandInteraction, context: IServiceContext): Promise<void>;
}

export interface IMessagePlugin {
    name: string;
    priority?: number;
    execute(message: Message, client: Client): Promise<void>;
}

export interface ITool {
    name: string;
    description: string;
    parameters: any;
    systemPrompt?: string;
    execute(args: any, message: Message, client: Client, useEmbed?: boolean): Promise<any>;
}
