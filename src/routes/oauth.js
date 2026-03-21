const express = require('express');
const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const router = express.Router();

// Re-use shared user store, token infrastructure, and rate limiter from auth.js
const { users, generateTokens, authRateLimiter } = require('./auth');

// OAuth provider client IDs (public, safe to expose)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';

const SUPPORTED_PROVIDERS = ['google', 'apple'];
const MAX_OAUTH_TOKEN_LENGTH = 4096;
const MAX_DISPLAY_NAME_LENGTH = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const HTTPS_URL_REGEX = /^https:\/\//;

// Google JWKS cache
let googleJwksCache = null;
let googleJwksCacheExpiry = 0;

/**
 * Custom error class for OAuth verification failures.
 * Allows route handlers to distinguish auth errors from unexpected errors.
 */
class OAuthVerificationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OAuthVerificationError';
    }
}

/**
 * Fetch Google's public JWKS (JSON Web Key Set) for signature verification.
 * Caches keys for 1 hour.
 * @returns {Promise<Array>} Array of JWK key objects
 */
function fetchGoogleJwks() {
    if (googleJwksCache && Date.now() < googleJwksCacheExpiry) {
        return Promise.resolve(googleJwksCache);
    }

    return new Promise((resolve, reject) => {
        https.get('https://www.googleapis.com/oauth2/v3/certs', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const jwks = JSON.parse(data);
                    googleJwksCache = jwks.keys || [];
                    googleJwksCacheExpiry = Date.now() + 3600000; // 1 hour
                    resolve(googleJwksCache);
                } catch {
                    reject(new Error('Failed to parse Google JWKS'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

// Apple JWKS cache
let appleJwksCache = null;
let appleJwksCacheExpiry = 0;

/**
 * Fetch Apple's public JWKS for signature verification.
 * Caches keys for 1 hour.
 * @returns {Promise<Array>} Array of JWK key objects
 */
function fetchAppleJwks() {
    if (appleJwksCache && Date.now() < appleJwksCacheExpiry) {
        return Promise.resolve(appleJwksCache);
    }

    return new Promise((resolve, reject) => {
        https.get('https://appleid.apple.com/auth/keys', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const jwks = JSON.parse(data);
                    appleJwksCache = jwks.keys || [];
                    appleJwksCacheExpiry = Date.now() + 3600000;
                    resolve(appleJwksCache);
                } catch {
                    reject(new Error('Failed to parse Apple JWKS'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

/**
 * Convert a JWK to a PEM public key for signature verification.
 * @param {Object} jwk - JSON Web Key
 * @returns {string} PEM-encoded public key
 */
function jwkToPem(jwk) {
    return crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({
        type: 'spki',
        format: 'pem'
    });
}

/**
 * Find the matching JWK from a JWKS set by the JWT header's `kid`.
 * @param {Array} jwks - Array of JWK objects
 * @param {string} kid - Key ID from JWT header
 * @returns {Object|null} Matching JWK or null
 */
function findJwkByKid(jwks, kid) {
    return jwks.find(key => key.kid === kid) || null;
}

/**
 * Decode a JWT header to extract the `kid` (Key ID).
 * @param {string} token - JWT string
 * @returns {Object} Decoded header
 */
function decodeJwtHeader(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new OAuthVerificationError('Malformed token');
    }
    try {
        return JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    } catch {
        throw new OAuthVerificationError('Invalid token header');
    }
}

/**
 * Validate basic token format and length.
 * @param {string} idToken
 */
function validateTokenFormat(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        throw new OAuthVerificationError('Invalid token');
    }
    if (idToken.length > MAX_OAUTH_TOKEN_LENGTH) {
        throw new OAuthVerificationError('Token too long');
    }
    const parts = idToken.split('.');
    if (parts.length !== 3) {
        throw new OAuthVerificationError('Malformed token');
    }
}

/**
 * Decode a JWT payload without signature verification (for structure validation).
 * @param {string} idToken
 * @returns {Object} Decoded payload
 */
function decodePayload(idToken) {
    const parts = idToken.split('.');
    try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch {
        throw new OAuthVerificationError('Invalid token payload');
    }
}

/**
 * Verify a Google ID token: signature, issuer, audience, expiry, claims.
 * In production, verifies against Google's JWKS public keys.
 * In test/dev without GOOGLE_CLIENT_ID, falls back to claim-only validation
 * with a NODE_ENV guard that logs a warning.
 * @param {string} idToken - Google ID token
 * @returns {Promise<Object>} Verified user info
 */
async function verifyGoogleToken(idToken) {
    validateTokenFormat(idToken);
    const payload = decodePayload(idToken);

    // Validate required claims
    if (!payload.sub || !payload.email) {
        throw new OAuthVerificationError('Token missing required claims');
    }

    // Validate issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
        throw new OAuthVerificationError('Invalid token issuer');
    }

    // Validate expiration (reject tokens without exp as a defense-in-depth measure)
    if (!payload.exp || payload.exp * 1000 < Date.now()) {
        throw new OAuthVerificationError('Token expired or missing expiration');
    }

    // Validate audience (must match our client ID)
    if (GOOGLE_CLIENT_ID) {
        if (payload.aud !== GOOGLE_CLIENT_ID) {
            throw new OAuthVerificationError('Invalid token audience');
        }
    }

    // Cryptographic signature verification
    if (GOOGLE_CLIENT_ID && config.nodeEnv === 'production') {
        const header = decodeJwtHeader(idToken);
        const jwks = await fetchGoogleJwks();
        const jwk = findJwkByKid(jwks, header.kid);
        if (!jwk) {
            throw new OAuthVerificationError('Token signing key not found');
        }
        const pem = jwkToPem(jwk);
        try {
            jwt.verify(idToken, pem, { algorithms: ['RS256'] });
        } catch {
            throw new OAuthVerificationError('Token signature verification failed');
        }
    } else if (config.nodeEnv !== 'test') {
        console.warn('[OAuth] Google token signature not verified (no GOOGLE_CLIENT_ID or non-production). Set GOOGLE_CLIENT_ID and run in production for full security.');
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
 * Verify an Apple ID token: signature, issuer, audience, expiry, claims.
 * @param {string} idToken - Apple ID token
 * @returns {Promise<Object>} Verified user info
 */
async function verifyAppleToken(idToken) {
    validateTokenFormat(idToken);
    const payload = decodePayload(idToken);

    if (!payload.sub) {
        throw new OAuthVerificationError('Token missing required claims');
    }

    // Validate issuer
    if (payload.iss !== 'https://appleid.apple.com') {
        throw new OAuthVerificationError('Invalid token issuer');
    }

    // Validate expiration (reject tokens without exp as a defense-in-depth measure)
    if (!payload.exp || payload.exp * 1000 < Date.now()) {
        throw new OAuthVerificationError('Token expired or missing expiration');
    }

    // Validate audience
    if (APPLE_CLIENT_ID) {
        if (payload.aud !== APPLE_CLIENT_ID) {
            throw new OAuthVerificationError('Invalid token audience');
        }
    }

    // Cryptographic signature verification
    if (APPLE_CLIENT_ID && config.nodeEnv === 'production') {
        const header = decodeJwtHeader(idToken);
        const jwks = await fetchAppleJwks();
        const jwk = findJwkByKid(jwks, header.kid);
        if (!jwk) {
            throw new OAuthVerificationError('Token signing key not found');
        }
        const pem = jwkToPem(jwk);
        try {
            jwt.verify(idToken, pem, { algorithms: ['RS256', 'ES256'] });
        } catch {
            throw new OAuthVerificationError('Token signature verification failed');
        }
    } else if (config.nodeEnv !== 'test') {
        console.warn('[OAuth] Apple token signature not verified (no APPLE_CLIENT_ID or non-production). Set APPLE_CLIENT_ID and run in production for full security.');
    }

    return {
        sub: payload.sub,
        email: payload.email || null,
        name: null, // Apple only provides name on first auth
        email_verified: payload.email_verified || false
    };
}

/**
 * Validate that a URL is an HTTPS URL (for photo URLs from providers).
 * @param {string} url
 * @returns {boolean}
 */
function isValidPhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return HTTPS_URL_REGEX.test(url) && url.length <= 2048;
}

/**
 * Validate and sanitize a displayName from client input.
 * @param {string} displayName
 * @returns {string|undefined} Sanitized name or undefined
 */
function sanitizeDisplayName(displayName) {
    if (displayName === undefined || displayName === null) return undefined;
    if (typeof displayName !== 'string') return undefined;
    const trimmed = displayName.trim().substring(0, MAX_DISPLAY_NAME_LENGTH);
    return trimmed || undefined;
}

/**
 * Find or create a user from OAuth provider data.
 * Handles account linking only when the provider email is verified.
 * @param {string} provider - 'google' or 'apple'
 * @param {Object} providerUser - User info from OAuth provider token
 * @param {Object} extraProfile - Additional profile data (displayName only)
 * @returns {Object} Internal user object
 */
function findOrCreateOAuthUser(provider, providerUser, extraProfile = {}) {
    // First, check if this OAuth identity is already linked to a user
    for (const user of users.values()) {
        if (user.oauthProviders && user.oauthProviders[provider] === providerUser.sub) {
            return user;
        }
    }

    // Only use verified email from the token for account linking (not client-supplied email)
    const email = providerUser.email;
    const emailVerified = providerUser.email_verified === true;

    // Account linking: only when email is verified
    if (email && emailVerified && users.has(email)) {
        const existingUser = users.get(email);
        if (!existingUser.oauthProviders) {
            existingUser.oauthProviders = {};
        }
        existingUser.oauthProviders[provider] = providerUser.sub;
        const photo = providerUser.picture;
        if (isValidPhotoUrl(photo) && !existingUser.photoUrl) {
            existingUser.photoUrl = photo;
        }
        return existingUser;
    }

    // Create a new user
    const displayName = sanitizeDisplayName(extraProfile.displayName)
        || providerUser.name
        || (email ? email.split('@')[0] : `user_${Date.now().toString(36)}`);

    const validatedPhoto = isValidPhotoUrl(providerUser.picture) ? providerUser.picture : null;

    const user = {
        id: uuidv4(),
        email: email || `${provider}:${providerUser.sub}@oauth.local`,
        displayName,
        hashedPassword: null,
        photoUrl: validatedPhoto,
        oauthProviders: { [provider]: providerUser.sub },
        createdAt: Date.now()
    };

    users.set(user.email, user);
    return user;
}

/**
 * POST /api/auth/oauth/google
 * Authenticate with a Google ID token (from Google Sign-In SDK).
 */
router.post('/google', authRateLimiter, async (req, res) => {
    try {
        const { idToken, displayName } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Google ID token is required' });
        }

        const providerUser = await verifyGoogleToken(idToken);
        const user = findOrCreateOAuthUser('google', providerUser, {
            displayName: sanitizeDisplayName(displayName)
        });
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
        if (error instanceof OAuthVerificationError) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});

/**
 * POST /api/auth/oauth/apple
 * Authenticate with an Apple ID token.
 * Apple only provides the user's name on the very first sign-in,
 * so the client forwards displayName in the body.
 * The email used for account lookup comes ONLY from the verified token,
 * never from the client request body.
 */
router.post('/apple', authRateLimiter, async (req, res) => {
    try {
        const { idToken, displayName } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'Apple ID token is required' });
        }

        const providerUser = await verifyAppleToken(idToken);
        const user = findOrCreateOAuthUser('apple', providerUser, {
            displayName: sanitizeDisplayName(displayName)
        });
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
        if (error instanceof OAuthVerificationError) {
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
router.post('/link', authRateLimiter, async (req, res) => {
    try {
        // Verify access token
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
            providerUser = await verifyGoogleToken(idToken);
        } else {
            providerUser = await verifyAppleToken(idToken);
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
        if (error instanceof OAuthVerificationError) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'Account linking failed' });
    }
});

/**
 * GET /api/auth/oauth/config
 * Return public OAuth client IDs for frontend SDK initialization.
 */
router.get('/config', (req, res) => {
    res.json({
        googleClientId: GOOGLE_CLIENT_ID,
        appleClientId: APPLE_CLIENT_ID
    });
});

module.exports = router;
module.exports.verifyGoogleToken = verifyGoogleToken;
module.exports.verifyAppleToken = verifyAppleToken;
module.exports.findOrCreateOAuthUser = findOrCreateOAuthUser;
module.exports.OAuthVerificationError = OAuthVerificationError;
module.exports.SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;
module.exports.isValidPhotoUrl = isValidPhotoUrl;
module.exports.sanitizeDisplayName = sanitizeDisplayName;
module.exports.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
module.exports.APPLE_CLIENT_ID = APPLE_CLIENT_ID;
// Expose for testing
module.exports._setGoogleJwksCache = (keys, expiry) => {
    googleJwksCache = keys;
    googleJwksCacheExpiry = expiry;
};
module.exports._setAppleJwksCache = (keys, expiry) => {
    appleJwksCache = keys;
    appleJwksCacheExpiry = expiry;
};
