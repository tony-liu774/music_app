/**
 * Video Trimmer Service (Backend)
 * Handles video trimming using FFmpeg
 * In production, this would be handled by a video processing service
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class VideoTrimmerService {
    constructor() {
        this.hasFFmpeg = null;
        this.tempDir = os.tmpdir();
    }

    /**
     * Check if FFmpeg is available
     */
    async checkFFmpeg() {
        if (this.hasFFmpeg !== null) {
            return this.hasFFmpeg;
        }

        return new Promise((resolve) => {
            exec('which ffmpeg', (error) => {
                this.hasFFmpeg = !error;
                resolve(this.hasFFmpeg);
            });
        });
    }

    /**
     * Trim video using FFmpeg
     * @param {string} inputPath - Path to input video (base64 or file path)
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @returns {Promise<{success: boolean, data?: string, error?: string}>}
     */
    async trimVideo(inputPath, startTime, endTime) {
        // If FFmpeg not available, return original video with trim metadata
        const hasFFmpeg = await this.checkFFmpeg();
        if (!hasFFmpeg) {
            console.log('FFmpeg not available, storing trim metadata only');
            return {
                success: true,
                data: inputPath,
                trimmed: false,
                message: 'Video trim metadata stored; actual trimming requires FFmpeg'
            };
        }

        const duration = endTime - startTime;
        const inputFile = path.join(this.tempDir, `input_${Date.now()}.webm`);
        const outputFile = path.join(this.tempDir, `output_${Date.now()}.webm`);

        try {
            // Write input video to temp file
            const base64Data = inputPath.replace(/^data:video\/\w+;base64,/, '');
            fs.writeFileSync(inputFile, Buffer.from(base64Data, 'base64'));

            // Run FFmpeg trim command
            await this.runFFmpegCommand(
                `-i ${inputFile} -ss ${startTime} -t ${duration} -c copy ${outputFile}`
            );

            // Read trimmed video
            const trimmedData = fs.readFileSync(outputFile);
            const base64Trimmed = `data:video/webm;base64,${trimmedData.toString('base64')}`;

            // Cleanup temp files
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);

            return {
                success: true,
                data: base64Trimmed,
                trimmed: true,
                trimStart: startTime,
                trimEnd: endTime
            };
        } catch (error) {
            console.error('Video trimming failed:', error);
            return {
                success: false,
                data: inputPath,
                trimmed: false,
                error: error.message
            };
        }
    }

    /**
     * Run FFmpeg command
     */
    runFFmpegCommand(args) {
        return new Promise((resolve, reject) => {
            exec(`ffmpeg -y ${args}`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /**
     * Generate trimmed video blob for frontend playback
     * Returns video URL with proper trim parameters for playback
     */
    getTrimmedVideoUrl(videoData, trimStart, trimEnd) {
        // For base64 data, we'll use the trim metadata for playback
        // The actual video processing happens server-side
        return {
            url: videoData,
            trimStart: trimStart || 0,
            trimEnd: trimEnd || 0,
            note: 'Use video.currentTime and video.end() for playback trimming'
        };
    }
}

const videoTrimmer = new VideoTrimmerService();

module.exports = videoTrimmer;
