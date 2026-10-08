module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.js'],
  testTimeout: 60000, // first run downloads an in-memory MongoDB binary
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/db.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 80, lines: 80, functions: 80, branches: 70 },
  },
};
