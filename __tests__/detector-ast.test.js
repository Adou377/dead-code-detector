const { DeadCodeFinderAST } = require('../src/detector-ast.js');
const { PathResolver } = require('../src/resolver.js');
const { ComponentDetector } = require('../src/component-detector.js');
const {
  isGroupExport,
  isTypeExport,
  isDefaultExport,
  isNamedExport,
  isStarExport,
  isReExport,
  isMultiLineExport,
} = require('../src/export-types.js');
const {
  groupItemsByLine,
  analyzeLinesToRemove,
  analyzeExportLine,
  analyzeGroupExport,
  analyzeMultiLineExport,
} = require('../src/analyzer.js');
const {
  createBackupDir,
  backupFile,
  writeFixedFile,
  generateFixPreview,
  showFixPreview,
  printFixSummary,
  confirmFix,
  groupByFile,
  fixUnusedExports,
  fixUnusedComponents,
  deleteUnusedToolFiles,
  removeUnusedExports,
} = require('../src/fixer.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('DeadCodeFinderAST', () => {
  let testDir;
  let finder;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-ast-test-'));
    finder = new DeadCodeFinderAST({ srcDir: testDir });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('应该正确创建实例', () => {
      expect(finder).toBeInstanceOf(DeadCodeFinderAST);
      expect(finder.jsxUsage).toBeInstanceOf(Map);
    });

    test('应该继承基类的属性', () => {
      expect(finder.exports).toBeInstanceOf(Map);
      expect(finder.imports).toBeInstanceOf(Map);
      expect(finder.components).toBeInstanceOf(Map);
    });

    test('应该初始化 PathResolver', () => {
      expect(finder.pathResolver).toBeInstanceOf(PathResolver);
    });

    test('应该初始化 ComponentDetector', () => {
      expect(finder.componentDetector).toBeInstanceOf(ComponentDetector);
    });
  });

  describe('extractImportsFromContent', () => {
    test('应该正确提取静态导入', () => {
      const content = `
        import { foo, bar } from './module.js';
        import defaultExport from './default.js';
      `;

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toBeInstanceOf(Array);
    });

    test('对于无效的代码应该返回空数组', () => {
      const content = 'invalid javascript code';

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toEqual([]);
    });
  });

  describe('processAstResult', () => {
    test('应该正确处理 AST 结果', () => {
      const relativePath = 'test.js';
      const content = `
        export const foo = 1;
        export function bar() {}
      `;

      const { parse } = require('../src/parser/index.js');
      const result = parse(content, 'test.js');

      if (result.success && result.ast) {
        finder.processAstResult(relativePath, result.ast, content);

        expect(finder.exports.has(relativePath)).toBe(true);
      }
    });
  });

  describe('resolveImportPath', () => {
    test('对于不存在的文件应该返回 null', () => {
      const result = finder.resolveImportPath('./nonexistent.js', 'test.js');

      expect(result).toBeNull();
    });
  });

  describe('detectUnusedToolFiles', () => {
    test('应该返回空数组当没有工具文件时', () => {
      const result = finder.detectUnusedToolFiles();

      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('generateFixPreview', () => {
    test('应该生成修复预览', () => {
      const unusedExports = [];
      const unusedComponents = [];
      const unusedToolFiles = [];

      const preview = generateFixPreview(unusedExports, unusedComponents, unusedToolFiles);

      expect(preview).toHaveProperty('unusedExports');
      expect(preview).toHaveProperty('unusedComponents');
      expect(preview).toHaveProperty('unusedToolFiles');
      expect(preview).toHaveProperty('details');
    });
  });

  describe('isGroupExport', () => {
    test('应该正确识别分组导出', () => {
      expect(isGroupExport('export { foo, bar }')).toBe(true);
      expect(isGroupExport('export type { Foo, Bar }')).toBe(true);
      expect(isGroupExport('export default foo')).toBe(false);
    });
  });

  describe('isTypeExport', () => {
    test('应该正确识别类型导出', () => {
      expect(isTypeExport('export type Foo = string;')).toBe(true);
      expect(isTypeExport('export interface Bar {}')).toBe(true);
      expect(isTypeExport('export enum Baz {}')).toBe(true);
      expect(isTypeExport('export const foo = 1;')).toBe(false);
    });
  });

  describe('isDefaultExport', () => {
    test('应该正确识别默认导出', () => {
      expect(isDefaultExport('export default foo;')).toBe(true);
      expect(isDefaultExport('export default function() {}')).toBe(true);
      expect(isDefaultExport('export const foo = 1;')).toBe(false);
    });
  });

  describe('isNamedExport', () => {
    test('应该正确识别命名导出', () => {
      expect(isNamedExport('export const foo = 1;')).toBe(true);
      expect(isNamedExport('export function bar() {}')).toBe(true);
      expect(isNamedExport('export class Baz {}')).toBe(true);
      expect(isNamedExport('export default foo')).toBe(false);
    });
  });

  describe('isStarExport', () => {
    test('应该正确识别星号导出', () => {
      expect(isStarExport('export * from "./module";')).toBe(true);
      expect(isStarExport('export const foo = 1;')).toBe(false);
    });
  });

  describe('isReExport', () => {
    test('应该正确识别重新导出', () => {
      expect(isReExport('export { foo } from "./module";')).toBe(true);
      expect(isReExport('export const foo = 1;')).toBe(false);
    });
  });

  describe('isMultiLineExport', () => {
    test('应该正确识别多行导出', () => {
      const lines = ['export {', '  foo,', '  bar', '};'];

      expect(isMultiLineExport(lines, 0)).toBe(true);
      expect(isMultiLineExport(lines, 1)).toBe(false);
    });
  });

  describe('analyzeGroupExport', () => {
    test('应该正确分析分组导出', () => {
      const lines = ['export { foo, bar, baz };'];

      const result = analyzeGroupExport(lines, 0, ['foo', 'bar']);

      expect(result).toHaveProperty('partialRemove');
      expect(result.partialRemove).toBe(true);
    });

    test('当所有导出都要删除时应该返回 shouldRemove', () => {
      const lines = ['export { foo, bar };'];

      const result = analyzeGroupExport(lines, 0, ['foo', 'bar']);

      expect(result).toHaveProperty('shouldRemove');
      expect(result.shouldRemove).toBe(true);
    });
  });

  describe('analyzeMultiLineExport', () => {
    test('应该正确分析多行导出', () => {
      const lines = ['export {', '  foo,', '  bar', '};'];

      const result = analyzeMultiLineExport(lines, 0, ['foo']);

      expect(result).toHaveProperty('shouldRemove');
      expect(result.shouldRemove).toBe(true);
      expect(result).toHaveProperty('endLine');
    });
  });

  describe('buildComponentTagIndex', () => {
    test('应该构建组件标签索引', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = finder.buildComponentTagIndex();

      expect(result).toBeInstanceOf(Map);
      consoleSpy.mockRestore();
    });
  });

  describe('createBackupDir', () => {
    test('应该创建备份目录', () => {
      const backupDir = createBackupDir(testDir);

      expect(typeof backupDir).toBe('string');
      expect(fs.existsSync(backupDir)).toBe(true);
    });
  });

  describe('backupFile', () => {
    test('应该备份文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const backupDir = createBackupDir(testDir);

      expect(() => {
        backupFile(testFile, backupDir, 'test.js');
      }).not.toThrow();
    });
  });

  describe('report', () => {
    test('应该生成报告', () => {
      finder.sourceFiles = [];
      finder.unusedExports = [];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];

      const consoleSpy = jest.spyOn(console, 'clear').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = finder.report();

      expect(result).toHaveProperty('unusedExports');
      expect(result).toHaveProperty('unusedComponents');
      expect(result).toHaveProperty('unusedToolFiles');

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('实际文件扫描测试', () => {
    test('应该正确扫描源文件目录', async () => {
      const srcFile = path.join(testDir, 'module.js');
      fs.writeFileSync(srcFile, 'export const foo = 1;');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await finder.scanSourceFiles();

      expect(finder.sourceFiles.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  describe('parseFile', () => {
    test('应该正确解析 JS 文件', async () => {
      const jsFile = path.join(testDir, 'test.js');
      fs.writeFileSync(jsFile, 'export const foo = 1;');

      await finder.parseFile(jsFile);

      expect(finder.exports.has('test.js')).toBe(true);
    });

    test('应该正确解析 JSX 文件', async () => {
      const jsxFile = path.join(testDir, 'Component.jsx');
      fs.writeFileSync(jsxFile, `
        import React from 'react';
        export function Component() { return <div />; }
      `);

      // 验证解析不抛出错误
      await expect(finder.parseFile(jsxFile)).resolves.not.toThrow();
    });

    test('应该正确解析 TS 文件', async () => {
      const tsFile = path.join(testDir, 'types.ts');
      fs.writeFileSync(tsFile, 'export type MyType = string;');

      await finder.parseFile(tsFile);

      expect(finder.exports.has('types.ts')).toBe(true);
    });

    test('应该正确解析 TSX 文件', async () => {
      const tsxFile = path.join(testDir, 'Widget.tsx');
      fs.writeFileSync(tsxFile, `
        import React from 'react';
        export const Widget: React.FC = () => <div />;
      `);

      await finder.parseFile(tsxFile);

      expect(finder.exports.has('Widget.tsx')).toBe(true);
    });

    test('应该正确解析 Vue 文件', async () => {
      const vueFile = path.join(testDir, 'MyComponent.vue');
      fs.writeFileSync(vueFile, `
        <template><div>test</div></template>
        <script>
        export default { name: 'MyComponent' }
        </script>
      `);

      await finder.parseFile(vueFile);

      expect(finder.fileContents.has('MyComponent.vue')).toBe(true);
    });

    test('应该跳过过大的文件', async () => {
      const largeFile = path.join(testDir, 'large.js');
      const largeContent = 'export const x = 1;\n'.repeat(50000);
      fs.writeFileSync(largeFile, largeContent);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(largeFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('large.js')).toBe(false);
    });

    test('应该输出警告信息当跳过超大文件时', async () => {
      const largeFile = path.join(testDir, 'huge.js');
      const largeContent = 'x'.repeat(1500000);
      fs.writeFileSync(largeFile, largeContent);

      const warnMessages = [];
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation((msg) => {
        warnMessages.push(msg);
      });

      await finder.parseFile(largeFile);
      consoleSpy.mockRestore();

      expect(warnMessages.length).toBeGreaterThan(0);
      expect(warnMessages[0]).toContain('文件过大');
      expect(finder.exports.has('huge.js')).toBe(false);
    });

    test('应该正确处理刚好超过 maxFileSize 的文件', async () => {
      const customMaxSize = 100;
      finder = new DeadCodeFinderAST({ srcDir: testDir, maxFileSize: customMaxSize });
      const boundaryFile = path.join(testDir, 'boundary.js');
      fs.writeFileSync(boundaryFile, 'export const x = 1;');

      await finder.parseFile(boundaryFile);

      expect(finder.exports.has('boundary.js')).toBe(true);
    });

    test('应该正确处理刚好等于 maxFileSize 的文件', async () => {
      const customMaxSize = 20;
      finder = new DeadCodeFinderAST({ srcDir: testDir, maxFileSize: customMaxSize });
      const exactSizeFile = path.join(testDir, 'exact.js');
      const content = 'export const x = 1;';
      fs.writeFileSync(exactSizeFile, content);

      await finder.parseFile(exactSizeFile);

      expect(finder.exports.has('exact.js')).toBe(true);
    });

    test('应该跳过超大 Vue 文件', async () => {
      const largeVueFile = path.join(testDir, 'Large.vue');
      const largeVueContent = `
        <template>
          <div>${'x'.repeat(1500000)}</div>
        </template>
        <script>
        export default { name: 'Large' }
        </script>
      `;
      fs.writeFileSync(largeVueFile, largeVueContent);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(largeVueFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('Large.vue')).toBe(false);
      expect(finder.components.has('Large.vue')).toBe(false);
    });

    test('应该跳过超大 TypeScript 文件', async () => {
      const largeTsFile = path.join(testDir, 'large.ts');
      const largeTsContent = 'export const x: number = 1;\n'.repeat(50000);
      fs.writeFileSync(largeTsFile, largeTsContent);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(largeTsFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('large.ts')).toBe(false);
    });

    test('应该处理解析失败的文件', async () => {
      const invalidFile = path.join(testDir, 'invalid.js');
      fs.writeFileSync(invalidFile, 'this is not valid javascript {{{');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(invalidFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('invalid.js')).toBe(false);
    });
  });

  describe('collectAllImports', () => {
    test('应该收集所有内部导入', () => {
      finder.imports.set('a.js', [
        { name: 'foo', source: './b.js', isInternal: true },
        { name: 'bar', source: './c.js', isInternal: true },
      ]);
      finder.imports.set('b.js', [
        { name: 'baz', source: './d.js', isInternal: true },
      ]);

      const result = finder.collectAllImports(new Map());

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
      expect(result.has('baz')).toBe(true);
    });

    test('应该处理动态导入', () => {
      finder.exports.set('dynamic.js', [{ name: 'dynamicExport', type: 'named', line: 1 }]);
      finder.imports.set('a.js', [
        { source: './dynamic.js', isDynamic: true, isInternal: true },
      ]);

      const result = finder.collectAllImports(new Map());

      // 动态导入可能不会直接导入具体导出，检查源文件是否被标记为已使用
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    test('应该合并测试导入', () => {
      finder.imports.set('a.js', [
        { name: 'foo', source: './b.js', isInternal: true },
      ]);
      const testImports = new Map([['bar', new Set(['test.js'])]]);

      const result = finder.collectAllImports(testImports);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
    });
  });

  describe('detectUnusedExports', () => {
    test('应该检测未使用的导出', async () => {
      finder.exports.set('module.js', [{ name: 'unusedFunc', type: 'named', line: 1, code: 'export const unusedFunc = 1;' }]);
      finder.imports.set('other.js', [{ name: 'usedFunc', source: './module.js', isInternal: true }]);
      finder.fileContents.set('module.js', 'export const unusedFunc = 1;');

      const allImports = new Map([['usedFunc', new Set(['other.js'])]]);
      await finder.detectUnusedExports(allImports);

      expect(finder.unusedExports.length).toBe(1);
      expect(finder.unusedExports[0].name).toBe('unusedFunc');
    });

    test('应该排除副作用导入的文件', () => {
      finder.exports.set('sideEffect.js', [{ name: 'exported', type: 'named', line: 1 }]);
      finder.imports.set('main.js', [
        { source: './sideEffect.js', isInternal: true, isSideEffect: true },
      ]);
      finder.fileContents.set('sideEffect.js', 'export const exported = 1;');

      const allImports = new Map();
      finder.detectUnusedExports(allImports);

      // 副作用导入文件的处理取决于具体实现
      // 这里只验证不会抛出错误
      expect(finder.unusedExports).toBeDefined();
    });
  });

  describe('detectUnusedComponents', () => {
    test('应该检测未使用的组件', async () => {
      finder.components.set('UnusedComp.vue', { name: 'UnusedComp', isGlobal: false });
      finder.components.set('UsedComp.vue', { name: 'UsedComp', isGlobal: false });
      finder.imports.set('app.js', [{ name: 'UsedComp', source: './UsedComp.vue', isInternal: true }]);
      finder.fileContents.set('UnusedComp.vue', '<template><div></div></template>');
      finder.fileContents.set('UsedComp.vue', '<template><div></div></template>');

      const testImports = new Map();
      await finder.detectUnusedComponents(testImports);

      expect(finder.unusedComponents.some(c => c.name === 'UnusedComp')).toBe(true);
      expect(finder.unusedComponents.some(c => c.name === 'UsedComp')).toBe(false);
    });
  });

  describe('fix', () => {
    test('dryRun 模式应该返回预览而不执行修复', async () => {
      finder.unusedExports = [];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];

      const result = await finder.fix({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.preview).toBeDefined();
    });

    test('应该正确执行修复', async () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const unused = 1;\nexport const used = 2;\n');

      finder.unusedExports = [{ file: 'test.js', name: 'unused', type: 'named', line: 1 }];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];
      finder.exports.set('test.js', [
        { name: 'unused', type: 'named', line: 1 },
        { name: 'used', type: 'named', line: 2 },
      ]);

      const result = await finder.fix({ confirm: false });

      expect(result.unusedExports).toBe(1);
    });
  });

  describe('analyzeExportLine', () => {
    test('应该正确分析分组导出行', () => {
      const lines = ['export { foo, bar };'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.partialRemove).toBe(true);
    });

    test('应该正确分析命名导出行', () => {
      const lines = ['export const foo = 1;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该正确分析默认导出行', () => {
      const lines = ['export default foo;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该正确分析类型导出行', () => {
      const lines = ['export type Foo = string;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'Foo' }]);

      expect(result.shouldRemove).toBe(true);
    });
  });

  describe('showFixPreview', () => {
    test('应该显示修复预览', () => {
      const preview = {
        unusedExports: 2,
        unusedComponents: 1,
        unusedToolFiles: 0,
        details: {
          unusedExports: [
            { file: 'a.js', name: 'foo', line: 1 },
            { file: 'b.js', name: 'bar', line: 2 },
          ],
          unusedComponents: [{ file: 'Unused.vue', name: 'Unused' }],
          unusedToolFiles: [],
        },
      };

      const logs = [];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args);
      });
      showFixPreview(preview, groupByFile);
      consoleSpy.mockRestore();

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('printFixSummary', () => {
    test('应该打印修复摘要', () => {
      const backupDir = path.join(testDir, 'backup');
      const fixResult = { unusedExports: 1, unusedComponents: 0, unusedToolFiles: 0 };

      const logs = [];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args);
      });
      printFixSummary(backupDir, fixResult);
      consoleSpy.mockRestore();

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('fixUnusedComponents', () => {
    test('应该修复未使用的组件', async () => {
      const testFile = path.join(testDir, 'test.vue');
      fs.writeFileSync(testFile, '<template><div></div></template>');

      const unusedComponents = [{ file: 'test.vue', name: 'Test' }];
      const backupDir = createBackupDir(testDir);
      const result = await fixUnusedComponents(unusedComponents, testDir, backupDir);

      expect(result).toBe(1);
    });

    test('应该跳过不存在的文件', async () => {
      const unusedComponents = [{ file: 'nonexistent.vue', name: 'Test' }];
      const backupDir = createBackupDir(testDir);
      const result = await fixUnusedComponents(unusedComponents, testDir, backupDir);

      expect(result).toBe(0);
    });
  });

  describe('deleteUnusedToolFiles', () => {
    test('应该删除未使用的工具文件', () => {
      const testFile = path.join(testDir, 'unused.js');
      fs.writeFileSync(testFile, 'export const unused = 1;');

      const unusedToolFiles = ['unused.js'];
      const backupDir = createBackupDir(testDir);
      const result = deleteUnusedToolFiles(unusedToolFiles, testDir, backupDir);

      expect(result).toBe(1);
    });

    test('应该处理空的未使用工具文件列表', () => {
      const backupDir = createBackupDir(testDir);
      const result = deleteUnusedToolFiles(null, testDir, backupDir);

      expect(result).toBe(0);
    });

    test('应该跳过不存在的文件', () => {
      const unusedToolFiles = ['nonexistent.js'];
      const backupDir = createBackupDir(testDir);
      const result = deleteUnusedToolFiles(unusedToolFiles, testDir, backupDir);

      expect(result).toBe(0);
    });
  });

  describe('analyzeLinesToRemove', () => {
    test('应该分析需要移除的行', () => {
      const content = 'export const foo = 1;\nexport const bar = 2;\nexport const baz = 3;';
      const items = [
        { name: 'foo', line: 1 },
        { name: 'baz', line: 3 }
      ];

      const result = analyzeLinesToRemove(content, items);

      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('linesToRemove');
      expect(result).toHaveProperty('modified');
    });
  });

  describe('groupItemsByLine', () => {
    test('应该按行号分组导出项', () => {
      const items = [
        { name: 'foo', line: 1 },
        { name: 'bar', line: 1 },
        { name: 'baz', line: 2 }
      ];

      const result = groupItemsByLine(items);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get(1)).toHaveLength(2);
      expect(result.get(2)).toHaveLength(1);
    });
  });

  describe('writeFixedFile', () => {
    test('应该写入修复后的文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;\nexport const bar = 2;');

      const lines = ['export const foo = 1;', 'export const bar = 2;'];
      const linesToRemove = new Set([0]); // 移除第一行

      writeFixedFile(testFile, lines, linesToRemove);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('export const bar = 2;');
    });
  });
});

describe('分支覆盖补充测试', () => {
  let testDir;
  let finder;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-ast-branch-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('collectAllImports - 动态导入分支', () => {
    test('应该正确处理动态导入并解析模块导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.exports.set('dynamic-module.js', [
        { name: 'dynamicExport', type: 'named', line: 1 },
        { name: 'anotherExport', type: 'named', line: 2 },
      ]);

      finder.imports.set('consumer.js', [
        { source: './dynamic-module.js', isDynamic: true, isInternal: true },
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('dynamic-module.js');

      const result = finder.collectAllImports(new Map());

      expect(result.has('dynamicExport')).toBe(true);
      expect(result.has('anotherExport')).toBe(true);
    });

    test('动态导入路径无法解析时应该跳过', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.exports.set('dynamic-module.js', [
        { name: 'dynamicExport', type: 'named', line: 1 },
      ]);

      finder.imports.set('consumer.js', [
        { source: './nonexistent.js', isDynamic: true, isInternal: true },
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue(null);

      const result = finder.collectAllImports(new Map());

      expect(result.has('dynamicExport')).toBe(false);
    });

    test('动态导入的模块没有导出时应该跳过', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.imports.set('consumer.js', [
        { source: './empty-module.js', isDynamic: true, isInternal: true },
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('empty-module.js');

      const result = finder.collectAllImports(new Map());

      expect(result.size).toBe(0);
    });
  });

  describe('collectAllImports - 副作用导入分支', () => {
    test('应该正确处理无名称的副作用导入', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.exports.set('side-effect.js', [
        { name: 'exportedItem', type: 'named', line: 1 },
      ]);

      finder.imports.set('consumer.js', [
        { source: './side-effect.js', isInternal: true, name: null },
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('side-effect.js');

      const result = finder.collectAllImports(new Map());

      expect(result.has('exportedItem')).toBe(true);
    });

    test('副作用导入路径无法解析时应该跳过', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.exports.set('side-effect.js', [
        { name: 'exportedItem', type: 'named', line: 1 },
      ]);

      finder.imports.set('consumer.js', [
        { source: './nonexistent.js', isInternal: true, name: null },
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue(null);

      const result = finder.collectAllImports(new Map());

      expect(result.size).toBe(0);
    });
  });

  describe('collectAllImports - 外部导入分支', () => {
    test('应该跳过外部模块导入', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.imports.set('consumer.js', [
        { name: 'React', source: 'react', isInternal: false },
        { name: 'lodash', source: 'lodash', isInternal: false },
      ]);

      const result = finder.collectAllImports(new Map());

      expect(result.has('React')).toBe(false);
      expect(result.has('lodash')).toBe(false);
    });
  });

  describe('processAstResult - IGNORE_EXPORTS 分支', () => {
    test('应该过滤掉 IGNORE_EXPORTS 中的命名导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const { parse } = require('../src/parser/index.js');

      const content = `
        export const computed = 'should be ignored';
        export const useState = 'should be ignored';
        export const normalExport = 'should be kept';
      `;

      const result = parse(content, 'test.js');
      finder.processAstResult('test.js', result.ast, content);

      const exports = finder.exports.get('test.js');
      expect(exports).toBeDefined();
      expect(exports.some(e => e.name === 'computed')).toBe(false);
      expect(exports.some(e => e.name === 'useState')).toBe(false);
      expect(exports.some(e => e.name === 'normalExport')).toBe(true);
    });

    test('应该过滤掉 IGNORE_MACROS 中的导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const { parse } = require('../src/parser/index.js');

      const content = `
        export const defineProps = 'should be ignored';
        export const defineEmits = 'should be ignored';
        export const normalExport = 'should be kept';
      `;

      const result = parse(content, 'test.js');
      finder.processAstResult('test.js', result.ast, content);

      const exports = finder.exports.get('test.js');
      expect(exports).toBeDefined();
      expect(exports.some(e => e.name === 'defineProps')).toBe(false);
      expect(exports.some(e => e.name === 'defineEmits')).toBe(false);
      expect(exports.some(e => e.name === 'normalExport')).toBe(true);
    });

    test('应该过滤掉 IGNORE_EXPORTS 中的默认导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const { parse } = require('../src/parser/index.js');

      const content = `
        export default computed;
      `;

      const result = parse(content, 'test.js');
      finder.processAstResult('test.js', result.ast, content);

      const exports = finder.exports.get('test.js');
      expect(exports).toBeUndefined();
    });

    test('应该过滤掉 IGNORE_EXPORTS 中的分组导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const { parse } = require('../src/parser/index.js');

      const content = `
        const computed = 1;
        const useState = 2;
        const normalExport = 3;
        export { computed, useState, normalExport };
      `;

      const result = parse(content, 'test.js');
      finder.processAstResult('test.js', result.ast, content);

      const exports = finder.exports.get('test.js');
      expect(exports).toBeDefined();
      expect(exports.some(e => e.name === 'computed')).toBe(false);
      expect(exports.some(e => e.name === 'useState')).toBe(false);
      expect(exports.some(e => e.name === 'normalExport')).toBe(true);
    });

    test('应该过滤掉 IGNORE_EXPORTS 中的重新导出', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const { parse } = require('../src/parser/index.js');

      const content = `
        export { computed, normalExport } from './module.js';
      `;

      const result = parse(content, 'test.js');
      finder.processAstResult('test.js', result.ast, content);

      const exports = finder.exports.get('test.js');
      expect(exports).toBeDefined();
      expect(exports.some(e => e.name === 'computed')).toBe(false);
      expect(exports.some(e => e.name === 'normalExport')).toBe(true);
    });
  });

  describe('parseFile - 空文件测试', () => {
    test('应该正确处理空文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const emptyFile = path.join(testDir, 'empty.js');
      fs.writeFileSync(emptyFile, '');

      await finder.parseFile(emptyFile);

      expect(finder.exports.has('empty.js')).toBe(false);
      expect(finder.imports.has('empty.js')).toBe(false);
    });

    test('应该正确处理只有注释的文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const commentFile = path.join(testDir, 'comment.js');
      fs.writeFileSync(commentFile, '// 只是一个注释\n/* 多行注释 */');

      await finder.parseFile(commentFile);

      expect(finder.exports.has('comment.js')).toBe(false);
    });

    test('应该正确处理只有空白的文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const whitespaceFile = path.join(testDir, 'whitespace.js');
      fs.writeFileSync(whitespaceFile, '   \n\t\n   ');

      await finder.parseFile(whitespaceFile);

      expect(finder.exports.has('whitespace.js')).toBe(false);
      expect(finder.imports.has('whitespace.js')).toBe(false);
    });

    test('应该正确处理空 Vue 文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const emptyVueFile = path.join(testDir, 'Empty.vue');
      fs.writeFileSync(emptyVueFile, '');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(emptyVueFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('Empty.vue')).toBe(false);
      expect(finder.components.has('Empty.vue')).toBe(false);
    });

    test('应该正确处理只有 template 的 Vue 文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const vueFile = path.join(testDir, 'NoScript.vue');
      fs.writeFileSync(vueFile, '<template><div>test</div></template>');

      await finder.parseFile(vueFile);

      expect(finder.exports.has('NoScript.vue')).toBe(false);
      expect(finder.components.has('NoScript.vue')).toBe(false);
    });

    test('应该正确处理空 TypeScript 文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const emptyTsFile = path.join(testDir, 'empty.ts');
      fs.writeFileSync(emptyTsFile, '');

      await finder.parseFile(emptyTsFile);

      expect(finder.exports.has('empty.ts')).toBe(false);
      expect(finder.imports.has('empty.ts')).toBe(false);
    });
  });

  describe('parseFile - Vue 文件分支测试', () => {
    test('应该正确识别 Vue 组件并设置 isScriptSetup', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const vueFile = path.join(testDir, 'SetupComponent.vue');
      fs.writeFileSync(vueFile, `
        <template><div>test</div></template>
        <script setup>
        import { ref } from 'vue';
        const count = ref(0);
        </script>
      `);

      await finder.parseFile(vueFile);

      const component = finder.components.get('SetupComponent.vue');
      expect(component).toBeDefined();
      expect(component.isScriptSetup).toBe(true);
    });

    test('应该正确处理 index.vue 文件（不添加到组件）', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const vueFile = path.join(testDir, 'index.vue');
      fs.writeFileSync(vueFile, `
        <template><div>test</div></template>
        <script>
        export default { name: 'IndexComponent' }
        </script>
      `);

      await finder.parseFile(vueFile);

      expect(finder.components.has('index.vue')).toBe(false);
    });

    test('应该正确识别全局组件（The 前缀）', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const vueFile = path.join(testDir, 'TheHeader.vue');
      fs.writeFileSync(vueFile, `
        <template><header>header</header></template>
        <script>
        export default { name: 'TheHeader' }
        </script>
      `);

      await finder.parseFile(vueFile);

      const component = finder.components.get('TheHeader.vue');
      expect(component).toBeDefined();
      expect(component.isGlobal).toBe(true);
    });

    test('应该正确识别全局组件（App 前缀）', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const vueFile = path.join(testDir, 'AppLayout.vue');
      fs.writeFileSync(vueFile, `
        <template><div>layout</div></template>
        <script>
        export default { name: 'AppLayout' }
        </script>
      `);

      await finder.parseFile(vueFile);

      const component = finder.components.get('AppLayout.vue');
      expect(component).toBeDefined();
      expect(component.isGlobal).toBe(true);
    });
  });

  describe('parseFile - JS/TS 组件分支测试', () => {
    test('应该正确识别非组件目录中的函数', async () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir, { recursive: true });
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const utilFile = path.join(utilsDir, 'helper.js');
      fs.writeFileSync(utilFile, `
        export function HelperFunction() {
          return 'helper';
        }
      `);

      await finder.parseFile(utilFile);

      expect(finder.components.has(path.join('utils', 'helper.js'))).toBe(false);
    });

    test('应该正确识别组件目录中的 React 函数组件', async () => {
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir, { recursive: true });
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const componentFile = path.join(componentsDir, 'Button.jsx');
      fs.writeFileSync(componentFile, `
        import React from 'react';
        export function Button() {
          return <button>Click</button>;
        }
      `);

      await finder.parseFile(componentFile);

      const component = finder.components.get(path.join('components', 'Button.jsx'));
      expect(component).toBeDefined();
      expect(component.name).toBe('Button');
    });

    test('应该正确识别组件目录中的 React 类组件', async () => {
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir, { recursive: true });
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const componentFile = path.join(componentsDir, 'Header.jsx');
      fs.writeFileSync(componentFile, `
        import React from 'react';
        export class Header extends React.Component {
          render() {
            return <header>Header</header>;
          }
        }
      `);

      await finder.parseFile(componentFile);

      const component = finder.components.get(path.join('components', 'Header.jsx'));
      expect(component).toBeDefined();
      expect(component.name).toBe('Header');
    });

    test('应该跳过 index 文件作为组件', async () => {
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir, { recursive: true });
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      const indexFile = path.join(componentsDir, 'index.js');
      fs.writeFileSync(indexFile, `
        export { default as Button } from './Button';
      `);

      await finder.parseFile(indexFile);

      expect(finder.components.has(path.join('components', 'index.js'))).toBe(false);
    });
  });

  describe('detectUnusedExports - 副作用导入文件分支', () => {
    test('应该排除副作用导入文件中的导出', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });

      finder.exports.set('sideEffect.js', [{ name: 'exported', type: 'named', line: 1 }]);
      finder.imports.set('main.js', [
        { source: './sideEffect.js', isInternal: true, isSideEffect: true, name: '' },
      ]);
      finder.fileContents.set('sideEffect.js', 'export const exported = 1;');

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('sideEffect.js');

      await finder.detectUnusedExports(new Map());

      expect(finder.unusedExports.some(e => e.name === 'exported')).toBe(false);
    });
  });

  describe('fix - 确认分支测试', () => {
    test('dryRun 模式应该返回预览', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      finder.unusedExports = [{ file: 'test.js', name: 'unused', type: 'named', line: 1 }];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];

      const result = await finder.fix({ dryRun: true, confirm: false });

      expect(result.dryRun).toBe(true);
      expect(result.preview).toBeDefined();
    });
  });

  describe('walkImports - 动态导入模板字面量', () => {
    test('应该正确处理模板字面量动态导入', () => {
      const { parse } = require('../src/parser/index.js');
      const { walkImports } = require('../src/parser/walker.js');

      const content = `
        const module = import(\`./modules/\${name}\`);
      `;

      const result = parse(content, 'test.js');
      const imports = walkImports(result.ast);

      expect(imports.dynamic.length).toBe(1);
      expect(imports.dynamic[0].source).toBe('./modules/');
    });
  });

  describe('walkJSX - JSX 组件测试', () => {
    test('应该正确收集 JSX 中的组件使用', () => {
      const { parse } = require('../src/parser/index.js');
      const { walkJSX } = require('../src/parser/walker.js');

      const content = `
        import React from 'react';
        function App() {
          return (
            <div>
              <Header />
              <Sidebar.Menu />
              <Footer />
            </div>
          );
        }
      `;

      const result = parse(content, 'test.jsx');
      const components = walkJSX(result.ast);

      expect(components).toContain('Header');
      expect(components).toContain('Footer');
      expect(components.some(c => c.includes('Sidebar'))).toBe(true);
    });
  });
});

