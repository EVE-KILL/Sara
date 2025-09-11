import chalk from 'chalk';
import { database } from '../database.js';
import OpenAI from 'openai';
import { Config } from '../config.js';
import * as fs from 'fs/promises';

export default {
    name: 'profile-user',
    description: 'Create a comprehensive psychological and behavioral profile of a user based on all their messages',

    async execute(client: any, args: string[]) {
        if (args.length === 0) {
            console.log(chalk.red('Error: User ID is required'));
            console.log(chalk.yellow('Usage: bun run task.ts profile-user <user-id> [--save-to-file]'));
            console.log(chalk.yellow('  --save-to-file: Save the profile to a file in addition to console output'));
            return;
        }

        const userId = args[0];
        const saveToFile = args.includes('--save-to-file');

        console.log(chalk.blue(`🔍 Creating psychological profile for user: ${userId}`));
        console.log(chalk.cyan('⚠️  Warning: This analysis is for entertainment/research purposes only'));

        try {
            // Get all messages from this user
            const messages = await getUserMessages(userId);

            if (messages.length === 0) {
                console.log(chalk.red('No messages found for this user!'));
                return;
            }

            console.log(chalk.green(`📊 Found ${messages.length} messages to analyze`));
            console.log(chalk.yellow('🧠 Starting AI-powered deep psychological analysis...'));

            // Initialize OpenAI
            const openai = new OpenAI({
                apiKey: Config.openai_api_key
            });

            // Create comprehensive profile
            const profile = await createUserProfile(openai, messages, userId);

            // Display the profile
            displayProfile(profile);

            // Save to file if requested
            if (saveToFile) {
                await saveProfileToFile(profile, userId);
            }

        } catch (error) {
            console.error(chalk.red('Error creating user profile:'), error);
        }
    }
};

async function getUserMessages(userId: string) {
    try {
        // Use the database directly since there's no getUserMessages method
        const query = `
            SELECT
                content,
                author_username,
                author_display_name,
                channel_id,
                guild_id,
                created_at,
                edited_at,
                attachments_count,
                embeds_count,
                reply_to_message_id,
                is_bot
            FROM messages
            WHERE author_id = ?
            AND is_bot = 0
            AND content IS NOT NULL
            AND content != ''
            ORDER BY created_at DESC
        `;

        // Access the private db property through the database instance
        // This is a workaround since there's no public method for custom queries
        return (database as any).db.query(query).all(userId);
    } catch (error) {
        console.error('Error fetching user messages:', error);
        return [];
    }
}

async function createUserProfile(openai: OpenAI, messages: any[], userId: string) {
    const profile = {
        userId,
        basicStats: analyzeBasicStats(messages),
        timePatterns: analyzeTimePatterns(messages),
        communicationStyle: null as string | null,
        psychologicalProfile: null as string | null,
        interests: null as string | null,
        relationships: null as string | null,
        behaviorPrediction: null as string | null,
        creepyInsights: null as string | null
    };

    // Prepare message samples for AI analysis (we'll need to chunk this due to token limits)
    const messageSamples = prepareMessageSamples(messages);

    try {
        // Communication Style Analysis
        console.log(chalk.cyan('  📝 Analyzing communication style...'));
        profile.communicationStyle = await analyzeCommunicationStyle(openai, messageSamples);

        // Deep Psychological Analysis
        console.log(chalk.cyan('  🧠 Performing psychological analysis...'));
        profile.psychologicalProfile = await analyzePsychologicalProfile(openai, messageSamples);

        // Interest and Hobby Detection
        console.log(chalk.cyan('  🎯 Detecting interests and hobbies...'));
        profile.interests = await analyzeInterests(openai, messageSamples);

        // Relationship Pattern Analysis
        console.log(chalk.cyan('  💕 Analyzing relationship patterns...'));
        profile.relationships = await analyzeRelationships(openai, messageSamples);

        // Behavior Prediction
        console.log(chalk.cyan('  🔮 Predicting future behavior...'));
        profile.behaviorPrediction = await predictBehavior(openai, messageSamples);

        // Creepy Deep Insights
        console.log(chalk.cyan('  👁️  Generating creepy insights...'));
        profile.creepyInsights = await generateCreepyInsights(openai, messageSamples, profile);

    } catch (error) {
        console.error(chalk.red('Error during AI analysis:'), error);
    }

    return profile;
}

