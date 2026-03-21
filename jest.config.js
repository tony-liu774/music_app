module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['**/tests/tuner.test.js'],
    moduleFileExtensions: ['js', 'html'],
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    collectCoverageFrom: [
        'src/js/**/*.js',
        '!src/**/*.min.js'
    ]
};
