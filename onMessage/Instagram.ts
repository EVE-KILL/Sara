import { Client, Message, AttachmentBuilder } from "discord.js";
import { instagramGetUrl } from "instagram-url-direct";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { execSync } from "child_process";
import { Config } from "../config";

// Helper function to create temporary cookies file
function createCookiesFile(tempDir: string): string {
    const cookiesPath = path.join(tempDir, 'instagram_cookies.txt');
    const cookiesContent = Buffer.from(Config.instagram_cookies_b64, 'base64').toString('utf8');
    fs.writeFileSync(cookiesPath, cookiesContent);
    return cookiesPath;
}

// Helper function to compress video using ffmpeg
async function compressVideo(inputPath: string, outputPath: string, targetSizeMB: number): Promise<boolean> {
    try {
        // Get input file size and duration
        const inputStats = fs.statSync(inputPath);
        const inputSizeMB = inputStats.size / (1024 * 1024);

        if (inputSizeMB <= targetSizeMB) {
            // If already under target, just copy the file
            fs.copyFileSync(inputPath, outputPath);
            return true;
        }

        // First, get video duration using ffprobe
        const ffprobeCmd = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${inputPath}"`;
        const durationStr = execSync(ffprobeCmd, { encoding: 'utf8' }).trim();
        const duration = parseFloat(durationStr);

        if (isNaN(duration) || duration <= 0) {
            console.error('Could not determine video duration');
            return false;
        }

        // Calculate target bitrate in kbps (with 90% safety margin)
        const targetBitrate = Math.floor((targetSizeMB * 8 * 1024 * 0.9) / duration);

        // Ensure minimum quality - don't go below 200kbps
        const finalBitrate = Math.max(targetBitrate, 200);

        // Compress the video with aggressive settings
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 28 -b:v ${finalBitrate}k -maxrate ${finalBitrate * 1.2}k -bufsize ${finalBitrate * 2}k -c:a aac -b:a 64k -movflags +faststart -y "${outputPath}"`;

        execSync(ffmpegCmd, { stdio: 'ignore' });

        // Check if compression was successful
        if (fs.existsSync(outputPath)) {
            return true;
        } else {
            console.error('Compression failed - output file not created');
            return false;
        }

    } catch (error) {
        console.error('ffmpeg compression error:', error);
        return false;
    }
}

// Helper function to get Instagram media info using yt-dlp (for videos)
async function getInstagramInfoWithYtDlp(url: string, tempDir: string): Promise<any> {
    try {
        // Create cookies file
        const cookiesPath = createCookiesFile(tempDir);

        // Use yt-dlp to get media info with cookies
        const cmd = `yt-dlp --cookies "${cookiesPath}" --dump-json --no-download "${url}"`;
        const result = execSync(cmd, { encoding: 'utf8' });

        // Clean up cookies file
        fs.unlinkSync(cookiesPath);

        // yt-dlp returns one JSON object per line for playlists/albums
        const lines = result.trim().split('\n').filter(line => line.trim());
        const mediaInfo = lines.map(line => JSON.parse(line));

        return {
            mediaInfo,
            title: mediaInfo[0]?.title || 'Instagram Post',
            uploader: mediaInfo[0]?.uploader || 'Unknown',
            uploaderId: mediaInfo[0]?.uploader_id || '',
            likeCount: mediaInfo[0]?.like_count || 0,
            viewCount: mediaInfo[0]?.view_count || 0,
            isPrivate: false, // yt-dlp usually can't access private content
            caption: mediaInfo[0]?.description || '',
            description: mediaInfo[0]?.description || ''
        };
    } catch (error: any) {
        console.error('yt-dlp error:', error.message);
        throw new Error(`Failed to get Instagram info: ${error.message}`);
    }
}

// Helper function to download Instagram media using yt-dlp (for videos)
async function downloadInstagramMediaWithYtDlp(url: string, outputDir: string): Promise<string[]> {
    try {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create cookies file
        const cookiesPath = createCookiesFile(outputDir);

        // Use yt-dlp to download media with cookies and a specific filename pattern
        const timestamp = Date.now();
        const outputTemplate = path.join(outputDir, `instagram_${timestamp}_%(autonumber)s.%(ext)s`);

        const cmd = `yt-dlp --cookies "${cookiesPath}" -o "${outputTemplate}" --write-thumbnail --embed-thumbnail "${url}"`;
        execSync(cmd, { stdio: 'pipe' });

        // Clean up cookies file
        fs.unlinkSync(cookiesPath);

        // Find all downloaded files
        const allFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(`instagram_${timestamp}_`))
            .map(file => path.join(outputDir, file));

        // Filter out thumbnail images when using yt-dlp
        // yt-dlp often downloads .jpg thumbnails alongside videos
        const files = allFiles.filter(file => {
            const fileName = path.basename(file).toLowerCase();
            const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.webp');

            // If this is an image, check if there's any video file in the same batch
            if (isImage) {
                const hasAnyVideo = allFiles.some(f => {
                    const videoName = path.basename(f).toLowerCase();
                    return videoName.endsWith('.mp4') || videoName.endsWith('.webm') || videoName.endsWith('.mkv');
                });

                // Skip image if there's any video file (since yt-dlp thumbnails are usually not needed when we have video)
                if (hasAnyVideo) {
                    // Delete the thumbnail file to clean up
                    try {
                        fs.unlinkSync(file);
                        console.log(`Removed thumbnail: ${path.basename(file)}`);
                    } catch (e) {
                        console.log('Could not delete thumbnail:', e);
                    }
                    return false;
                }
            }

            return true;
        });

        return files;
    } catch (error: any) {
        console.error('yt-dlp download error:', error.message);
        throw new Error(`Failed to download Instagram media: ${error.message}`);
    }
}

// Helper function to download media from direct URL (for images from instagram-url-direct)
function downloadMedia(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);

        // Handle both http and https URLs
        const protocol = url.startsWith('https:') ? https : http;

        protocol.get(url, (response: any) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            } else if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirects
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    const redirectProtocol = redirectUrl.startsWith('https:') ? https : http;
                    redirectProtocol.get(redirectUrl, (redirectResponse: any) => {
                        redirectResponse.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve();
                        });
                    }).on('error', reject);
                } else {
                    reject(new Error('Redirect without location header'));
                }
            } else {
                reject(new Error(`HTTP ${response.statusCode}`));
            }
        }).on('error', reject);

        file.on('error', (err) => {
            fs.unlink(filePath, () => {}); // Delete the file on error
            reject(err);
        });
    });
}

// Helper function to extract hashtags from text
function extractHashtags(text: string): string[] {
    if (!text) return [];
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const hashtags = text.match(hashtagRegex) || [];
    // Remove duplicates and return
    return [...new Set(hashtags)];
}

export default async function Instagram(client: Client, message: Message) {
    // Check if the message contains an Instagram URL - updated regex to be more specific
    const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)\/?(?:\?[^\s]*)?/gi;
    const matches = message.content.match(instagramRegex);

    if (!matches) {
        // Check for story URLs separately to provide helpful message
        const storyRegex = /https?:\/\/(?:www\.)?instagram\.com\/stories\/[\w\-]+\/?(?:\?[^\s]*)?/gi;
        const storyMatches = message.content.match(storyRegex);
        if (storyMatches) {
            await message.reply("❌ Instagram Stories are not supported. Only regular posts and reels can be downloaded.");
        }
        return;
    }

    // Check if any Instagram URLs are not wrapped in < > (which suppresses embeds)
    const unwrappedMatches = matches.filter(url => {
        const urlIndex = message.content.indexOf(url);
        const beforeUrl = message.content.substring(Math.max(0, urlIndex - 1), urlIndex);
        const afterUrl = message.content.substring(urlIndex + url.length, urlIndex + url.length + 1);
        return !(beforeUrl === '<' && afterUrl === '>');
    });

    // If there are unwrapped URLs, suppress Discord's automatic embeds
    if (unwrappedMatches.length > 0) {
        try {
            await message.suppressEmbeds(true);
        } catch (error: any) {
            // Check if it's a permissions error
            if (error.code === 50013) {
                console.log("⚠️  Bot needs 'Manage Messages' permission to suppress Instagram embeds. Please update bot permissions.");
            } else {
                console.log("Could not suppress embeds:", error);
            }
        }
    }

    try {
        // React to the message to show we're processing
        await message.react('⏳');

        for (const url of matches) {
            try {
                console.log(`Processing Instagram URL: ${url}`);

                // Create a temporary directory
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                let downloadedFiles: string[] = [];
                let postInfo: any = null;
                let usedYtDlp = false;

                // First, try instagram-url-direct (works for images and some videos)
                try {
                    console.log(`Trying instagram-url-direct for: ${url}`);
                    const result = await instagramGetUrl(url);

                    if (result && result.url_list && result.url_list.length > 0) {
                        // Check if the account is private
                        if (result.post_info && result.post_info.is_private) {
                            await message.reply("❌ This Instagram post is from a private account and cannot be downloaded.");
                            continue;
                        }

                        // Download media using instagram-url-direct
                        for (let i = 0; i < result.url_list.length; i++) {
                            const mediaUrl = result.url_list[i];
                            try {
                                // Determine file extension from media details or URL
                                const mediaDetail = result.media_details && result.media_details[i];
                                const isVideo = mediaDetail ? (mediaDetail as any).type === 'video' : mediaUrl.includes('.mp4') || mediaUrl.includes('video');
                                const extension = isVideo ? 'mp4' : 'jpg';
                                const fileName = `instagram_${Date.now()}_${i + 1}.${extension}`;
                                const filePath = path.join(tempDir, fileName);

                                // Download the media
                                await downloadMedia(mediaUrl, filePath);
                                downloadedFiles.push(filePath);
                            } catch (downloadError) {
                                console.error(`Error downloading media ${i + 1} with instagram-url-direct:`, downloadError);
                            }
                        }

                        // Extract post info from instagram-url-direct result
                        postInfo = {
                            uploader: result.post_info?.owner_username || 'Unknown',
                            likeCount: result.post_info?.likes || 0,
                            viewCount: result.media_details?.find((detail: any) => detail.type === 'video' && detail.video_view_count)?.video_view_count || 0,
                            isVerified: result.post_info?.is_verified || false,
                            fullname: result.post_info?.owner_fullname || '',
                            caption: result.post_info?.caption || ''
                        };
                    }
                } catch (instagramDirectError: any) {
                    console.log(`instagram-url-direct failed: ${instagramDirectError.message}`);

                    // Check if it's a video-related error that suggests we should try yt-dlp
                    const shouldTryYtDlp = instagramDirectError.message.includes("Only posts/reels supported") ||
                                          instagramDirectError.message.includes("video") ||
                                          instagramDirectError.message.includes("reel") ||
                                          downloadedFiles.length === 0; // No files downloaded

                    if (shouldTryYtDlp) {
                        console.log(`Falling back to yt-dlp for: ${url}`);
                        try {
                            downloadedFiles = await downloadInstagramMediaWithYtDlp(url, tempDir);
                            usedYtDlp = true;

                            // Try to get post info with yt-dlp
                            try {
                                const ytDlpInfo = await getInstagramInfoWithYtDlp(url, tempDir);
                                postInfo = {
                                    uploader: ytDlpInfo.uploader,
                                    likeCount: ytDlpInfo.likeCount,
                                    viewCount: ytDlpInfo.viewCount,
                                    isVerified: false,
                                    fullname: '',
                                    caption: ytDlpInfo.caption || ytDlpInfo.description || ''
                                };
                            } catch (infoError) {
                                console.log('Could not get post info with yt-dlp:', infoError);
                            }
                        } catch (ytDlpError) {
                            console.error(`yt-dlp also failed: ${ytDlpError}`);
                            throw instagramDirectError; // Throw the original error
                        }
                    } else {
                        throw instagramDirectError;
                    }
                }

                if (downloadedFiles.length > 0) {
                    // Determine upload limit based on server boost level
                    let uploadLimit = 10; // Default Discord upload limit
                    const guild = message.guild;

                    if (guild) {
                        switch (guild.premiumTier) {
                            case 1: // Level 1 boost (no file size increase)
                                uploadLimit = 10;
                                break;
                            case 2: // Level 2 boost
                                uploadLimit = 50;
                                break;
                            case 3: // Level 3 boost
                                uploadLimit = 100;
                                break;
                            default: // No boost
                                uploadLimit = 10;
                                break;
                        }
                    }

                    const attachments: AttachmentBuilder[] = [];
                    const oversizedFiles: string[] = [];

                    for (let i = 0; i < downloadedFiles.length; i++) {
                        const filePath = downloadedFiles[i];
                        try {
                            // Check file size
                            const stats = fs.statSync(filePath);
                            const fileSizeInMB = stats.size / (1024 * 1024);

                            if (fileSizeInMB > uploadLimit) {
                                // Check if it's a video and try compression
                                const isVideo = filePath.toLowerCase().includes('.mp4') || filePath.toLowerCase().includes('.webm');

                                if (isVideo) {
                                    try {
                                        // Create compressed file path
                                        const compressedFileName = `compressed_${path.basename(filePath, path.extname(filePath))}.mp4`;
                                        const compressedFilePath = path.join(tempDir, compressedFileName);

                                        // Attempt compression
                                        const compressionSuccess = await compressVideo(filePath, compressedFilePath, uploadLimit * 0.90);

                                        if (compressionSuccess) {
                                            // Check compressed file size
                                            const compressedStats = fs.statSync(compressedFilePath);
                                            const compressedSizeMB = compressedStats.size / (1024 * 1024);

                                            if (compressedSizeMB <= uploadLimit) {
                                                // Use compressed file
                                                const attachment = new AttachmentBuilder(compressedFilePath, { name: compressedFileName });
                                                attachments.push(attachment);
                                            } else {
                                                oversizedFiles.push(path.basename(filePath));
                                                fs.unlinkSync(compressedFilePath);
                                            }
                                        } else {
                                            oversizedFiles.push(path.basename(filePath));
                                        }
                                    } catch (compressionError) {
                                        console.error(`Error compressing video ${i + 1}:`, compressionError);
                                        oversizedFiles.push(path.basename(filePath));
                                    }
                                } else {
                                    oversizedFiles.push(path.basename(filePath));
                                }
                            } else {
                                // File is within size limits
                                const attachment = new AttachmentBuilder(filePath, { name: path.basename(filePath) });
                                attachments.push(attachment);
                            }
                        } catch (fileError) {
                            console.error(`Error processing file ${filePath}:`, fileError);
                        }
                    }

                    if (attachments.length > 0) {
                        // Post info should already be available from above
                        // (either from instagram-url-direct or yt-dlp)

                        // Split attachments into batches of 10
                        const batches = [];
                        for (let i = 0; i < attachments.length; i += 10) {
                            batches.push(attachments.slice(i, i + 10));
                        }

                        // Build content with post information for first message
                        let content = `📸 **Instagram Post`;

                        // Add author info if available
                        if (postInfo?.uploader) {
                            const verifiedIcon = postInfo.isVerified ? ' ✓' : '';
                            content += ` by @${postInfo.uploader}${verifiedIcon}`;

                            if (postInfo.fullname && postInfo.fullname !== postInfo.uploader) {
                                content += ` (${postInfo.fullname})`;
                            }
                        }

                        content += '**';

                        // Add media count info
                        const totalFiles = downloadedFiles.length;
                        const sentCount = attachments.length;

                        if (totalFiles > 1) {
                            content += ` (${sentCount}/${totalFiles} files downloaded`;
                            if (oversizedFiles.length > 0) {
                                content += `, ${oversizedFiles.length} too large`;
                            }
                            content += ')';
                        }

                        // Add method used for debugging
                        if (usedYtDlp) {
                            content += ' 🎥'; // Video emoji to indicate yt-dlp was used
                        } else {
                            content += ' 📷'; // Camera emoji to indicate instagram-url-direct was used
                        }

                        // Add engagement info if available
                        if (postInfo?.likeCount && postInfo.likeCount > 0) {
                            content += `\n❤️ ${postInfo.likeCount.toLocaleString()} likes`;
                        }

                        if (postInfo?.viewCount && postInfo.viewCount > 0) {
                            content += `\n📹 ${postInfo.viewCount.toLocaleString()} views`;
                        }

                        // Add hashtags if available
                        if (postInfo?.caption) {
                            const hashtags = extractHashtags(postInfo.caption);
                            if (hashtags.length > 0) {
                                // Limit hashtags to prevent overly long messages
                                let displayHashtags = hashtags.slice(0, 10);
                                let hashtagString = displayHashtags.join(' ');

                                // If the hashtag string is too long, reduce the number of hashtags
                                while (hashtagString.length > 200 && displayHashtags.length > 1) {
                                    displayHashtags = displayHashtags.slice(0, -1);
                                    hashtagString = displayHashtags.join(' ');
                                }

                                content += `\n🏷️ ${hashtagString}`;

                                // Add indicator if there are more hashtags
                                if (hashtags.length > displayHashtags.length) {
                                    content += ` (+${hashtags.length - displayHashtags.length} more)`;
                                }
                            }
                        }

                        if (oversizedFiles.length > 0) {
                            let boostInfo = "";
                            if (guild && uploadLimit === 10) {
                                boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                            }
                            content += `\n⚠️ ${oversizedFiles.length} files were too large and couldn't be uploaded.${boostInfo}`;
                        }

                        // Add batch info if there are multiple batches
                        if (batches.length > 1) {
                            content += `\n**Message 1 of ${batches.length}** - Files 1-${batches[0].length}`;
                        }

                        // Send first batch as reply
                        await message.reply({
                            content,
                            files: batches[0]
                        });

                        // Send remaining batches as follow-up messages
                        for (let i = 1; i < batches.length; i++) {
                            const batch = batches[i];
                            const startFileNum = (i * 10) + 1;
                            const endFileNum = startFileNum + batch.length - 1;

                            const followupContent = `📸 **Message ${i + 1} of ${batches.length}** - Files ${startFileNum}-${endFileNum}`;

                            // Send follow-up in the same channel but don't reply to avoid notification spam
                            try {
                                const sendableChannel = message.channel as any;
                                if (sendableChannel.send) {
                                    await sendableChannel.send({
                                        content: followupContent,
                                        files: batch
                                    });
                                }
                            } catch (channelError) {
                                console.error('Error sending follow-up message:', channelError);
                            }

                            // Add a small delay between posts to avoid rate limiting
                            if (i < batches.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    } else {
                        let boostInfo = "";
                        if (guild && uploadLimit === 10) {
                            boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                        }
                        await message.reply(`❌ Instagram media files are too large for this server's upload limit (${uploadLimit}MB).${boostInfo}`);
                    }

                    // Clean up temporary files
                    for (const filePath of downloadedFiles) {
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (cleanupError) {
                            console.error('Error cleaning up file:', cleanupError);
                        }
                    }

                    // Clean up any compressed files
                    for (const attachment of attachments) {
                        try {
                            const attachmentData = attachment.attachment as string;
                            if (typeof attachmentData === 'string' && fs.existsSync(attachmentData)) {
                                fs.unlinkSync(attachmentData);
                            }
                        } catch (cleanupError) {
                            console.error('Error cleaning up compressed file:', cleanupError);
                        }
                    }
                } else {
                    console.log(`No media files downloaded for URL: ${url}`);
                    await message.reply("❌ Unable to download media from Instagram post. The post might be private, unavailable, deleted, or a story (stories are not supported).");
                }
            } catch (error: any) {
                console.error("Error processing Instagram URL:", url, error);

                // Provide more specific error messages based on the error
                let errorMessage = "❌ An error occurred while processing the Instagram post.";

                if (error.message) {
                    if (error.message.includes("Unsupported URL") || error.message.includes("not supported")) {
                        errorMessage = "❌ This Instagram link is not supported. Only regular posts and reels can be downloaded. Stories, IGTV, and some other content types are not supported.";
                    } else if (error.message.includes("private")) {
                        errorMessage = "❌ This Instagram post is from a private account and cannot be downloaded.";
                    } else if (error.message.includes("not found") || error.message.includes("404")) {
                        errorMessage = "❌ Instagram post not found. The post may have been deleted or the link is invalid.";
                    } else if (error.message.includes("rate limit") || error.message.includes("429")) {
                        errorMessage = "❌ Instagram is rate limiting requests. Please try again in a few minutes.";
                    } else if (error.message.includes("network") || error.message.includes("timeout")) {
                        errorMessage = "❌ Network error while accessing Instagram. Please try again later.";
                    }
                }

                await message.reply(errorMessage);
            }
        }

        // Remove the processing reaction
        await message.reactions.removeAll().catch(() => {});

    } catch (error) {
        console.error("Error in Instagram handler:", error);
        await message.reactions.removeAll().catch(() => {});
    }
}