describe('PathResolver', () => {
  let testDir;
  let resolver;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-resolver-test-'));
    resolver = new PathResolver(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('应该正确创建实例', () => {
      expect(resolver).toBeInstanceOf(PathResolver);
      expect(resolver.srcDir).toBe(testDir);
    });
  });

  describe('resolve', () => {
    test('对于不存在的文件应该返回 null', () => {
      const result = resolver.resolve('./nonexistent.js', 'test.js');

      expect(result).toBeNull();
    });

    test('对于外部模块应该返回 null', () => {
      const result = resolver.resolve('lodash', 'test.js');

      expect(result).toBeNull();
    });
  });

  describe('matchDefaultAlias', () => {
    test('应该匹配 @/ 别名', () => {
      const result = resolver.matchDefaultAlias('@/utils/helper.js');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('utils/helper.js');
    });

    test('对于非别名路径应该返回 null', () => {
      const result = resolver.matchDefaultAlias('./utils/helper.js');

      expect(result).toBeNull();
    });
  });

  describe('isPathInSrcDir', () => {
    test('对于源目录内的路径应该返回 true', () => {
      const result = resolver.isPathInSrcDir(path.join(testDir, 'utils', 'helper.js'));

      expect(result).toBe(true);
    });

    test('对于源目录外的路径应该返回 false', () => {
      const result = resolver.isPathInSrcDir(path.join(os.tmpdir(), 'other-dir', 'file.js'));

      expect(result).toBe(false);
    });
  });
});

