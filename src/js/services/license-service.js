/**
 * License Service - Client-side license and subscription management
 * Handles license key validation, feature gating, and studio license operations
 * Integrates with the backend license API
 */

class LicenseService {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl;
        this.licenseKey = 'music_app_license';
        this.licenseDataKey = 'music_app_license_data';
        this.listeners = [];
        this._cachedLicense = null;

        // Feature definitions
        this.features = {
            // Free tier features
            'tuner': { name: 'Precision Tuner', tier: 'free', description: 'Real-time tuning with visual feedback' },
            'metronome': { name: 'Metronome', tier: 'free', description: 'Built-in metronome with adjustable tempo' },
            'sheetMusicRenderer': { name: 'Sheet Music Display', tier: 'free', description: 'View digital sheet music' },
            'audioInput': { name: 'Audio Input', tier: 'free', description: 'Microphone input for pitch detection' },

            // Pro tier features (require license)
            'studioDashboard': { name: 'Studio Dashboard', tier: 'pro', description: 'Teacher portal for student management' },
            'cloudSync': { name: 'Cloud Sync', tier: 'pro', description: 'Cross-device data synchronization' },
            'aiCoach': { name: 'AI Coach', tier: 'pro', description: 'AI-powered performance feedback' },
            'heatMap': { name: 'Practice Heat Map', tier: 'pro', description: 'Visual practice analytics' },
            'omrScanner': { name: 'OMR Scanner', tier: 'pro', description: 'Scan sheet music from images' },
            'communityLibrary': { name: 'Community Library', tier: 'pro', description: 'Access shared sheet music' },
            'scaleEngine': { name: 'Scale Engine', tier: 'pro', description: 'Procedural scale generation' },
            'annotations': { name: 'Score Annotations', tier: 'pro', description: 'Add notes and annotations to scores' },
            'studentInvites': { name: 'Student Invitations', tier: 'studio', description: 'Invite up to 30 students' },
            'bulkUnlocks': { name: 'Bulk Unlocks', tier: 'studio', description: 'Unlock features for multiple users' },
            'teacherReports': { name: 'Teacher Reports', tier: 'pro', description: 'Generate PDF reports' },
            'videoSnippets': { name: 'Video Snippets', tier: 'pro', description: 'Record and share practice videos' },
            'bluetoothPedal': { name: 'Bluetooth Pedal', tier: 'pro', description: 'AirTurn pedal integration' },
            'advancedDSP': { name: 'Advanced DSP', tier: 'pro', description: 'Articulation and dynamics detection' }
        };

