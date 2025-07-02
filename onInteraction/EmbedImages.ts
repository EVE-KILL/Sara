import { AttachmentBuilder } from 'discord.js';
import { getRedditAccessToken } from '../redditAccessToken.js';

export const command = {
    name: 'embedimages',
    description: 'Download and embed ALL images/videos from a Reddit post (creates multiple posts if needed)',
    options: [
        {
            name: 'reddit_url',
            description: 'Reddit post URL to extract media from',
            type: 3, // STRING type
            required: true
        },
        {
            name: 'max_posts',
            description: 'Maximum number of posts to create (default: 10, each post has up to 10 files)',
            type: 4, // INTEGER type
            required: false,
            min_value: 1,
            max_value: 10
        }
    ]
};

export default async function EmbedImages(interaction: any, client: any) {
    if (interaction.commandName !== 'embedimages') return;

    await interaction.deferReply();

    try {
        const redditUrl = interaction.options.getString('reddit_url');
        const maxPosts = interaction.options.getInteger('max_posts') || 10;

        // Validate Reddit URL
        if (!isValidRedditUrl(redditUrl)) {
            await interaction.editReply('❌ Please provide a valid Reddit post URL (e.g., https://www.reddit.com/r/subreddit/comments/...)');
            return;
        }

        // Get Reddit access token for authenticated requests
        let accessToken: string;
        let useOAuth = true;
        try {
            accessToken = await getRedditAccessToken();
        } catch (error) {
            console.warn('Failed to get Reddit access token, falling back to public API:', error);
            useOAuth = false;
            accessToken = '';
        }

        // Convert Reddit URL to appropriate API format
        const apiUrl = useOAuth ? convertToOAuthApiUrl(redditUrl) : convertToJsonUrl(redditUrl);

        // Fetch Reddit post data
        const headers: Record<string, string> = {
            'User-Agent': 'Sara Discord Bot 1.0'
        };

        if (useOAuth && accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
            // If OAuth request failed, try falling back to public JSON API
            if (useOAuth && (response.status === 401 || response.status === 403)) {
                console.log('OAuth request failed, falling back to public JSON API...');
                const fallbackUrl = convertToJsonUrl(redditUrl);
                const fallbackResponse = await fetch(fallbackUrl, {
                    headers: {
                        'User-Agent': 'Sara Discord Bot 1.0'
                    }
                });

                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    const post = fallbackData[0]?.data?.children?.[0]?.data;
                    if (post) {
                        await processRedditPost(interaction, post, maxPosts, redditUrl);
                        return;
                    }
                }
            }

            if (response.status === 401) {
                throw new Error('Reddit authentication failed. The bot may need to refresh its access token.');
            } else if (response.status === 403) {
                throw new Error('Access forbidden. This post may be private, require NSFW access, or be in a restricted subreddit.');
            } else if (response.status === 404) {
                throw new Error('Reddit post not found. Please check the URL.');
            } else {
                throw new Error(`Reddit API returned ${response.status}: ${response.statusText}`);
            }
        }

        const data = await response.json();

        // Extract post data
        const post = data[0]?.data?.children?.[0]?.data;
        if (!post) {
            throw new Error('Could not find Reddit post data');
        }

        await processRedditPost(interaction, post, maxPosts, redditUrl);

    } catch (error) {
        console.error('Error in embedImages command:', error);
        await interaction.editReply(`❌ Error processing Reddit post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function processRedditPost(interaction: any, post: any, maxPosts: number, redditUrl: string) {
    // Extract ALL media from the post (no limit)
    const mediaUrls = await extractImageUrls(post);

    if (mediaUrls.length === 0) {
        await interaction.editReply('❌ No images or videos found in this Reddit post. Make sure the post contains media content.');
        return;
    }

    // Calculate how many posts we'll need
    const maxImagesTotal = maxPosts * 10; // Maximum total images we'll process
    const mediaToProcess = mediaUrls.slice(0, maxImagesTotal);
    const totalPosts = Math.ceil(mediaToProcess.length / 10);

    await interaction.editReply(`🔍 Found ${mediaUrls.length} media file(s). Will create ${totalPosts} post(s) with up to 10 files each. Downloading...`);

    // Download all media first
    const downloadPromises = mediaToProcess.map(async (url: string, index: number) => {
        try {
            const imageResponse = await fetch(url);
            if (!imageResponse.ok) {
                console.warn(`Failed to download media ${index + 1}: ${imageResponse.status}`);
                return null;
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);

            // Get file extension from URL or default to jpg
            const extension = getFileExtension(url);
            const filename = `reddit_media_${index + 1}.${extension}`;

            return new AttachmentBuilder(buffer, { name: filename });
        } catch (error) {                console.warn(`Error downloading media ${index + 1}:`, error);
            return null;
        }
    });

    const downloadedAttachments = (await Promise.all(downloadPromises)).filter((attachment: AttachmentBuilder | null) => attachment !== null) as AttachmentBuilder[];

    if (downloadedAttachments.length === 0) {
        await interaction.editReply('❌ Failed to download any media files. The files might be in an unsupported format or unavailable.');
        return;
    }

    // Prepare post information
    const postTitle = post.title || 'Reddit Post';
    const postAuthor = post.author || 'Unknown';
    const subreddit = post.subreddit_name_prefixed || 'Unknown';

    // Split images into batches of 10 and send multiple posts
    const batches = [];
    for (let i = 0; i < downloadedAttachments.length; i += 10) {
        batches.push(downloadedAttachments.slice(i, i + 10));
    }

    // Send first batch as reply
    const firstBatch = batches[0];
    const firstContent = `📸 **Media from Reddit Post** (${downloadedAttachments.length}/${mediaToProcess.length} downloaded successfully)\n` +
                       `**Title:** ${postTitle.length > 100 ? postTitle.substring(0, 97) + '...' : postTitle}\n` +
                       `**Author:** u/${postAuthor}\n` +
                       `**Subreddit:** ${subreddit}\n` +
                       `**URL:** <${redditUrl}>\n` +
                       `**Post 1 of ${batches.length}** - Files 1-${firstBatch.length}`;

    await interaction.editReply({
        content: firstContent,
        files: firstBatch
    });

    // Send remaining batches as follow-up messages
    for (let i = 1; i < batches.length; i++) {
        const batch = batches[i];
        const startImageNum = (i * 10) + 1;
        const endImageNum = startImageNum + batch.length - 1;

        const followupContent = `📸 **Post ${i + 1} of ${batches.length}** - Files ${startImageNum}-${endImageNum}`;

        await interaction.followUp({
            content: followupContent,
            files: batch
        });

        // Add a small delay between posts to avoid rate limiting
        if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function isValidRedditUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return (parsedUrl.hostname === 'www.reddit.com' || parsedUrl.hostname === 'reddit.com' ||
                parsedUrl.hostname === 'old.reddit.com' || parsedUrl.hostname === 'new.reddit.com') &&
               parsedUrl.pathname.includes('/comments/');
    } catch {
        return false;
    }
}

function convertToOAuthApiUrl(redditUrl: string): string {
    // Extract subreddit and post ID from Reddit URL
    // Format: https://www.reddit.com/r/subreddit/comments/postid/title/
    const urlParts = redditUrl.split('/');
    const subredditIndex = urlParts.indexOf('r') + 1;
    const commentsIndex = urlParts.indexOf('comments');

    if (subredditIndex > 0 && commentsIndex > 0 && urlParts[commentsIndex + 1]) {
        const subreddit = urlParts[subredditIndex];
        const postId = urlParts[commentsIndex + 1];
        return `https://oauth.reddit.com/r/${subreddit}/comments/${postId}`;
    }

    // Fallback: try to convert to oauth.reddit.com
    return redditUrl.replace(/^https?:\/\/(www\.|old\.|new\.)?reddit\.com/, 'https://oauth.reddit.com');
}

