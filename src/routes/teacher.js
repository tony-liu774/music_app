/**
 * Teacher (Studio Dashboard) API routes
 * REST API stub for teacher portal data. Currently uses in-memory storage;
 * the primary data source is the client-side IndexedDB in teacher-service.js.
 * These routes are provided for future backend migration.
 */

const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Get JWT secret from config
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

// In-memory store (would be replaced by a database in production)
const students = new Map();
const practiceLogs = new Map();

// Video snippets storage - export for scheduler
const videoSnippets = new Map();
const REACTION_AUTO_DELETE_DAYS = 7;
const MAX_VIDEO_SIZE_MB = 10;

// Export videoSnippets for scheduler access
router.videoSnippets = videoSnippets;

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
 * Middleware: validate JWT token for authentication
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Middleware: require teacher role
 */
function requireTeacher(req, res, next) {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Teacher access required' });
    }
    next();
}

/**
 * Middleware: require X-Teacher-Mode header to access teacher routes
 */
function requireTeacherMode(req, res, next) {
    // Allow snippet routes without teacher mode for students
    if (req.path.startsWith('/snippets')) {
        return next();
    }

    if (req.headers['x-teacher-mode'] !== 'true') {
        return res.status(403).json({ error: 'Teacher mode not enabled' });
    }
    next();
}

// Apply teacher mode check to non-snippet routes
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
 * Validate video size to prevent memory exhaustion
 */
function validateVideoSize(videoData, maxSizeMB = MAX_VIDEO_SIZE_MB) {
    if (!videoData) return { valid: false, error: 'No video data' };

    // Estimate size from base64
    const base64Length = videoData.length;
    const sizeInBytes = (base64Length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > maxSizeMB) {
        return { valid: false, error: `Video too large: ${sizeInMB.toFixed(2)}MB (max: ${maxSizeMB}MB)` };
    }

    return { valid: true, sizeInMB: sizeInMB.toFixed(2) };
}

/**
 * Get snippets for a student (student's own sent snippets view)
 * GET /api/teacher/snippets/:studentId
 */
router.get('/snippets/:studentId', requireAuth, (req, res) => {
    const { studentId } = req.params;
    const isTeacher = req.user.role === 'teacher';

    // Students can only view their own snippets
    if (!isTeacher && req.user.userId !== studentId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // For students, check if they exist (validate student)
    if (!isTeacher && !students.has(studentId)) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const snippets = Array.from(videoSnippets.values())
        .filter(s => s.studentId === studentId)
        .sort((a, b) => b.submittedAt - a.submittedAt);

    // Don't expose video data in list view
    const sanitizedSnippets = snippets.map(s => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        thumbnail: s.thumbnail,
        duration: s.duration,
        title: s.title,
        notes: s.notes,
        submittedAt: s.submittedAt,
        status: s.status,
        teacherReply: s.teacherReply ? '(Reply received)' : null,
        replyType: s.replyType,
        replyAt: s.replyAt,
        expiresAt: s.expiresAt
    }));

    res.json({ snippets: sanitizedSnippets, total: sanitizedSnippets.length });
});

/**
 * Get all pending snippets (teacher inbox)
 * GET /api/teacher/snippets
 */
router.get('/snippets', requireAuth, requireTeacher, (req, res) => {
    const allSnippets = Array.from(videoSnippets.values())
        .sort((a, b) => b.submittedAt - a.submittedAt);

    // Don't expose full video data in list view for performance
    const sanitizedSnippets = allSnippets.map(s => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.studentName,
        thumbnail: s.thumbnail,
        duration: s.duration,
        title: s.title,
        notes: s.notes,
        submittedAt: s.submittedAt,
        status: s.status,
        hasReply: !!s.teacherReply,
        expiresAt: s.expiresAt
    }));

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
router.post('/snippets', requireAuth, async (req, res) => {
    const { studentId, studentName, videoData, thumbnail, duration, title, notes, trimStart, trimEnd } = req.body;
    const isTeacher = req.user.role === 'teacher';

    // Validate required fields
    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    // Students can only submit for themselves
    if (!isTeacher && req.user.userId !== studentId) {
        return res.status(403).json({ error: 'Cannot submit for other users' });
    }

    if (!videoData) {
        return res.status(400).json({ error: 'Video data is required' });
    }

    // Validate video size to prevent memory exhaustion
    const sizeValidation = validateVideoSize(videoData);
    if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
    }

    // Validate video duration (max 15 seconds for office hours drop)
    const validatedDuration = typeof duration === 'number' && duration > 0 ? Math.min(duration, 15) : 15;

    // Generate snippet ID
    const snippetId = generateSnippetId();

    // In production, upload to cloud storage (S3)
    // For now, store locally with base64
    let videoUrl = videoData;
    let videoKey = null;
    let storageType = 'local';

    // Note: In production, uncomment this to use S3
    // const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
    // ... upload logic here

    const snippet = {
        id: snippetId,
        studentId: sanitizeString(studentId, 100),
        studentName: sanitizeString(studentName || req.user.name || 'Anonymous', 200),
        videoData: videoData, // Base64 encoded video (keep for demo)
        videoUrl: videoUrl,  // Cloud URL when available
        videoKey: videoKey,  // S3 key for deletion
        storageType: storageType,
        thumbnail: thumbnail || null,
        duration: validatedDuration,
        title: sanitizeString(title || 'Untitled Recording', 200),
        notes: sanitizeString(notes || '', 1000),
        // Video trimming data
        trimStart: typeof trimStart === 'number' ? Math.max(0, trimStart) : 0,
        trimEnd: typeof trimEnd === 'number' ? Math.min(validatedDuration, trimEnd) : validatedDuration,
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
router.post('/snippets/:id/reply', requireAuth, requireTeacher, async (req, res) => {
    const { id } = req.params;
    const { replyText, replyVoiceData, replyType } = req.body;

    const snippet = videoSnippets.get(id);
    if (!snippet) {
        return res.status(404).json({ error: 'Snippet not found' });
    }

    // Validate reply type
    const validReplyType = ['text', 'voice'].includes(replyType) ? replyType : 'text';

    if (validReplyType === 'text') {
        if (!replyText || replyText.trim().length === 0) {
            return res.status(400).json({ error: 'Reply text is required' });
        }
        snippet.teacherReply = sanitizeString(replyText, 2000);
    } else if (validReplyType === 'voice') {
        if (!replyVoiceData) {
            return res.status(400).json({ error: 'Voice data is required' });
        }
        snippet.teacherReply = replyVoiceData; // Base64 audio data
    }

    snippet.replyType = validReplyType;
    snippet.replyAt = Date.now();
    snippet.replyBy = req.user.name || 'Teacher';
    snippet.status = 'replied';

    videoSnippets.set(id, snippet);

    // Notify student of reply (would integrate with push notification service)
    console.log(`Teacher replied to snippet ${id}: ${validReplyType} reply`);

    // Return the full snippet with reply
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
