import { Config } from './config.js';

// In-memory token storage (you could also use a file or database)
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

export async function getRedditAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (cachedAccessToken && Date.now() < tokenExpiry) {
        return cachedAccessToken;
    }

    // If no valid cached token, get a new one
    return await getNewRedditAccessToken();
}

export async function getNewRedditAccessToken(): Promise<string> {
    if (!Config.reddit_api_key || !Config.reddit_api_secret) {
        throw new Error('Reddit API credentials not configured');
    }

    const accessTokenUrl = 'https://www.reddit.com/api/v1/access_token';

    try {
        const response = await fetch(accessTokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${Config.reddit_api_key}:${Config.reddit_api_secret}`).toString('base64')}`,
                'User-Agent': 'Sara Discord Bot 1.0'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            throw new Error(`Reddit API returned ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (!json.access_token) {
            throw new Error('No access token received from Reddit API');
        }

        // Cache the new token
        cachedAccessToken = json.access_token;
        // Reddit tokens expire in 1 hour, set expiry slightly before that
        tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

        console.log('✅ New Reddit access token obtained');
        return cachedAccessToken!;

    } catch (error) {
        console.error('❌ Failed to get Reddit access token:', error);
        throw error;
    }
}

export async function validateRedditAccessToken(token?: string): Promise<boolean> {
    const accessToken = token || cachedAccessToken;

    if (!accessToken) {
        return false;
    }

    try {
        const response = await fetch('https://oauth.reddit.com/api/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Sara Discord Bot 1.0'
            }
        });

        return response.status === 200;
    } catch (error) {
        console.warn('Failed to validate Reddit access token:', error);
        return false;
    }
}

// Force refresh the access token
export async function refreshRedditAccessToken(): Promise<string> {
    cachedAccessToken = null;
    tokenExpiry = 0;
    return await getNewRedditAccessToken();
}

// Initialize Reddit access token at startup
export async function initializeRedditAccessToken(): Promise<void> {
    try {
        if (!Config.reddit_api_key || !Config.reddit_api_secret) {
            console.warn('⚠️ Reddit API credentials not configured. Reddit functionality will be limited.');
            return;
        }

        console.log('🔑 Initializing Reddit access token...');
        await getNewRedditAccessToken();
        console.log('✅ Reddit access token ready');
    } catch (error) {
        console.error('❌ Failed to initialize Reddit access token:', error);
        console.warn('⚠️ Reddit functionality may be limited.');
    }
}
