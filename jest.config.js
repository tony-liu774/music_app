module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['**/tests/tuner.test.js', '**/tests/onboarding.test.js', '**/tests/sso-login-ui.test.js', '**/tests/role-selection-ui.test.js', '**/tests/theme-variables.test.js'],
    moduleFileExtensions: ['js', 'html'],
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    collectCoverageFrom: [
        'src/js/**/*.js',
        '!src/**/*.min.js'
    ]
};
