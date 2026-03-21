/**
 * Teacher (Studio Dashboard) API routes
 * REST API stub for teacher portal data. Currently uses in-memory storage;
 * the primary data source is the client-side IndexedDB in teacher-service.js.
 * These routes are provided for future backend migration.
 */

const express = require('express');

const router = express.Router();

// In-memory store (would be replaced by a database in production)
const students = new Map();
const practiceLogs = new Map();

// Video snippets storage (in-memory for demo; would use cloud storage in production)
const videoSnippets = new Map();
const REACTION_AUTO_DELETE_DAYS = 7;

let nextId = 1;
function generateId() {
    return 'srv-' + (nextId++) + '-' + Date.now().toString(36);
}

/**
 * Get the start of the current week (Monday at midnight)
 */
function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.getTime();
}

/**
 * Middleware: require X-Teacher-Mode header to access teacher routes
 */
function requireTeacherMode(req, res, next) {
    if (req.headers['x-teacher-mode'] !== 'true') {
        return res.status(403).json({ error: 'Teacher mode not enabled' });
    }
    next();
}

// Apply teacher mode check to all routes
router.use(requireTeacherMode);

/**
 * Validate and sanitize string fields with length limits
 */
function sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
}

// GET /api/teacher/students - List all students
router.get('/students', (req, res) => {
    const allStudents = Array.from(students.values());

    // Apply search filter
    const { search, sortBy, order } = req.query;
    let result = allStudents;

    if (search) {
        const lower = sanitizeString(search, 100).toLowerCase();
        result = result.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.instrument.toLowerCase().includes(lower) ||
            (s.assignedPiece && s.assignedPiece.toLowerCase().includes(lower))
        );
    }

    // Apply sorting
    if (sortBy) {
        const asc = order !== 'desc';
        result.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'practiceTime':
                    valA = a.weeklyPracticeTimeMs || 0;
                    valB = b.weeklyPracticeTimeMs || 0;
                    break;
                case 'intonation':
                    valA = a.averageIntonationScore ?? -1;
                    valB = b.averageIntonationScore ?? -1;
                    break;
                default:
                    valA = a.addedAt || 0;
                    valB = b.addedAt || 0;
            }
            return asc ? valA - valB : valB - valA;
        });
    }

    res.json({ students: result, total: result.length });
});

// POST /api/teacher/students - Add a new student
router.post('/students', (req, res) => {
    const { name, instrument, assignedPiece, email } = req.body;

    const sanitizedName = sanitizeString(name, 200);
    if (!sanitizedName) {
        return res.status(400).json({ error: 'Student name is required' });
    }

    const allowedInstruments = ['violin', 'viola', 'cello', 'bass'];
    const sanitizedInstrument = allowedInstruments.includes(instrument) ? instrument : 'violin';

    const student = {
        id: generateId(),
        name: sanitizedName,
        instrument: sanitizedInstrument,
        assignedPiece: sanitizeString(assignedPiece, 500),
        email: sanitizeString(email, 320),
        addedAt: Date.now(),
        lastSessionAt: null,
        totalPracticeTimeMs: 0,
        averageIntonationScore: null,
        weeklyPracticeTimeMs: 0,
        weekStartTimestamp: getWeekStart()
    };

    students.set(student.id, student);
    res.status(201).json(student);
});

// GET /api/teacher/students/:id - Get a single student
router.get('/students/:id', (req, res) => {
    const student = students.get(req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
});

// PUT /api/teacher/students/:id - Update a student
router.put('/students/:id', (req, res) => {
    const student = students.get(req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const allowedFields = ['name', 'instrument', 'assignedPiece', 'email', 'notes', 'level'];
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            student[field] = sanitizeString(req.body[field], field === 'email' ? 320 : 500);
        }
    }

    students.set(student.id, student);
    res.json(student);
});

// DELETE /api/teacher/students/:id - Remove a student and their practice logs
router.delete('/students/:id', (req, res) => {
    if (!students.has(req.params.id)) {
        return res.status(404).json({ error: 'Student not found' });
    }
    students.delete(req.params.id);
    // Also delete orphaned practice logs
    practiceLogs.delete(req.params.id);
    res.status(204).end();
});

