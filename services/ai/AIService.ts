import OpenAI from 'openai';
import { Config } from '../../config.js';
import { IService } from '../../types/Services.js';

/**
 * Service for handling AI integrations and tool execution
 */
export class AIService implements IService {
    name = 'AI';

    private openai: OpenAI;
    private tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
    private toolExecutors = new Map<string, Function>();
    private systemPrompts: string[] = [];

    constructor() {
        this.openai = new OpenAI({
            apiKey: Config.openai_api_key
        });
    }

    /**
     * Initialize the AI service
     */
    async initialize(): Promise<void> {
        console.log('🤖 Initializing AI service...');

        // Validate API key
        if (!Config.openai_api_key) {
            console.warn('⚠️  OpenAI API key not configured');
            return;
        }

        console.log('✅ AI service initialized');
    }

    /**
     * Set tools for AI functionality
     */
    setTools(tools: OpenAI.Chat.Completions.ChatCompletionTool[],
             toolExecutors: Map<string, Function>,
             systemPrompts: string[]): void {
        this.tools = tools;
        this.toolExecutors = toolExecutors;
        this.systemPrompts = systemPrompts;

        console.log(`🛠️  Loaded ${tools.length} AI tools`);
    }

    /**
     * Generate a chat completion
     */
    async generateCompletion(messages: any[], options: {
        model?: string;
        useTools?: boolean;
        temperature?: number;
    } = {}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
        const {
            model = Config.openai_model,
            useTools = true,
            temperature = 0.7
        } = options;

        const completionOptions: any = {
            model,
            messages,
            temperature
        };

        if (useTools && this.tools.length > 0) {
            completionOptions.tools = this.tools;
            completionOptions.tool_choice = "auto";
        }

        return await this.openai.chat.completions.create(completionOptions);
    }

    /**
     * Execute a tool call
     */
    async executeTool(toolCall: any, message: any, client: any, useEmbed: boolean = false): Promise<any> {
        const { name, arguments: args } = toolCall.function;

        console.log(`🔧 Executing tool: ${name}`);

        try {
            const parsedArgs = JSON.parse(args);
            const toolExecutor = this.toolExecutors.get(name);

            if (!toolExecutor) {
                throw new Error(`Tool executor not found: ${name}`);
            }

            return await toolExecutor(parsedArgs, message, client, useEmbed);
        } catch (error) {
            console.error(`❌ Error executing tool ${name}:`, error);
            throw error;
        }
    }

    /**
     * Process a message with AI and tools
     */
    async processMessage(message: any, client: any, options: {
        useTools?: boolean;
        useEmbed?: boolean;
        model?: string;
    } = {}): Promise<{ content?: string; embeds?: any[] }> {
        const {
            useTools = true,
            useEmbed = false,
            model = Config.openai_model
        } = options;

        // Generate system prompt
        const systemPrompt = this.generateSystemPrompt();

        // Build chat history
        const messages: any[] = [
            {
                role: 'system' as const,
                content: systemPrompt
            },
            {
                role: 'user' as const,
                content: message.content
            }
        ];

        // Get AI completion
        const completion = await this.generateCompletion(messages, {
            model,
            useTools,
            temperature: 0.7
        });

        const responseMessage = completion.choices?.[0]?.message;
        if (!responseMessage) {
            throw new Error('No response from AI');
        }

        // Handle tool calls if present
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const embeds: any[] = [];

            // Add the assistant message to conversation
            messages.push(responseMessage);

            // Execute tools
            for (const toolCall of responseMessage.tool_calls) {
                try {
                    const toolResult = await this.executeTool(toolCall, message, client, useEmbed);

                    // Handle different result types
                    if (toolResult && typeof toolResult === 'object' && 'data' in toolResult) {
                        embeds.push(toolResult);
                        messages.push({
                            role: 'tool' as const,
                            content: 'Tool executed successfully',
                            tool_call_id: toolCall.id
                        });
                    } else {
                        messages.push({
                            role: 'tool' as const,
                            content: toolResult || 'Tool executed',
                            tool_call_id: toolCall.id
                        });
                    }
                } catch (error) {
                    messages.push({
                        role: 'tool' as const,
                        content: `Error: ${error}`,
                        tool_call_id: toolCall.id
                    });
                }
            }

            // Generate final response
            const finalCompletion = await this.generateCompletion(messages, {
                model,
                useTools: false
            });

            const finalResponse = finalCompletion.choices?.[0]?.message?.content;

            return {
                content: finalResponse || 'I completed the requested actions.',
                embeds: embeds.length > 0 ? embeds : undefined
            };
        }

        // Return simple text response
        return {
            content: responseMessage.content || 'No response generated'
        };
    }

    /**
     * Generate system prompt with tool information
     */
    private generateSystemPrompt(): string {
        let systemPrompt = Config.baseSystemPrompt;

        if (this.tools.length > 0) {
            systemPrompt += '\n\nYou have access to the following tools:\n';

            const toolDescriptions = this.tools.map(tool => {
                const name = tool.function.name.replace(/([A-Z])/g, ' $1').trim();
                const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                return `- **${capitalizedName}**: ${tool.function.description}`;
            }).join('\n');

            systemPrompt += toolDescriptions;

            if (this.systemPrompts.length > 0) {
                systemPrompt += '\n\n' + this.systemPrompts.join('\n');
            }
        }

        return systemPrompt;
    }

    /**
     * Create speech from text
     */
    async textToSpeech(text: string, voice: string = 'nova'): Promise<Buffer> {
        const response = await this.openai.audio.speech.create({
            model: Config.tts_model || 'tts-1',
            voice: voice as any,
            input: text,
            response_format: 'mp3'
        });

        return Buffer.from(await response.arrayBuffer());
    }

    /**
     * Convert speech to text
     */
    async speechToText(audioBuffer: Buffer): Promise<string> {
        // Create a File-like object from buffer
        const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

        const response = await this.openai.audio.transcriptions.create({
            file: audioFile,
            model: Config.voice_model || 'whisper-1'
        });

        return response.text;
    }

    /**
     * Moderate content using OpenAI moderation
     */
    async moderateContent(text: string): Promise<{ flagged: boolean; categories: string[] }> {
        const response = await this.openai.moderations.create({
            input: text,
            model: Config.openai_moderation_model || 'text-moderation-latest'
        });

        const result = response.results[0];
        const flaggedCategories = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category);

        return {
            flagged: result.flagged,
            categories: flaggedCategories
        };
    }

    /**
     * Get OpenAI client for advanced usage
     */
    getClient(): OpenAI {
        return this.openai;
    }
}