function convertToJsonUrl(redditUrl: string): string {
    // Remove any trailing slash and add .json
    const cleanUrl = redditUrl.replace(/\/$/, '');
    return `${cleanUrl}.json`;
}

async function extractImageUrls(post: any, limit?: number): Promise<string[]> {
    const mediaUrls: string[] = [];

    // Check for Reddit gallery (media_metadata) - this is the primary source for galleries
    if (post.media_metadata) {
        for (const [id, metadata] of Object.entries(post.media_metadata as Record<string, any>)) {
            if (metadata.s) {
                const source = metadata.s;
                let mediaUrl: string | null = null;

                // Priority: mp4 (video) > gif (animated) > u (static image)
                if (source.mp4) {
                    mediaUrl = source.mp4;
                    console.log(`Found MP4 media: ${id}`);
                } else if (source.gif) {
                    mediaUrl = source.gif;
                    console.log(`Found GIF media: ${id}`);
                } else if (source.u) {
                    mediaUrl = source.u;
                    console.log(`Found static image: ${id}`);
                }

                if (mediaUrl) {
                    // Decode HTML entities in the URL
                    mediaUrl = mediaUrl.replace(/&amp;/g, '&');
                    mediaUrls.push(mediaUrl);
                }
            }
        }
    }

    // Check for Reddit video (v.redd.it videos)
    if (post.media && post.media.reddit_video) {
        const videoUrl = post.media.reddit_video.fallback_url || post.media.reddit_video.dash_url;
        if (videoUrl) {
            mediaUrls.push(videoUrl);
        }
    }

    // Check for preview images/videos (fallback if no media_metadata)
    if (post.preview && post.preview.images && post.preview.images.length > 0 && mediaUrls.length === 0) {
        for (const image of post.preview.images) {
            let mediaUrl: string | null = null;

            // Priority: mp4 variants > gif variants > static image source
            if (image.variants) {
                if (image.variants.mp4 && image.variants.mp4.source) {
                    // Get the highest resolution mp4
                    const resolutions = image.variants.mp4.resolutions || [];
                    const highestRes = resolutions.length > 0 ? resolutions[resolutions.length - 1] : image.variants.mp4.source;
                    mediaUrl = highestRes.url.replace(/&amp;/g, '&');
                    console.log(`Found MP4 variant (${resolutions.length} resolutions available)`);
                } else if (image.variants.gif && image.variants.gif.source) {
                    // Get the highest resolution gif
                    const resolutions = image.variants.gif.resolutions || [];
                    const highestRes = resolutions.length > 0 ? resolutions[resolutions.length - 1] : image.variants.gif.source;
                    mediaUrl = highestRes.url.replace(/&amp;/g, '&');
                    console.log(`Found GIF variant (${resolutions.length} resolutions available)`);
                }
            }

            // Fallback to highest resolution static image
            if (!mediaUrl && image.source && image.source.url) {
                mediaUrl = image.source.url.replace(/&amp;/g, '&');
                console.log(`Fallback to static image source`);
            }

            if (mediaUrl && !mediaUrls.some(url => url.includes(mediaUrl))) {
                mediaUrls.push(mediaUrl);
            }
        }
    }

    // Check for Reddit video preview
    if (post.preview && post.preview.reddit_video_preview && mediaUrls.length === 0) {
        const videoUrl = post.preview.reddit_video_preview.fallback_url;
        if (videoUrl) {
            mediaUrls.push(videoUrl);
        }
    }

    // Check for direct media URL
    if (post.url && isImageUrl(post.url) && mediaUrls.length === 0) {
        mediaUrls.push(post.url);
    }

    // Check for crosspost original content
    if (post.crosspost_parent_list && post.crosspost_parent_list.length > 0) {
        const originalPost = post.crosspost_parent_list[0];
        const crosspostMedia = await extractImageUrls(originalPost, limit);
        mediaUrls.push(...crosspostMedia);
    }

    // Handle Imgur links
    if (post.url && (post.url.includes('imgur.com') || post.url.includes('i.imgur.com'))) {
        const imgurMedia = await extractImgurImages(post.url);
        mediaUrls.push(...imgurMedia);
    }

    // Remove duplicates and optionally limit
    const uniqueUrls = [...new Set(mediaUrls)];
    return limit ? uniqueUrls.slice(0, limit) : uniqueUrls;
}

