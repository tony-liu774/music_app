const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const router = express.Router();

// In-memory user store (in production, use a database)
const users = new Map();
const refreshTokens = new Set();

// Use JWT config from centralized config
const JWT_SECRET = config.jwt.secret;
const JWT_EXPIRES_IN = config.jwt.expiresIn;
const REFRESH_EXPIRES_IN = config.jwt.refreshExpiresIn;

// Auth-specific rate limiter: 10 attempts per 15 minutes (relaxed in test)
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.nodeEnv === 'test' ? 1000 : 10,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 100;

/**
 * Generate JWT tokens
 */
function generateTokens(user) {
    const token = jwt.sign(
        { id: user.id, email: user.email, type: 'access' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );

    refreshTokens.add(refreshToken);

    return { token, refreshToken };
}

/**
 * Auth middleware - verifies JWT access token
 * Rejects refresh tokens used as access tokens
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Reject refresh tokens used as access tokens
        if (decoded.type === 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', authRateLimiter, async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Validate email format and length
        if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password length
        if (typeof password !== 'string' || password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
        }

        // Validate displayName if provided
        if (displayName !== undefined && displayName !== null) {
            if (typeof displayName !== 'string' || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
                return res.status(400).json({ error: `Display name must be a string of at most ${MAX_DISPLAY_NAME_LENGTH} characters` });
            }
        }

        // Check if user already exists
        if (users.has(email)) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
            email,
            displayName: displayName || email.split('@')[0],
            hashedPassword,
            createdAt: Date.now()
        };

        users.set(email, user);

        const tokens = generateTokens(user);

        res.status(201).json({
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = users.get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.hashedPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const tokens = generateTokens(user);

        res.json({
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh the auth token
 */
router.post('/refresh', authRateLimiter, (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        if (!refreshTokens.has(refreshToken)) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        // Verify this is actually a refresh token
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Find the user
        let foundUser = null;
        for (const user of users.values()) {
            if (user.id === decoded.id) {
                foundUser = user;
                break;
            }
        }

        if (!foundUser) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Remove old refresh token and generate new ones
        refreshTokens.delete(refreshToken);
        const tokens = generateTokens(foundUser);

        res.json({
            token: tokens.token,
            refreshToken: tokens.refreshToken
        });
    } catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        refreshTokens.delete(refreshToken);
    }
    res.json({ message: 'Logged out' });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.users = users;
module.exports.generateTokens = generateTokens;
module.exports.refreshTokens = refreshTokens;
module.exports.EMAIL_REGEX = EMAIL_REGEX;
module.exports.authRateLimiter = authRateLimiter;