function analyzeBasicStats(messages: any[]) {
    const totalMessages = messages.length;
    const totalWords = messages.reduce((sum, msg) => sum + (msg.content?.split(' ').length || 0), 0);
    const avgWordsPerMessage = totalWords / totalMessages;

    const firstMessage = new Date(messages[0]?.created_at);
    const lastMessage = new Date(messages[messages.length - 1]?.created_at);
    const timeSpan = lastMessage.getTime() - firstMessage.getTime();
    const daysActive = timeSpan / (1000 * 60 * 60 * 24);
    const messagesPerDay = totalMessages / daysActive;

    const editedMessages = messages.filter(msg => msg.edited_at).length;
    const messagesWithAttachments = messages.filter(msg => msg.attachments_count > 0).length;
    const replies = messages.filter(msg => msg.reply_to_message_id).length;

    const channelDistribution: Record<string, number> = {};
    messages.forEach(msg => {
        channelDistribution[msg.channel_id] = (channelDistribution[msg.channel_id] || 0) + 1;
    });

    return {
        totalMessages,
        totalWords,
        avgWordsPerMessage: Math.round(avgWordsPerMessage * 100) / 100,
        daysActive: Math.round(daysActive),
        messagesPerDay: Math.round(messagesPerDay * 100) / 100,
        editRate: Math.round((editedMessages / totalMessages) * 100 * 100) / 100,
        attachmentRate: Math.round((messagesWithAttachments / totalMessages) * 100 * 100) / 100,
        replyRate: Math.round((replies / totalMessages) * 100 * 100) / 100,
        mostActiveChannel: Object.keys(channelDistribution).reduce((a, b) =>
            channelDistribution[a] > channelDistribution[b] ? a : b),
        channelCount: Object.keys(channelDistribution).length
    };
}

function analyzeTimePatterns(messages: any[]) {
    const hourCounts = new Array(24).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);
    const monthCounts = new Array(12).fill(0);

    messages.forEach(msg => {
        const date = new Date(msg.created_at);
        hourCounts[date.getHours()]++;
        dayOfWeekCounts[date.getDay()]++;
        monthCounts[date.getMonth()]++;
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakDay = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
    const peakMonth = monthCounts.indexOf(Math.max(...monthCounts));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

    return {
        peakHour: `${peakHour}:00`,
        peakDay: dayNames[peakDay],
        peakMonth: monthNames[peakMonth],
        hourDistribution: hourCounts,
        isNightOwl: hourCounts.slice(22).reduce((a, b) => a + b) + hourCounts.slice(0, 6).reduce((a, b) => a + b) >
                   hourCounts.slice(9, 17).reduce((a, b) => a + b),
        weekendActivity: (dayOfWeekCounts[0] + dayOfWeekCounts[6]) / (dayOfWeekCounts.slice(1, 6).reduce((a, b) => a + b))
    };
}

function prepareMessageSamples(messages: any[], maxSamples = 50000) {
    // Stay within 400k TPM limit for GPT-4.1-nano
    const validMessages = messages.filter(msg => msg.content && msg.content.trim().length > 0);

    console.log(chalk.yellow(`  📝 Processing ${validMessages.length} valid messages (limit: ${maxSamples})...`));

    // Calculate token usage to stay within 400k TPM limit (leaving room for system prompts + output)
    const TARGET_INPUT_TOKENS = 300000;
    let messagesToUse = [];
    let currentTokens = 0;

    for (let i = 0; i < validMessages.length && i < maxSamples; i++) {
        const messageWords = validMessages[i].content?.split(' ').length || 0;
        const messageTokens = Math.round(messageWords / 0.75); // Rough approximation

        if (currentTokens + messageTokens > TARGET_INPUT_TOKENS) {
            break;
        }

        messagesToUse.push(validMessages[i]);
        currentTokens += messageTokens;
    }

    const totalWords = messagesToUse.reduce((sum, msg) => sum + (msg.content?.split(' ').length || 0), 0);
    const estimatedTokens = Math.round(totalWords / 0.75);

    console.log(chalk.cyan(`  🔢 Using ${messagesToUse.length} messages (~${totalWords} words, ~${estimatedTokens} tokens)`));
    console.log(chalk.gray(`  📊 Staying within 400k TPM limit (target: ${TARGET_INPUT_TOKENS} tokens)`));

    // Return messages that fit within token budget
    return messagesToUse.map(msg => ({
        content: msg.content,
        timestamp: msg.created_at,
        isReply: !!msg.reply_to_message_id,
        hasAttachments: msg.attachments_count > 0
    }));
}

async function analyzeCommunicationStyle(openai: OpenAI, messageSamples: any[]) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are a forensic linguistic expert analyzing communication patterns. Analyze writing style, vocabulary sophistication, grammar patterns, punctuation habits, emoji usage, capitalization tendencies, sentence structure, formality levels, emotional expression patterns, slang usage, typo patterns, and unique linguistic fingerprints. Be extremely specific and detailed. You have access to ALL of this person's messages, so provide the most comprehensive linguistic analysis possible.`
            },
            {
                role: 'user',
                content: `Analyze this person's complete communication style from ALL their messages (${messageSamples.length} total messages):\n\n${allMessages}`
            }
        ],
        max_completion_tokens: 500
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

