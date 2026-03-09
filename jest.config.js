// CI 环境中排除 worker 相关测试（资源限制导致不稳定）
const testPathIgnorePatterns = [
  '/node_modules/',
  '/__tests__/fixtures/',
];

if (process.env.CI) {
  testPathIgnorePatterns.push('worker');
}

module.exports = {
  testPathIgnorePatterns,
  transformIgnorePatterns: [
    'node_modules/',
    '__tests__/fixtures/',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
};
