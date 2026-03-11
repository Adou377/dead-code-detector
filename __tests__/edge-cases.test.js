/**
 * 边界情况测试
 * 
 * 测试大文件处理、特殊字符路径、并发安全等边界场景
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { DeadCodeFinder } = require('../src/detector.js');
const { DeadCodeFinderAST } = require('../src/detector-ast.js');
const { CacheManager, LRUCache } = require('../src/cache.js');
const { PathResolver } = require('../src/resolver.js');
const { WorkerPool, createWorkerPool } = require('../src/worker/index.js');
const { processParallel, validateOptions, isSafePath, hasPathTraversal } = require('../src/utils.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');

describe('大文件处理边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'large-file-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('文件大小边界', () => {
    test('应该正确处理刚好低于限制的文件', async () => {
      const maxSize = 1024;
      const content = 'export const x = 1;\n'.repeat(Math.floor(maxSize / 20));
      const filePath = path.join(tempDir, 'near-limit.js');
      fs.writeFileSync(filePath, content);

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: maxSize,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.has('near-limit.js')).toBe(true);
    });

    test('应该正确处理刚好超过限制的文件', async () => {
      const maxSize = 100;
      const content = 'export const x = 1;\n'.repeat(20);
      const filePath = path.join(tempDir, 'over-limit.js');
      fs.writeFileSync(filePath, content);

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: maxSize,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(filePath);
      consoleSpy.mockRestore();

      expect(finder.fileContents.has('over-limit.js')).toBe(false);
    });

    test('应该正确处理大小限制为 0 的情况', async () => {
      const filePath = path.join(tempDir, 'zero-limit.js');
      fs.writeFileSync(filePath, 'export const x = 1;');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: 0,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.has('zero-limit.js')).toBe(true);
    });

    test('应该正确处理大小限制为最大值的情况', async () => {
      const filePath = path.join(tempDir, 'max-limit.js');
      fs.writeFileSync(filePath, 'export const x = 1;');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: 10 * 1024 * 1024,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.has('max-limit.js')).toBe(true);
    });
  });

  describe('大文件内容处理', () => {
    test('应该正确处理大量导出的文件', async () => {
      const filePath = path.join(tempDir, 'many-exports.js');
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`export const export${i} = ${i};`);
      }
      fs.writeFileSync(filePath, lines.join('\n'));

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.exports.has('many-exports.js')).toBe(true);
      const exports = finder.exports.get('many-exports.js');
      expect(exports.length).toBe(2000);
    });

    test('应该正确处理大量导入的文件', async () => {
      for (let i = 0; i < 100; i++) {
        const modulePath = path.join(tempDir, `module${i}.js`);
        fs.writeFileSync(modulePath, `export const value${i} = ${i};`);
      }

      const filePath = path.join(tempDir, 'many-imports.js');
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`import { value${i} } from './module${i}';`);
      }
      fs.writeFileSync(filePath, lines.join('\n'));

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.imports.has('many-imports.js')).toBe(true);
      const imports = finder.imports.get('many-imports.js');
      expect(imports.length).toBe(100);
    });

    test('应该正确处理超长单行代码', async () => {
      const filePath = path.join(tempDir, 'long-line.js');
      const longLine = `export const x = { ${Array(1000).fill(0).map((_, i) => `key${i}: ${i}`).join(', ')} };`;
      fs.writeFileSync(filePath, longLine);

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.has('long-line.js')).toBe(true);
    });

    test('应该正确处理深层嵌套的代码结构', async () => {
      const filePath = path.join(tempDir, 'deep-nested.js');
      let content = 'export const obj = ';
      for (let i = 0; i < 50; i++) {
        content += '{ nested: ';
      }
      content += '1';
      for (let i = 0; i < 50; i++) {
        content += ' }';
      }
      content += ';';
      fs.writeFileSync(filePath, content);

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.has('deep-nested.js')).toBe(true);
    });
  });
});

describe('特殊字符路径边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'special-path-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Unicode 字符路径', () => {
    test('应该正确处理包含中文字符的文件名', async () => {
      const filePath = path.join(tempDir, '组件-测试.js');
      fs.writeFileSync(filePath, 'export const 中文变量 = "测试";');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.size).toBeGreaterThan(0);
    });

    test('应该正确处理包含日文字符的文件名', async () => {
      const filePath = path.join(tempDir, 'コンポーネント.js');
      fs.writeFileSync(filePath, 'export const test = "テスト";');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.size).toBeGreaterThan(0);
    });

    test('应该正确处理包含 emoji 的文件名', async () => {
      const filePath = path.join(tempDir, 'test🎉component.js');
      fs.writeFileSync(filePath, 'export const emoji = "🚀";');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.size).toBeGreaterThan(0);
    });

    test('应该正确处理包含特殊符号的文件名', async () => {
      const filePath = path.join(tempDir, 'test-file_特殊@符号.js');
      fs.writeFileSync(filePath, 'export const special = "symbols";');

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      expect(finder.fileContents.size).toBeGreaterThan(0);
    });
  });

  describe('路径遍历防护', () => {
    test('应该阻止基本的路径遍历攻击', () => {
      expect(isSafePath('/app/src', '/app/src/../../../etc/passwd')).toBe(false);
      expect(isSafePath('/app/src', '/app/src/../config')).toBe(false);
    });

    test('应该阻止 URL 编码的路径遍历', () => {
      expect(hasPathTraversal('..%2f')).toBe(true);
      expect(hasPathTraversal('..%5c')).toBe(true);
      expect(hasPathTraversal('%2e%2e')).toBe(true);
    });

    test('应该阻止混合编码的路径遍历', () => {
      expect(hasPathTraversal('..%2F')).toBe(true);
      expect(hasPathTraversal('..%5C')).toBe(true);
      expect(hasPathTraversal('%2E%2e')).toBe(true);
    });

    test('应该允许正常的相对路径', () => {
      expect(hasPathTraversal('./components/Button.js')).toBe(false);
      expect(hasPathTraversal('utils/helpers.js')).toBe(false);
    });
  });

  describe('路径解析边界', () => {
    test('应该正确处理空路径', () => {
      const resolver = new PathResolver(tempDir);
      const result = resolver.resolve('', 'test.js');
      expect(result).toBeNull();
    });

    test('应该正确处理只有空格的路径', () => {
      const resolver = new PathResolver(tempDir);
      const result = resolver.resolve('   ', 'test.js');
      expect(result).toBeNull();
    });

    test('应该正确处理根路径', () => {
      const resolver = new PathResolver(tempDir);
      const result = resolver.resolve('/', 'test.js');
      expect(result).toBeNull();
    });

    test('应该正确处理多个连续斜杠的路径', () => {
      const filePath = path.join(tempDir, 'test.js');
      fs.writeFileSync(filePath, 'export const x = 1;');

      const resolver = new PathResolver(tempDir);
      const result = resolver.resolve('.//test.js', 'other.js');
      expect(result).toBe('test.js');
    });
  });
});

describe('并发安全边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrent-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('并发文件处理', () => {
    test('应该在高并发下保持数据一致性', async () => {
      const fileCount = 100;
      for (let i = 0; i < fileCount; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.js`), `export const value${i} = ${i};`);
      }

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 20,
      });

      await finder.analyze();

      expect(finder.exports.size).toBeGreaterThanOrEqual(fileCount);
    });

    test('应该在并发时正确处理重复文件', async () => {
      const files = [];
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(tempDir, `dup${i}.js`);
        fs.writeFileSync(filePath, 'export const same = 1;');
        files.push(filePath);
      }

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 5,
      });

      await finder.analyze();

      const sameExports = finder.exports;
      let sameCount = 0;
      for (const [, exports] of sameExports) {
        if (exports.some(e => e.name === 'same')) {
          sameCount++;
        }
      }
      expect(sameCount).toBe(10);
    });

    test('应该在并发时正确处理错误', async () => {
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(tempDir, `file${i}.js`);
        if (i % 2 === 0) {
          fs.writeFileSync(filePath, `export const value${i} = ${i};`);
        } else {
          fs.writeFileSync(filePath, 'invalid javascript {{{');
        }
      }

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 3,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.analyze();
      consoleSpy.mockRestore();

      expect(finder.exports.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Worker 线程池并发', () => {
    let pool;

    beforeEach(async () => {
      const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
      pool = createWorkerPool({
        workerPath,
        workerCount: 4,
        taskTimeout: 30000,
      });
      await pool.initialize();
    });

    afterEach(async () => {
      if (pool) {
        await pool.shutdown();
      }
    });

    test('应该在多个 Worker 同时执行时保持正确性', async () => {
      const files = [];
      for (let i = 0; i < 20; i++) {
        const filePath = path.join(tempDir, `worker${i}.js`);
        fs.writeFileSync(filePath, `export const worker${i} = ${i};`);
        files.push(filePath);
      }

      const promises = files.map(filePath =>
        pool.execute({
          type: 'parseFile',
          options: {
            filePath,
            srcDir: tempDir,
            maxFileSize: 1000000,
          },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.exports[0].name).toBe(`worker${index}`);
      });
    });

    test('应该正确处理 Worker 任务队列溢出', async () => {
      const files = [];
      for (let i = 0; i < 50; i++) {
        const filePath = path.join(tempDir, `overflow${i}.js`);
        fs.writeFileSync(filePath, `export const overflow${i} = ${i};`);
        files.push(filePath);
      }

      const promises = files.map(filePath =>
        pool.execute({
          type: 'parseFile',
          options: {
            filePath,
            srcDir: tempDir,
            maxFileSize: 1000000,
          },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('缓存并发安全', () => {
    test('应该在并发读写时保持缓存一致性', async () => {
      const cacheManager = new CacheManager({
        projectRoot: tempDir,
        maxEntries: 50,
      });

      const files = [];
      for (let i = 0; i < 30; i++) {
        const filePath = path.join(tempDir, `cache${i}.js`);
        fs.writeFileSync(filePath, `export const cache${i} = ${i};`);
        files.push(filePath);
      }

      cacheManager.load();

      const writePromises = files.map((filePath, index) => {
        return new Promise(resolve => {
          setTimeout(() => {
            cacheManager.set(filePath, { exports: [`cache${index}`] });
            resolve();
          }, Math.random() * 10);
        });
      });

      await Promise.all(writePromises);

      const stats = cacheManager.getStats();
      expect(stats.totalFiles).toBe(30);
    });

    test('应该在并发淘汰时保持 LRU 正确性', async () => {
      const lruCache = new LRUCache({
        maxSize: 10,
        maxMemoryMB: 1,
      });

      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          new Promise(resolve => {
            setTimeout(() => {
              lruCache.set(`key${i}`, { data: i });
              resolve();
            }, Math.random() * 5);
          })
        );
      }

      await Promise.all(operations);

      expect(lruCache.size).toBeLessThanOrEqual(10);
    });
  });
});

describe('内存压力边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('缓存内存限制', () => {
    test('应该在内存超限时自动淘汰条目', () => {
      const lruCache = new LRUCache({
        maxSize: 100,
        maxMemoryMB: 0.001,
      });

      for (let i = 0; i < 50; i++) {
        lruCache.set(`key${i}`, { data: 'x'.repeat(1000) });
      }

      expect(lruCache.size).toBeLessThan(50);
    });

    test('应该正确报告内存使用情况', () => {
      const lruCache = new LRUCache({
        maxSize: 100,
        maxMemoryMB: 1,
      });

      for (let i = 0; i < 10; i++) {
        lruCache.set(`key${i}`, { data: 'x'.repeat(1000) });
      }

      const memoryUsage = lruCache.getMemoryUsage();
      expect(memoryUsage.currentBytes).toBeGreaterThan(0);
      expect(memoryUsage.utilizationPercent).toBeDefined();
    });

    test('应该支持动态调整内存限制', () => {
      const lruCache = new LRUCache({
        maxSize: 100,
        maxMemoryMB: 1,
      });

      for (let i = 0; i < 10; i++) {
        lruCache.set(`key${i}`, { data: 'x'.repeat(1000) });
      }

      const initialSize = lruCache.size;
      lruCache.setMaxMemory(0.0001);

      expect(lruCache.size).toBeLessThanOrEqual(initialSize);
    });
  });

  describe('大文件内存处理', () => {
    test('应该在处理大文件时不导致内存泄漏', async () => {
      const filePath = path.join(tempDir, 'large.js');
      const lines = [];
      for (let i = 0; i < 5000; i++) {
        lines.push(`export const item${i} = { data: "${'x'.repeat(100)}" };`);
      }
      fs.writeFileSync(filePath, lines.join('\n'));

      const initialMemory = process.memoryUsage().heapUsed;

      const finder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await finder.parseFile(filePath);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});

describe('配置验证边界测试', () => {
  describe('validateOptions 边界情况', () => {
    test('应该拒绝 null 配置', () => {
      expect(() => validateOptions(null)).toThrow('配置选项必须是一个对象');
    });

    test('应该拒绝非对象配置', () => {
      expect(() => validateOptions('string')).toThrow('配置选项必须是一个对象');
      expect(() => validateOptions(123)).toThrow('配置选项必须是一个对象');
      expect(() => validateOptions([])).toThrow('配置选项必须是一个对象');
    });

    test('应该拒绝空字符串 srcDir', () => {
      expect(() => validateOptions({ srcDir: '' })).toThrow('srcDir 必须是非空字符串');
      expect(() => validateOptions({ srcDir: '   ' })).toThrow('srcDir 必须是非空字符串');
    });

    test('应该拒绝包含空字符的 srcDir', () => {
      expect(() => validateOptions({ srcDir: '/path/with\0null' })).toThrow('srcDir 包含非法字符');
    });

    test('应该拒绝无效的 concurrency 值', () => {
      expect(() => validateOptions({ concurrency: 0 })).toThrow('concurrency 必须在 1 到 1000 之间');
      expect(() => validateOptions({ concurrency: 1001 })).toThrow('concurrency 必须在 1 到 1000 之间');
      expect(() => validateOptions({ concurrency: -1 })).toThrow('concurrency 必须在 1 到 1000 之间');
      expect(() => validateOptions({ concurrency: 1.5 })).toThrow('concurrency 必须是整数');
    });

    test('应该拒绝无效的 maxFileSize 值', () => {
      expect(() => validateOptions({ maxFileSize: -1 })).toThrow('maxFileSize 必须在 0 到 10MB 之间');
      expect(() => validateOptions({ maxFileSize: 11 * 1024 * 1024 })).toThrow('maxFileSize 必须在 0 到 10MB 之间');
      expect(() => validateOptions({ maxFileSize: NaN })).toThrow('maxFileSize 必须是数字');
    });

    test('应该接受有效的配置', () => {
      expect(() => validateOptions({ srcDir: '/valid/path' })).not.toThrow();
      expect(() => validateOptions({ concurrency: 50 })).not.toThrow();
      expect(() => validateOptions({ maxFileSize: 1024 })).not.toThrow();
    });
  });
});

describe('processParallel 边界测试', () => {
  test('应该正确处理空数组', async () => {
    const results = await processParallel([], item => Promise.resolve(item));
    expect(results).toEqual([]);
  });

  test('应该正确处理单个项目', async () => {
    const results = await processParallel([1], item => Promise.resolve(item * 2));
    expect(results).toEqual([2]);
  });

  test('应该正确处理所有项目都失败的情况', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const results = await processParallel(
      [1, 2, 3],
      () => Promise.reject(new Error('All failed')),
      2
    );
    consoleSpy.mockRestore();

    expect(results).toEqual([]);
  });

  test('应该正确处理进度回调', async () => {
    const onProgress = jest.fn();
    await processParallel({
      items: [1, 2, 3, 4, 5],
      processor: item => Promise.resolve(item),
      concurrency: 2,
      onProgress,
      progressInterval: 1,
    });

    expect(onProgress).toHaveBeenCalled();
  });

  test('应该正确处理零进度间隔', async () => {
    const onProgress = jest.fn();
    await processParallel({
      items: [1, 2, 3],
      processor: item => Promise.resolve(item),
      concurrency: 2,
      onProgress,
      progressInterval: 0,
    });

    expect(onProgress).toHaveBeenCalled();
  });
});

describe('AST 解析器边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('应该正确处理复杂的 TypeScript 类型', async () => {
    const filePath = path.join(tempDir, 'complex-types.ts');
    fs.writeFileSync(filePath, `
      type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
      };
      
      export interface ComplexType {
        nested: {
          deep: {
            value: string;
          };
        };
        optional?: string;
      }
      
      export type MappedType = { [K in keyof ComplexType]: ComplexType[K] };
    `);

    const finder = new DeadCodeFinderAST({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    await finder.parseFile(filePath);

    expect(finder.fileContents.has('complex-types.ts')).toBe(true);
  });

  test('应该正确处理装饰器语法', async () => {
    const filePath = path.join(tempDir, 'decorators.ts');
    fs.writeFileSync(filePath, `
      function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {}
      
      export class DecoratedClass {
        @Log
        method() {}
      }
    `);

    const finder = new DeadCodeFinderAST({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    await finder.parseFile(filePath);

    expect(finder.fileContents.has('decorators.ts')).toBe(true);
  });

  test('应该正确处理动态导入', async () => {
    const filePath = path.join(tempDir, 'dynamic-import.js');
    fs.writeFileSync(filePath, `
      export const loadModule = async () => {
        const module = await import('./other-module');
        return module;
      };
      
      export const lazyComponent = () => import('./Component');
    `);

    const finder = new DeadCodeFinderAST({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    await finder.parseFile(filePath);

    expect(finder.imports.has('dynamic-import.js')).toBe(true);
    const imports = finder.imports.get('dynamic-import.js');
    expect(imports.some(i => i.isDynamic)).toBe(true);
  });

  test('应该正确处理 Vue 3 Composition API', async () => {
    const filePath = path.join(tempDir, 'Composition.vue');
    fs.writeFileSync(filePath, `
      <script setup>
      import { ref, computed, onMounted } from 'vue';
      
      const count = ref(0);
      const doubled = computed(() => count.value * 2);
      
      onMounted(() => {
        console.log('mounted');
      });
      
      export { count, doubled };
      </script>
    `);

    const finder = new DeadCodeFinderAST({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    await finder.parseFile(filePath);

    expect(finder.fileContents.has('Composition.vue')).toBe(true);
  });
});

describe('错误恢复边界测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-recovery-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('应该在部分文件解析失败后继续处理', async () => {
    for (let i = 0; i < 5; i++) {
      const filePath = path.join(tempDir, `file${i}.js`);
      if (i === 2) {
        fs.writeFileSync(filePath, 'invalid {{{');
      } else {
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
      }
    }

    const finder = new DeadCodeFinder({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    await finder.analyze();
    consoleSpy.mockRestore();

    expect(finder.exports.size).toBe(4);
  });

  test('应该在文件被删除后优雅处理', async () => {
    const filePath = path.join(tempDir, 'will-delete.js');
    fs.writeFileSync(filePath, 'export const temp = 1;');

    const finder = new DeadCodeFinder({
      srcDir: tempDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });

    finder.sourceFiles = [filePath];
    fs.unlinkSync(filePath);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    await finder.parseFile(filePath);
    consoleSpy.mockRestore();

    expect(finder.exports.has('will-delete.js')).toBe(false);
  });

  test('应该在缓存损坏后重建缓存', async () => {
    const cacheManager = new CacheManager({
      projectRoot: tempDir,
    });

    const cachePath = path.join(tempDir, '.dead-code-cache', 'analysis-cache.json');
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, 'corrupted cache data {{{');

    const cache = cacheManager.load();

    expect(cache.version).toBe('1.0.0');
    expect(cache.files).toEqual({});
  });
});

describe('边界值数值测试', () => {
  test('应该正确处理最大并发数', async () => {
    const items = Array(10).fill(0);
    const results = await processParallel(items, item => Promise.resolve(item), 1000);
    expect(results).toHaveLength(10);
  });

  test('应该正确处理最小并发数', async () => {
    const items = Array(10).fill(0);
    const results = await processParallel(items, item => Promise.resolve(item), 1);
    expect(results).toHaveLength(10);
  });

  test('LRUCache 应该正确处理 maxSize 为 1', () => {
    const lruCache = new LRUCache({ maxSize: 1, maxMemoryMB: 1 });
    lruCache.set('key1', 'value1');
    expect(lruCache.get('key1')).toBe('value1');

    lruCache.set('key2', 'value2');
    expect(lruCache.get('key1')).toBeNull();
    expect(lruCache.get('key2')).toBe('value2');
  });

  test('LRUCache 应该正确处理 maxSize 为 0', () => {
    const lruCache = new LRUCache({ maxSize: 0, maxMemoryMB: 1 });
    lruCache.set('key1', 'value1');
    expect(lruCache.size).toBe(0);
  });

  test('LRUCache resize 应该正确淘汰多余条目', () => {
    const lruCache = new LRUCache({ maxSize: 10, maxMemoryMB: 1 });
    for (let i = 0; i < 10; i++) {
      lruCache.set(`key${i}`, `value${i}`);
    }

    lruCache.resize(5);
    expect(lruCache.size).toBe(5);
  });
});
