/**
 * Role Selection Service - Manages user role (student/teacher) persistence and invite links.
 * App now defaults to student role in public mode.
 * Stores role in localStorage and syncs to backend when available.
 */

class RoleSelectionService {
    constructor(authService, apiBaseUrl = '') {
        this.authService = authService || null;
        this.apiBaseUrl = apiBaseUrl;
        this.roleKey = 'music_app_user_role';
        this.inviteLinkKey = 'music_app_studio_invite';
        this.roleSelectedKey = 'music_app_role_selected';

        // In public mode, default to student role if not set
        if (!this.hasSelectedRole()) {
            try {
                localStorage.setItem(this.roleKey, 'student');
                localStorage.setItem(this.roleSelectedKey, 'true');
            } catch {
                // localStorage quota exceeded - non-critical
            }
        }
    }

    /**
     * Check if the user has already selected a role.
     * @returns {boolean}
     */
    hasSelectedRole() {
        try {
            return localStorage.getItem(this.roleSelectedKey) === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Get the current user role.
     * In public mode, defaults to 'student'.
     * @returns {string|null} 'student' or 'teacher' or null
     */
    getRole() {
        try {
            return localStorage.getItem(this.roleKey) || 'student';
        } catch {
            return 'student';
        }
    }

    /**
     * Set the user role and persist it.
     * @param {string} role - 'student' or 'teacher'
     * @returns {Promise<void>}
     */
    async setRole(role) {
        if (role !== 'student' && role !== 'teacher') {
            throw new Error('Role must be "student" or "teacher"');
        }

        try {
            localStorage.setItem(this.roleKey, role);
            localStorage.setItem(this.roleSelectedKey, 'true');
        } catch {
            // localStorage quota exceeded - non-critical
        }

        // Sync to backend if authenticated (public mode doesn't have auth)
        if (this.authService && this.authService.isAuthenticated()) {
            await this._syncRoleToBackend(role);
        }

        // Generate invite link for teachers
        if (role === 'teacher') {
            this._generateInviteLink();
        }
    }

    /**
     * Check if the current user is a student.
     * @returns {boolean}
     */
    isStudent() {
        const role = this.getRole();
        return role === 'student' || !role;
    }

    /**
     * Check if the current user is a teacher.
     * @returns {boolean}
     */
    isTeacher() {
        return this.getRole() === 'teacher';
    }

    /**
     * Generate a unique studio invite link for teachers.
     * @returns {string} The invite link
     */
    _generateInviteLink() {
        const code = this._generateInviteCode();
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.concertmaster.com';
        const link = `${baseUrl}/invite/${code}`;

        try {
            localStorage.setItem(this.inviteLinkKey, link);
        } catch {
            // non-critical
        }

        return link;
    }

    /**
     * Generate a cryptographically random invite code.
     * Falls back to Math.random() if crypto API is unavailable (e.g., Node.js test env).
     * @returns {string}
     */
    _generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const len = 8;
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const values = new Uint8Array(len);
            crypto.getRandomValues(values);
            return Array.from(values, v => chars[v % chars.length]).join('');
        }
        let code = '';
        for (let i = 0; i < len; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Get the studio invite link (for teachers).
     * @returns {string|null}
     */
    getInviteLink() {
        try {
            return localStorage.getItem(this.inviteLinkKey);
        } catch {
            return null;
        }
    }

    /**
     * Sync the role to the backend API.
     * @param {string} role
     * @returns {Promise<void>}
     * @private
     */
    async _syncRoleToBackend(role) {
        try {
            const headers = await this.authService.getAuthHeaders();
            if (!headers.Authorization) return;

            const response = await fetch(`${this.apiBaseUrl}/api/auth/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({ role })
            });
            if (!response.ok) {
                console.warn(`Role sync failed with status ${response.status}`);
            }
        } catch (err) {
            console.warn('Role sync network error:', err.message || err);
        }
    }

    /**
     * Clear role data (for logout or reset).
     */
    clearRole() {
        try {
            localStorage.removeItem(this.roleKey);
            localStorage.removeItem(this.roleSelectedKey);
            localStorage.removeItem(this.inviteLinkKey);
            // In public mode, reset back to student role
            localStorage.setItem(this.roleKey, 'student');
            localStorage.setItem(this.roleSelectedKey, 'true');
        } catch {
            // non-critical
        }
    }
}

if (typeof window !== 'undefined') {
    window.RoleSelectionService = RoleSelectionService;
}
if (typeof module !== 'undefined') {
    module.exports = RoleSelectionService;
}
