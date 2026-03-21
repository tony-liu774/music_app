const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory user store (in production, use a database)
const users = new Map();
const refreshTokens = new Set();

const JWT_SECRET = process.env.JWT_SECRET || 'music-app-jwt-secret-dev';
const JWT_EXPIRES_IN = '1h';
const REFRESH_EXPIRES_IN = '7d';

/**
 * Generate JWT tokens
 */
function generateTokens(user) {
    const token = jwt.sign(
        { id: user.id, email: user.email },
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
 * Auth middleware - verifies JWT token
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
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
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
router.post('/login', async (req, res) => {
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
router.post('/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is required' });
        }

        if (!refreshTokens.has(refreshToken)) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const decoded = jwt.verify(refreshToken, JWT_SECRET);
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