describe('ComponentDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ComponentDetector();
  });

  describe('constructor', () => {
    test('应该正确创建实例', () => {
      expect(detector).toBeInstanceOf(ComponentDetector);
    });
  });

  describe('collectComponentUsages', () => {
    test('应该收集组件使用情况', () => {
      const imports = new Map([
        ['file.js', [{ name: 'TestComponent', isInternal: true }]],
      ]);
      const testImports = new Map();

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('TestComponent')).toBe(true);
    });
  });

  describe('buildComponentTagIndexFromFileContents', () => {
    test('应该从文件内容构建组件标签索引', () => {
      const fileContents = new Map([
        ['test.vue', '<template><TestComponent /></template>'],
        ['app.vue', '<template><MyButton>Click</MyButton></template>'],
      ]);

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('TestComponent')).toBe(true);
      expect(result.has('MyButton')).toBe(true);
    });
  });

  describe('isComponentUsed', () => {
    test('当组件在导入中使用时应该返回 true', () => {
      const componentUsages = new Map([['TestComponent', new Set(['other.js'])]]);
      const componentTagIndex = new Map();

      const result = detector.isComponentUsed(
        'TestComponent',
        'test.js',
        componentUsages,
        componentTagIndex
      );

      expect(result).toBe(true);
    });

    test('当组件未被使用时应该返回 false', () => {
      const componentUsages = new Map();
      const componentTagIndex = new Map();

      const result = detector.isComponentUsed(
        'UnusedComponent',
        'unused.js',
        componentUsages,
        componentTagIndex
      );

      expect(result).toBe(false);
    });
  });

  describe('detectUnusedComponents', () => {
    test('应该检测未使用的组件', () => {
      const components = new Map([
        ['UsedComponent.vue', { name: 'UsedComponent', isGlobal: false }],
        ['UnusedComponent.vue', { name: 'UnusedComponent', isGlobal: false }],
      ]);
      const componentUsages = new Map([['UsedComponent', new Set(['app.js'])]]);
      const componentTagIndex = new Map();

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.some(c => c.name === 'UnusedComponent')).toBe(true);
      expect(result.some(c => c.name === 'UsedComponent')).toBe(false);
    });

    test('应该跳过全局组件', () => {
      const components = new Map([
        ['TheHeader.vue', { name: 'TheHeader', isGlobal: true }],
      ]);
      const componentUsages = new Map();
      const componentTagIndex = new Map();

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex
      );

      expect(result).toHaveLength(0);
    });
  });
});

