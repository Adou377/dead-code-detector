const path = require('path');
const fs = require('fs');

describe('CLI', () => {
  let testDir;

  beforeEach(() => {
    testDir = path.join(__dirname, 'fixtures', 'cli-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('bin/dead-code.js', () => {
    test('should have correct bin entry', () => {
      const packageJson = require('../package.json');
      expect(packageJson.bin).toBeDefined();
      expect(packageJson.bin['dead-code']).toBe('./bin/dead-code.js');
    });

    test('should be executable Node script', () => {
      const binPath = path.join(__dirname, '..', 'bin', 'dead-code.js');
      const content = fs.readFileSync(binPath, 'utf-8');
      expect(content).toContain('#!/usr/bin/env node');
    });
  });

  describe('CLI arguments', () => {
    const { parseArgs } = require('../src/utils.js');

    test('should parse --help flag', () => {
      const args = parseArgs(['--help']);
      expect(args.help).toBe(true);
    });

    test('should parse -s short flag', () => {
      const args = parseArgs(['-s', './src']);
      expect(args.src).toBe('./src');
    });

    test('should parse --src flag', () => {
      const args = parseArgs(['--src', './lib']);
      expect(args.src).toBe('./lib');
    });

    test('should parse --mode flag', () => {
      const args = parseArgs(['--mode', 'regex']);
      expect(args.mode).toBe('regex');
    });

    test('should parse --fix flag', () => {
      const args = parseArgs(['--fix']);
      expect(args.fix).toBe(true);
    });

    test('should parse --verbose flag', () => {
      const args = parseArgs(['--verbose']);
      expect(args.verbose).toBe(true);
    });

    test('should parse --ext flag', () => {
      const args = parseArgs(['--ext', '.js,.jsx']);
      expect(args.ext).toBe('.js,.jsx');
    });

    test('should parse --ignore flag', () => {
      const args = parseArgs(['--ignore', 'dist,build']);
      expect(args.ignore).toBe('dist,build');
    });

    test('should handle multiple arguments', () => {
      const args = parseArgs(['--src', './src', '--mode', 'ast', '--fix']);
      expect(args.src).toBe('./src');
      expect(args.mode).toBe('ast');
      expect(args.fix).toBe(true);
    });
  });
});
