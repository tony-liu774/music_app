/**
 * Tests for RoleSelectionUI - Role selection component
 * Uses Jest's jsdom environment (configured in jest.config.js)
 */

// Mock RoleSelectionService
class MockRoleSelectionService {
    constructor() {
        this._role = null;
        this._hasSelected = false;
        this._inviteLink = null;
    }
    hasSelectedRole() { return this._hasSelected; }
    getRole() { return this._role; }
    async setRole(role) {
        this._role = role;
        this._hasSelected = true;
        if (role === 'teacher') {
            this._inviteLink = 'https://app.concertmaster.com/invite/ABC12345';
        }
    }
    getInviteLink() { return this._inviteLink; }
    isStudent() { return this._role === 'student'; }
    isTeacher() { return this._role === 'teacher'; }
    clearRole() {
        this._role = null;
        this._hasSelected = false;
        this._inviteLink = null;
    }
}

const RoleSelectionUI = require('../src/js/components/role-selection-ui');

describe('RoleSelectionUI', () => {
    let roleService, ui;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="role-selection-screen" class="role-selection-screen" aria-hidden="true"></div>
        `;
        roleService = new MockRoleSelectionService();
    });

    afterEach(() => {
        if (ui) ui.destroy();
        document.body.innerHTML = '';
    });

    test('constructor requires RoleSelectionService', () => {
        expect(() => new RoleSelectionUI(null)).toThrow('RoleSelectionService is required');
    });

    test('init renders the role selection screen with two role cards', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        expect(document.getElementById('role-student-card')).toBeTruthy();
        expect(document.getElementById('role-teacher-card')).toBeTruthy();
        expect(document.getElementById('role-skip-btn')).toBeTruthy();
    });

    test('init renders header with title and subtitle', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        const title = document.querySelector('.role-selection-title');
        expect(title).toBeTruthy();
        expect(title.textContent).toContain('Welcome to The Virtual Concertmaster');

        const subtitle = document.querySelector('.role-selection-subtitle');
        expect(subtitle).toBeTruthy();
        expect(subtitle.textContent).toContain('Tell us about yourself');
    });

    test('student card contains correct text', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        const card = document.getElementById('role-student-card');
        expect(card.textContent).toContain('I am a Musician / Student');
        expect(card.textContent).toContain('Practice with real-time feedback');
    });

    test('teacher card contains correct text', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        const card = document.getElementById('role-teacher-card');
        expect(card.textContent).toContain('I am an Educator');
        expect(card.textContent).toContain('Manage your studio');
    });

    test('show makes the screen visible', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        const container = document.getElementById('role-selection-screen');
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.getAttribute('aria-hidden')).toBe('false');
    });

    test('hide makes the screen invisible', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();
        ui.hide();

        const container = document.getElementById('role-selection-screen');
        expect(container.classList.contains('visible')).toBe(false);
        expect(container.getAttribute('aria-hidden')).toBe('true');
    });

    test('clicking student card sets role and fires callback', async () => {
        let selectedRole = null;
        let selectedInviteLink = 'not-called';

        ui = new RoleSelectionUI(roleService);
        ui.init({
            onRoleSelected: (role, inviteLink) => {
                selectedRole = role;
                selectedInviteLink = inviteLink;
            }
        });
        ui.show();

        document.getElementById('role-student-card').click();
        await new Promise(r => setTimeout(r, 50));

        expect(selectedRole).toBe('student');
        expect(selectedInviteLink).toBe(null);
        expect(roleService.getRole()).toBe('student');
        expect(document.getElementById('role-selection-screen').classList.contains('visible')).toBe(false);
    });

    test('clicking teacher card sets role and returns invite link', async () => {
        let selectedRole = null;
        let selectedInviteLink = null;

        ui = new RoleSelectionUI(roleService);
        ui.init({
            onRoleSelected: (role, inviteLink) => {
                selectedRole = role;
                selectedInviteLink = inviteLink;
            }
        });
        ui.show();

        document.getElementById('role-teacher-card').click();
        await new Promise(r => setTimeout(r, 50));

        expect(selectedRole).toBe('teacher');
        expect(selectedInviteLink).toBe('https://app.concertmaster.com/invite/ABC12345');
        expect(roleService.getRole()).toBe('teacher');
    });

    test('clicking skip button fires callback with "skip"', () => {
        let selectedRole = null;

        ui = new RoleSelectionUI(roleService);
        ui.init({
            onRoleSelected: (role) => { selectedRole = role; }
        });
        ui.show();

        document.getElementById('role-skip-btn').click();

        expect(selectedRole).toBe('skip');
        expect(document.getElementById('role-selection-screen').classList.contains('visible')).toBe(false);
    });

    test('clicking a card adds selected class', async () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        const studentCard = document.getElementById('role-student-card');
        studentCard.click();
        await new Promise(r => setTimeout(r, 50));

        expect(studentCard.classList.contains('selected')).toBe(true);
    });

    test('clicking teacher card removes selected from student card', async () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        // The selected class would be on whichever card is clicked
        const teacherCard = document.getElementById('role-teacher-card');
        const studentCard = document.getElementById('role-student-card');

        teacherCard.click();
        await new Promise(r => setTimeout(r, 50));

        expect(teacherCard.classList.contains('selected')).toBe(true);
        expect(studentCard.classList.contains('selected')).toBe(false);
    });

    test('Escape key triggers skip', () => {
        let selectedRole = null;

        ui = new RoleSelectionUI(roleService);
        ui.init({
            onRoleSelected: (role) => { selectedRole = role; }
        });
        ui.show();

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.getElementById('role-selection-screen').dispatchEvent(event);

        expect(selectedRole).toBe('skip');
    });

    test('Escape key does nothing when not visible', () => {
        let callbackCalled = false;

        ui = new RoleSelectionUI(roleService);
        ui.init({
            onRoleSelected: () => { callbackCalled = true; }
        });
        // Do NOT call show()

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.getElementById('role-selection-screen').dispatchEvent(event);

        expect(callbackCalled).toBe(false);
    });

    test('show moves focus to the first card', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        const firstCard = document.querySelector('.role-card');
        expect(document.activeElement).toBe(firstCard);
    });

    test('focus trap wraps Tab from last to first element', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        const skipBtn = document.getElementById('role-skip-btn');
        skipBtn.focus();

        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        skipBtn.dispatchEvent(tabEvent);

        expect(tabEvent.defaultPrevented).toBe(true);
    });

    test('focus trap wraps Shift+Tab from first to last element', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();
        ui.show();

        const firstCard = document.getElementById('role-student-card');
        firstCard.focus();

        const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        firstCard.dispatchEvent(shiftTabEvent);

        expect(shiftTabEvent.defaultPrevented).toBe(true);
    });

    test('destroy clears container innerHTML', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        const container = document.getElementById('role-selection-screen');
        expect(container.innerHTML.length).toBeGreaterThan(0);

        ui.destroy();
        expect(container.innerHTML).toBe('');
    });

    test('init handles missing container gracefully', () => {
        document.body.innerHTML = '';
        ui = new RoleSelectionUI(roleService);
        ui.init(); // should not throw
    });

    test('show/hide handle null container gracefully', () => {
        ui = new RoleSelectionUI(roleService);
        // container is null since init wasn't called on empty DOM
        ui.show(); // should not throw
        ui.hide(); // should not throw
    });

    test('cards have proper ARIA labels', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        const studentCard = document.getElementById('role-student-card');
        expect(studentCard.getAttribute('aria-label')).toBe('I am a Musician or Student');

        const teacherCard = document.getElementById('role-teacher-card');
        expect(teacherCard.getAttribute('aria-label')).toBe('I am an Educator');
    });

    test('cards have data-role attributes', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        expect(document.getElementById('role-student-card').dataset.role).toBe('student');
        expect(document.getElementById('role-teacher-card').dataset.role).toBe('teacher');
    });

    test('logo SVG is rendered', () => {
        ui = new RoleSelectionUI(roleService);
        ui.init();

        expect(document.querySelector('.role-selection-logo')).toBeTruthy();
    });

    test('onRoleSelected defaults to no-op if not provided', async () => {
        ui = new RoleSelectionUI(roleService);
        ui.init(); // no options
        ui.show();

        // Should not throw
        document.getElementById('role-student-card').click();
        await new Promise(r => setTimeout(r, 50));
    });
});
