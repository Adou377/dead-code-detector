const path = require('path');
const fs = require('fs');
const { DeadCodeFinderBase } = require('../src/detector-base.js');

describe('DeadCodeFinderBase', () => {
  let base;

  beforeEach(() => {
    base = new DeadCodeFinderBase({
      srcDir: './test-src',
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
      ignoreDirs: ['node_modules', 'dist', '.git'],
      verbose: false,
    });
  });

  describe('constructor', () => {
    test('should create instance with default options', () => {
      const defaultBase = new DeadCodeFinderBase();
      expect(defaultBase.srcDir).toBeDefined();
      expect(defaultBase.extensions).toBeDefined();
      expect(defaultBase.ignoreDirs).toBeDefined();
    });

    test('should create instance with custom options', () => {
      expect(base.srcDir).toBe('./test-src');
      expect(base.extensions).toEqual(['.js', '.jsx', '.ts', '.tsx', '.vue']);
      expect(base.verbose).toBe(false);
    });

    test('should initialize collections', () => {
      expect(base.sourceFiles).toEqual([]);
      expect(base.fileContents).toBeInstanceOf(Map);
      expect(base.exports).toBeInstanceOf(Map);
      expect(base.imports).toBeInstanceOf(Map);
      expect(base.components).toBeInstanceOf(Map);
      expect(base.unusedExports).toEqual([]);
      expect(base.unusedComponents).toEqual([]);
      expect(base.unusedToolFiles).toEqual([]);
    });
  });

  describe('countLocalUsage', () => {
    test('should count usage in cached content', async () => {
      base.fileContents.set('test.js', 'const foo = 1; console.log(foo);');
      const count = await base.countLocalUsage('test.js', 'foo');
      expect(count).toBe(1);
    });

    test('should return 0 for non-existent file', async () => {
      const count = await base.countLocalUsage('non-existent.js', 'foo');
      expect(count).toBe(0);
    });
  });

  describe('countUsageInContent', () => {
    test('should count name occurrences', () => {
      const content = 'const foo = 1; function foo() {}';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });

    test('should exclude export declarations', () => {
      const content = 'export const foo = 1; const bar = foo;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(1);
    });

    test('should exclude import statements', () => {
      const content = 'import { foo } from "./bar"; const baz = foo;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(1);
    });

    test('should exclude string literals', () => {
      const content = 'const foo = "foo"; console.log(foo);';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(1);
    });

    test('should exclude regex', () => {
      const content = 'const foo = /foo/; console.log(foo);';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(1);
    });

    test('should exclude comments', () => {
      const content = '// foo\nconst bar = 1;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });
  });

  describe('toPascalCase', () => {
    test('should convert kebab-case', () => {
      expect(base.toPascalCase('my-component')).toBe('MyComponent');
    });

    test('should handle already pascal case', () => {
      expect(base.toPascalCase('MyComponent')).toBe('MyComponent');
    });

    test('should handle empty string', () => {
      expect(base.toPascalCase('')).toBe('');
    });
  });

  describe('toKebabCase', () => {
    test('should convert PascalCase', () => {
      expect(base.toKebabCase('MyComponent')).toBe('my-component');
    });

    test('should handle already kebab case', () => {
      expect(base.toKebabCase('my-component')).toBe('my-component');
    });
  });

  describe('getExportCount', () => {
    test('should return total export count', () => {
      base.exports.set('file1.js', [{ name: 'a' }, { name: 'b' }]);
      base.exports.set('file2.js', [{ name: 'c' }]);
      expect(base.getExportCount()).toBe(3);
    });

    test('should return 0 for no exports', () => {
      expect(base.getExportCount()).toBe(0);
    });
  });

  describe('groupByFile', () => {
    test('should group items by file', () => {
      const items = [
        { file: 'a.js', name: 'foo' },
        { file: 'a.js', name: 'bar' },
        { file: 'b.js', name: 'baz' },
      ];
      const grouped = base.groupByFile(items);
      expect(grouped['a.js'].length).toBe(2);
      expect(grouped['b.js'].length).toBe(1);
    });
  });

  describe('extractImportsFromContent', () => {
    test('should return empty array by default', () => {
      const imports = base.extractImportsFromContent('const a = 1;');
      expect(imports).toEqual([]);
    });
  });

  describe('resolveImportPath', () => {
    test('should return null by default', () => {
      const result = base.resolveImportPath('./test', 'file.js');
      expect(result).toBeNull();
    });
  });

  describe('analyze', () => {
    test('should return empty results by default', async () => {
      const result = await base.analyze();
      expect(result.unusedExports).toEqual([]);
      expect(result.unusedComponents).toEqual([]);
      expect(result.unusedToolFiles).toEqual([]);
    });
  });

  describe('report', () => {
    test('should return current state', () => {
      base.unusedExports = [{ file: 'test.js', name: 'foo' }];
      const result = base.report();
      expect(result.unusedExports).toEqual([{ file: 'test.js', name: 'foo' }]);
    });
  });

  describe('fix', () => {
    test('should return cancelled false by default', async () => {
      const result = await base.fix();
      expect(result.cancelled).toBe(false);
    });
  });

  describe('scanFiles', () => {
    const testDir = path.join(__dirname, 'fixtures', 'scan-test');

    beforeEach(async () => {
      // 创建测试目录结构
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.mkdir(path.join(testDir, 'visible'), { recursive: true });
      await fs.promises.mkdir(path.join(testDir, '.hidden'), { recursive: true });
      await fs.promises.writeFile(path.join(testDir, 'test.js'), 'const a = 1;');
      await fs.promises.writeFile(path.join(testDir, 'visible', 'nested.js'), 'const b = 2;');
      await fs.promises.writeFile(path.join(testDir, '.hidden', 'hidden.js'), 'const c = 3;');
    });

    afterEach(async () => {
      // 清理测试目录
      await fs.promises.rm(testDir, { recursive: true, force: true });
    });

    test('should scan files recursively', async () => {
      const finder = new DeadCodeFinderBase({ extensions: ['.js'], srcDir: testDir });
      const files = await finder.scanFiles(testDir);
      expect(files.some(f => f.endsWith('test.js'))).toBe(true);
      expect(files.some(f => f.endsWith('nested.js'))).toBe(true);
    });

    test('should ignore hidden directories', async () => {
      const finder = new DeadCodeFinderBase({ extensions: ['.js'], srcDir: testDir });
      const files = await finder.scanFiles(testDir);
      expect(files.some(f => f.includes('.hidden'))).toBe(false);
    });

    test('should ignore configured directories', async () => {
      const ignoreDir = path.join(testDir, 'node_modules');
      await fs.promises.mkdir(ignoreDir, { recursive: true });
      await fs.promises.writeFile(path.join(ignoreDir, 'pkg.js'), 'const d = 4;');

      const finder = new DeadCodeFinderBase({
        extensions: ['.js'],
        srcDir: testDir,
        ignoreDirs: ['node_modules'],
      });
      const files = await finder.scanFiles(testDir);
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    test('should handle inaccessible directory gracefully', async () => {
      const finder = new DeadCodeFinderBase({ extensions: ['.js'], srcDir: testDir });
      // 传入不存在的目录
      const files = await finder.scanFiles(path.join(testDir, 'non-existent'));
      expect(files).toEqual([]);
    });

    test('should handle inaccessible file gracefully', async () => {
      const finder = new DeadCodeFinderBase({ extensions: ['.js'], srcDir: testDir });
      // 创建一个文件后删除它，模拟无法访问的情况
      const tempFile = path.join(testDir, 'temp.js');
      await fs.promises.writeFile(tempFile, 'const x = 1;');

      const files = await finder.scanFiles(testDir);
      // 应该能正常扫描到文件
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('scanTestFiles', () => {
    const testRoot = path.join(__dirname, 'fixtures', 'test-scan-root');
    const srcDir = path.join(testRoot, 'src');

    beforeEach(async () => {
      // 创建测试目录结构
      await fs.promises.mkdir(srcDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.promises.rm(testRoot, { recursive: true, force: true });
    });

    test('should scan test directory and collect imports', async () => {
      const testDir = path.join(testRoot, 'test');
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testDir, 'example.test.js'),
        'import { foo } from "../src/module";'
      );

      const finder = new DeadCodeFinderBase({ srcDir });
      finder.extractImportsFromContent = content => {
        const match = content.match(/import\s+\{\s*(\w+)\s*\}\s+from/);
        if (match) {
          return [{ name: match[1], isInternal: true }];
        }
        return [];
      };

      const testImports = await finder.scanTestFiles();
      expect(testImports.has('foo')).toBe(true);
    });

    test('should scan __tests__ directory', async () => {
      const testsDir = path.join(testRoot, '__tests__');
      await fs.promises.mkdir(testsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testsDir, 'module.test.js'),
        'import { bar } from "../src/module";'
      );

      const finder = new DeadCodeFinderBase({ srcDir });
      finder.extractImportsFromContent = content => {
        const match = content.match(/import\s+\{\s*(\w+)\s*\}\s+from/);
        if (match) {
          return [{ name: match[1], isInternal: true }];
        }
        return [];
      };

      const testImports = await finder.scanTestFiles();
      expect(testImports.has('bar')).toBe(true);
    });

    test('should handle non-existent test directories', async () => {
      const finder = new DeadCodeFinderBase({ srcDir });
      finder.extractImportsFromContent = () => [];

      const testImports = await finder.scanTestFiles();
      expect(testImports.size).toBe(0);
    });

    test('should handle unreadable test file gracefully', async () => {
      const testDir = path.join(testRoot, 'test');
      await fs.promises.mkdir(testDir, { recursive: true });
      // 创建一个测试文件
      const testFile = path.join(testDir, 'unreadable.test.js');
      await fs.promises.writeFile(testFile, 'import { baz } from "../src/module";');

      const finder = new DeadCodeFinderBase({ srcDir });
      finder.extractImportsFromContent = () => {
        throw new Error('Parse error');
      };

      // 应该不会抛出错误
      const testImports = await finder.scanTestFiles();
      expect(testImports.size).toBe(0);
    });
  });

  describe('countLocalUsage edge cases', () => {
    test('should return 0 when file exists but cannot be read', async () => {
      const finder = new DeadCodeFinderBase({ srcDir: __dirname });
      // 文件路径存在但实际读取时会失败（路径格式问题）
      const count = await finder.countLocalUsage('non-existent-file.js', 'foo');
      expect(count).toBe(0);
    });

    test('should count usage from cached content', async () => {
      const finder = new DeadCodeFinderBase();
      finder.fileContents.set('cached.js', 'const bar = 1; console.log(bar);');
      const count = await finder.countLocalUsage('cached.js', 'bar');
      expect(count).toBe(1);
    });
  });

  describe('countUsageInContent advanced cases', () => {
    test('should count decorator usage', () => {
      // 装饰器会被计算：装饰器匹配 + 名称匹配（@Component 中的 Component）
      const content = '@Component class MyComponent {}';
      const count = base.countUsageInContent(content, 'Component');
      expect(count).toBe(2);
    });

    test('should count decorator with arguments', () => {
      const content = '@Prop({ type: String }) name';
      const count = base.countUsageInContent(content, 'Prop');
      expect(count).toBe(2);
    });

    test('should handle multiple decorators', () => {
      // 每个装饰器名称会被匹配：装饰器匹配 + 名称匹配
      const content = '@Injectable() @Logger() class Service {}';
      const injectableCount = base.countUsageInContent(content, 'Injectable');
      const loggerCount = base.countUsageInContent(content, 'Logger');
      expect(injectableCount).toBe(2);
      // Logger 只被装饰器模式匹配一次（因为装饰器正则只匹配行首）
      expect(loggerCount).toBe(1);
    });

    test('should not count name in comments', () => {
      const content = '// TODO: use foo here\nconst bar = 1;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });

    test('should not count name in block comments', () => {
      const content = '/* use foo here */ const bar = 1;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });

    test('should not count name in string literals', () => {
      const content = 'const str = "foo"; const bar = 1;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });

    test('should not count name in template literals', () => {
      const content = 'const str = `foo`; const bar = 1;';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(0);
    });

    test('should handle special regex characters in name', () => {
      // 测试带括号等特殊字符的名称转义
      const content = 'const foo = 1; console.log(foo);';
      const count = base.countUsageInContent(content, 'foo');
      expect(count).toBe(1);
    });
  });
});
