import { Config } from '../config.js';
import OpenAI from 'openai';

export const tool = {
    name: 'get_programming_help',
    description: 'Get advanced programming assistance using a specialized coding model. Use this for complex programming questions, code reviews, debugging, algorithm explanations, or technical discussions that require deep reasoning.',
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "The programming question, code snippet, or technical problem that needs advanced analysis"
            },
            context: {
                type: "string",
                description: "Additional context about the programming environment, language, or specific requirements"
            },
            show_reasoning: {
                type: "boolean",
                description: "Whether to show the model's step-by-step reasoning process (default: true for complex problems)"
            }
        },
        required: ["question"]
    },
    systemPrompt: 'Use the get_programming_help tool when users need advanced programming assistance, code reviews, debugging help, or technical explanations that require specialized coding knowledge.'
};

export default async function getProgrammingHelp(args: any, message: any, client: any, useEmbed: boolean = false): Promise<string> {
    try {
        const { question, context, show_reasoning = true } = args;

        const openai = new OpenAI({
            apiKey: Config.openai_api_key
        });

        let systemPrompt = `You are an expert programming assistant with deep knowledge across multiple programming languages, frameworks, and software development practices.

Provide detailed, accurate, and practical programming help. When answering:
- Give clear, working code examples when appropriate
- Explain complex concepts step by step
- Point out potential issues or best practices
- Suggest optimizations when relevant
- Use proper formatting for code blocks

Be thorough but concise, and always prioritize correctness and clarity.`;

        if (show_reasoning) {
            systemPrompt += `\n\nShow your reasoning process when solving complex problems.`;
        }

        let userPrompt = `Programming Question: ${question}`;
        if (context) {
            userPrompt += `\n\nAdditional Context: ${context}`;
        }

        const completion = await openai.chat.completions.create({
            model: Config.openai_model_coding,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: 4000
        });

        const response = completion.choices?.[0]?.message?.content;

        if (!response) {
            return '❌ No response received from the programming assistant.';
        }

        // Add a header to distinguish this as specialized programming help
        const formattedResponse = `🤖 **Advanced Programming Assistant**\n\n${response}`;

        return formattedResponse;

    } catch (error) {
        console.error('Error getting programming help:', error);
        return `❌ Error getting programming assistance: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}