// POST /api/teacher/students/:id/sessions - Log a practice session
router.post('/students/:id/sessions', (req, res) => {
    const student = students.get(req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const { durationMs, piece, intonationScore, pitchScore, rhythmScore, notes } = req.body;

    // Validate numeric fields
    const validatedDuration = typeof durationMs === 'number' && durationMs >= 0 ? durationMs : 0;
    const validatedIntonation = typeof intonationScore === 'number' && intonationScore >= 0 && intonationScore <= 100
        ? intonationScore : null;

    const log = {
        id: generateId(),
        studentId: req.params.id,
        date: Date.now(),
        durationMs: validatedDuration,
        piece: sanitizeString(piece, 500),
        intonationScore: validatedIntonation,
        pitchScore: pitchScore ?? null,
        rhythmScore: rhythmScore ?? null,
        notes: sanitizeString(notes, 2000)
    };

    // Store log
    if (!practiceLogs.has(req.params.id)) {
        practiceLogs.set(req.params.id, []);
    }
    practiceLogs.get(req.params.id).push(log);

    // Update student aggregates
    student.lastSessionAt = log.date;
    student.totalPracticeTimeMs = (student.totalPracticeTimeMs || 0) + validatedDuration;

    // Weekly practice time with reset logic
    const weekStart = getWeekStart();
    if (student.weekStartTimestamp !== weekStart) {
        student.weeklyPracticeTimeMs = validatedDuration;
        student.weekStartTimestamp = weekStart;
    } else {
        student.weeklyPracticeTimeMs = (student.weeklyPracticeTimeMs || 0) + validatedDuration;
    }

    if (validatedIntonation !== null) {
        if (student.averageIntonationScore === null) {
            student.averageIntonationScore = validatedIntonation;
        } else {
            student.averageIntonationScore = Math.round(
                student.averageIntonationScore * 0.7 + validatedIntonation * 0.3
            );
        }
    }

    students.set(student.id, student);
    res.status(201).json(log);
});

// GET /api/teacher/students/:id/sessions - Get practice logs for a student
router.get('/students/:id/sessions', (req, res) => {
    if (!students.has(req.params.id)) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const logs = practiceLogs.get(req.params.id) || [];
    res.json({ sessions: logs, total: logs.length });
});

// GET /api/teacher/metrics - Dashboard summary metrics
router.get('/metrics', (req, res) => {
    const allStudents = Array.from(students.values());
    const totalStudents = allStudents.length;
    const totalWeeklyPracticeMs = allStudents.reduce((sum, s) => sum + (s.weeklyPracticeTimeMs || 0), 0);

    const studentsWithScores = allStudents.filter(s => s.averageIntonationScore !== null);
    const averageIntonation = studentsWithScores.length > 0
        ? Math.round(studentsWithScores.reduce((sum, s) => sum + s.averageIntonationScore, 0) / studentsWithScores.length)
        : null;

    const weekStart = getWeekStart();
    const studentsActiveThisWeek = allStudents.filter(s =>
        s.lastSessionAt !== null && s.lastSessionAt >= weekStart
    ).length;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const needsAttention = allStudents.filter(s => !s.lastSessionAt || s.lastSessionAt < oneWeekAgo).length;

    res.json({
        totalStudents,
        totalWeeklyPracticeMs,
        averageIntonation,
        studentsActiveThisWeek,
        needsAttention
    });
});

// ============================================
// Video Snippet Routes (Office Hours Drop)
// ============================================

/**
 * Generate a unique ID for video snippets
 */
function generateSnippetId() {
    return 'vid-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get snippets for a student (inbox view)
 * GET /api/teacher/snippets/:studentId
 */
router.get('/snippets/:studentId', (req, res) => {
    const { studentId } = req.params;

    if (!students.has(studentId)) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const snippets = Array.from(videoSnippets.values())
        .filter(s => s.studentId === studentId)
        .sort((a, b) => b.submittedAt - a.submittedAt);

    res.json({ snippets, total: snippets.length });
});

/**
 * Get all pending snippets (teacher inbox)
 * GET /api/teacher/snippets
 */
router.get('/snippets', (req, res) => {
    const allSnippets = Array.from(videoSnippets.values())
        .sort((a, b) => b.submittedAt - a.submittedAt);

    // Group by student for teacher view
    const snippetsByStudent = {};
    for (const snippet of allSnippets) {
        if (!snippetsByStudent[snippet.studentId]) {
            snippetsByStudent[snippet.studentId] = {
                studentId: snippet.studentId,
                studentName: snippet.studentName || 'Unknown',
                snippets: []
            };
        }
        snippetsByStudent[snippet.studentId].snippets.push(snippet);
    }

    res.json({
        snippets: allSnippets,
        byStudent: Object.values(snippetsByStudent),
        total: allSnippets.length
    });
});

/**
 * Submit a new video snippet (from student)
 * POST /api/teacher/snippets
 */
router.post('/snippets', (req, res) => {
    const { studentId, studentName, videoData, thumbnail, duration, title, notes } = req.body;

    // Validate required fields
    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    if (!videoData) {
        return res.status(400).json({ error: 'Video data is required' });
    }

    // Validate video duration (max 15 seconds for office hours drop)
    const validatedDuration = typeof duration === 'number' && duration > 0 ? Math.min(duration, 15) : 15;

    const snippet = {
        id: generateSnippetId(),
        studentId: sanitizeString(studentId, 100),
        studentName: sanitizeString(studentName || 'Anonymous', 200),
        videoData: videoData, // Base64 encoded video
        thumbnail: thumbnail || null,
        duration: validatedDuration,
        title: sanitizeString(title || 'Untitled Recording', 200),
        notes: sanitizeString(notes || '', 1000),
        submittedAt: Date.now(),
        status: 'pending', // pending, reviewed, replied
        teacherReply: null,
        replyType: null, // text, voice
        replyAt: null,
        expiresAt: Date.now() + (REACTION_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000)
    };

    videoSnippets.set(snippet.id, snippet);
    res.status(201).json(snippet);
});

/**
 * Add teacher reply to a snippet
 * POST /api/teacher/snippets/:id/reply
 */
router.post('/snippets/:id/reply', (req, res) => {
    const { id } = req.params;
    const { replyText, replyVoiceData, replyType } = req.body;

    const snippet = videoSnippets.get(id);
    if (!snippet) {
        return res.status(404).json({ error: 'Snippet not found' });
    }

    // Validate reply type
    const validReplyType = ['text', 'voice'].includes(replyType) ? replyType : 'text';

    if (validReplyType === 'text') {
        snippet.teacherReply = sanitizeString(replyText || '', 2000);
    } else if (validReplyType === 'voice') {
        snippet.teacherReply = replyVoiceData; // Base64 audio data
    }

    snippet.replyType = validReplyType;
    snippet.replyAt = Date.now();
    snippet.status = 'replied';

    videoSnippets.set(id, snippet);
    res.json(snippet);
});

/**
 * Delete a snippet
 * DELETE /api/teacher/snippets/:id
 */
router.delete('/snippets/:id', (req, res) => {
    const { id } = req.params;

    if (!videoSnippets.has(id)) {
        return res.status(404).json({ error: 'Snippet not found' });
    }

    videoSnippets.delete(id);
    res.status(204).end();
});

/**
 * Clean up expired snippets (auto-delete after 7 days)
 * POST /api/teacher/snippets/cleanup
 */
router.post('/snippets/cleanup', (req, res) => {
    const now = Date.now();
    let deletedCount = 0;

    for (const [id, snippet] of videoSnippets.entries()) {
        if (snippet.expiresAt && snippet.expiresAt < now) {
            videoSnippets.delete(id);
            deletedCount++;
        }
    }

    res.json({ deletedCount, remaining: videoSnippets.size });
});

/**
 * Get a single snippet by ID
 * GET /api/teacher/snippets/:id
 */
router.get('/snippet/:id', (req, res) => {
    const { id } = req.params;

    const snippet = videoSnippets.get(id);
    if (!snippet) {
        return res.status(404).json({ error: 'Snippet not found' });
    }

    res.json(snippet);
});

module.exports = router;
