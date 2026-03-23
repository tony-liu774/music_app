/**
 * Assignment API Client - Connects frontend to backend API routes
 * Used for server-side persistence and push notification integration
 */

/**
 * Get the user ID from localStorage
 */
function getUserId() {
    return localStorage.getItem('user_id') || 'anonymous';
}

class AssignmentAPIClient {
    constructor(baseUrl = '/api/assignments') {
        this.baseUrl = baseUrl;
    }

    /**
     * Make an authenticated API request
     */
    async _request(method, endpoint, data = null) {
        const headers = {
            'Content-Type': 'application/json',
            'X-User-Id': getUserId()
        };

        const options = {
            method,
            headers
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    // ============================================
    // Student Links
    // ============================================

    /**
     * Link a student to a teacher
     */
    async linkStudent(studentId, studentEmail = '', studentName = '') {
        return this._request('POST', '/link', { studentId, studentEmail, studentName });
    }

    /**
     * Get all students linked to a teacher
     */
    async getTeacherStudents() {
        return this._request('GET', '/students');
    }

    /**
     * Remove a student link
     */
    async removeStudentLink(linkId) {
        return this._request('DELETE', `/link/${linkId}`);
    }

    // ============================================
    // Assignments
    // ============================================

    /**
     * Get assignments (filtered by user role via headers)
     */
    async getAssignments(options = {}) {
        const query = new URLSearchParams(options).toString();
        return this._request('GET', query ? `?${query}` : '');
    }

    /**
     * Get a single assignment
     */
    async getAssignment(id) {
        return this._request('GET', `/${id}`);
    }

    /**
     * Create a new assignment
     */
    async createAssignment(assignment) {
        return this._request('POST', '', assignment);
    }

    /**
     * Update an assignment
     */
    async updateAssignment(id, updates) {
        return this._request('PUT', `/${id}`, updates);
    }

    /**
     * Delete an assignment
     */
    async deleteAssignment(id) {
        return this._request('DELETE', `/${id}`);
    }

    // ============================================
    // Progress Tracking
    // ============================================

    /**
     * Record progress for an assignment
     */
    async recordProgress(assignmentId, progress) {
        return this._request('POST', `/${assignmentId}/progress`, progress);
    }

    /**
     * Get progress history for an assignment
     */
    async getAssignmentProgress(assignmentId) {
        return this._request('GET', `/${assignmentId}/progress`);
    }

    // ============================================
    // Statistics
    // ============================================

    /**
     * Get assignment statistics
     */
    async getStats() {
        return this._request('GET', '/stats/summary');
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssignmentAPIClient;
} else if (typeof window !== 'undefined') {
    window.AssignmentAPIClient = AssignmentAPIClient;
}
