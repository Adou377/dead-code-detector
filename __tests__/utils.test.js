const {
  normalizePath,
  parseArgs,
  processParallel,
  printProgress,
  isSafePath,
  hasPathTraversal,
  PerformanceStats,
} = require('../src/utils');

describe('Utils', () => {
  describe('normalizePath', () => {
    test('should convert backslashes to forward slashes', () => {
      expect(normalizePath('C:\\path\\to\\file.js')).toBe('C:/path/to/file.js');
      expect(normalizePath('path\\with\\multiple\\slashes')).toBe('path/with/multiple/slashes');
    });

    test('should leave forward slashes unchanged', () => {
      expect(normalizePath('/path/to/file.js')).toBe('/path/to/file.js');
      expect(normalizePath('path/with/forward/slashes')).toBe('path/with/forward/slashes');
    });

    test('should handle empty string', () => {
      expect(normalizePath('')).toBe('');
    });
  });

  describe('parseArgs', () => {
    test('should parse --src argument', () => {
      expect(parseArgs(['--src', './src'])).toEqual({ src: './src' });
      expect(parseArgs(['-s', './source'])).toEqual({ src: './source' });
    });

    test('should parse --ext argument', () => {
      expect(parseArgs(['--ext', '.js,.vue'])).toEqual({ ext: '.js,.vue' });
      expect(parseArgs(['-e', '.ts'])).toEqual({ ext: '.ts' });
    });

    test('should parse --ignore argument', () => {
      expect(parseArgs(['--ignore', 'node_modules,dist'])).toEqual({ ignore: 'node_modules,dist' });
      expect(parseArgs(['-i', 'build'])).toEqual({ ignore: 'build' });
    });

    test('should parse --fix flag', () => {
      expect(parseArgs(['--fix'])).toEqual({ fix: true });
    });

    test('should parse --verbose flag', () => {
      expect(parseArgs(['--verbose'])).toEqual({ verbose: true });
    });

    test('should parse --mode argument', () => {
      expect(parseArgs(['--mode', 'ast'])).toEqual({ mode: 'ast' });
      expect(parseArgs(['--mode', 'regex'])).toEqual({ mode: 'regex' });
    });

    test('should parse --help flag', () => {
      expect(parseArgs(['--help'])).toEqual({ help: true });
      expect(parseArgs(['-h'])).toEqual({ help: true });
    });

    test('should parse multiple arguments', () => {
      expect(parseArgs(['--src', './src', '--fix', '--mode', 'ast'])).toEqual({
        src: './src',
        fix: true,
        mode: 'ast',
      });
    });

    test('should return empty object for no arguments', () => {
      expect(parseArgs([])).toEqual({});
    });
  });

  describe('processParallel', () => {
    test('should process items in parallel with object options', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn(item => Promise.resolve(item * 2));

      const results = await processParallel({
        items,
        processor,
        concurrency: 2,
      });

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    test('should process items in parallel with array signature', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn(item => Promise.resolve(item + 1));

      const results = await processParallel(items, processor, 2);

      expect(results).toEqual([2, 3, 4]);
    });

    test('should handle errors gracefully', async () => {
      const items = [1, 2, 3];
      const processor = jest.fn(item => {
        if (item === 2) {
          return Promise.reject(new Error('Test error'));
        }
        return Promise.resolve(item);
      });

      const results = await processParallel(items, processor, 2);

      expect(results).toEqual([1, 3]);
    });

    test('should call onProgress', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = item => Promise.resolve(item);
      const onProgress = jest.fn();

      await processParallel({
        items,
        processor,
        concurrency: 5,
        onProgress,
        progressInterval: 1,
      });

      expect(onProgress).toHaveBeenCalled();
    });

    test('should handle empty array', async () => {
      const results = await processParallel([], item => Promise.resolve(item));
      expect(results).toEqual([]);
    });
  });

  describe('isSafePath', () => {
    test('should return true for paths within base directory', () => {
      expect(isSafePath('/app/src', '/app/src/components/Button.js')).toBe(true);
      expect(isSafePath('/app/src', '/app/src/utils/helpers.js')).toBe(true);
      expect(isSafePath('/app/src', '/app/src')).toBe(true);
    });

    test('should return false for paths outside base directory', () => {
      expect(isSafePath('/app/src', '/app/dist/bundle.js')).toBe(false);
      expect(isSafePath('/app/src', '/app/config.json')).toBe(false);
      expect(isSafePath('/app/src', '/etc/passwd')).toBe(false);
    });

    test('should prevent path traversal attacks', () => {
      // 路径遍历攻击尝试跳出源目录
      expect(isSafePath('/app/src', '/app/src/../../../etc/passwd')).toBe(false);
      expect(isSafePath('/app/src', '/app/src/../config')).toBe(false);
      expect(isSafePath('/app/src', '/app/src/..')).toBe(false);
    });

    test('should handle absolute paths correctly', () => {
      expect(isSafePath('/app/src', '/app/src/pages/index.js')).toBe(true);
      if (process.platform === 'win32') {
        expect(isSafePath('C:\\project\\src', 'C:\\project\\src\\components')).toBe(true);
      }
      expect(isSafePath('/app/src', '/app/src-backup/file.js')).toBe(false);
    });

    test('should normalize paths before comparison', () => {
      // 处理不同格式的路径分隔符
      expect(isSafePath('/app/src', '/app/src//components//Button.js')).toBe(true);
      expect(isSafePath('/app/src/', '/app/src/components')).toBe(true);
      expect(isSafePath('/app/src', '/app/src/./components')).toBe(true);
    });

    test('should handle edge cases', () => {
      expect(isSafePath('', '')).toBe(false);
      expect(isSafePath('/app/src', '/app/src/')).toBe(true);
      expect(isSafePath(null, '/app/src')).toBe(false);
      expect(isSafePath('/app/src', null)).toBe(false);
    });
  });

  describe('hasPathTraversal', () => {
    test('should detect basic path traversal patterns', () => {
      expect(hasPathTraversal('../')).toBe(true);
      expect(hasPathTraversal('..\\')).toBe(true);
      expect(hasPathTraversal('..')).toBe(true);
      expect(hasPathTraversal('path/../other')).toBe(true);
    });

    test('should detect URL encoded path traversal', () => {
      expect(hasPathTraversal('..%2f')).toBe(true);
      expect(hasPathTraversal('..%5c')).toBe(true);
      expect(hasPathTraversal('%2e%2e')).toBe(true);
    });

    test('should return false for safe paths', () => {
      expect(hasPathTraversal('components/Button.js')).toBe(false);
      expect(hasPathTraversal('utils/helpers.js')).toBe(false);
      expect(hasPathTraversal('/app/src/index.js')).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(hasPathTraversal('')).toBe(false);
      expect(hasPathTraversal(null)).toBe(false);
      expect(hasPathTraversal(undefined)).toBe(false);
      expect(hasPathTraversal(123)).toBe(false);
    });
  });

  describe('normalizePath with traversal detection', () => {
    test('should return string when detectTraversal is false (default)', () => {
      const result = normalizePath('C:\\path\\to\\file.js');
      expect(result).toBe('C:/path/to/file.js');
      expect(typeof result).toBe('string');
    });

    test('should return object with traversal info when detectTraversal is true', () => {
      const result = normalizePath('../escape.js', { detectTraversal: true });
      expect(result).toEqual({
        path: '../escape.js',
        hasTraversal: true,
        isSafe: false,
      });
    });

    test('should return safe result for normal paths with detectTraversal', () => {
      const result = normalizePath('components/Button.js', { detectTraversal: true });
      expect(result).toEqual({
        path: 'components/Button.js',
        hasTraversal: false,
        isSafe: true,
      });
    });

    test('should validate against basePath when provided', () => {
      const result = normalizePath('/app/src/../config.js', {
        detectTraversal: true,
        basePath: '/app/src',
      });
      expect(result.hasTraversal).toBe(true);
      expect(result.isSafe).toBe(false);
    });

    test('should handle safe traversal within basePath', () => {
      const result = normalizePath('/app/src/components/../utils/helpers.js', {
        detectTraversal: true,
        basePath: '/app/src',
      });
      expect(result.hasTraversal).toBe(true);
      // 注意：这里 isSafe 取决于 isSafePath 的判断
    });
  });

  describe('PerformanceStats', () => {
    test('should initialize with default values', () => {
      const stats = new PerformanceStats();
      expect(stats.startTime).toBe(0);
      expect(stats.endTime).toBe(0);
      expect(stats.fileCount).toBe(0);
      expect(stats.exportCount).toBe(0);
      expect(stats.componentCount).toBe(0);
      expect(stats.memoryPeak).toBe(0);
    });

    test('should start and end timing', async () => {
      const stats = new PerformanceStats();
      stats.start();
      expect(stats.startTime).toBeGreaterThan(0);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      stats.end();
      expect(stats.endTime).toBeGreaterThan(0);
      expect(stats.endTime).toBeGreaterThanOrEqual(stats.startTime);
    });

    test('should record file count', () => {
      const stats = new PerformanceStats();
      stats.recordFile();
      expect(stats.fileCount).toBe(1);
      
      stats.recordFile(5);
      expect(stats.fileCount).toBe(6);
    });

    test('should record export count', () => {
      const stats = new PerformanceStats();
      stats.recordExport();
      expect(stats.exportCount).toBe(1);
      
      stats.recordExport(10);
      expect(stats.exportCount).toBe(11);
    });

    test('should record component count', () => {
      const stats = new PerformanceStats();
      stats.recordComponent();
      expect(stats.componentCount).toBe(1);
      
      stats.recordComponent(3);
      expect(stats.componentCount).toBe(4);
    });

    test('should get elapsed time', async () => {
      const stats = new PerformanceStats();
      stats.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      stats.end();
      
      const elapsed = stats.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    test('should format time correctly for milliseconds', () => {
      const stats = new PerformanceStats();
      stats.startTime = Date.now();
      stats.endTime = stats.startTime + 500;
      
      expect(stats.getFormattedTime()).toBe('500ms');
    });

    test('should format time correctly for seconds', () => {
      const stats = new PerformanceStats();
      stats.startTime = Date.now();
      stats.endTime = stats.startTime + 1500;
      
      expect(stats.getFormattedTime()).toBe('1.50s');
    });

    test('should get current memory', () => {
      const stats = new PerformanceStats();
      const memory = stats.getCurrentMemory();
      expect(memory).toBeGreaterThan(0);
      expect(typeof memory).toBe('number');
    });

    test('should get report', () => {
      const stats = new PerformanceStats();
      stats.start();
      stats.recordFile(10);
      stats.recordExport(20);
      stats.recordComponent(5);
      stats.end();
      
      const report = stats.getReport();
      expect(report.fileCount).toBe(10);
      expect(report.exportCount).toBe(20);
      expect(report.componentCount).toBe(5);
      expect(report.elapsedTime).toBeGreaterThanOrEqual(0);
      expect(report.formattedTime).toBeDefined();
      expect(report.memoryPeak).toBeGreaterThanOrEqual(0);
    });

    test('should track memory peak during monitoring', async () => {
      const stats = new PerformanceStats();
      stats.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      stats.end();
      expect(stats.memoryPeak).toBeGreaterThan(0);
    });
  });
});
