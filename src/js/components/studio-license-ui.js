/**
 * Studio License UI - License management and student invitation component
 * Provides UI for license activation, feature display, and student management
 */

class StudioLicenseUI {
    constructor(licenseService, authService) {
        this.licenseService = licenseService;
        this.authService = authService;
        this.container = null;
    }

    /**
     * Initialize the license UI
     */
    async init() {
        this.container = document.getElementById('license-view');
        if (!this.container) return;

        await this.licenseService.init();
        this.render();
        this.bindEvents();

        // Listen for license changes
        this.licenseService.onLicenseChange((event, license) => {
            this.render();
        });
    }

    /**
     * Render the license UI
     */
    render() {
        if (!this.container) return;

        const hasLicense = this.licenseService.hasLicense();
        const tier = this.licenseService.getTier();
        const license = this.licenseService.getLicense();

        let content = '';

        if (!hasLicense) {
            content = this._renderUpgradePrompt();
        } else {
            content = this._renderLicenseDashboard(license, tier);
        }

        const contentContainer = this.container.querySelector('.license-content');
        if (contentContainer) {
            contentContainer.innerHTML = content;
        }

        this._bindDynamicEvents();
    }

    /**
     * Render the upgrade prompt for free users
     */
    _renderUpgradePrompt() {
        const plans = this.licenseService.getPlans();

        const planCards = plans.map(plan => this._renderPlanCard(plan)).join('');

        return `
            <div class="license-upgrade">
                <div class="license-header">
                    <h2>Unlock Midnight Conservatory Pro</h2>
                    <p>Elevate your practice with premium features</p>
                </div>
                ${planCards}
                <div class="license-activation">
                    <h3>Already have a license key?</h3>
                    <div class="activation-form">
                        <input type="text" id="license-key-input" placeholder="Enter license key (e.g., MCP-XXXX-XXXX-XXXX)"
                               class="license-key-input" aria-label="License key">
                        <button class="btn btn-primary" id="activate-license-btn">
                            Activate
                        </button>
                    </div>
                    <p class="activation-error" id="activation-error" style="display: none;"></p>
                </div>
            </div>
        `;
    }

    /**
     * Render a plan card
     */
    _renderPlanCard(plan) {
        const isStudio = plan.id === 'studio';
        const badge = isStudio ? '<span class="plan-badge">Best Value</span>' : '';
        const studentInfo = isStudio ? `<p class="plan-students">Up to ${plan.maxStudents} students</p>` : '';

        return `
            <div class="plan-card ${plan.id}">
                ${badge}
                <h3 class="plan-name">${plan.name}</h3>
                <div class="plan-price">
                    <span class="price-amount">$${plan.price.toFixed(2)}</span>
                    <span class="price-interval">${plan.interval === 'one-time' ? 'one-time' : '/month'}</span>
                </div>
                ${studentInfo}
                <p class="plan-description">${plan.description}</p>
                <ul class="plan-features">
                    ${plan.features.map(f => {
                        const feature = this.licenseService.features[f];
                        return feature ? `<li><span class="feature-check">✓</span> ${feature.name}</li>` : '';
                    }).join('')}
                </ul>
                <button class="btn btn-${isStudio ? 'primary' : 'secondary'} plan-cta" data-plan="${plan.id}">
                    ${isStudio ? 'Get Studio License' : 'Get Pro'}
                </button>
            </div>
        `;
    }