async function analyzePsychologicalProfile(openai: OpenAI, messageSamples: any[]) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are a forensic psychologist with expertise in digital behavior analysis. Analyze personality traits, emotional patterns, cognitive biases, defense mechanisms, attachment styles, neuroticism indicators, extroversion levels, openness to experience, conscientiousness, agreeableness, stress responses, coping mechanisms, social dynamics, power dynamics, insecurity markers, confidence patterns, empathy levels, narcissistic tendencies, anxiety indicators, depression markers, anger patterns, and psychological defense patterns. Be extremely detailed and specific. You have access to ALL of this person's messages, so provide the most comprehensive psychological analysis possible.`
            },
            {
                role: 'user',
                content: `Analyze this person's complete psychological profile from ALL their messages (${messageSamples.length} total messages):\n\n${allMessages}`
            }
        ],
        max_completion_tokens: 1000
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

async function analyzeInterests(openai: OpenAI, messageSamples: any[]) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are an expert at detecting interests, hobbies, preferences, and passions from text. Identify explicit and implicit interests, including niche hobbies, entertainment preferences, career interests, lifestyle choices, hidden obsessions, brands mentioned, games played, shows watched, books referenced, music tastes, political leanings, philosophical interests, technical skills, creative pursuits, and subcultural affiliations. Look for patterns in what they discuss, react to, or reference repeatedly. You have access to ALL of this person's messages, so provide the most comprehensive interest analysis possible.`
            },
            {
                role: 'user',
                content: `Identify all interests and hobbies from ALL their messages (${messageSamples.length} total messages):\n\n${allMessages}`
            }
        ],
        max_completion_tokens: 1000
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

async function analyzeRelationships(openai: OpenAI, messageSamples: any[]) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are a relationship expert and social dynamics analyst. Analyze communication patterns to determine relationship status, attachment style, social circle size, friendship quality, romantic preferences, conflict resolution style, social anxiety levels, intimacy comfort, boundary setting, people-pleasing tendencies, dominance/submission patterns, emotional availability, jealousy indicators, trust issues, social hierarchy positioning, and relationship satisfaction markers. Look for patterns in how they interact with different people. You have access to ALL of this person's messages, so provide the most comprehensive relationship analysis possible.`
            },
            {
                role: 'user',
                content: `Analyze all relationship and social patterns from ALL their messages (${messageSamples.length} total messages):\n\n${allMessages}`
            }
        ],
        max_completion_tokens: 2500
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

async function predictBehavior(openai: OpenAI, messageSamples: any[]) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are a behavioral prediction specialist with expertise in psychological forecasting. Based on communication patterns, predict future behaviors, stress responses, decision-making patterns, risk tolerance, career trajectory, relationship outcomes, potential life changes, coping strategies under pressure, likely personality development, potential addictions or compulsions, financial decision patterns, conflict escalation tendencies, and probability of major life pivots. Be specific with behavioral predictions but acknowledge these are speculative analyses. You have access to ALL of this person's messages, so provide the most comprehensive behavioral prediction possible.`
            },
            {
                role: 'user',
                content: `Predict future behaviors based on ALL their communication patterns (${messageSamples.length} total messages):\n\n${allMessages}`
            }
        ],
        max_completion_tokens: 2500
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

