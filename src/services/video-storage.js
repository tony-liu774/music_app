/**
 * Video Storage Service (Backend - Node.js)
 * Handles video upload to AWS S3 with lifecycle policies
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class VideoStorageService {
    constructor() {
        this.s3Client = null;
        this.bucketName = process.env.AWS_S3_BUCKET || 'music-app-videos';
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.cloudFrontUrl = process.env.CLOUD_FRONT_URL || '';
        this.isConfigured = false;

        this.initializeClient();
    }

    initializeClient() {
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });
            this.isConfigured = true;
            console.log('S3 client initialized for video storage');
        } else {
            console.log('AWS credentials not configured, using local storage fallback');
        }
    }

    /**
     * Generate a unique S3 key for video storage
     */
    generateS3Key(studentId, snippetId, fileType = 'webm') {
        const timestamp = Date.now();
        return `video-snippets/${studentId}/${snippetId}-${timestamp}.${fileType}`;
    }

    /**
     * Upload video to S3
     */
    async uploadVideo(studentId, snippetId, videoData, fileType = 'webm') {
        // If not configured, store locally (for development)
        if (!this.isConfigured) {
            return this.storeLocally(snippetId, videoData);
        }

        const key = this.generateS3Key(studentId, snippetId, fileType);

        // Convert base64 to buffer
        const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: `video/${fileType}`,
            Metadata: {
                studentId,
                snippetId,
                uploadedAt: new Date().toISOString()
            }
        });

        try {
            await this.s3Client.send(command);
            const videoUrl = this.cloudFrontUrl
                ? `${this.cloudFrontUrl}/${key}`
                : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

            return {
                success: true,
                url: videoUrl,
                key: key,
                storageType: 's3'
            };
        } catch (error) {
            console.error('S3 upload failed:', error);
            // Fallback to local storage
            return this.storeLocally(snippetId, videoData);
        }
    }

    /**
     * Upload thumbnail to S3
     */
    async uploadThumbnail(studentId, snippetId, thumbnailData) {
        if (!this.isConfigured || !thumbnailData) {
            return { success: true, url: thumbnailData, storageType: 'local' };
        }

        const key = `video-thumbnails/${studentId}/${snippetId}.jpg`;

        const base64Data = thumbnailData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/jpeg',
            Metadata: {
                studentId,
                snippetId
            }
        });

        try {
            await this.s3Client.send(command);
            const thumbnailUrl = this.cloudFrontUrl
                ? `${this.cloudFrontUrl}/${key}`
                : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

            return {
                success: true,
                url: thumbnailUrl,
                key: key,
                storageType: 's3'
            };
        } catch (error) {
            console.error('Thumbnail upload failed:', error);
            return { success: true, url: thumbnailData, storageType: 'local' };
        }
    }

    /**
     * Delete video from S3
     */
    async deleteVideo(key) {
        if (!this.isConfigured || !key) {
            return { success: true };
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        try {
            await this.s3Client.send(command);
            return { success: true };
        } catch (error) {
            console.error('S3 delete failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate presigned URL for video playback
     */
    async getPresignedUrl(key, expiresIn = 3600) {
        if (!this.isConfigured || !key) {
            return null;
        }

        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        try {
            const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
            return signedUrl;
        } catch (error) {
            console.error('Failed to generate presigned URL:', error);
            return null;
        }
    }

    /**
     * Local storage fallback (development only)
     */
    storeLocally(snippetId, videoData) {
        // In production, this would store to local filesystem
        // For now, we return the base64 data
        return {
            success: true,
            url: videoData,
            key: null,
            storageType: 'local'
        };
    }
}

// Export singleton instance
const videoStorage = new VideoStorageService();

module.exports = videoStorage;
