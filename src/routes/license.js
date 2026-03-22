const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { authMiddleware } = require('./auth');

const router = express.Router();

// In-memory license store (in production, use a database)
// License structure: { id, key, type, tier, userId, status, expiresAt, studentLimit, studentCount, students[], createdAt }
const licenses = new Map();

// Invitation tokens storage
const invitations = new Map();

// Generate a secure license key
function generateLicenseKey(prefix = 'MCP') {
    const random = crypto.randomBytes(16).toString('hex').toUpperCase();
    const checksum = crypto.createHash('sha256').update(random).digest('hex').substring(0, 4).toUpperCase();
    return `${prefix}-${random.substring(0, 8)}-${random.substring(8, 12)}-${checksum}`;
}

// Generate invitation token
function generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
}

// License rate limiter: 10 attempts per minute (disabled in test mode)
const isTest = process.env.NODE_ENV === 'test';
const licenseRateLimiter = isTest ? (req, res, next) => next() : rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many license requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Input validation helpers
function isValidLicenseKey(key) {
    return typeof key === 'string' && /^[A-Z0-9]{3,4}-[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Pre-populate some demo license keys for testing
function initializeDemoLicenses() {
    const nodeEnv = process.env.NODE_ENV || 'development';

    // Pro license (monthly)
    const proKey = generateLicenseKey('MCP');
    licenses.set(proKey, {
        id: uuidv4(),
        type: 'subscription',
        tier: 'pro',
        userId: null,
        status: 'active',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        studentLimit: 0,
        studentCount: 0,
        students: [],
        createdAt: Date.now()
    });

    // Studio license (one-time, 30 students)
    const studioKey = generateLicenseKey('MCS');
    licenses.set(studioKey, {
        id: uuidv4(),
        type: 'one-time',
        tier: 'studio',
        userId: null,
        status: 'active',
        expiresAt: null, // Never expires
        studentLimit: 30,
        studentCount: 0,
        students: [],
        createdAt: Date.now()
    });

    // Only log in non-production environments
    if (nodeEnv !== 'production') {
        console.log('Demo license keys generated:');
        console.log('  Pro (30 days):', proKey);
        console.log('  Studio (one-time, 30 students):', studioKey);
    }
}

// Initialize demo licenses on module load
initializeDemoLicenses();

/**
 * POST /api/licenses/validate
 * Validate a license key without activating
 */
router.post('/validate', licenseRateLimiter, async (req, res) => {
    try {
        const { licenseKey } = req.body;

        if (!licenseKey || !isValidLicenseKey(licenseKey)) {
            return res.status(400).json({ error: 'Invalid license key format' });
        }

        const license = licenses.get(licenseKey.toUpperCase());

        if (!license) {
            return res.status(404).json({ error: 'License key not found' });
        }

        // Return license info without sensitive data
        res.json({
            valid: license.status === 'active' && (!license.expiresAt || license.expiresAt > Date.now()),
            tier: license.tier,
            type: license.type,
            studentLimit: license.studentLimit,
            expiresAt: license.expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: 'License validation failed' });
    }
});

/**
 * POST /api/licenses/activate
 * Activate a license key for the current user
 */
router.post('/activate', licenseRateLimiter, authMiddleware, async (req, res) => {
    try {
        const { licenseKey } = req.body;
        const userId = req.user.id;

        if (!licenseKey || !isValidLicenseKey(licenseKey)) {
            return res.status(400).json({ error: 'Invalid license key format' });
        }

        const normalizedKey = licenseKey.toUpperCase();
        const license = licenses.get(normalizedKey);

        if (!license) {
            return res.status(404).json({ error: 'License key not found' });
        }

        if (license.status !== 'active') {
            return res.status(400).json({ error: 'License is not active' });
        }

        if (license.expiresAt && license.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'License has expired' });
        }

        // Check if license is already assigned to another user
        if (license.userId && license.userId !== userId) {
            return res.status(409).json({ error: 'License is already activated' });
        }

        // For one-time licenses, check if user already has one
        if (license.type === 'one-time') {
            for (const [key, lic] of licenses) {
                if (lic.userId === userId && lic.type === 'one-time' && lic.tier === license.tier) {
                    return res.status(409).json({ error: 'You already have a license of this type' });
                }
            }
        }

        // Assign license to user
        license.userId = userId;
        licenses.set(normalizedKey, license);

        res.json({
            id: license.id,
            tier: license.tier,
            type: license.type,
            status: license.status,
            expiresAt: license.expiresAt,
            studentLimit: license.studentLimit,
            studentCount: license.studentCount
        });
    } catch (error) {
        res.status(500).json({ error: 'License activation failed' });
    }
});

