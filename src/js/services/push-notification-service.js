/**
 * Push Notification Service
 * Handles push notifications for new video clips and teacher replies
 */

class PushNotificationService {
    constructor() {
        this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
        this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
        this.subscriptionEndpoint = '/api/notifications/subscribe';
        this.isSupported = typeof window !== 'undefined' && 'PushManager' in window;
        this.currentSubscription = null;
    }

    /**
     * Check if push notifications are supported
     */
    isPushSupported() {
        if (typeof window === 'undefined') return false;
        return 'PushManager' in window && 'serviceWorker' in navigator;
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        if (!this.isPushSupported()) {
            console.log('Push notifications not supported');
            return null;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            return false;
        }
    }

    /**
     * Subscribe to push notifications
     */
    async subscribe() {
        if (!this.isPushSupported()) {
            console.log('Cannot subscribe: push not supported');
            return null;
        }

        try {
            // Check current permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission not granted');
                return null;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });

            // Send subscription to server
            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            if (response.ok) {
                this.currentSubscription = subscription;
                console.log('Push subscription successful');
                return subscription;
            } else {
                console.error('Failed to save subscription on server');
                return null;
            }
        } catch (error) {
            console.error('Push subscription error:', error);
            return null;
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe() {
        if (!this.currentSubscription) {
            return true;
        }

        try {
            await this.currentSubscription.unsubscribe();

            // Notify server
            const endpoint = this.currentSubscription.endpoint;
            await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint })
            });

            this.currentSubscription = null;
            return true;
        } catch (error) {
            console.error('Unsubscribe error:', error);
            return false;
        }
    }

    /**
     * Show local notification (fallback when service worker not available)
     */
    showNotification(title, options = {}) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return;
        }

        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                icon: '/icon-192.png',
                badge: '/badge-72.png',
                vibrate: [200, 100, 200],
                ...options
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                if (options.onclick) options.onclick();
            };

            return notification;
        }
    }

    /**
     * Notify teacher of new video submission
     */
    async notifyTeacherNewClip(studentName, snippetTitle) {
        try {
            const response = await fetch('/api/notifications/teacher/new-clip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentName,
                    title: snippetTitle,
                    timestamp: Date.now()
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to notify teacher:', error);
            return false;
        }
    }

    /**
     * Notify student of teacher reply
     */
    async notifyStudentReply(studentId, replyType) {
        try {
            const response = await fetch('/api/notifications/student/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId,
                    replyType,
                    timestamp: Date.now()
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to notify student:', error);
            return false;
        }
    }

    /**
     * Test notification
     */
    async testNotification() {
        const granted = await this.requestPermission();
        if (granted) {
            this.showNotification('Test Notification', {
                body: 'Push notifications are working!',
                tag: 'test'
            });
            return true;
        }
        return false;
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }
}

// Export singleton
window.pushNotificationService = new PushNotificationService();

// Also export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PushNotificationService;
}
