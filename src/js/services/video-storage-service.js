/**
 * Video Storage Service (Frontend - Browser)
 * Handles video upload to cloud storage (AWS S3) with presigned URLs
 */

class VideoStorageService {
    constructor() {
        this.apiBaseUrl = '/api/teacher';
        this.isConfigured = false;
    }

    /**
     * Get presigned upload URL from server
     */
    async getPresignedUploadUrl(studentId, snippetId, fileType = 'webm') {
        try {
            const response = await fetch(`${this.apiBaseUrl}/snippets/upload-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId,
                    snippetId,
                    fileType
                })
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to get presigned URL:', error);
            return null;
        }
    }

    /**
     * Upload video to S3 using presigned URL
     */
    async uploadToS3(presignedUrl, videoBlob, contentType) {
        try {
            const response = await fetch(presignedUrl, {
                method: 'PUT',
                body: videoBlob,
                headers: {
                    'Content-Type': contentType
                }
            });

            return response.ok;
        } catch (error) {
            console.error('S3 upload failed:', error);
            return false;
        }
    }

    /**
     * Upload video - tries S3, falls back to base64
     */
    async uploadVideo(studentId, snippetId, videoData) {
        // Convert base64 to blob
        const blob = this.base64ToBlob(videoData, 'video/webm');

        // Try to get presigned URL and upload to S3
        const presignedData = await this.getPresignedUploadUrl(studentId, snippetId, 'webm');

        if (presignedData && presignedData.uploadUrl) {
            const success = await this.uploadToS3(presignedData.uploadUrl, blob, 'video/webm');
            if (success) {
                return {
                    success: true,
                    url: presignedData.publicUrl,
                    storageType: 's3'
                };
            }
        }

        // Fallback to local storage (base64)
        return {
            success: true,
            url: videoData,
            storageType: 'local'
        };
    }

    /**
     * Upload thumbnail
     */
    async uploadThumbnail(studentId, snippetId, thumbnailData) {
        if (!thumbnailData) {
            return { success: true, url: null, storageType: 'local' };
        }

        // For thumbnails, we can just store as base64 for now
        return {
            success: true,
            url: thumbnailData,
            storageType: 'local'
        };
    }

    /**
     * Validate video size before upload
     */
    validateVideoSize(videoData, maxSizeMB = 10) {
        if (!videoData) return { valid: false, error: 'No video data' };

        // Estimate size from base64
        const base64Length = videoData.length;
        const sizeInBytes = (base64Length * 3) / 4;
        const sizeInMB = sizeInBytes / (1024 * 1024);

        return {
            valid: sizeInMB <= maxSizeMB,
            sizeInMB: sizeInMB.toFixed(2),
            maxSizeMB
        };
    }

    /**
     * Convert base64 to Blob
     */
    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Convert Blob to base64
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

// Export singleton
window.videoStorageService = new VideoStorageService();
