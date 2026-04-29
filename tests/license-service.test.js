/**
 * Tests for LicenseService - Client-side license management
 * Imports the actual source file with global mocks for localStorage and fetch
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage (set up before requiring LicenseService)
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;

// Mock fetch - configurable per test
let fetchMockFn;
global.fetch = async (...args) => fetchMockFn(...args);

function setupFetch(response, ok = true, status = 200) {
    fetchMockFn = async () => ({
        ok,
        status,
        json: async () => response
    });
}

// Now import the actual LicenseService from source
const LicenseService = require('../src/js/services/license-service');

describe('LicenseService', () => {
    let license;

    beforeEach(() => {
        localStorageMock.clear();
        license = new LicenseService('http://localhost:3000');
    });

    afterEach(() => {
        license = null;
        localStorageMock.clear();
    });

    describe('Initialization', () => {
        it('should initialize with studio tier in public mode (no license)', () => {
            // In public mode, no license is required - all features available
            assert.strictEqual(license.hasLicense(), false);
            assert.strictEqual(license.getTier(), 'studio');
        });

        it('should load cached license from localStorage and respect its tier', () => {
            const cachedLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(cachedLicense));

            const newLicense = new LicenseService('http://localhost:3000');
            newLicense.init();

            assert.strictEqual(newLicense.hasLicense(), true);
            assert.strictEqual(newLicense.getTier(), 'pro');
        });
    });

    describe('Feature Gating', () => {
        it('should allow all features in public mode', () => {
            // In public mode, all features are available without a license
            assert.strictEqual(license.hasFeature('tuner'), true);
            assert.strictEqual(license.hasFeature('metronome'), true);
            assert.strictEqual(license.hasFeature('sheetMusicRenderer'), true);
            assert.strictEqual(license.hasFeature('audioInput'), true);
            assert.strictEqual(license.hasFeature('studioDashboard'), true);
            assert.strictEqual(license.hasFeature('cloudSync'), true);
            assert.strictEqual(license.hasFeature('aiCoach'), true);
            assert.strictEqual(license.hasFeature('heatMap'), true);
            assert.strictEqual(license.hasFeature('studentInvites'), true);
            assert.strictEqual(license.hasFeature('bulkUnlocks'), true);
        });

        it('should allow pro features with pro license', () => {
            const proLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(proLicense));
            license.init();

            assert.strictEqual(license.hasFeature('studioDashboard'), true);
            assert.strictEqual(license.hasFeature('cloudSync'), true);
            assert.strictEqual(license.hasFeature('aiCoach'), true);
        });

        it('should allow studio features with studio license', () => {
            const studioLicense = {
                id: 'lic-123',
                tier: 'studio',
                type: 'one-time',
                status: 'active',
                studentLimit: 30,
                studentCount: 0
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(studioLicense));
            license.init();

            assert.strictEqual(license.hasFeature('studentInvites'), true);
            assert.strictEqual(license.hasFeature('bulkUnlocks'), true);
            assert.strictEqual(license.hasFeature('studioDashboard'), true);
        });

        it('should not allow studio features with pro license', () => {
            const proLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(proLicense));
            license.init();

            assert.strictEqual(license.hasFeature('studentInvites'), false);
            assert.strictEqual(license.hasFeature('bulkUnlocks'), false);
        });
    });

    describe('Student Management', () => {
        it('should return 30 student limit in public mode (default studio tier)', () => {
            // In public mode, all features are enabled including student invites
            assert.strictEqual(license.getStudentLimit(), 30);
        });

        it('should return 0 student limit for pro tier', () => {
            const proLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(proLicense));
            license.init();

            assert.strictEqual(license.getStudentLimit(), 0);
        });

        it('should return 30 student limit for studio tier', () => {
            const studioLicense = {
                id: 'lic-123',
                tier: 'studio',
                type: 'one-time',
                status: 'active',
                studentLimit: 30,
                studentCount: 5
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(studioLicense));
            license.init();

            assert.strictEqual(license.getStudentLimit(), 30);
            assert.strictEqual(license.getStudentCount(), 5);
        });

        it('should allow adding students in public mode (no license = studio tier)', () => {
            // In public mode, no license means studio tier, which allows students
            assert.strictEqual(license.canAddStudent(), true);
        });

        it('should allow adding students if under limit', () => {
            const studioLicense = {
                id: 'lic-123',
                tier: 'studio',
                type: 'one-time',
                status: 'active',
                studentLimit: 30,
                studentCount: 25
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(studioLicense));
            license.init();

            assert.strictEqual(license.canAddStudent(), true);
        });

        it('should not allow adding students if at limit', () => {
            const studioLicense = {
                id: 'lic-123',
                tier: 'studio',
                type: 'one-time',
                status: 'active',
                studentLimit: 30,
                studentCount: 30
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(studioLicense));
            license.init();

            assert.strictEqual(license.canAddStudent(), false);
        });
    });

    describe('License Validation', () => {
        it('should return false for null license', () => {
            assert.strictEqual(license._isLicenseValid(null), false);
        });

        it('should return false for inactive license', () => {
            const inactiveLicense = {
                id: 'lic-123',
                status: 'inactive'
            };
            assert.strictEqual(license._isLicenseValid(inactiveLicense), false);
        });

        it('should return false for expired license', () => {
            const expiredLicense = {
                id: 'lic-123',
                status: 'active',
                expiresAt: Date.now() - 86400000
            };
            assert.strictEqual(license._isLicenseValid(expiredLicense), false);
        });

        it('should return true for active non-expiring license', () => {
            const perpetualLicense = {
                id: 'lic-123',
                status: 'active',
                expiresAt: null
            };
            assert.strictEqual(license._isLicenseValid(perpetualLicense), true);
        });

        it('should return true for active non-expired license', () => {
            const validLicense = {
                id: 'lic-123',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            assert.strictEqual(license._isLicenseValid(validLicense), true);
        });
    });

    describe('API Calls', () => {
        it('should activate license successfully', async () => {
            const mockResponse = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            setupFetch(mockResponse);

            const result = await license.activateLicense('MCP-ABCD1234-EFGH5678-IJKL9012');

            assert.strictEqual(result.tier, 'pro');
            assert.strictEqual(license.hasLicense(), true);
        });

        it('should throw error for invalid license key', async () => {
            setupFetch({ error: 'Invalid license key' }, false, 400);

            await assert.rejects(
                () => license.activateLicense(''),
                { message: 'Valid license key is required' }
            );
        });

        it('should validate license without activating', async () => {
            const mockResponse = {
                valid: true,
                tier: 'pro',
                type: 'subscription',
                studentLimit: 0,
                expiresAt: Date.now() + 86400000
            };
            setupFetch(mockResponse);

            const result = await license.validateLicense('MCP-ABCD1234-EFGH5678-IJKL9012');

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.tier, 'pro');
            assert.strictEqual(license.hasLicense(), false); // Should not activate
        });

        it('should deactivate license successfully', async () => {
            // First activate a license
            const activeLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(activeLicense));
            license.init();

            setupFetch({ message: 'License deactivated successfully' });

            await license.deactivateLicense();

            assert.strictEqual(license.hasLicense(), false);
        });
    });

    describe('Plans', () => {
        it('should return available plans', () => {
            const plans = license.getPlans();

            assert.strictEqual(plans.length, 2);
            assert.strictEqual(plans[0].id, 'pro');
            assert.strictEqual(plans[0].price, 9.99);
            assert.strictEqual(plans[1].id, 'studio');
            assert.strictEqual(plans[1].price, 199.00);
            assert.strictEqual(plans[1].maxStudents, 30);
        });
    });

    describe('Feature Lists', () => {
        it('should return all features as available in public mode (no license)', () => {
            // In public mode, no license means studio tier
            license.init();

            const { available, unavailable } = license.getAvailableFeatures();

            // All features should be available in public mode (studio tier)
            assert.ok(available.length > 0);
            assert.strictEqual(unavailable.length, 0);

            // Verify all features are in available list
            const freeFeature = available.find(f => f.id === 'tuner');
            assert.ok(freeFeature);

            // Verify studio feature is available
            const studioFeature = available.find(f => f.id === 'studentInvites');
            assert.ok(studioFeature);
        });

        it('should respect tier restrictions when license is stored', () => {
            const proLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active',
                expiresAt: Date.now() + 86400000
            };
            localStorageMock.setItem('music_app_license_data', JSON.stringify(proLicense));
            license.init();

            const { available, unavailable } = license.getAvailableFeatures();

            // With pro license, studio features should be unavailable
            const studioFeatureUnavailable = unavailable.find(f => f.id === 'studentInvites');
            assert.ok(studioFeatureUnavailable);
        });
    });

    describe('Event Listeners', () => {
        it('should notify listeners on license change', () => {
            let notified = false;
            let receivedLicense = null;

            license.onLicenseChange((event, lic) => {
                notified = true;
                receivedLicense = lic;
            });

            const newLicense = {
                id: 'lic-123',
                tier: 'pro',
                status: 'active'
            };
            license._saveLicense(newLicense);

            assert.strictEqual(notified, true);
            assert.strictEqual(receivedLicense.tier, 'pro');
        });

        it('should allow unsubscribing from listeners', () => {
            let callCount = 0;
            const unsubscribe = license.onLicenseChange(() => {
                callCount++;
            });

            license._saveLicense({ id: '1', tier: 'pro', status: 'active' });
            unsubscribe();
            license._saveLicense({ id: '2', tier: 'studio', status: 'active' });

            assert.strictEqual(callCount, 1);
        });
    });
});
