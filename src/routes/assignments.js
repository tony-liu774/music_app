/**
 * Assignments API routes - Smart Assignments & Routine Builder
 * REST API for managing teacher-student assignments with due dates,
 * measure ranges, and practice targets.
 */

const express = require('express');
const router = express.Router();

// In-memory stores (primary data is in client IndexedDB)
// These routes are for server-side persistence and push notifications
const assignments = new Map();
const studentLinks = new Map();
const assignmentProgress = new Map();

let nextId = 1;
function generateId(prefix) {
    return `${prefix}-${(nextId++)}-${Date.now().toString(36)}`;
}

/**
 * Middleware: require authentication
 */
function requireAuth(req, res, next) {
    // In production, verify JWT token
    // For now, accept X-User-Id header
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.userId = userId;
    next();
}

/**
 * Validate and sanitize string fields
 */
function sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
}

/**
 * Validate numeric fields
 */
function sanitizeNumber(value, min, max, defaultValue) {
    const num = Number(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
}

// ============================================
// Student Links (Teacher <-> Student mapping)
// ============================================

// POST /api/assignments/link - Link a student to a teacher
router.post('/link', requireAuth, (req, res) => {
    const { studentId, studentEmail, studentName } = req.body;
    const teacherId = req.userId;

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    // Check if link already exists
    const existingKey = `${teacherId}:${studentId}`;
    if (studentLinks.has(existingKey)) {
        return res.status(409).json({ error: 'Student is already linked' });
    }

    const link = {
        id: generateId('link'),
        teacherId,
        studentId: sanitizeString(studentId, 100),
        studentEmail: sanitizeString(studentEmail, 320),
        studentName: sanitizeString(studentName, 200),
        linkedAt: Date.now()
    };

    studentLinks.set(existingKey, link);
    res.status(201).json(link);
});

// GET /api/assignments/students - Get all students linked to a teacher
router.get('/students', requireAuth, (req, res) => {
    const teacherId = req.userId;
    const students = [];

    for (const [key, link] of studentLinks) {
        if (key.startsWith(`${teacherId}:`)) {
            students.push(link);
        }
    }

    res.json({ students, total: students.length });
});

// DELETE /api/assignments/link/:linkId - Remove a student link
router.delete('/link/:linkId', requireAuth, (req, res) => {
    const teacherId = req.userId;
    const { linkId } = req.params;

    for (const [key, link] of studentLinks) {
        if (link.id === linkId && link.teacherId === teacherId) {
            studentLinks.delete(key);
            return res.status(204).end();
        }
    }

    res.status(404).json({ error: 'Link not found' });
});

// ============================================
// Assignments
// ============================================

// GET /api/assignments - Get assignments (teacher: all, student: own)
router.get('/', requireAuth, (req, res) => {
    const teacherId = req.headers['x-teacher-mode'] === 'true' ? req.userId : null;
    const studentId = req.headers['x-student-mode'] === 'true' ? req.userId : null;

    let result = [];

    for (const assignment of assignments.values()) {
        if (teacherId && assignment.teacherId === teacherId) {
            result.push(assignment);
        } else if (studentId && assignment.studentId === studentId) {
            result.push(assignment);
        } else if (teacherId || studentId) {
            // Filtering but no match
        } else {
            // No filtering, return all (should not happen in production)
            result.push(assignment);
        }
    }

    // Sort by due date and status
    result = sortAssignments(result);

    res.json({ assignments: result, total: result.length });
});

// POST /api/assignments - Create a new assignment
router.post('/', requireAuth, (req, res) => {
    const teacherId = req.userId;
    const {
        studentId,
        pieceId,
        pieceTitle,
        composer,
        measureStart,
        measureEnd,
        targetTempo,
        targetIntonation,
        targetAccuracy,
        title,
        description,
        dueDate,
        priority
    } = req.body;

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    const assignment = {
        id: generateId('asgn'),
        teacherId,
        studentId: sanitizeString(studentId, 100),
        pieceId: sanitizeString(pieceId, 100),
        pieceTitle: sanitizeString(pieceTitle, 500) || 'Untitled Piece',
        composer: sanitizeString(composer, 300),
        measureStart: sanitizeNumber(measureStart, 1, 9999, 1),
        measureEnd: measureEnd ? sanitizeNumber(measureEnd, 1, 9999, null) : null,
        targetTempo: targetTempo ? sanitizeNumber(targetTempo, 20, 300, null) : null,
        targetIntonation: targetIntonation ? sanitizeNumber(targetIntonation, 0, 100, null) : null,
        targetAccuracy: targetAccuracy ? sanitizeNumber(targetAccuracy, 0, 100, null) : null,
        title: sanitizeString(title, 300),
        description: sanitizeString(description, 2000),
        dueDate: dueDate ? Number(dueDate) : null,
        status: 'assigned',
        priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        assignedAt: Date.now(),
        completedAt: null
    };

    assignments.set(assignment.id, assignment);

    // Push notification stub (FCM integration pending)
    console.warn('[PushNotification] Would send to student:', studentId, {
        title: 'New Assignment',
        body: `${assignment.title || 'Practice Assignment'}: ${assignment.pieceTitle}`
    });

    res.status(201).json(assignment);
});

// GET /api/assignments/:id - Get a single assignment
router.get('/:id', requireAuth, (req, res) => {
    const assignment = assignments.get(req.params.id);

    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check access (teacher or student)
    const isTeacher = assignment.teacherId === req.userId;
    const isStudent = assignment.studentId === req.userId;

    if (!isTeacher && !isStudent) {
        return res.status(403).json({ error: 'Access denied' });
    }

    res.json(assignment);
});

// PUT /api/assignments/:id - Update an assignment
router.put('/:id', requireAuth, (req, res) => {
    const assignment = assignments.get(req.params.id);

    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    // Only teacher can update
    if (assignment.teacherId !== req.userId) {
        return res.status(403).json({ error: 'Only the teacher can update this assignment' });
    }

    const allowedFields = [
        'title', 'description', 'measureStart', 'measureEnd',
        'targetTempo', 'targetIntonation', 'targetAccuracy',
        'dueDate', 'status', 'priority', 'pieceId', 'pieceTitle'
    ];

    const updates = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            if (typeof req.body[field] === 'string') {
                updates[field] = sanitizeString(req.body[field], 2000);
            } else if (typeof req.body[field] === 'number') {
                updates[field] = req.body[field];
            } else {
                updates[field] = req.body[field];
            }
        }
    }

    const updated = {
        ...assignment,
        ...updates,
        id: assignment.id,
        updatedAt: Date.now()
    };

    if (updates.status === 'completed' && !assignment.completedAt) {
        updated.completedAt = Date.now();
    }

    assignments.set(updated.id, updated);

    // Push notification stub (FCM integration pending)
    console.warn('[PushNotification] Would notify student of update:', updated.studentId, {
        title: 'Assignment Updated',
        body: `${updated.title || 'Practice Assignment'} has been updated`
    });

    res.json(updated);
});

