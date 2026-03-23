/**
 * Video Snippet Service
 * Handles recording, uploading, and managing 15-second video snippets
 * for the "Office Hours Drop" feature
 */

class VideoSnippetService {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.chunks = [];
        this.maxDuration = 15; // 15 seconds max
        this.timerInterval = null;
        this.onTimeUpdate = null;
        this.onRecordingComplete = null;
        this.onError = null;
    }

    /**
     * Check if getUserMedia is supported
     */
    isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Request camera and microphone permissions
     */
    async requestPermissions() {
        if (!this.isSupported()) {
            throw new Error('Video recording not supported in this browser');
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true
            });
            return true;
        } catch (error) {
            console.error('Permission denied:', error);
            throw new Error('Camera/microphone permission denied');
        }
    }

    /**
     * Get the video stream for preview
     */
    getStream() {
        return this.stream;
    }

    /**
     * Start recording a video snippet
     */
    startRecording(videoElement) {
        if (!this.stream) {
            throw new Error('Stream not initialized. Call requestPermissions first.');
        }

        this.chunks = [];

        // Create MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.chunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => this.handleRecordingComplete();
        this.mediaRecorder.onerror = (event) => {
            if (this.onError) {
                this.onError(event.error);
            }
        };

        // Connect stream to video element for preview
        if (videoElement) {
            videoElement.srcObject = this.stream;
            videoElement.play();
        }

        // Start recording
        this.mediaRecorder.start(100); // Collect data every 100ms

        // Start timer
        let elapsed = 0;
        this.timerInterval = setInterval(() => {
            elapsed++;
            if (this.onTimeUpdate) {
                this.onTimeUpdate(elapsed, this.maxDuration);
            }
            if (elapsed >= this.maxDuration) {
                this.stopRecording();
            }
        }, 1000);
    }

    /**
     * Stop the current recording
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Handle recording completion
     */
    async handleRecordingComplete() {
        const blob = new Blob(this.chunks, { type: 'video/webm' });

        // Convert to base64 for storage/transmission
        const base64 = await this.blobToBase64(blob);

        // Generate thumbnail
        const thumbnail = await this.generateThumbnail(blob);

        if (this.onRecordingComplete) {
            this.onRecordingComplete({
                videoData: base64,
                thumbnail: thumbnail,
                duration: this.chunks.length > 0 ? Math.min(this.chunks.length, this.maxDuration) : this.maxDuration
            });
        }
    }

    /**
     * Convert Blob to Base64
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Generate a thumbnail from video blob
     */
    async generateThumbnail(videoBlob) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            video.src = URL.createObjectURL(videoBlob);
            video.currentTime = 0.5; // Get frame at 0.5 seconds

            video.onloadeddata = () => {
                canvas.width = 160;
                canvas.height = 90;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(video.src);

                const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                resolve(thumbnail);
            };

            video.onerror = () => {
                resolve(null);
            };
        });
    }

    /**
     * Trim video to specified start/end times
     */
    async trimVideo(videoData, startTime, endTime) {
        // This is a simplified trim - in production, you'd use a proper video editing library
        // For now, we'll just record the trim times and apply them during playback
        return {
            originalData: videoData,
            trimStart: startTime,
            trimEnd: endTime
        };
    }

    /**
     * Stop and release all resources
     */
    stopPreview() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Get JWT token from localStorage
     */
    getAuthHeader() {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    /**
     * Submit a video snippet to the teacher
     */
    async submitSnippet(snippetData) {
        const response = await fetch('/api/teacher/snippets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeader()
            },
            body: JSON.stringify(snippetData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit snippet');
        }

        return response.json();
    }

    /**
     * Get snippets for a student
     */
    async getSnippets(studentId) {
        const response = await fetch(`/api/teacher/snippets/${studentId}`, {
            headers: {
                ...this.getAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch snippets');
        }

        return response.json();
    }

    /**
     * Get all snippets (teacher view)
     */
    async getAllSnippets() {
        const response = await fetch('/api/teacher/snippets', {
            headers: {
                ...this.getAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch snippets');
        }

        return response.json();
    }

    /**
     * Submit teacher reply
     */
    async submitReply(snippetId, replyText, replyVoiceData, replyType) {
        const response = await fetch(`/api/teacher/snippets/${snippetId}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeader()
            },
            body: JSON.stringify({
                replyText,
                replyVoiceData,
                replyType
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit reply');
        }

        return response.json();
    }

    /**
     * Delete a snippet
     */
    async deleteSnippet(snippetId) {
        const response = await fetch(`/api/teacher/snippets/${snippetId}`, {
            method: 'DELETE',
            headers: {
                ...this.getAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete snippet');
        }

        return true;
    }

    /**
     * Clean up expired snippets
     */
    async cleanupExpiredSnippets() {
        const response = await fetch('/api/teacher/snippets/cleanup', {
            method: 'POST',
            headers: {
                ...this.getAuthHeader()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to cleanup snippets');
        }

        return response.json();
    }

    /**
     * Check if snippets are expired
     */
    isExpired(snippet) {
        return snippet.expiresAt && snippet.expiresAt < Date.now();
    }

    /**
     * Get days until expiration
     */
    getDaysUntilExpiration(snippet) {
        if (!snippet.expiresAt) return null;
        const msRemaining = snippet.expiresAt - Date.now();
        return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    }
}

// Export singleton instance
window.videoSnippetService = new VideoSnippetService();