async function generateCreepyInsights(openai: OpenAI, messageSamples: any[], profile: any) {
    // Send ALL messages in one massive request for comprehensive analysis (GPT-4.1-nano 1M token budget)
    const allMessages = messageSamples.map(msg => msg.content).join('\\n');
    const stats = JSON.stringify(profile.basicStats);
    const timePatterns = JSON.stringify(profile.timePatterns);

    const completion = await openai.chat.completions.create({
        model: Config.openai_model_cheap,
        messages: [
            {
                role: 'system',
                content: `You are a digital forensic psychologist specializing in uncovering hidden behavioral patterns. Generate unsettling but accurate insights that someone might not realize they're revealing about themselves. Focus on: unconscious word choices, emotional leakage, micro-expressions in text, digital body language, hidden insecurities bleeding through confidence, suppressed desires, self-sabotaging patterns, projection mechanisms, compensation behaviors, identity masks, temporal behavior patterns, stress indicators, loneliness markers, power dynamics, validation-seeking, and things they probably don't know they're communicating. Be deeply analytical but remember this is for educational/entertainment purposes. You have access to ALL of this person's messages, so provide the most comprehensive and revealing psychological insight possible.`
            },
            {
                role: 'user',
                content: `Generate the most comprehensive deep psychological insights about this person based on ALL their message patterns (${messageSamples.length} total messages):

Messages: ${allMessages}
Stats: ${stats}
Time Patterns: ${timePatterns}

What unconscious patterns and hidden aspects of their personality are they revealing? What secrets are they unknowingly sharing?`
            }
        ],
        max_completion_tokens: 2500
    });

    return completion.choices[0]?.message?.content || 'Analysis failed';
}

function displayProfile(profile: any) {
    console.log(chalk.magenta.bold('\n' + '='.repeat(80)));
    console.log(chalk.magenta.bold('               🕵️  COMPREHENSIVE USER PROFILE 🕵️'));
    console.log(chalk.magenta.bold('='.repeat(80)));

    console.log(chalk.cyan.bold('\n📊 BASIC STATISTICS:'));
    console.log(`  Total Messages: ${profile.basicStats.totalMessages}`);
    console.log(`  Total Words: ${profile.basicStats.totalWords}`);
    console.log(`  Average Words/Message: ${profile.basicStats.avgWordsPerMessage}`);
    console.log(`  Days Active: ${profile.basicStats.daysActive}`);
    console.log(`  Messages per Day: ${profile.basicStats.messagesPerDay}`);
    console.log(`  Edit Rate: ${profile.basicStats.editRate}%`);
    console.log(`  Attachment Usage: ${profile.basicStats.attachmentRate}%`);
    console.log(`  Reply Rate: ${profile.basicStats.replyRate}%`);
    console.log(`  Active Channels: ${profile.basicStats.channelCount}`);

    console.log(chalk.yellow.bold('\n⏰ TIME PATTERNS:'));
    console.log(`  Peak Activity Hour: ${profile.timePatterns.peakHour}`);
    console.log(`  Most Active Day: ${profile.timePatterns.peakDay}`);
    console.log(`  Most Active Month: ${profile.timePatterns.peakMonth}`);
    console.log(`  Night Owl: ${profile.timePatterns.isNightOwl ? 'Yes' : 'No'}`);
    console.log(`  Weekend vs Weekday Activity: ${(profile.timePatterns.weekendActivity * 100).toFixed(1)}%`);

    if (profile.communicationStyle) {
        console.log(chalk.green.bold('\n📝 COMMUNICATION STYLE:'));
        console.log(profile.communicationStyle);
    }

    if (profile.psychologicalProfile) {
        console.log(chalk.blue.bold('\n🧠 PSYCHOLOGICAL PROFILE:'));
        console.log(profile.psychologicalProfile);
    }

    if (profile.interests) {
        console.log(chalk.magenta.bold('\n🎯 INTERESTS & HOBBIES:'));
        console.log(profile.interests);
    }

    if (profile.relationships) {
        console.log(chalk.magenta.bold('\n💕 RELATIONSHIP PATTERNS:'));
        console.log(profile.relationships);
    }

    if (profile.behaviorPrediction) {
        console.log(chalk.red.bold('\n🔮 BEHAVIOR PREDICTIONS:'));
        console.log(profile.behaviorPrediction);
    }

    if (profile.creepyInsights) {
        console.log(chalk.red.bold('\n👁️  CREEPY INSIGHTS (Things you probably don\'t realize you\'re revealing):'));
        console.log(profile.creepyInsights);
    }

    console.log(chalk.magenta.bold('\n' + '='.repeat(80)));
    console.log(chalk.gray('⚠️  This analysis is for entertainment/research purposes only.'));
    console.log(chalk.gray('   Real psychological assessment requires professional evaluation.'));
    console.log(chalk.magenta.bold('='.repeat(80) + '\n'));
}

async function saveProfileToFile(profile: any, userId: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `user-profile-${userId}-${timestamp}.json`;

    try {
        await fs.writeFile(filename, JSON.stringify(profile, null, 2));
        console.log(chalk.green(`💾 Profile saved to: ${filename}`));
    } catch (error) {
        console.error(chalk.red('Error saving profile to file:'), error);
    }
}