// DELETE /api/assignments/:id - Delete an assignment
router.delete('/:id', requireAuth, (req, res) => {
    const assignment = assignments.get(req.params.id);

    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.teacherId !== req.userId) {
        return res.status(403).json({ error: 'Only the teacher can delete this assignment' });
    }

    assignments.delete(req.params.id);

    // Delete related progress
    for (const [key, progress] of assignmentProgress) {
        if (progress.assignmentId === req.params.id) {
            assignmentProgress.delete(key);
        }
    }

    res.status(204).end();
});

// ============================================
// Progress Tracking
// ============================================

// POST /api/assignments/:id/progress - Record progress
router.post('/:id/progress', requireAuth, (req, res) => {
    const assignment = assignments.get(req.params.id);

    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    // Only student can record progress
    if (assignment.studentId !== req.userId) {
        return res.status(403).json({ error: 'Only the assigned student can record progress' });
    }

    const { tempoAchieved, intonationScore, accuracyScore, practiceDurationMs, notes } = req.body;

    const progress = {
        id: generateId('prog'),
        assignmentId: req.params.id,
        studentId: req.userId,
        recordedAt: Date.now(),
        tempoAchieved: tempoAchieved ? sanitizeNumber(tempoAchieved, 20, 300, null) : null,
        intonationScore: intonationScore !== undefined ? sanitizeNumber(intonationScore, 0, 100, null) : null,
        accuracyScore: accuracyScore !== undefined ? sanitizeNumber(accuracyScore, 0, 100, null) : null,
        practiceDurationMs: sanitizeNumber(practiceDurationMs, 0, 86400000, 0),
        notes: sanitizeString(notes, 1000)
    };

    assignmentProgress.set(progress.id, progress);

    // Check if targets met and update status
    let allTargetsMet = true;

    if (assignment.targetTempo && tempoAchieved) {
        if (tempoAchieved < assignment.targetTempo) allTargetsMet = false;
    }
    if (assignment.targetIntonation && intonationScore !== undefined) {
        if (intonationScore < assignment.targetIntonation) allTargetsMet = false;
    }
    if (assignment.targetAccuracy && accuracyScore !== undefined) {
        if (accuracyScore < assignment.targetAccuracy) allTargetsMet = false;
    }

    if (allTargetsMet && assignment.status !== 'completed') {
        assignment.status = 'completed';
        assignment.completedAt = Date.now();
        assignments.set(assignment.id, assignment);
    } else if (assignment.status === 'assigned') {
        assignment.status = 'in_progress';
        assignments.set(assignment.id, assignment);
    }

    res.status(201).json({ progress, assignment });
});