/**
 * POST /api/licenses/deactivate
 * Deactivate the current user's license
 */
router.post('/deactivate', authMiddleware, async (req, res) => {
    try {
        const { licenseId } = req.body;
        const userId = req.user.id;

        if (!licenseId) {
            return res.status(400).json({ error: 'License ID is required' });
        }

        // Find license belonging to user
        let foundLicense = null;
        let licenseKey = null;
        for (const [key, license] of licenses) {
            if (license.id === licenseId && license.userId === userId) {
                foundLicense = license;
                licenseKey = key;
                break;
            }
        }

        if (!foundLicense || !licenseKey) {
            return res.status(404).json({ error: 'License not found' });
        }

        // Remove user association (keep license in system)
        foundLicense.userId = null;
        licenses.set(licenseKey, foundLicense);

        res.json({ message: 'License deactivated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'License deactivation failed' });
    }
});

/**
 * GET /api/licenses/status
 * Get current user's license status
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find user's active license
        let userLicense = null;
        for (const [key, license] of licenses) {
            if (license.userId === userId && license.status === 'active') {
                if (!license.expiresAt || license.expiresAt > Date.now()) {
                    userLicense = license;
                    break;
                }
            }
        }

        if (!userLicense) {
            return res.json({
                hasLicense: false,
                tier: 'free'
            });
        }

        // Filter out sensitive data from student list
        const sanitizedStudents = userLicense.students.map(s => ({
            id: s.id,
            email: s.email,
            invitedAt: s.invitedAt,
            activatedAt: s.activatedAt,
            userId: s.userId
        }));

        res.json({
            hasLicense: true,
            id: userLicense.id,
            tier: userLicense.tier,
            type: userLicense.type,
            status: userLicense.status,
            expiresAt: userLicense.expiresAt,
            studentLimit: userLicense.studentLimit,
            studentCount: userLicense.studentCount,
            students: sanitizedStudents
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get license status' });
    }
});

/**
 * POST /api/licenses/generate-student-key
 * Generate a student unlock key (Studio license only)
 */
router.post('/generate-student-key', authMiddleware, async (req, res) => {
    try {
        const { studentEmail } = req.body;
        const userId = req.user.id;

        if (!studentEmail || !isValidEmail(studentEmail)) {
            return res.status(400).json({ error: 'Valid student email is required' });
        }

        // Find user's studio license
        let studioLicense = null;
        let licenseKey = null;
        for (const [key, license] of licenses) {
            if (license.userId === userId && license.tier === 'studio' && license.status === 'active') {
                studioLicense = license;
                licenseKey = key;
                break;
            }
        }

        if (!studioLicense) {
            return res.status(403).json({ error: 'Studio license required for student invitations' });
        }

        if (studioLicense.studentCount >= studioLicense.studentLimit) {
            return res.status(400).json({ error: `Student limit reached (${studioLicense.studentLimit})` });
        }

        // Check if student already invited
        const existingStudent = studioLicense.students.find(s => s.email === studentEmail);
        if (existingStudent) {
            return res.status(409).json({ error: 'Student already invited' });
        }

        // Generate a unique unlock key for the student
        const studentKey = generateLicenseKey('STU');
        const student = {
            id: uuidv4(),
            email: studentEmail,
            key: studentKey,
            invitedAt: Date.now(),
            activatedAt: null
        };

        // Add student to license
        studioLicense.students.push(student);
        studioLicense.studentCount++;
        licenses.set(licenseKey, studioLicense);

        res.json({
            studentKey,
            studentEmail,
            studentId: student.id,
            message: 'Student key generated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate student key' });
    }
});

/**
 * POST /api/licenses/redeem-student-key
 * Redeem a student unlock key received from a teacher
 */
router.post('/redeem-student-key', authMiddleware, async (req, res) => {
    try {
        const { studentKey } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!studentKey || !isValidLicenseKey(studentKey)) {
            return res.status(400).json({ error: 'Invalid student key format' });
        }

        // Search all licenses for this student key
        let foundLicense = null;
        let licenseKey = null;
        let studentRecord = null;

        for (const [key, license] of licenses) {
            const student = license.students?.find(s => s.key === studentKey);
            if (student) {
                foundLicense = license;
                licenseKey = key;
                studentRecord = student;
                break;
            }
        }

        if (!foundLicense || !studentRecord) {
            return res.status(404).json({ error: 'Student key not found' });
        }

        if (foundLicense.status !== 'active') {
            return res.status(400).json({ error: 'License is not active' });
        }

        // Check if already redeemed
        if (studentRecord.userId) {
            if (studentRecord.userId === userId) {
                return res.json({
                    message: 'Key already redeemed',
                    tier: foundLicense.tier
                });
            }
            return res.status(409).json({ error: 'Key already redeemed by another user' });
        }

        // Check if email matches (if student record has email)
        if (studentRecord.email && studentRecord.email !== userEmail) {
            return res.status(403).json({ error: 'This key was invited for a different email address' });
        }

        // Redeem the key - add userId to student record
        studentRecord.userId = userId;
        studentRecord.activatedAt = Date.now();

        // Update license in Map
        licenses.set(licenseKey, foundLicense);

        res.json({
            message: 'Student key redeemed successfully',
            tier: foundLicense.tier,
            teacherTier: foundLicense.tier
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to redeem student key' });
    }
});

/**
 * GET /api/licenses/students
 * Get all students for the current studio license
 */
router.get('/students', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find user's studio license
        let studioLicense = null;
        for (const [key, license] of licenses) {
            if (license.userId === userId && license.tier === 'studio' && license.status === 'active') {
                studioLicense = license;
                break;
            }
        }

        if (!studioLicense) {
            return res.status(403).json({ error: 'Studio license required' });
        }

        // Filter out sensitive data
        const sanitizedStudents = studioLicense.students.map(s => ({
            id: s.id,
            email: s.email,
            invitedAt: s.invitedAt,
            activatedAt: s.activatedAt,
            userId: s.userId
        }));

        res.json(sanitizedStudents);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get students' });
    }
});

/**
 * DELETE /api/licenses/students/:studentId
 * Remove a student from the studio license
 */
router.delete('/students/:studentId', authMiddleware, async (req, res) => {
    try {
        const { studentId } = req.params;
        const userId = req.user.id;

        // Find user's studio license
        let studioLicense = null;
        let licenseKey = null;
        for (const [key, license] of licenses) {
            if (license.userId === userId && license.tier === 'studio' && license.status === 'active') {
                studioLicense = license;
                licenseKey = key;
                break;
            }
        }

        if (!studioLicense) {
            return res.status(403).json({ error: 'Studio license required' });
        }

        const studentIndex = studioLicense.students.findIndex(s => s.id === studentId);
        if (studentIndex === -1) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Remove student
        studioLicense.students.splice(studentIndex, 1);
        studioLicense.studentCount = Math.max(0, studioLicense.studentCount - 1);
        licenses.set(licenseKey, studioLicense);

        res.json({ message: 'Student removed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove student' });
    }
});

/**
 * POST /api/licenses/invite-link
 * Generate an invitation link for students
 */
router.post('/invite-link', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find user's studio license
        let studioLicense = null;
        let licenseKey = null;
        for (const [key, license] of licenses) {
            if (license.userId === userId && license.tier === 'studio' && license.status === 'active') {
                studioLicense = license;
                licenseKey = key;
                break;
            }
        }

        if (!studioLicense) {
            return res.status(403).json({ error: 'Studio license required for invitations' });
        }

        if (studioLicense.studentCount >= studioLicense.studentLimit) {
            return res.status(400).json({ error: `Student limit reached (${studioLicense.studentLimit})` });
        }

        // Generate invitation token
        const inviteToken = generateInviteToken();
        const inviteLink = {
            token: inviteToken,
            licenseId: studioLicense.id,
            createdAt: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            maxUses: studioLicense.studentLimit - studioLicense.studentCount
        };

        invitations.set(inviteToken, inviteLink);

        // Return the full URL (in production, this would be the actual domain)
        const baseUrl = config.app?.baseUrl || 'http://localhost:3000';
        res.json({
            inviteLink: `${baseUrl}?invite=${inviteToken}`,
            expiresAt: inviteLink.expiresAt,
            remainingSlots: inviteLink.maxUses
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate invite link' });
    }
});

/**
 * GET /api/licenses/check-invitation
 * Check if current user has a pending invitation
 */
router.get('/check-invitation', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const inviteToken = req.query.token;

        if (!inviteToken) {
            return res.json({ hasInvitation: false });
        }

        const invitation = invitations.get(inviteToken);

        if (!invitation) {
            return res.json({ hasInvitation: false });
        }

        if (invitation.expiresAt < Date.now()) {
            return res.json({ hasInvitation: false, error: 'Invitation expired' });
        }

        // Find the license
        let license = null;
        for (const [key, lic] of licenses) {
            if (lic.id === invitation.licenseId) {
                license = lic;
                break;
            }
        }

        if (!license || license.status !== 'active') {
            return res.json({ hasInvitation: false, error: 'License not found' });
        }

        res.json({
            hasInvitation: true,
            teacherLicenseId: license.id,
            teacherTier: license.tier,
            expiresAt: invitation.expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check invitation' });
    }
});

/**
 * POST /api/licenses/accept-invitation
 * Accept an invitation from a studio teacher
 */
router.post('/accept-invitation', authMiddleware, async (req, res) => {
    try {
        const { invitationToken } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        if (!invitationToken) {
            return res.status(400).json({ error: 'Invitation token is required' });
        }

        const invitation = invitations.get(invitationToken);

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        // Check maxUses limit
        if (invitation.maxUses !== undefined && invitation.maxUses <= 0) {
            return res.status(400).json({ error: 'Invitation has reached its usage limit' });
        }

        // Find the license
        let license = null;
        let licenseKey = null;
        for (const [key, lic] of licenses) {
            if (lic.id === invitation.licenseId) {
                license = lic;
                licenseKey = key;
                break;
            }
        }

        if (!license || license.status !== 'active') {
            return res.status(400).json({ error: 'License not found or inactive' });
        }

        // Check if user already has access (by userId)
        const existingStudent = license.students.find(s => s.userId === userId);
        if (existingStudent) {
            return res.json({
                message: 'Access already granted',
                tier: license.tier
            });
        }

        // Check if we can add more students
        if (license.studentCount >= license.studentLimit) {
            return res.status(400).json({ error: 'Student limit reached' });
        }

        // Try to find student by email if provided, otherwise create new record
        let studentRecord = license.students.find(s => s.email === userEmail);
        if (studentRecord) {
            // Check if this email slot is already claimed by another user
            if (studentRecord.userId && studentRecord.userId !== userId) {
                return res.status(409).json({ error: 'This invitation has already been claimed by another user' });
            }
            // Update existing student record with userId
            // Don't increment studentCount - already counted when key was generated
            studentRecord.userId = userId;
            studentRecord.activatedAt = Date.now();
        } else {
            // Create new student record
            studentRecord = {
                id: uuidv4(),
                email: userEmail || '',
                userId: userId,
                invitedAt: Date.now(),
                activatedAt: Date.now()
            };
            license.students.push(studentRecord);
            license.studentCount++; // Only increment for new records
        }

        // Update the license in the Map
        licenses.set(licenseKey, license);

        // Handle maxUses for multi-use invites
        if (invitation.maxUses !== undefined) {
            invitation.maxUses--;
            if (invitation.maxUses <= 0) {
                // Delete the invitation when max uses is reached
                invitations.delete(invitationToken);
            } else {
                // Keep the invitation for remaining uses
                invitations.set(invitationToken, invitation);
            }
        } else {
            // Delete the invitation after successful use (single-use)
            invitations.delete(invitationToken);
        }

        res.json({
            message: 'Invitation accepted',
            tier: license.tier,
            studentLimit: license.studentLimit
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

/**
 * GET /api/licenses/:licenseId/renewal
 * Get renewal information for a license
 */
router.get('/:licenseId/renewal', authMiddleware, async (req, res) => {
    try {
        const { licenseId } = req.params;
        const userId = req.user.id;

        // Find license belonging to user
        let license = null;
        for (const [key, lic] of licenses) {
            if (lic.id === licenseId && lic.userId === userId) {
                license = lic;
                break;
            }
        }

        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        // For one-time licenses, no renewal needed
        if (license.type === 'one-time') {
            return res.json({
                renewalRequired: false,
                message: 'One-time license does not require renewal'
            });
        }

        // For subscriptions, provide renewal info
        const daysUntilExpiry = license.expiresAt
            ? Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
            : 0;

        res.json({
            renewalRequired: daysUntilExpiry <= 7,
            daysUntilExpiry,
            currentTier: license.tier,
            // In production, this would connect to Stripe
            renewalPrice: license.tier === 'pro' ? 9.99 : null,
            renewalUrl: '/api/stripe/checkout' // Placeholder for Stripe integration
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get renewal info' });
    }
});

module.exports = router;
module.exports.licenses = licenses;
module.exports.invitations = invitations;
module.exports.generateLicenseKey = generateLicenseKey;
module.exports.generateInviteToken = generateInviteToken;
