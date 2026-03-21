const express = require('express');
const router = express.Router();

// In-memory store for assignments (production would use a real database)
const assignments = new Map();
const relationships = new Map();
const notifications = new Map();

// SSE clients for real-time notifications
const sseClients = new Map();

/**
 * POST /api/assignments
 * Create a new assignment
 */
router.post('/', (req, res) => {
    const { teacherId, studentId, scoreId, title, measures, target, dueDate, notes } = req.body;

    if (!teacherId || !studentId || !scoreId) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'teacherId, studentId, and scoreId are required'
        });
    }

    const id = generateId();
    const assignment = {
        id,
        teacherId,
        studentId,
        scoreId,
        title: title || 'Practice Assignment',
        measures: measures || { start: 1, end: null },
        target: {
            bpm: target?.bpm || 80,
            intonationThreshold: target?.intonationThreshold || 90
        },
        dueDate: dueDate || null,
        notes: notes || '',
        status: 'pending',
        progress: {
            currentBpm: 0,
            currentIntonation: 0,
            practiceCount: 0,
            totalPracticeMinutes: 0,
            lastPracticed: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
    };

    assignments.set(id, assignment);

    // Send notification to student
    sendNotification(studentId, {
        type: 'new_assignment',
        assignmentId: id,
        title: `New Assignment: ${assignment.title}`,
        message: `Your teacher assigned "${assignment.title}". ${dueDate ? `Due: ${new Date(dueDate).toLocaleDateString()}` : ''}`,
        timestamp: new Date().toISOString()
    });

    res.status(201).json(assignment);
});

/**
 * GET /api/assignments
 * Get assignments (filtered by query params)
 */
router.get('/', (req, res) => {
    const { studentId, teacherId, status } = req.query;
    let results = Array.from(assignments.values());

    if (studentId) {
        results = results.filter(a => a.studentId === studentId);
    }
    if (teacherId) {
        results = results.filter(a => a.teacherId === teacherId);
    }
    if (status) {
        results = results.filter(a => a.status === status);
    }

    // Sort: pending/in_progress first, then by due date
    results.sort((a, b) => {
        const order = { pending: 0, in_progress: 1, completed: 2 };
        if (a.status !== b.status) {
            return (order[a.status] || 3) - (order[b.status] || 3);
        }
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(results);
});

/**
 * GET /api/assignments/:id
 * Get a single assignment
 */
router.get('/:id', (req, res) => {
    const assignment = assignments.get(req.params.id);
    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(assignment);
});

/**
 * PUT /api/assignments/:id
 * Update an assignment
 */
router.put('/:id', (req, res) => {
    const assignment = assignments.get(req.params.id);
    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    const updates = req.body;
    const updated = {
        ...assignment,
        ...updates,
        id: assignment.id, // Preserve ID
        updatedAt: new Date().toISOString()
    };

    assignments.set(req.params.id, updated);
    res.json(updated);
});

/**
 * PUT /api/assignments/:id/progress
 * Update assignment progress after practice session
 */
router.put('/:id/progress', (req, res) => {
    const assignment = assignments.get(req.params.id);
    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    const { bpm, intonation, durationMinutes } = req.body;

    const progress = {
        ...assignment.progress,
        currentBpm: bpm || assignment.progress.currentBpm,
        currentIntonation: intonation || assignment.progress.currentIntonation,
        practiceCount: assignment.progress.practiceCount + 1,
        totalPracticeMinutes: assignment.progress.totalPracticeMinutes + (durationMinutes || 0),
        lastPracticed: new Date().toISOString()
    };

    let status = assignment.status;
    if (status === 'pending') {
        status = 'in_progress';
    }

    // Check if target met
    const targetMet = progress.currentBpm >= assignment.target.bpm &&
        progress.currentIntonation >= assignment.target.intonationThreshold;

    if (targetMet) {
        status = 'completed';
    }

    const updated = {
        ...assignment,
        progress,
        status,
        completedAt: status === 'completed' ? new Date().toISOString() : assignment.completedAt,
        updatedAt: new Date().toISOString()
    };

    assignments.set(req.params.id, updated);

    // Notify teacher of progress
    sendNotification(assignment.teacherId, {
        type: 'progress_update',
        assignmentId: assignment.id,
        title: targetMet ? `Assignment Completed!` : `Progress Update`,
        message: targetMet
            ? `${assignment.title} has been completed!`
            : `Practice session recorded for "${assignment.title}": ${bpm} BPM, ${intonation}% intonation`,
        timestamp: new Date().toISOString()
    });

    res.json(updated);
});

/**
 * PUT /api/assignments/:id/complete
 * Manually mark assignment as complete
 */
router.put('/:id/complete', (req, res) => {
    const assignment = assignments.get(req.params.id);
    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    const updated = {
        ...assignment,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    assignments.set(req.params.id, updated);

    sendNotification(assignment.teacherId, {
        type: 'assignment_completed',
        assignmentId: assignment.id,
        title: 'Assignment Completed',
        message: `"${assignment.title}" has been marked as complete`,
        timestamp: new Date().toISOString()
    });

    res.json(updated);
});

/**
 * DELETE /api/assignments/:id
 * Delete an assignment
 */
router.delete('/:id', (req, res) => {
    if (!assignments.has(req.params.id)) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    assignments.delete(req.params.id);
    res.json({ success: true });
});

/**
 * POST /api/assignments/relationships
 * Link a teacher to a student
 */
router.post('/relationships', (req, res) => {
    const { teacherId, studentId } = req.body;

    if (!teacherId || !studentId) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'teacherId and studentId are required'
        });
    }

    // Check for existing
    const existing = Array.from(relationships.values()).find(
        r => r.teacherId === teacherId && r.studentId === studentId
    );
    if (existing) {
        return res.json(existing);
    }

    const id = generateId();
    const relationship = {
        id,
        teacherId,
        studentId,
        createdAt: new Date().toISOString()
    };

    relationships.set(id, relationship);
    res.status(201).json(relationship);
});