// GET /api/assignments/:id/progress - Get progress history
router.get('/:id/progress', requireAuth, (req, res) => {
    const assignment = assignments.get(req.params.id);

    if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
    }

    const isTeacher = assignment.teacherId === req.userId;
    const isStudent = assignment.studentId === req.userId;

    if (!isTeacher && !isStudent) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const progressList = [];
    for (const progress of assignmentProgress.values()) {
        if (progress.assignmentId === req.params.id) {
            progressList.push(progress);
        }
    }

    progressList.sort((a, b) => b.recordedAt - a.recordedAt);

    res.json({ progress: progressList, total: progressList.length });
});

// ============================================
// Stats
// ============================================

// GET /api/assignments/stats - Get assignment statistics
router.get('/stats/summary', requireAuth, (req, res) => {
    const teacherId = req.headers['x-teacher-mode'] === 'true' ? req.userId : null;
    const studentId = req.headers['x-student-mode'] === 'true' ? req.userId : null;
    const now = Date.now();

    let assignmentsList = [];
    for (const assignment of assignments.values()) {
        if (teacherId && assignment.teacherId === teacherId) {
            assignmentsList.push(assignment);
        } else if (studentId && assignment.studentId === studentId) {
            assignmentsList.push(assignment);
        }
    }

    const stats = {
        total: assignmentsList.length,
        assigned: assignmentsList.filter(a => a.status === 'assigned').length,
        inProgress: assignmentsList.filter(a => a.status === 'in_progress').length,
        completed: assignmentsList.filter(a => a.status === 'completed').length,
        overdue: assignmentsList.filter(a =>
            a.dueDate && a.dueDate < now && a.status !== 'completed'
        ).length
    };

    res.json(stats);
});

/**
 * Sort assignments by status and due date
 */
function sortAssignments(assignments) {
    const now = Date.now();

    return [...assignments].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;

        const aOverdue = a.dueDate && a.dueDate < now && a.status !== 'completed';
        const bOverdue = b.dueDate && b.dueDate < now && b.status !== 'completed';
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;

        return b.createdAt - a.createdAt;
    });
}

module.exports = router;
