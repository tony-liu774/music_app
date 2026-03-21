const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// Re-use the shared user store and token infrastructure from auth.js
const { users, generateTokens, refreshTokens } = require('./auth');

// OAuth provider configurations (read from env, with safe defaults for dev/test)
const OAUTH_PROVIDERS = {
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || ''
    },
    apple: {
        clientId: process.env.APPLE_CLIENT_ID || '',
        teamId: process.env.APPLE_TEAM_ID || '',
        keyId: process.env.APPLE_KEY_ID || '',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        redirectUri: process.env.APPLE_REDIRECT_URI || ''
    }
};

const SUPPORTED_PROVIDERS = ['google', 'apple'];
const MAX_OAUTH_TOKEN_LENGTH = 4096;
const MAX_NONCE_LENGTH = 256;

/**
 * Validate and decode a Google ID token (JWT).
 * In production, verify signature against Google's public keys.
 * For dev/test, we decode and validate basic claims.
 * @param {string} idToken - Google ID token
 * @returns {Object} Decoded user info
 */
function verifyGoogleToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        throw new Error('Invalid token');
    }
    if (idToken.length > MAX_OAUTH_TOKEN_LENGTH) {
        throw new Error('Token too long');
    }

    // Decode the JWT payload (middle segment)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed token');
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch {
        throw new Error('Invalid token payload');
    }

    // Validate required claims
    if (!payload.sub || !payload.email) {
        throw new Error('Token missing required claims');
    }

    // Validate issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
        throw new Error('Invalid token issuer');
    }

    // Validate expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
    }

    return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture || null,
        email_verified: payload.email_verified || false
    };
}

/**
 * Validate and decode an Apple ID token (JWT).
 * @param {string} idToken - Apple ID token
 * @returns {Object} Decoded user info
 */
function verifyAppleToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        throw new Error('Invalid token');
    }
    if (idToken.length > MAX_OAUTH_TOKEN_LENGTH) {
        throw new Error('Token too long');
    }

    const parts = idToken.split('.');
    if (parts.length !== 3) {
        throw new Error('Malformed token');
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch {
        throw new Error('Invalid token payload');
    }

    if (!payload.sub) {
        throw new Error('Token missing required claims');
    }

    // Validate issuer
    if (payload.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid token issuer');
    }

    // Validate expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
    }

    return {
        sub: payload.sub,
        email: payload.email || null,
        name: null, // Apple only provides name on first auth
        email_verified: payload.email_verified || false
    };
}

/**
 * Find or create a user from OAuth provider data.
 * Handles account linking when email matches an existing user.
 * @param {string} provider - 'google' or 'apple'
 * @param {Object} providerUser - User info from OAuth provider
 * @param {Object} extraProfile - Additional profile data from client
 * @returns {Object} Internal user object
 */
function findOrCreateOAuthUser(provider, providerUser, extraProfile = {}) {
    const providerId = `${provider}:${providerUser.sub}`;

    // First, check if this OAuth identity is already linked to a user
    for (const user of users.values()) {
        if (user.oauthProviders && user.oauthProviders[provider] === providerUser.sub) {
            return user;
        }
    }

    // Check if a user with the same email exists (account linking)
    const email = providerUser.email || extraProfile.email;
    if (email && users.has(email)) {
        const existingUser = users.get(email);
        // Link the OAuth provider to the existing account
        if (!existingUser.oauthProviders) {
            existingUser.oauthProviders = {};
        }
        existingUser.oauthProviders[provider] = providerUser.sub;
        if (providerUser.picture && !existingUser.photoUrl) {
            existingUser.photoUrl = providerUser.picture;
        }
        return existingUser;
    }

    // Create a new user
    const displayName = extraProfile.displayName
        || providerUser.name
        || (email ? email.split('@')[0] : `user_${Date.now().toString(36)}`);

    const user = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
        email: email || `${providerId}@oauth.local`,
        displayName,
        hashedPassword: null, // OAuth users have no password
        photoUrl: providerUser.picture || null,
        oauthProviders: { [provider]: providerUser.sub },
        createdAt: Date.now()
    };

    users.set(user.email, user);
    return user;
}

/**
 * POST /api/auth/oauth/google
 * Authenticate with a Google ID token (from Google Sign-In SDK).
 * The client sends the idToken obtained from Google's sign-in flow.
 */
router.post('/google', (req, res) => {
    try {
        const { idToken, displayName } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Google ID token is required' });
        }

        const providerUser = verifyGoogleToken(idToken);
        const user = findOrCreateOAuthUser('google', providerUser, { displayName });
        const tokens = generateTokens(user);

        res.json({
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoUrl: user.photoUrl,
                provider: 'google'
            }
        });
    } catch (error) {
        if (error.message.includes('token') || error.message.includes('Token') || error.message.includes('issuer') || error.message.includes('claims')) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});

/**
 * POST /api/auth/oauth/apple
 * Authenticate with an Apple ID token (from Sign in with Apple SDK).
 * Apple only provides user's name on the very first sign-in, so
 * the client must forward it in the request body.
 */
router.post('/apple', (req, res) => {
    try {
        const { idToken, displayName, email } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Apple ID token is required' });
        }

        const providerUser = verifyAppleToken(idToken);
        const user = findOrCreateOAuthUser('apple', providerUser, { displayName, email });
        const tokens = generateTokens(user);

        res.json({
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoUrl: user.photoUrl,
                provider: 'apple'
            }
        });
    } catch (error) {
        if (error.message.includes('token') || error.message.includes('Token') || error.message.includes('issuer') || error.message.includes('claims')) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});

/**
 * POST /api/auth/oauth/link
 * Link an additional OAuth provider to an existing authenticated user.
 * Requires a valid access token in the Authorization header.
 */
router.post('/link', (req, res) => {
    try {
        const { authMiddleware } = require('./auth');

        // Manually invoke auth middleware
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, config.jwt.secret);
            if (decoded.type === 'refresh') {
                return res.status(401).json({ error: 'Invalid token type' });
            }
        } catch {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const { provider, idToken } = req.body;

        if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
            return res.status(400).json({ error: 'Unsupported provider. Supported: google, apple' });
        }
        if (!idToken) {
            return res.status(400).json({ error: 'ID token is required' });
        }

        // Verify the provider token
        let providerUser;
        if (provider === 'google') {
            providerUser = verifyGoogleToken(idToken);
        } else {
            providerUser = verifyAppleToken(idToken);
        }

        // Find the current user
        let currentUser = null;
        for (const user of users.values()) {
            if (user.id === decoded.id) {
                currentUser = user;
                break;
            }
        }

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if this OAuth identity is already linked to another user
        for (const user of users.values()) {
            if (user.id !== currentUser.id &&
                user.oauthProviders &&
                user.oauthProviders[provider] === providerUser.sub) {
                return res.status(409).json({ error: 'This account is already linked to another user' });
            }
        }

        // Link the provider
        if (!currentUser.oauthProviders) {
            currentUser.oauthProviders = {};
        }
        currentUser.oauthProviders[provider] = providerUser.sub;

        res.json({
            message: `${provider} account linked successfully`,
            providers: Object.keys(currentUser.oauthProviders)
        });
    } catch (error) {
        res.status(500).json({ error: 'Account linking failed' });
    }
});

module.exports = router;
module.exports.verifyGoogleToken = verifyGoogleToken;
module.exports.verifyAppleToken = verifyAppleToken;
module.exports.findOrCreateOAuthUser = findOrCreateOAuthUser;
module.exports.OAUTH_PROVIDERS = OAUTH_PROVIDERS;
module.exports.SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;