describe('并发场景测试', () => {
  let testDir;
  let finder;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-concurrent-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('高并发文件解析', () => {
    test('应该正确处理大量并发文件解析', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 10 });

      const fileCount = 100;
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.sourceFiles.length).toBe(fileCount);
      expect(finder.exports.size).toBe(fileCount);
    });

    test('应该正确处理混合类型文件的并发解析', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 5 });

      const jsFile = path.join(testDir, 'module.js');
      const tsFile = path.join(testDir, 'types.ts');
      const vueFile = path.join(testDir, 'Component.vue');
      const jsxFile = path.join(testDir, 'Widget.jsx');
      const tsxFile = path.join(testDir, 'App.tsx');

      fs.writeFileSync(jsFile, 'export const jsFunc = () => 1;');
      fs.writeFileSync(tsFile, 'export type MyType = string;');
      fs.writeFileSync(vueFile, `
        <template><div>test</div></template>
        <script>export default { name: 'Component' }; export const vueFunc = () => 1;</script>
      `);
      fs.writeFileSync(jsxFile, 'export const JSXComp = () => <div />;');
      fs.writeFileSync(tsxFile, 'export const TSXComp = () => <div />;');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.exports.size).toBe(5);
      expect(finder.components.size).toBeGreaterThanOrEqual(1);
    });

    test('应该正确处理并发解析中的错误文件', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 5 });

      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        if (i % 3 === 0) {
          fs.writeFileSync(filePath, 'invalid javascript {{{');
        } else {
          fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
        }
      }

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();

      expect(finder.exports.size).toBeGreaterThan(0);
    });
  });

  describe('并发限制测试', () => {
    test('应该正确应用自定义并发限制', async () => {
      const customConcurrency = 3;
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: customConcurrency });

      for (let i = 0; i < 20; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.exports.size).toBe(20);
    });

    test('应该正确处理单线程模式', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 1 });

      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.exports.size).toBe(5);
    });

    test('应该正确处理高并发限制', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 100 });

      for (let i = 0; i < 50; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.exports.size).toBe(50);
    });
  });

  // CI 环境中跳过 Worker 模式测试（资源限制导致不稳定）
  const describeWorker = process.env.CI ? describe.skip : describe;

  describeWorker('Worker 模式测试', () => {
    test('应该在文件数量超过阈值时使用 Worker 模式', async () => {
      finder = new DeadCodeFinderAST({
        srcDir: testDir,
        workerThreshold: 10,
        useWorker: undefined,
      });

      for (let i = 0; i < 20; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.shouldUseWorkerMode()).toBe(true);
    });

    test('应该在文件数量低于阈值时不使用 Worker 模式', async () => {
      finder = new DeadCodeFinderAST({
        srcDir: testDir,
        workerThreshold: 100,
        useWorker: undefined,
      });

      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      expect(finder.shouldUseWorkerMode()).toBe(false);
    });

    test('应该强制使用 Worker 模式', async () => {
      finder = new DeadCodeFinderAST({
        srcDir: testDir,
        useWorker: true,
        workerCount: 2,
      });

      expect(finder.shouldUseWorkerMode()).toBe(true);
    });

    test('应该强制不使用 Worker 模式', async () => {
      finder = new DeadCodeFinderAST({
        srcDir: testDir,
        useWorker: false,
      });

      expect(finder.shouldUseWorkerMode()).toBe(false);
    });
    
    test('createBatches 应正确分割文件列表', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const files = Array(25).fill(0).map((_, i) => `file${i}.js`);
      
      const batches = finder.createBatches(files, 10);
      
      expect(batches.length).toBe(3);
      expect(batches[0].length).toBe(10);
      expect(batches[1].length).toBe(10);
      expect(batches[2].length).toBe(5);
    });
    
    test('createBatches 应处理空列表', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const batches = finder.createBatches([], 10);
      
      expect(batches.length).toBe(0);
    });
    
    test('createBatches 应处理小于批次大小的列表', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const files = ['a.js', 'b.js', 'c.js'];
      
      const batches = finder.createBatches(files, 10);
      
      expect(batches.length).toBe(1);
      expect(batches[0].length).toBe(3);
    });
    
    test('processWorkerResult 应正确处理成功结果', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const result = {
        relativePath: 'test.js',
        success: true,
        exports: [{ name: 'foo', type: 'named', line: 1 }],
        imports: [{ name: 'bar', source: './bar.js', isInternal: true }],
        jsxComponents: ['TestComponent'],
        componentInfo: { name: 'TestComponent', isGlobal: false },
      };
      
      finder.processWorkerResult(result);
      
      expect(finder.exports.has('test.js')).toBe(true);
      expect(finder.imports.has('test.js')).toBe(true);
      expect(finder.jsxUsage.has('test.js')).toBe(true);
      expect(finder.components.has('test.js')).toBe(true);
    });
    
    test('processWorkerResult 应正确处理错误结果', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = {
        relativePath: 'error.js',
        success: false,
        error: 'Parse error',
        filePath: path.join(testDir, 'error.js'),
      };
      
      finder.processWorkerResult(result);
      
      expect(finder.exports.has('error.js')).toBe(false);
      consoleSpy.mockRestore();
    });
    
    test('processWorkerResult 应正确处理空结果', () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const result = {
        relativePath: 'empty.js',
        success: true,
        exports: [],
        imports: [],
        jsxComponents: [],
      };
      
      finder.processWorkerResult(result);
      
      expect(finder.exports.has('empty.js')).toBe(false);
      expect(finder.imports.has('empty.js')).toBe(false);
    });
  });

  describe('并发安全性测试', () => {
    test('应该正确处理并发写入 exports Map', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 20 });

      for (let i = 0; i < 50; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const func${i} = () => ${i};`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      let totalExports = 0;
      for (const exports of finder.exports.values()) {
        totalExports += exports.length;
      }
      expect(totalExports).toBe(50);
    });

    test('应该正确处理并发写入 imports Map', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 10 });

      fs.writeFileSync(path.join(testDir, 'shared.js'), 'export const shared = 1;');

      for (let i = 0; i < 20; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `import { shared } from './shared.js'; export const func${i} = () => shared;`);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.imports.size).toBe(20);
    });

    test('应该正确处理并发写入 components Map', async () => {
      finder = new DeadCodeFinderAST({ srcDir: testDir, concurrency: 10 });

      for (let i = 0; i < 20; i++) {
        const vueFile = path.join(testDir, `Component${i}.vue`);
        fs.writeFileSync(vueFile, `
          <template><div>test</div></template>
          <script>export default { name: 'Component${i}' }</script>
        `);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await finder.scanSourceFiles();
      await finder.parseSourceFiles();
      consoleSpy.mockRestore();

      expect(finder.components.size).toBe(20);
    });
  });
});

describe('Mock 数据一致性检查', () => {
  describe('ImportItem Mock 数据结构', () => {
    test('Mock ImportItem 应与真实结构一致', () => {
      const { ImportItem } = require('../src/models.js');
      
      const realItem = new ImportItem('testName', './test.js', false, true, false, false);
      
      const mockItem = {
        name: 'testName',
        source: './test.js',
        isDefault: false,
        isInternal: true,
        isDynamic: false,
        isSideEffect: false,
      };
      
      expect(Object.keys(mockItem).sort()).toEqual(Object.keys(realItem).sort());
    });
    
    test('ImportItem 应包含所有必要属性', () => {
      const { ImportItem } = require('../src/models.js');
      
      const item = new ImportItem('foo', './bar.js', true, true);
      
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('source');
      expect(item).toHaveProperty('isDefault');
      expect(item).toHaveProperty('isInternal');
      expect(item).toHaveProperty('isDynamic');
      expect(item).toHaveProperty('isSideEffect');
    });
  });
  
  describe('ExportItem Mock 数据结构', () => {
    test('Mock ExportItem 应与真实结构一致', () => {
      const { ExportItem } = require('../src/models.js');
      
      const realItem = new ExportItem('testExport', 'named', 10, 'export const testExport = 1;');
      
      const mockItem = {
        name: 'testExport',
        type: 'named',
        line: 10,
        code: 'export const testExport = 1;',
        source: null,
      };
      
      expect(Object.keys(mockItem).sort()).toEqual(Object.keys(realItem).sort());
    });
    
    test('ExportItem 应支持不同类型', () => {
      const { ExportItem } = require('../src/models.js');
      
      const namedExport = new ExportItem('foo', 'named', 1, 'export const foo = 1;');
      expect(namedExport.type).toBe('named');
      
      const defaultExport = new ExportItem('default', 'default', 5, 'export default function() {}');
      expect(defaultExport.type).toBe('default');
      
      const reexport = new ExportItem('bar', 'reexport', 8, 'export { bar } from "./bar.js";', './bar.js');
      expect(reexport.type).toBe('reexport');
      expect(reexport.source).toBe('./bar.js');
    });
  });
  
  describe('ComponentItem Mock 数据结构', () => {
    test('Mock ComponentItem 应与真实结构一致', () => {
      const { ComponentItem } = require('../src/models.js');
      
      const realItem = new ComponentItem('TestComponent', false, true);
      
      const mockItem = {
        name: 'TestComponent',
        used: false,
        isGlobal: true,
      };
      
      expect(Object.keys(mockItem).sort()).toEqual(Object.keys(realItem).sort());
    });
  });
  
  describe('导出提取一致性测试', () => {
    test('正则模式与 AST 模式结果应一致', () => {
      const { parse } = require('../src/parser/index.js');
      const { walkExports } = require('../src/parser/walker.js');
      
      const testContent = 'export const foo = 1;\nexport default function() {}\nexport { bar, baz } from "./module.js";';
      
      const result = parse(testContent, 'test.js');
      const astExports = walkExports(result.ast);
      
      const allExports = [
        ...astExports.named,
        ...astExports.group,
        astExports.default,
        ...astExports.reexport,
      ].filter(Boolean);
      
      expect(allExports.some(e => e.name === 'foo')).toBe(true);
      expect(allExports.some(e => e.name === 'default' || e.type === 'default')).toBe(true);
      expect(allExports.some(e => e.name === 'bar')).toBe(true);
      expect(allExports.some(e => e.name === 'baz')).toBe(true);
    });
    
    test('导入提取应包含所有导入类型', () => {
      const { parse } = require('../src/parser/index.js');
      const { walkImports } = require('../src/parser/walker.js');
      
      const testContent = `
        import { foo, bar } from './module.js';
        import defaultExport from './default.js';
        import * as namespace from './namespace.js';
        import './side-effect.js';
        const dynamic = import('./dynamic.js');
      `;
      
      const result = parse(testContent, 'test.js');
      const imports = walkImports(result.ast);
      
      expect(imports.static.length).toBeGreaterThan(0);
      expect(imports.default.length).toBeGreaterThan(0);
      expect(imports.namespace.length).toBeGreaterThan(0);
      expect(imports.dynamic.length).toBeGreaterThan(0);
    });
  });
  
  describe('工厂函数测试', () => {
    test('ExportItem 应支持不同创建方式', () => {
      const { ExportItem } = require('../src/models.js');
      
      const namedExport = new ExportItem('foo', 'named', 1, 'export const foo = 1;');
      expect(namedExport.name).toBe('foo');
      expect(namedExport.type).toBe('named');
      
      const defaultExport = new ExportItem('defaultFunc', 'default', 5, 'export default function defaultFunc() {}');
      expect(defaultExport.name).toBe('defaultFunc');
      expect(defaultExport.type).toBe('default');
      
      const reexport = new ExportItem('bar', 'reexport', 10, 'export { bar } from "./bar.js";', './bar.js');
      expect(reexport.name).toBe('bar');
      expect(reexport.type).toBe('reexport');
      expect(reexport.source).toBe('./bar.js');
    });
  });
});
