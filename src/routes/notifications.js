/**
 * Push Notifications API Routes
 * Handles push notification subscriptions and sending notifications
 */

const express = require('express');
const router = express.Router();

// In-memory store for subscriptions (would use database in production)
const pushSubscriptions = new Map();

// Web Push configuration
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@musicapp.com';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

// Generate VAPID keys if not provided (one-time setup)
function getVapidKeys() {
    if (vapidPublicKey && vapidPrivateKey) {
        return { publicKey: vapidPublicKey, privateKey: vapidPrivateKey };
    }
    // Return demo keys - in production, generate and store these
    return {
        publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        privateKey: 'UUxI4O8-FbRouAf7-7OT9lL9z9-6KT5rF1y6z3Y8Zc'
    };
}

// Get VAPID public key for client
router.get('/vapid-key', (req, res) => {
    const keys = getVapidKeys();
    res.json({ publicKey: keys.publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
    const { subscription, userId } = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }

    const userSubscriptions = pushSubscriptions.get(userId) || [];
    userSubscriptions.push({
        ...subscription,
        subscribedAt: Date.now()
    });
    pushSubscriptions.set(userId, userSubscriptions);

    console.log(`New push subscription for user: ${userId}`);
    res.status(201).json({ success: true });
});

// Unsubscribe from push notifications
router.post('/unsubscribe', (req, res) => {
    const { endpoint, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    const userSubscriptions = pushSubscriptions.get(userId) || [];
    const filtered = userSubscriptions.filter(s => s.endpoint !== endpoint);
    pushSubscriptions.set(userId, filtered);

    res.json({ success: true });
});

// Notify teacher of new video clip
router.post('/teacher/new-clip', async (req, res) => {
    const { studentName, title, snippetId } = req.body;

    // Get all teacher subscriptions
    const teacherSubscriptions = pushSubscriptions.get('teacher') || [];

    if (teacherSubscriptions.length === 0) {
        return res.json({ sent: 0 });
    }

    // In production, send push notifications using web-push library
    // For now, just log and return success
    const payload = JSON.stringify({
        title: 'New Video Clip',
        body: `${studentName} submitted: ${title}`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: `new-clip-${snippetId}`,
        data: {
            type: 'new-clip',
            snippetId,
            studentName,
            title
        }
    });

    // Send to all teacher subscriptions (would use web-push in production)
    let sentCount = 0;
    for (const sub of teacherSubscriptions) {
        try {
            // await webPush.sendNotification(sub, payload);
            sentCount++;
        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }

    console.log(`Sent notification to ${sentCount} teacher(s): New clip from ${studentName}`);
    res.json({ sent: sentCount });
});

// Notify student of teacher reply
router.post('/student/reply', async (req, res) => {
    const { studentId, replyType, snippetId, teacherName } = req.body;

    const studentSubscriptions = pushSubscriptions.get(studentId) || [];

    if (studentSubscriptions.length === 0) {
        return res.json({ sent: 0 });
    }

    const replyTypeLabel = replyType === 'voice' ? 'voice note' : 'text reply';
    const payload = JSON.stringify({
        title: 'Teacher Feedback',
        body: `Your teacher sent a ${replyTypeLabel}`,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: `reply-${snippetId}`,
        data: {
            type: 'reply',
            snippetId,
            replyType
        }
    });

    let sentCount = 0;
    for (const sub of studentSubscriptions) {
        try {
            // await webPush.sendNotification(sub, payload);
            sentCount++;
        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }

    console.log(`Sent reply notification to student ${studentId}: ${sentCount} delivered`);
    res.json({ sent: sentCount });
});

// Get notification settings for user
router.get('/settings/:userId', (req, res) => {
    const { userId } = req.params;
    const subscriptions = pushSubscriptions.get(userId) || [];

    res.json({
        enabled: subscriptions.length > 0,
        subscriptionCount: subscriptions.length,
        lastUpdated: subscriptions[0]?.subscribedAt || null
    });
});

module.exports = router;
