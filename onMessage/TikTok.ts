import { Client, Message, AttachmentBuilder } from "discord.js";
// @ts-ignore - Package installed from GitHub without types
import tikTokApi from "@tobyg74/tiktok-api-dl";
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

        // Calculate target bitrate (leaving some headroom)
        // Target bitrate = (target size in MB * 8 * 1024) / duration in seconds * 0.9 (safety margin)

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

        console.log(`🎬 Compressing video: ${inputSizeMB.toFixed(2)}MB → ${targetSizeMB}MB (target bitrate: ${finalBitrate}kbps)`);

        // Compress the video with aggressive settings
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 28 -b:v ${finalBitrate}k -maxrate ${finalBitrate * 1.2}k -bufsize ${finalBitrate * 2}k -c:a aac -b:a 64k -movflags +faststart -y "${outputPath}"`;

        execSync(ffmpegCmd, { stdio: 'ignore' });

        // Check if compression was successful
        if (fs.existsSync(outputPath)) {
            const outputStats = fs.statSync(outputPath);
            const outputSizeMB = outputStats.size / (1024 * 1024);
            console.log(`✅ Compression successful: ${outputSizeMB.toFixed(2)}MB`);
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

export default async function TikTok(client: Client, message: Message) {
    // Check if the message contains a TikTok URL (both standard and shortened formats)
    const tiktokRegex = /https?:\/\/(?:(?:www\.)?tiktok\.com\/@[\w\.-]+\/video\/\d+(?:\?[^\s]*)?|vm\.tiktok\.com\/[\w\.-]+)/gi;
    const matches = message.content.match(tiktokRegex);

    if (!matches) {
        return;
    }

    // Check if any TikTok URLs are not wrapped in < > (which suppresses embeds)
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
                console.log("⚠️  Bot needs 'Manage Messages' permission to suppress TikTok embeds. Please update bot permissions.");
                // Optionally, you could send a one-time message about this to the channel
                // await message.channel.send("ℹ️ I need the 'Manage Messages' permission to suppress TikTok embeds. Please ask an admin to update my permissions.");
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
                // Download TikTok video info using the Downloader method
                const result = await tikTokApi.Downloader(url, { version: "v2" });

                if (result.status === "success" && result.result) {
                    const videoData = result.result;
                    const videoUrl = videoData.video?.playAddr?.[0] || videoData.direct; // Try different video quality options

                    if (videoUrl) {
                        // Create a temporary filename
                        const tempDir = path.join(process.cwd(), 'temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }

                        const fileName = `tiktok_${Date.now()}.mp4`;
                        const filePath = path.join(tempDir, fileName);

                        // Download the video
                        await downloadVideo(videoUrl, filePath);

                        // Check file size based on server boost level
                        const stats = fs.statSync(filePath);
                        const fileSizeInMB = stats.size / (1024 * 1024);

                        // Determine upload limit based on server boost level
                        let uploadLimit = 10; // Default Discord upload limit (raised from 8MB)
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
                            console.log(`📊 Server "${guild.name}" boost level: ${guild.premiumTier}, upload limit: ${uploadLimit}MB`);
                        }

                        if (fileSizeInMB > uploadLimit) {
                            console.log(`📹 Video size (${fileSizeInMB.toFixed(2)}MB) exceeds limit (${uploadLimit}MB), attempting compression...`);

                            try {
                                // Create compressed file path
                                const compressedFileName = `tiktok_compressed_${Date.now()}.mp4`;
                                const compressedFilePath = path.join(tempDir, compressedFileName);

                                // Attempt compression
                                const compressionSuccess = await compressVideo(filePath, compressedFilePath, uploadLimit * 0.90); // Target 90% of limit for safety

                                if (compressionSuccess) {
                                    // Check compressed file size
                                    const compressedStats = fs.statSync(compressedFilePath);
                                    const compressedSizeMB = compressedStats.size / (1024 * 1024);

                                    if (compressedSizeMB <= uploadLimit) {
                                        // Use compressed file
                                        const attachment = new AttachmentBuilder(compressedFilePath, { name: compressedFileName });

                                        const description = videoData.desc || "TikTok Video";
                                        const author = videoData.author?.nickname || "Unknown";

                                        await message.reply({
                                            content: `🎵 **TikTok Video by ${author}** *(compressed from ${fileSizeInMB.toFixed(1)}MB to ${compressedSizeMB.toFixed(1)}MB)*\n${description.length > 100 ? description.substring(0, 100) + '...' : description}`,
                                            files: [attachment]
                                        });

                                        // Clean up both files
                                        fs.unlinkSync(filePath);
                                        fs.unlinkSync(compressedFilePath);
                                    } else {
                                        // Even compressed file is too large
                                        let boostInfo = "";
                                        if (guild && uploadLimit === 10) {
                                            boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                                        }
                                        await message.reply(`❌ TikTok video is too large even after compression (${compressedSizeMB.toFixed(2)}MB). This server's upload limit is ${uploadLimit}MB.${boostInfo}`);

                                        // Clean up files
                                        fs.unlinkSync(filePath);
                                        fs.unlinkSync(compressedFilePath);
                                    }
                                } else {
                                    // Compression failed
                                    let boostInfo = "";
                                    if (guild && uploadLimit === 10) {
                                        boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                                    }
                                    await message.reply(`❌ TikTok video is too large (${fileSizeInMB.toFixed(2)}MB) and compression failed. This server's upload limit is ${uploadLimit}MB.${boostInfo}`);

                                    // Clean up original file
                                    fs.unlinkSync(filePath);
                                }
                            } catch (compressionError) {
                                console.error('Error during compression:', compressionError);
                                let boostInfo = "";
                                if (guild && uploadLimit === 10) {
                                    boostInfo = "\n💡 *Server boosts increase upload limits: Level 2 = 50MB, Level 3 = 100MB*";
                                }
                                await message.reply(`❌ TikTok video is too large (${fileSizeInMB.toFixed(2)}MB) and compression failed. This server's upload limit is ${uploadLimit}MB.${boostInfo}`);

                                // Clean up original file
                                fs.unlinkSync(filePath);
                            }
                        } else {
                            // File is within size limits, send normally
                            const attachment = new AttachmentBuilder(filePath, { name: fileName });

                            // Create embed with video info
                            const description = videoData.desc || "TikTok Video";
                            const author = videoData.author?.nickname || "Unknown";

                            await message.reply({
                                content: `🎵 **TikTok Video by ${author}**\n${description.length > 100 ? description.substring(0, 100) + '...' : description}`,
                                files: [attachment]
                            });

                            // Clean up the temporary file
                            fs.unlinkSync(filePath);
                        }
                    } else {
                        await message.reply("❌ Unable to extract video URL from TikTok link.");
                    }
                } else {
                    await message.reply("❌ Failed to fetch TikTok video. The video might be private or unavailable.");
                }
            } catch (error) {
                console.error("Error processing TikTok URL:", url, error);
                await message.reply("❌ An error occurred while processing the TikTok video.");
            }
        }

        // Remove the processing reaction
        await message.reactions.removeAll().catch(() => {});

    } catch (error) {
        console.error("Error in TikTok handler:", error);
        await message.reactions.removeAll().catch(() => {});
    }
}

// Helper function to download video
function downloadVideo(url: string, filePath: string): Promise<void> {
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
