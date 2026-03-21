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

module.exports = router;
