/**
 * Notification Service - Push notification system for assignments
 * Uses Web Notifications API + Server-Sent Events for real-time updates
 */

class NotificationService {
    constructor() {
        this.eventSource = null;
        this.userId = null;
        this.listeners = [];
        this.permission = 'default';
        this.baseUrl = '';
    }

    /**
     * Initialize the notification service
     * @param {string} userId - Current user's ID
     * @param {string} [baseUrl] - API base URL
     */
    async init(userId, baseUrl = '') {
        this.userId = userId;
        this.baseUrl = baseUrl;

        // Request notification permission
        if (typeof Notification !== 'undefined') {
            this.permission = Notification.permission;
            if (this.permission === 'default') {
                this.permission = await Notification.requestPermission();
            }
        }

        // Connect to SSE stream
        this.connect();

        // Fetch any pending notifications
        await this.fetchPending();
    }

    /**
     * Connect to SSE notification stream
     */
    connect() {
        if (!this.userId) return;

        // Close existing connection
        this.disconnect();

        try {
            this.eventSource = new EventSource(
                `${this.baseUrl}/api/assignments/notifications/stream?userId=${this.userId}`
            );

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'connected') {
                        this.handleNotification(data);
                    }
                } catch (e) {
                    console.error('Failed to parse notification:', e);
                }
            };

            this.eventSource.onerror = () => {
                // Auto-reconnect after 5 seconds
                this.disconnect();
                setTimeout(() => this.connect(), 5000);
            };
        } catch (e) {
            console.error('SSE connection failed:', e);
        }
    }

    /**
     * Disconnect from SSE stream
     */
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    /**
     * Fetch pending notifications from server
     */
    async fetchPending() {
        if (!this.userId) return [];

        try {
            const response = await fetch(
                `${this.baseUrl}/api/assignments/notifications/${this.userId}`
            );
            if (response.ok) {
                const notifications = await response.json();
                notifications.forEach(n => this.handleNotification(n));
                return notifications;
            }
        } catch (e) {
            console.error('Failed to fetch notifications:', e);
        }
        return [];
    }

    /**
     * Handle an incoming notification
     */
    handleNotification(notification) {
        // Show browser notification
        this.showBrowserNotification(notification);

        // Notify all listeners
        this.listeners.forEach(listener => {
            try {
                listener(notification);
            } catch (e) {
                console.error('Notification listener error:', e);
            }
        });
    }

    /**
     * Show a browser push notification
     */
    showBrowserNotification(notification) {
        if (this.permission !== 'granted') return;
        if (typeof Notification === 'undefined') return;

        try {
            const n = new Notification(notification.title || 'New Notification', {
                body: notification.message || '',
                icon: '/public/icons/icon-192.png',
                badge: '/public/icons/badge-72.png',
                tag: notification.assignmentId || 'assignment',
                data: notification
            });

            n.onclick = () => {
                window.focus();
                if (notification.assignmentId) {
                    this.listeners.forEach(listener => {
                        try {
                            listener({
                                type: 'notification_click',
                                assignmentId: notification.assignmentId
                            });
                        } catch (e) {
                            // ignore
                        }
                    });
                }
                n.close();
            };
        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }

    /**
     * Add a notification listener
     * @param {Function} listener - Called with notification data
     * @returns {Function} Unsubscribe function
     */
    onNotification(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Check if notifications are supported and permitted
     */
    isSupported() {
        return typeof Notification !== 'undefined';
    }

    /**
     * Get current permission status
     */
    getPermission() {
        return this.permission;
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        if (typeof Notification === 'undefined') return 'denied';
        this.permission = await Notification.requestPermission();
        return this.permission;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.disconnect();
        this.listeners = [];
        this.userId = null;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.NotificationService = NotificationService;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
}