/**
 * GET /api/assignments/relationships/:teacherId
 * Get all students linked to a teacher
 */
router.get('/relationships/:teacherId', (req, res) => {
    const results = Array.from(relationships.values())
        .filter(r => r.teacherId === req.params.teacherId);
    res.json(results);
});

/**
 * DELETE /api/assignments/relationships/:id
 * Remove a teacher-student relationship
 */
router.delete('/relationships/:id', (req, res) => {
    if (!relationships.has(req.params.id)) {
        return res.status(404).json({ error: 'Relationship not found' });
    }
    relationships.delete(req.params.id);
    res.json({ success: true });
});

/**
 * GET /api/assignments/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
router.get('/notifications/stream', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ error: 'userId query parameter required' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

    // Register this client
    if (!sseClients.has(userId)) {
        sseClients.set(userId, []);
    }
    sseClients.get(userId).push(res);

    // Send any pending notifications
    const pending = notifications.get(userId) || [];
    pending.forEach(notification => {
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
    });
    notifications.delete(userId);

    // Clean up on disconnect
    req.on('close', () => {
        const clients = sseClients.get(userId) || [];
        const index = clients.indexOf(res);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        if (clients.length === 0) {
            sseClients.delete(userId);
        }
    });
});

/**
 * GET /api/assignments/notifications/:userId
 * Get pending notifications for a user
 */
router.get('/notifications/:userId', (req, res) => {
    const pending = notifications.get(req.params.userId) || [];
    notifications.delete(req.params.userId);
    res.json(pending);
});

/**
 * Helper: Send notification to a user via SSE or queue it
 */
function sendNotification(userId, notification) {
    const clients = sseClients.get(userId) || [];

    if (clients.length > 0) {
        // Send via SSE
        clients.forEach(client => {
            client.write(`data: ${JSON.stringify(notification)}\n\n`);
        });
    } else {
        // Queue for later retrieval
        if (!notifications.has(userId)) {
            notifications.set(userId, []);
        }
        notifications.get(userId).push(notification);
    }
}

/**
 * Helper: Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Export for testing
router._assignments = assignments;
router._relationships = relationships;
router._notifications = notifications;
router._sseClients = sseClients;
router._sendNotification = sendNotification;

module.exports = router;
