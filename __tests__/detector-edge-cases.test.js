const path = require('path');
const fs = require('fs');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');

describe('detector.js - 边界情况和错误处理测试', () => {
  let finder;
  let fixturesDir;

  beforeEach(() => {
    fixturesDir = path.join(__dirname, 'fixtures');
    finder = new DeadCodeFinder({
      srcDir: fixturesDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });
  });

  describe('空文件处理测试', () => {
    test('应该正确处理空 JS 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-empty-js-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const emptyFile = path.join(tempDir, 'empty.js');
      fs.writeFileSync(emptyFile, '');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(emptyFile);

      expect(tempFinder.fileContents.has('empty.js')).toBe(true);
      expect(tempFinder.exports.has('empty.js')).toBe(false);
      expect(tempFinder.imports.has('empty.js')).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该正确处理空 Vue 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-empty-vue-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const emptyVueFile = path.join(tempDir, 'Empty.vue');
      fs.writeFileSync(emptyVueFile, '');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(emptyVueFile);

      expect(tempFinder.fileContents.has('Empty.vue')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该正确处理只有空白字符的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-whitespace-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const whitespaceFile = path.join(tempDir, 'whitespace.js');
      fs.writeFileSync(whitespaceFile, '   \n\t\n   ');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(whitespaceFile);

      expect(tempFinder.fileContents.has('whitespace.js')).toBe(true);
      expect(tempFinder.exports.has('whitespace.js')).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该正确处理只有注释的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-comment-only-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const commentFile = path.join(tempDir, 'comments.js');
      fs.writeFileSync(commentFile, '// 这是一个注释\n/* 多行注释 */');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(commentFile);

      expect(tempFinder.fileContents.has('comments.js')).toBe(true);
      expect(tempFinder.exports.has('comments.js')).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('超大文件跳过测试', () => {
    test('应该跳过超过大小限制的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-large-file-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const largeFile = path.join(tempDir, 'large.js');
      const largeContent = 'export const x = 1;\n'.repeat(100000);
      fs.writeFileSync(largeFile, largeContent);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: 1000,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(largeFile);
      consoleSpy.mockRestore();

      expect(tempFinder.exports.has('large.js')).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理刚好在大小限制边界上的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-boundary-size-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const boundaryFile = path.join(tempDir, 'boundary.js');
      const content = 'export const x = 1;';
      fs.writeFileSync(boundaryFile, content);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: content.length + 1,
      });

      await tempFinder.parseFile(boundaryFile);

      expect(tempFinder.exports.has('boundary.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理零字节文件', async () => {
      const tempDir = path.join(__dirname, 'temp-zero-byte-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const zeroFile = path.join(tempDir, 'zero.js');
      fs.writeFileSync(zeroFile, '');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        maxFileSize: 1,
      });

      await tempFinder.parseFile(zeroFile);

      expect(tempFinder.fileContents.has('zero.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('无效语法文件处理测试', () => {
    test('应该处理未闭合花括号的 JS 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-unclosed-brace-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'unclosed.js');
      fs.writeFileSync(invalidFile, 'function foo() { return 1;');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('unclosed.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理未闭合括号的 JS 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-unclosed-paren-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'unclosed-paren.js');
      fs.writeFileSync(invalidFile, 'const foo = (1 + 2;');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('unclosed-paren.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理未闭合字符串的 JS 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-unclosed-string-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'unclosed-string.js');
      fs.writeFileSync(invalidFile, 'const foo = "unclosed string;');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('unclosed-string.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效导入语句的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-invalid-import-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'invalid-import.js');
      fs.writeFileSync(invalidFile, 'import { from "module";');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('invalid-import.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效导出语句的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-invalid-export-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'invalid-export.js');
      fs.writeFileSync(invalidFile, 'export { foo from "./module";');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('invalid-export.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效 TypeScript 语法的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-invalid-ts-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'invalid.ts');
      fs.writeFileSync(invalidFile, 'const foo: = 1;');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('invalid.ts')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效 JSX 语法的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-invalid-jsx-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidFile = path.join(tempDir, 'invalid.jsx');
      fs.writeFileSync(invalidFile, 'const elem = <div><span></div></span>;');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('invalid.jsx')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效 Vue 文件 - script 内容无效', async () => {
      const tempDir = path.join(__dirname, 'temp-invalid-vue-script-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const invalidVueFile = path.join(tempDir, 'InvalidScript.vue');
      fs.writeFileSync(
        invalidVueFile,
        `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default { name: 'Test'
        </script>
      `
      );

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.parseFile(invalidVueFile);
      consoleSpy.mockRestore();

      expect(tempFinder.fileContents.has('InvalidScript.vue')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理无效 Vue 文件 - 没有 script 块', async () => {
      const tempDir = path.join(__dirname, 'temp-no-script-vue-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const noScriptVueFile = path.join(tempDir, 'NoScript.vue');
      fs.writeFileSync(
        noScriptVueFile,
        `
        <template>
          <div>Hello</div>
        </template>
      `
      );

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(noScriptVueFile);

      expect(tempFinder.fileContents.has('NoScript.vue')).toBe(true);
      expect(tempFinder.components.has('NoScript.vue')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('并发场景测试', () => {
    test('应该并发解析多个文件', async () => {
      const tempDir = path.join(__dirname, 'temp-concurrent-parse-test');
      fs.mkdirSync(tempDir, { recursive: true });

      const fileCount = 20;
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
      }

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 5,
      });

      const startTime = Date.now();
      await tempFinder.analyze();
      const elapsed = Date.now() - startTime;

      expect(tempFinder.exports.size).toBeGreaterThanOrEqual(fileCount);
      expect(elapsed).toBeLessThan(10000);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该正确处理并发时的文件读取错误', async () => {
      const tempDir = path.join(__dirname, 'temp-concurrent-error-test');
      fs.mkdirSync(tempDir, { recursive: true });

      for (let i = 0; i < 5; i++) {
        const filePath = path.join(tempDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
      }

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 2,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await tempFinder.analyze();
      consoleSpy.mockRestore();

      expect(tempFinder.exports.size).toBeGreaterThanOrEqual(0);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该在高并发下保持数据一致性', async () => {
      const tempDir = path.join(__dirname, 'temp-high-concurrency-test');
      fs.mkdirSync(tempDir, { recursive: true });

      const fileCount = 50;
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
      }

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 10,
      });

      await tempFinder.analyze();

      expect(tempFinder.exports.size).toBeGreaterThanOrEqual(fileCount);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该正确处理并发时的混合文件类型', async () => {
      const tempDir = path.join(__dirname, 'temp-mixed-concurrent-test');
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(path.join(tempDir, 'file.js'), 'export const js = 1;');
      fs.writeFileSync(path.join(tempDir, 'component.jsx'), 'export const jsx = 2;');
      fs.writeFileSync(path.join(tempDir, 'types.ts'), 'export const ts = 3;');
      fs.writeFileSync(path.join(tempDir, 'Component.tsx'), 'export const tsx = 4;');
      fs.writeFileSync(
        path.join(tempDir, 'VueComp.vue'),
        `
        <script>
        export const vue = 5;
        </script>
      `
      );

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
        concurrency: 3,
      });

      await tempFinder.analyze();

      expect(tempFinder.exports.size).toBeGreaterThanOrEqual(5);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('文件不存在测试', () => {
    test('应该处理不存在的文件', async () => {
      const nonExistentFile = path.join(fixturesDir, 'non-existent-file.js');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(nonExistentFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('non-existent-file.js')).toBe(false);
    });

    test('应该处理路径无效的文件', async () => {
      const invalidPath = path.join(fixturesDir, 'invalid', 'path', 'file.js');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(invalidPath);
      consoleSpy.mockRestore();

      expect(finder.exports.has('file.js')).toBe(false);
    });
  });

  describe('特殊字符处理测试', () => {
    test('应该处理包含 Unicode 字符的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-unicode-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const unicodeFile = path.join(tempDir, 'unicode.js');
      fs.writeFileSync(
        unicodeFile,
        `
        const 你好 = '世界';
        const emoji = '🎉';
        export { 你好, emoji };
      `
      );

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(unicodeFile);

      expect(tempFinder.fileContents.has('unicode.js')).toBe(true);
      expect(tempFinder.exports.has('unicode.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理包含特殊字符文件名的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-special-name-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const specialFile = path.join(tempDir, 'special-file_测试.js');
      fs.writeFileSync(specialFile, 'export const special = "测试";');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(specialFile);

      expect(tempFinder.fileContents.size).toBeGreaterThan(0);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('内存和性能边界测试', () => {
    test('应该处理深层嵌套的代码结构', async () => {
      const tempDir = path.join(__dirname, 'temp-deep-nested-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const nestedFile = path.join(tempDir, 'nested.js');

      let content = 'const obj = ';
      for (let i = 0; i < 100; i++) {
        content += '{ a: ';
      }
      content += '1';
      for (let i = 0; i < 100; i++) {
        content += ' }';
      }
      content += ';';

      fs.writeFileSync(nestedFile, content);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(nestedFile);

      expect(tempFinder.fileContents.has('nested.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理超长单行代码', async () => {
      const tempDir = path.join(__dirname, 'temp-long-line-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const longLineFile = path.join(tempDir, 'longline.js');
      const content = `const x = ${'1 + '.repeat(1000)}1;`;
      fs.writeFileSync(longLineFile, content);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(longLineFile);

      expect(tempFinder.fileContents.has('longline.js')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该处理大量导出的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-many-exports-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const manyExportsFile = path.join(tempDir, 'many-exports.js');

      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `export const item${i} = ${i};\n`;
      }
      fs.writeFileSync(manyExportsFile, content);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(manyExportsFile);

      expect(tempFinder.exports.has('many-exports.js')).toBe(true);
      const exports = tempFinder.exports.get('many-exports.js');
      expect(exports.length).toBeGreaterThanOrEqual(100);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