function isImageUrl(url: string): boolean {
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp4', '.mov', '.avi', '.gifv'];
    const lowerUrl = url.toLowerCase();
    return mediaExtensions.some(ext => lowerUrl.includes(ext)) ||
           url.includes('i.redd.it') ||
           url.includes('v.redd.it') ||
           url.includes('preview.redd.it') ||
           url.includes('imgur.com');
}

async function extractImgurImages(imgurUrl: string): Promise<string[]> {
    try {
        // Handle direct imgur image links
        if (imgurUrl.includes('i.imgur.com')) {
            return [imgurUrl];
        }

        // Handle imgur album/gallery links
        if (imgurUrl.includes('imgur.com/a/') || imgurUrl.includes('imgur.com/gallery/')) {
            // For albums/galleries, we'd need Imgur API, but for now return the direct link if possible
            const albumId = imgurUrl.split('/').pop()?.replace('.gifv', '');
            if (albumId) {
                // Try common image extensions
                const extensions = ['jpg', 'png', 'gif'];
                const imageUrls = extensions.map(ext => `https://i.imgur.com/${albumId}.${ext}`);
                return imageUrls;
            }
        }

        // Handle single imgur links
        if (imgurUrl.includes('imgur.com/') && !imgurUrl.includes('/a/') && !imgurUrl.includes('/gallery/')) {
            const imageId = imgurUrl.split('/').pop()?.replace('.gifv', '');
            if (imageId) {
                return [`https://i.imgur.com/${imageId}.jpg`];
            }
        }

        return [];
    } catch (error) {
        console.warn('Error extracting Imgur images:', error);
        return [];
    }
}

function getFileExtension(url: string): string {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) {
        const ext = match[1].toLowerCase();
        // Map common extensions (both images and videos)
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'mov', 'avi', 'gifv'];
        if (validExtensions.includes(ext)) {
            // Convert gifv to mp4 since that's what it actually is
            return ext === 'gifv' ? 'mp4' : ext;
        }
    }

    // Detect by URL patterns
    if (url.includes('.mp4') || url.includes('DASH_') || url.includes('reddit_video')) {
        return 'mp4';
    }
    if (url.includes('.gif')) {
        return 'gif';
    }
    if (url.includes('.webp')) {
        return 'webp';
    }

    return 'jpg'; // Default extension
}