    /**
     * Render the license dashboard for active users
     */
    _renderLicenseDashboard(license, tier) {
        const tierInfo = this.licenseService.tiers[tier];
        const features = this.licenseService.getAvailableFeatures();
        const studentLimit = this.licenseService.getStudentLimit();
        const studentCount = this.licenseService.getStudentCount();

        return `
            <div class="license-dashboard">
                <div class="license-status-card">
                    <div class="status-header">
                        <span class="status-badge ${tier}">${tierInfo.name}</span>
                        <span class="status-active">Active</span>
                    </div>
                    <div class="license-details">
                        <p class="license-type">${license.type === 'one-time' ? 'One-time license' : 'Monthly subscription'}</p>
                        ${license.expiresAt ? `<p class="license-expiry">Expires: ${this._formatDate(license.expiresAt)}</p>` : '<p class="license-expiry">Never expires</p>'}
                    </div>
                    ${tier === 'studio' ? this._renderStudentSection(studentCount, studentLimit) : ''}
                </div>

                <div class="features-section">
                    <h3>Your Features</h3>
                    <div class="features-grid">
                        ${features.available.map(f => this._renderFeatureItem(f, true)).join('')}
                        ${features.unavailable.map(f => this._renderFeatureItem(f, false)).join('')}
                    </div>
                </div>

                <div class="license-actions">
                    <button class="btn btn-secondary" id="deactivate-license-btn">
                        Deactivate License
                    </button>
                    ${license.type === 'subscription' ? `
                        <button class="btn btn-secondary" id="renew-license-btn">
                            Renew Subscription
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render student management section for studio licenses
     */
    _renderStudentSection(studentCount, studentLimit) {
        const canAdd = this.licenseService.canAddStudent();

        return `
            <div class="student-section">
                <div class="student-header">
                    <h4>Student Management</h4>
                    <span class="student-count">${studentCount} / ${studentLimit} students</span>
                </div>
                <div class="student-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(studentCount / studentLimit) * 100}%"></div>
                    </div>
                </div>
                <div class="student-actions">
                    <button class="btn btn-primary btn-small" id="invite-student-btn" ${!canAdd ? 'disabled' : ''}>
                        Invite Student
                    </button>
                    <button class="btn btn-secondary btn-small" id="generate-invite-link-btn" ${!canAdd ? 'disabled' : ''}>
                        Generate Link
                    </button>
                </div>
                ${!canAdd ? '<p class="student-limit-warning">Student limit reached</p>' : ''}
            </div>
        `;
    }

    /**
     * Render a feature item
     */
    _renderFeatureItem(feature, available) {
        return `
            <div class="feature-item ${available ? 'available' : 'locked'}">
                <span class="feature-icon">${available ? '✓' : '🔒'}</span>
                <div class="feature-info">
                    <span class="feature-name">${feature.name}</span>
                    <span class="feature-tier">${feature.tier}</span>
                </div>
            </div>
        `;
    }

    /**
     * Bind static event listeners
     */
    bindEvents() {
        // License activation
        const activateBtn = document.getElementById('activate-license-btn');
        if (activateBtn) {
            activateBtn.addEventListener('click', () => this._handleActivateLicense());
        }

        // License key input - enter key
        const keyInput = document.getElementById('license-key-input');
        if (keyInput) {
            keyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this._handleActivateLicense();
                }
            });
        }

        // Plan CTAs
        document.querySelectorAll('.plan-cta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.target.dataset.plan;
                this._handlePlanSelect(planId);
            });
        });
    }

    /**
     * Bind events for dynamically rendered content
     */
    _bindDynamicEvents() {
        // Deactivate license
        const deactivateBtn = document.getElementById('deactivate-license-btn');
        if (deactivateBtn) {
            deactivateBtn.addEventListener('click', () => this._handleDeactivateLicense());
        }

        // Renew license
        const renewBtn = document.getElementById('renew-license-btn');
        if (renewBtn) {
            renewBtn.addEventListener('click', () => this._handleRenewLicense());
        }

        // Invite student
        const inviteBtn = document.getElementById('invite-student-btn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => this._showInviteStudentModal());
        }

        // Generate invite link
        const linkBtn = document.getElementById('generate-invite-link-btn');
        if (linkBtn) {
            linkBtn.addEventListener('click', () => this._handleGenerateInviteLink());
        }

        // Re-bind plan CTAs
        document.querySelectorAll('.plan-cta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const planId = e.target.dataset.plan;
                this._handlePlanSelect(planId);
            });
        });
    }

    /**
     * Handle license activation
     */
    async _handleActivateLicense() {
        const input = document.getElementById('license-key-input');
        const errorEl = document.getElementById('activation-error');
        const activateBtn = document.getElementById('activate-license-btn');

        if (!input || !input.value.trim()) {
            this._showError('Please enter a license key');
            return;
        }

        // Disable button during activation
        if (activateBtn) activateBtn.disabled = true;
        this._hideError();

        try {
            await this.licenseService.activateLicense(input.value.trim());
            this._showSuccess('License activated successfully!');
            input.value = '';
            this.render();
        } catch (error) {
            this._showError(error.message || 'Failed to activate license');
        } finally {
            if (activateBtn) activateBtn.disabled = false;
        }
    }

    /**
     * Handle license deactivation
     */
    async _handleDeactivateLicense() {
        if (!confirm('Are you sure you want to deactivate your license? You will lose access to premium features.')) {
            return;
        }

        try {
            await this.licenseService.deactivateLicense();
            this._showSuccess('License deactivated successfully');
            this.render();
        } catch (error) {
            alert(error.message || 'Failed to deactivate license');
        }
    }

    /**
     * Handle license renewal
     */
    async _handleRenewLicense() {
        try {
            const renewalInfo = await this.licenseService.getRenewalInfo();
            if (renewalInfo && renewalInfo.renewalUrl) {
                // In production, redirect to Stripe checkout
                alert(`Renewal price: $${renewalInfo.renewalPrice}/month\n\n(This would redirect to Stripe in production)`);
            }
        } catch (error) {
            alert(error.message || 'Failed to get renewal info');
        }
    }

    /**
     * Handle plan selection (would integrate with Stripe in production)
     */
    _handlePlanSelect(planId) {
        const plans = this.licenseService.getPlans();
        const plan = plans.find(p => p.id === planId);

        if (!plan) return;

        alert(`Plan: ${plan.name}\nPrice: $${plan.price.toFixed(2)} ${plan.interval === 'one-time' ? 'one-time' : '/month'}\n\n(This would redirect to Stripe checkout in production)`);
    }

    /**
     * Show invite student modal
     */
    _showInviteStudentModal() {
        const email = prompt('Enter student email address:');
        if (!email) return;

        this._handleInviteStudent(email);
    }

    /**
     * Handle student invitation
     */
    async _handleInviteStudent(email) {
        try {
            const result = await this.licenseService.generateStudentKey(email);
            alert(`Student invitation sent!\n\nStudent key: ${result.studentKey}\n\nShare this key with ${email} to activate their access.`);
            this.render();
        } catch (error) {
            alert(error.message || 'Failed to invite student');
        }
    }

    /**
     * Handle invite link generation
     */
    async _handleGenerateInviteLink() {
        try {
            const inviteLink = await this.licenseService.generateInviteLink();
            await navigator.clipboard.writeText(inviteLink);
            alert(`Invitation link copied to clipboard!\n\n${inviteLink}\n\nShare this link with your students.`);
        } catch (error) {
            alert(error.message || 'Failed to generate invite link');
        }
    }

    /**
     * Show error message
     */
    _showError(message) {
        const errorEl = document.getElementById('activation-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Hide error message
     */
    _hideError() {
        const errorEl = document.getElementById('activation-error');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    /**
     * Show success message (temporary)
     */
    _showSuccess(message) {
        // Could use a toast notification here
        console.log(message);
    }

    /**
     * Format date for display
     */
    _formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudioLicenseUI;
} else if (typeof window !== 'undefined') {
    window.StudioLicenseUI = StudioLicenseUI;
}
