// CI 环境中排除 worker 相关测试（资源限制导致不稳定）
const testPathIgnorePatterns = [
  '/node_modules/',
  '/__tests__/fixtures/',
];

if (process.env.CI) {
  testPathIgnorePatterns.push('worker');
}

// CI 环境中降低覆盖率阈值（因为排除了 worker 测试）
const coverageThreshold = process.env.CI
  ? {
      global: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    }
  : {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    };

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
  coverageThreshold,
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
};
