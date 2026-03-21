const express = require('express');

const router = express.Router();

// In-memory store for server-side teacher data (would be replaced by a database in production)
const students = new Map();
const practiceLogs = new Map();

let nextId = 1;
function generateId() {
    return 'srv-' + (nextId++) + '-' + Date.now().toString(36);
}

// GET /api/teacher/students - List all students
router.get('/students', (req, res) => {
    const allStudents = Array.from(students.values());

    // Apply search filter
    const { search, sortBy, order } = req.query;
    let result = allStudents;

    if (search) {
        const lower = search.toLowerCase();
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

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Student name is required' });
    }

    const student = {
        id: generateId(),
        name: name.trim(),
        instrument: instrument || 'violin',
        assignedPiece: assignedPiece || '',
        email: email || '',
        addedAt: Date.now(),
        lastSessionAt: null,
        totalPracticeTimeMs: 0,
        averageIntonationScore: null,
        weeklyPracticeTimeMs: 0
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
            student[field] = req.body[field];
        }
    }

    students.set(student.id, student);
    res.json(student);
});

// DELETE /api/teacher/students/:id - Remove a student
router.delete('/students/:id', (req, res) => {
    if (!students.has(req.params.id)) {
        return res.status(404).json({ error: 'Student not found' });
    }
    students.delete(req.params.id);
    res.status(204).end();
});

// POST /api/teacher/students/:id/sessions - Log a practice session
router.post('/students/:id/sessions', (req, res) => {
    const student = students.get(req.params.id);
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const { durationMs, piece, intonationScore, pitchScore, rhythmScore, notes } = req.body;

    const log = {
        id: generateId(),
        studentId: req.params.id,
        date: Date.now(),
        durationMs: durationMs || 0,
        piece: piece || '',
        intonationScore: intonationScore ?? null,
        pitchScore: pitchScore ?? null,
        rhythmScore: rhythmScore ?? null,
        notes: notes || ''
    };

    // Store log
    if (!practiceLogs.has(req.params.id)) {
        practiceLogs.set(req.params.id, []);
    }
    practiceLogs.get(req.params.id).push(log);

    // Update student aggregates
    student.lastSessionAt = log.date;
    student.totalPracticeTimeMs = (student.totalPracticeTimeMs || 0) + (log.durationMs || 0);
    student.weeklyPracticeTimeMs = (student.weeklyPracticeTimeMs || 0) + (log.durationMs || 0);

    if (log.intonationScore !== null) {
        if (student.averageIntonationScore === null) {
            student.averageIntonationScore = log.intonationScore;
        } else {
            student.averageIntonationScore = Math.round(
                student.averageIntonationScore * 0.7 + log.intonationScore * 0.3
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

    const studentsWithSessions = allStudents.filter(s => s.lastSessionAt !== null).length;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const needsAttention = allStudents.filter(s => !s.lastSessionAt || s.lastSessionAt < oneWeekAgo).length;

    res.json({
        totalStudents,
        totalWeeklyPracticeMs,
        averageIntonation,
        studentsWithSessions,
        needsAttention
    });
});

module.exports = router;