        // License tiers
        this.tiers = {
            free: { maxStudents: 0, name: 'Free', price: 0 },
            pro: { maxStudents: 0, name: 'Pro', price: 9.99 },
            studio: { maxStudents: 30, name: 'Studio', price: 199.00 }
        };
    }

    /**
     * Initialize the license service and load cached license
     */
    init() {
        this._loadCachedLicense();
        return this;
    }

    /**
     * Load cached license from localStorage
     * @private
     */
    _loadCachedLicense() {
        try {
            const data = localStorage.getItem(this.licenseDataKey);
            if (data) {
                this._cachedLicense = JSON.parse(data);
            }
        } catch {
            this._cachedLicense = null;
        }
    }

    /**
     * Save license to localStorage
     * @private
     */
    _saveLicense(license) {
        this._cachedLicense = license;
        if (license) {
            localStorage.setItem(this.licenseDataKey, JSON.stringify(license));
        } else {
            localStorage.removeItem(this.licenseDataKey);
        }
        this._notifyListeners('licenseChanged', license);
    }

    /**
     * Get the current license status
     * @returns {Object|null} License data or null
     */
    getLicense() {
        return this._cachedLicense;
    }

    /**
     * Check if user has a valid license
     * @returns {boolean}
     */
    hasLicense() {
        if (!this._cachedLicense) return false;
        return this._isLicenseValid(this._cachedLicense);
    }

    /**
     * Check if license is valid and not expired
     * @param {Object} license
     * @returns {boolean}
     * @private
     */
    _isLicenseValid(license) {
        if (!license) return false;
        if (license.status !== 'active') return false;
        if (license.expiresAt && license.expiresAt < Date.now()) return false;
        return true;
    }

    /**
     * Get the current license tier
     * @returns {string} 'free', 'pro', or 'studio'
     */
    getTier() {
        if (!this.hasLicense()) return 'free';
        return this._cachedLicense.tier || 'free';
    }

    /**
     * Check if a specific feature is available
     * @param {string} featureId - Feature identifier
     * @returns {boolean}
     */
    hasFeature(featureId) {
        const feature = this.features[featureId];
        if (!feature) return false;

        // Free features are always available
        if (feature.tier === 'free') return true;

        // Pro and studio features require a license
        if (!this.hasLicense()) return false;

        // Check tier requirements
        if (feature.tier === 'pro') {
            return this.getTier() === 'pro' || this.getTier() === 'studio';
        }

        if (feature.tier === 'studio') {
            return this.getTier() === 'studio';
        }

        return false;
    }

    /**
     * Get all available features for current tier
     * @returns {Object} Features grouped by availability
     */
    getAvailableFeatures() {
        const available = [];
        const unavailable = [];

        for (const [id, feature] of Object.entries(this.features)) {
            if (this.hasFeature(id)) {
                available.push({ id, ...feature });
            } else {
                unavailable.push({ id, ...feature });
            }
        }

        return { available, unavailable };
    }

    /**
     * Get student limit for current tier
     * @returns {number} Maximum number of students allowed
     */
    getStudentLimit() {
        const tier = this.getTier();
        return this.tiers[tier]?.maxStudents || 0;
    }

    /**
     * Get current student count (for studio licenses)
     * @returns {number}
     */
    getStudentCount() {
        if (!this._cachedLicense || !this._cachedLicense.studentCount) return 0;
        return this._cachedLicense.studentCount;
    }

    /**
     * Check if can add more students (for studio tier)
     * @returns {boolean}
     */
    canAddStudent() {
        const limit = this.getStudentLimit();
        if (limit <= 0) return false;
        return this.getStudentCount() < limit;
    }

    /**
     * Activate a license key
     * @param {string} licenseKey - License key to activate
     * @returns {Promise<Object>} License data
     */
    async activateLicense(licenseKey) {
        if (!licenseKey || typeof licenseKey !== 'string') {
            throw new Error('Valid license key is required');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: licenseKey.trim() })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'License activation failed');
        }

        const license = await response.json();
        this._saveLicense(license);
        return license;
    }

    /**
     * Validate a license key without activating
     * @param {string} licenseKey - License key to validate
     * @returns {Promise<Object>} License info (without activating)
     */
    async validateLicense(licenseKey) {
        if (!licenseKey || typeof licenseKey !== 'string') {
            throw new Error('Valid license key is required');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: licenseKey.trim() })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'License validation failed');
        }

        return response.json();
    }

    /**
     * Deactivate the current license
     * @returns {Promise<void>}
     */
    async deactivateLicense() {
        if (!this._cachedLicense || !this._cachedLicense.id) {
            throw new Error('No active license to deactivate');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/deactivate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            },
            body: JSON.stringify({ licenseId: this._cachedLicense.id })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'License deactivation failed');
        }

        this._saveLicense(null);
    }

    /**
     * Check license status with server
     * @returns {Promise<Object>} Current license status
     */
    async checkLicenseStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/licenses/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
                }
            });

            if (!response.ok) {
                // If unauthorized or error, keep using cached license
                return this._cachedLicense;
            }

            const license = await response.json();
            if (license && this._isLicenseValid(license)) {
                this._saveLicense(license);
            } else if (license && !this._isLicenseValid(license)) {
                // License expired or invalid, clear it
                this._saveLicense(null);
            }
            return license;
        } catch {
            // On network error, return cached license
            return this._cachedLicense;
        }
    }

    /**
     * Get available studio license plans
     * @returns {Array} Available plans
     */
    getPlans() {
        return [
            {
                id: 'pro',
                name: 'Midnight Conservatory Pro',
                price: this.tiers.pro.price,
                interval: 'month',
                features: ['studioDashboard', 'cloudSync', 'aiCoach', 'heatMap', 'omrScanner',
                          'communityLibrary', 'scaleEngine', 'annotations', 'teacherReports',
                          'videoSnippets', 'bluetoothPedal', 'advancedDSP'],
                description: 'All premium features for individual musicians'
            },
            {
                id: 'studio',
                name: 'Midnight Conservatory Studio',
                price: this.tiers.studio.price,
                interval: 'one-time',
                maxStudents: this.tiers.studio.maxStudents,
                features: ['studioDashboard', 'cloudSync', 'aiCoach', 'heatMap', 'omrScanner',
                          'communityLibrary', 'scaleEngine', 'annotations', 'teacherReports',
                          'videoSnippets', 'bluetoothPedal', 'advancedDSP', 'studentInvites', 'bulkUnlocks'],
                description: 'One-time license for teachers - up to 30 student accounts'
            }
        ];
    }

    /**
     * Subscribe to license changes
     * @param {Function} callback - Called with (event, license)
     * @returns {Function} Unsubscribe function
     */
    onLicenseChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Notify listeners of license changes
     * @param {string} event
     * @param {Object|null} license
     * @private
     */
    _notifyListeners(event, license) {
        this.listeners.forEach(cb => cb(event, license));
    }

    /**
     * Generate a license key (for studio license holders to distribute)
     * Note: This is a client-side helper; actual key generation happens server-side
     * @param {string} studentEmail - Email of the student to generate key for
     * @returns {Promise<Object>} Generated unlock key
     */
    async generateStudentKey(studentEmail) {
        if (!this.hasFeature('studentInvites')) {
            throw new Error('Student invitation feature not available');
        }

        if (!this.canAddStudent()) {
            throw new Error(`Student limit reached (${this.getStudentLimit()} students)`);
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/generate-student-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            },
            body: JSON.stringify({ studentEmail })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate student key');
        }

        return response.json();
    }

    /**
     * Get all invited students for this studio license
     * @returns {Promise<Array>} List of invited students
     */
    async getInvitedStudents() {
        if (!this.hasFeature('studentInvites')) {
            throw new Error('Student invitation feature not available');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/students`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get students');
        }

        return response.json();
    }

    /**
     * Remove a student from the studio license
     * @param {string} studentId - ID of the student to remove
     * @returns {Promise<void>}
     */
    async removeStudent(studentId) {
        if (!this.hasFeature('studentInvites')) {
            throw new Error('Student invitation feature not available');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/students/${studentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove student');
        }

        // Update local cache
        if (this._cachedLicense) {
            this._cachedLicense.studentCount = Math.max(0, (this._cachedLicense.studentCount || 1) - 1);
            this._saveLicense(this._cachedLicense);
        }
    }

    /**
     * Generate an invitation link for students
     * @returns {Promise<string>} Invitation link
     */
    async generateInviteLink() {
        if (!this.hasFeature('studentInvites')) {
            throw new Error('Student invitation feature not available');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/invite-link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate invite link');
        }

        const result = await response.json();
        return result.inviteLink;
    }

    /**
     * Check if current user was invited by a studio license holder
     * @returns {Promise<Object|null>} Invitation data if invited
     */
    async checkInvitation() {
        const response = await fetch(`${this.apiBaseUrl}/api/licenses/check-invitation`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            }
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    }

    /**
     * Accept an invitation from a studio teacher
     * @param {string} invitationToken - Invitation token
     * @returns {Promise<Object>} Updated license info
     */
    async acceptInvitation(invitationToken) {
        const response = await fetch(`${this.apiBaseUrl}/api/licenses/accept-invitation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            },
            body: JSON.stringify({ invitationToken })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept invitation');
        }

        return response.json();
    }

    /**
     * Get renewal information for current license
     * @returns {Promise<Object|null>} Renewal info
     */
    async getRenewalInfo() {
        if (!this._cachedLicense || !this._cachedLicense.id) {
            return null;
        }

        const response = await fetch(`${this.apiBaseUrl}/api/licenses/${this._cachedLicense.id}/renewal`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('music_app_auth_token')}`
            }
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LicenseService;
} else if (typeof window !== 'undefined') {
    window.LicenseService = LicenseService;
}
