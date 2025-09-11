import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { Config } from '../../config.js';
import { IPluginLoader } from '../../types/Services.js';
import { PluginLoadResult, ToolLoadResult } from '../../types/Internal.js';

/**
 * Service responsible for dynamically loading plugins, commands, and tools
 */
export class PluginLoaderService implements IPluginLoader {
    name = 'PluginLoader';
    
    private toolsCache: {
        tools: OpenAI.Chat.Completions.ChatCompletionTool[],
        toolExecutors: Map<string, Function>,
        systemPrompts: string[]
    } | null = null;

    /**
     * Load interaction plugins from a directory
     */
    async loadInteractionPlugins(directory: string): Promise<any[]> {
        console.log('🔌 Loading interaction plugins...');
        const result = await this.loadPluginsFromDirectory(directory, 'interaction');
        
        if (result.commands.length > 0) {
            await this.registerSlashCommands(result.commands);
        }

        console.log(`✅ Loaded ${result.plugins.length} interaction plugins`);
        return result.plugins;
    }

    /**
     * Load message plugins from a directory
     */
    async loadMessagePlugins(directory: string): Promise<any[]> {
        console.log('🔌 Loading message plugins...');
        const result = await this.loadPluginsFromDirectory(directory, 'message');
        
        console.log(`✅ Loaded ${result.plugins.length} message plugins`);
        return result.plugins;
    }

    /**
     * Load tools for AI functionality
     */
    async loadTools(directory: string): Promise<{
        tools: OpenAI.Chat.Completions.ChatCompletionTool[],
        toolExecutors: Map<string, Function>,
        systemPrompts: string[]
    }> {
        // Return cached tools if available
        if (this.toolsCache) {
            return this.toolsCache;
        }

        console.log('🛠️  Loading tools...');
        const toolPath = path.resolve(directory);
        const files = fs.readdirSync(toolPath);

        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
        const toolExecutors = new Map<string, Function>();
        const systemPrompts: string[] = [];

        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    console.log(`🔧 Loading tool: ${file}`);
                    const { default: handler, tool } = await import(path.join(toolPath, file));

                    if (tool && handler) {
                        // Create OpenAI tool definition
                        const openAITool: OpenAI.Chat.Completions.ChatCompletionTool = {
                            type: "function",
                            function: {
                                name: tool.name,
                                description: tool.description,
                                parameters: tool.parameters
                            }
                        };

                        tools.push(openAITool);
                        toolExecutors.set(tool.name, handler);

                        if (tool.systemPrompt) {
                            systemPrompts.push(tool.systemPrompt);
                        }
                    } else {
                        console.warn(`⚠️  Tool ${file} is missing required exports (tool config or default function)`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to load tool ${file}:`, error);
                }
            }
        }

        // Cache the results
        this.toolsCache = { tools, toolExecutors, systemPrompts };

        console.log(`✅ Loaded ${tools.length} tools successfully`);
        return this.toolsCache;
    }

    /**
     * Register slash commands with Discord
     */
    async registerSlashCommands(commands: any[]): Promise<void> {
        const rest = new REST({ version: '10' }).setToken(Config.token);

        console.log(`📝 Registering ${commands.length} slash commands...`);

        try {
            await rest.put(Routes.applicationCommands(Config.clientId), { body: commands });
            console.log(`✅ Successfully registered ${commands.length} slash commands.`);
        } catch (error) {
            console.error('❌ Failed to register slash commands:', error);
            throw error;
        }
    }

    /**
     * Load plugins from a specific directory
     * @private
     */
    private async loadPluginsFromDirectory(pluginDirectory: string, type: string): Promise<PluginLoadResult> {
        const pluginPath = path.resolve(pluginDirectory);
        const files = fs.readdirSync(pluginPath);
        const plugins: any[] = [];
        const commands: any[] = [];
        const errors: string[] = [];

        for (const file of files) {
            try {
                console.log(`🔧 Loading ${type} plugin: ${file}`);
                const { default: handler, command } = await import(path.join(pluginPath, file));
                
                if (command) {
                    commands.push(command);
                }
                
                if (handler) {
                    plugins.push(handler);
                } else {
                    console.warn(`⚠️  Plugin ${file} has no default export`);
                }
            } catch (error) {
                const errorMsg = `Failed to load plugin ${file}: ${error}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

        return { plugins, commands, errors };
    }

    /**
     * Load tasks from a directory (for task runner)
     */
    async loadTasks(taskDirectory: string): Promise<Map<string, any>> {
        console.log('📋 Loading tasks...');
        const taskPath = path.resolve(taskDirectory);
        const files = fs.readdirSync(taskPath);
        const taskMap = new Map<string, any>();

        for (const file of files) {
            if (file.endsWith('.ts') || file.endsWith('.js')) {
                try {
                    const { default: task } = await import(path.join(taskPath, file));
                    if (task && task.name && task.execute) {
                        taskMap.set(task.name, task);
                        console.log(`✅ Loaded task: ${task.name}`);
                    } else {
                        console.warn(`⚠️  Task ${file} is missing required properties (name, execute)`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to load task ${file}:`, error);
                }
            }
        }

        console.log(`✅ Loaded ${taskMap.size} tasks`);
        return taskMap;
    }

    /**
     * Clear the tools cache (useful for reloading)
     */
    clearToolsCache(): void {
        this.toolsCache = null;
        console.log('🗑️  Cleared tools cache');
    }

    /**
     * Get the current tools cache
     */
    getToolsCache() {
        return this.toolsCache;
    }
}
