/**
 * Scheduler Service
 * Handles scheduled jobs like auto-deleting expired video snippets
 */

const cron = require('node-cron');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('Scheduler already running');
            return;
        }

        console.log('Starting scheduler service...');
        this.isRunning = true;

        // Schedule cleanup job to run every hour
        this.scheduleJob('video-cleanup', '0 * * * *', async () => {
            await this.cleanupExpiredSnippets();
        });

        // Schedule daily health check at midnight
        this.scheduleJob('daily-health', '0 0 * * *', async () => {
            await this.dailyHealthCheck();
        });

        console.log('Scheduler started successfully');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        console.log('Stopping scheduler...');

        for (const [name, job] of this.jobs.entries()) {
            job.stop();
            console.log(`Stopped job: ${name}`);
        }

        this.jobs.clear();
        this.isRunning = false;
        console.log('Scheduler stopped');
    }

    /**
     * Schedule a recurring job
     */
    scheduleJob(name, cronExpression, callback) {
        if (this.jobs.has(name)) {
            console.log(`Job ${name} already scheduled`);
            return;
        }

        if (!cron.validate(cronExpression)) {
            console.error(`Invalid cron expression for job ${name}: ${cronExpression}`);
            return;
        }

        const job = cron.schedule(cronExpression, async () => {
            console.log(`Running scheduled job: ${name}`);
            try {
                await callback();
            } catch (error) {
                console.error(`Error in scheduled job ${name}:`, error);
            }
        });

        this.jobs.set(name, job);
        console.log(`Scheduled job: ${name} (${cronExpression})`);
    }

    /**
     * Run a job immediately
     */
    async runJob(name, callback) {
        console.log(`Running job immediately: ${name}`);
        try {
            await callback();
        } catch (error) {
            console.error(`Error running job ${name}:`, error);
        }
    }

    /**
     * Clean up expired video snippets
     */
    async cleanupExpiredSnippets() {
        console.log('Running expired snippet cleanup...');

        // Access videoSnippets from teacher routes module
        const teacherRoutes = require('../routes/teacher');
        const videoSnippets = teacherRoutes.videoSnippets;

        if (!videoSnippets) {
            console.log('Video snippets storage not available');
            return;
        }

        const now = Date.now();
        let deletedCount = 0;
        const expiredIds = [];

        for (const [id, snippet] of videoSnippets.entries()) {
            if (snippet.expiresAt && snippet.expiresAt < now) {
                // Delete associated video from storage
                if (snippet.videoKey) {
                    try {
                        const storageService = require('./video-storage');
                        if (storageService && storageService.deleteVideo) {
                            await storageService.deleteVideo(snippet.videoKey);
                        }
                    } catch (error) {
                        console.error(`Failed to delete video for snippet ${id}:`, error);
                    }
                }

                // Delete associated thumbnail from storage
                if (snippet.thumbnailKey) {
                    try {
                        const storageService = require('./video-storage');
                        if (storageService && storageService.deleteVideo) {
                            await storageService.deleteVideo(snippet.thumbnailKey);
                        }
                    } catch (error) {
                        console.error(`Failed to delete thumbnail for snippet ${id}:`, error);
                    }
                }

                videoSnippets.delete(id);
                deletedCount++;
                expiredIds.push(id);
            }
        }

        console.log(`Cleanup complete: deleted ${deletedCount} expired snippets`);
        return { deletedCount, remaining: videoSnippets.size };
    }

    /**
     * Daily health check
     */
    async dailyHealthCheck() {
        console.log('Running daily health check...');

        // Check storage usage
        // Check database connections
        // Send health metrics
        // etc.

        console.log('Daily health check complete');
        return { status: 'healthy', timestamp: Date.now() };
    }

    /**
     * Get job status
     */
    getStatus() {
        const jobStatus = {};
        for (const [name, job] of this.jobs.entries()) {
            jobStatus[name] = job ? 'active' : 'stopped';
        }

        return {
            running: this.isRunning,
            jobs: jobStatus
        };
    }
}

// Export singleton
const schedulerService = new SchedulerService();

// Auto-start if running in production
if (process.env.NODE_ENV === 'production') {
    schedulerService.start();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    schedulerService.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    schedulerService.stop();
    process.exit(0);
});

module.exports = schedulerService;
