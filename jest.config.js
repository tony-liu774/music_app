module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['**/tests/**/*.test.js'],
    moduleFileExtensions: ['js', 'html'],
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    collectCoverageFrom: [
        'src/js/**/*.js',
        '!src/**/*.min.js'
    ]
};
