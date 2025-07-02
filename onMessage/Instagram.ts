import { Client, Message, AttachmentBuilder } from "discord.js";
import { instagramGetUrl } from "instagram-url-direct";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { execSync } from "child_process";

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

export default async function Instagram(client: Client, message: Message) {
    // Check if the message contains an Instagram URL
    const instagramRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|stories)\/[\w\-]+\/?(?:\?[^\s]*)?/gi;
    const matches = message.content.match(instagramRegex);

    if (!matches) {
        return;
    }

    // Check for story URLs and provide helpful message
    const storyMatches = matches.filter(url => url.includes('/stories/'));
    if (storyMatches.length > 0) {
        await message.reply("❌ Instagram Stories are not supported. Only regular posts and reels can be downloaded.");
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
                // Get Instagram media info and download URLs
                const result = await instagramGetUrl(url);

                if (result && result.url_list && result.url_list.length > 0) {
                    // Check if the account is private
                    if (result.post_info && result.post_info.is_private) {
                        await message.reply("❌ This Instagram post is from a private account and cannot be downloaded.");
                        continue;
                    }
                    // Create a temporary directory
                    const tempDir = path.join(process.cwd(), 'temp');
                    if (!fs.existsSync(tempDir)) {
                        fs.mkdirSync(tempDir, { recursive: true });
                    }

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
                    // Limit to reasonable number to avoid overwhelming Discord (max 50 files = 5 messages)
                    const mediaItems = result.url_list.slice(0, 50);

                    for (let i = 0; i < mediaItems.length; i++) {
                        const mediaUrl = mediaItems[i];
                        try {
                            // Determine file extension from media details or URL
                            const mediaDetail = result.media_details && result.media_details[i];
                            const isVideo = mediaDetail ? mediaDetail.type === 'video' : mediaUrl.includes('.mp4') || mediaUrl.includes('video');
                            const extension = isVideo ? 'mp4' : 'jpg';
                            const fileName = `instagram_${Date.now()}_${i + 1}.${extension}`;
                            const filePath = path.join(tempDir, fileName);

                            // Download the media
                            await downloadMedia(mediaUrl, filePath);

                            // Check file size
                            const stats = fs.statSync(filePath);
                            const fileSizeInMB = stats.size / (1024 * 1024);

                            if (fileSizeInMB > uploadLimit) {
                                if (isVideo) {
                                    try {
                                        // Create compressed file path
                                        const compressedFileName = `instagram_compressed_${Date.now()}_${i + 1}.mp4`;
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

                                                // Clean up original file, keep compressed for now
                                                fs.unlinkSync(filePath);
                                            } else {
                                                // Clean up both files
                                                fs.unlinkSync(filePath);
                                                fs.unlinkSync(compressedFilePath);
                                            }
                                        } else {
                                            // Clean up original file
                                            fs.unlinkSync(filePath);
                                        }
                                    } catch (compressionError) {
                                        console.error(`Error compressing video ${i + 1}:`, compressionError);
                                        fs.unlinkSync(filePath);
                                    }
                                } else {
                                    fs.unlinkSync(filePath);
                                }
                            } else {
                                // File is within size limits
                                const attachment = new AttachmentBuilder(filePath, { name: fileName });
                                attachments.push(attachment);
                            }
                        } catch (downloadError) {
                            console.error(`Error downloading media ${i + 1}:`, downloadError);
                        }
                    }

                    if (attachments.length > 0) {
                        // Send the media with post info in batches
                        const mediaCount = result.url_list.length;
                        const sentCount = attachments.length;

                        // Split attachments into batches of 10
                        const batches = [];
                        for (let i = 0; i < attachments.length; i += 10) {
                            batches.push(attachments.slice(i, i + 10));
                        }

                        // Build content with post information for first message
                        let content = `📸 **Instagram Post`;

                        // Add author info if available
                        if (result.post_info && result.post_info.owner_username) {
                            const verifiedIcon = result.post_info.is_verified ? ' ✓' : '';
                            content += ` by @${result.post_info.owner_username}${verifiedIcon}`;

                            if (result.post_info.owner_fullname && result.post_info.owner_fullname !== result.post_info.owner_username) {
                                content += ` (${result.post_info.owner_fullname})`;
                            }
                        }

                        content += '**';

                        // Add media count info
                        if (mediaCount > 1) {
                            content += ` (${sentCount}/${Math.min(mediaCount, 50)} files downloaded`;
                            if (mediaCount > 50) {
                                content += `, limited from ${mediaCount}`;
                            }
                            content += ')';
                        }

                        // Add engagement info if available
                        if (result.post_info && result.post_info.likes) {
                            content += `\n❤️ ${result.post_info.likes.toLocaleString()} likes`;
                        }

                        // Add video view count if available and it's a video post
                        if (result.media_details && result.media_details.length > 0) {
                            const videoDetails = result.media_details.find(detail => detail.type === 'video' && detail.video_view_count);
                            if (videoDetails && videoDetails.video_view_count) {
                                content += `\n📹 ${videoDetails.video_view_count.toLocaleString()} views`;
                            }
                        }

                        if (sentCount < mediaCount) {
                            let boostInfo = "";
                            if (guild && uploadLimit === 10) {
                                boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                            }
                            content += `\n⚠️ Some files were too large and couldn't be uploaded.${boostInfo}`;
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
                                // Type assertion to handle the Discord.js typing issue
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

                        // Clean up temporary files
                        for (const attachment of attachments) {
                            try {
                                const attachmentData = attachment.attachment as string;
                                if (typeof attachmentData === 'string' && fs.existsSync(attachmentData)) {
                                    fs.unlinkSync(attachmentData);
                                }
                            } catch (cleanupError) {
                                console.error('Error cleaning up file:', cleanupError);
                            }
                        }
                    } else {
                        let boostInfo = "";
                        if (guild && uploadLimit === 10) {
                            boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                        }
                        await message.reply(`❌ Instagram media files are too large for this server's upload limit (${uploadLimit}MB).${boostInfo}`);
                    }
                } else {
                    await message.reply("❌ Unable to extract media from Instagram post. The post might be private, unavailable, or a story (stories are not supported).");
                }
            } catch (error) {
                console.error("Error processing Instagram URL:", url, error);
                await message.reply("❌ An error occurred while processing the Instagram post.");
            }
        }

        // Remove the processing reaction
        await message.reactions.removeAll().catch(() => {});

    } catch (error) {
        console.error("Error in Instagram handler:", error);
        await message.reactions.removeAll().catch(() => {});
    }
}

// Helper function to download media
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
