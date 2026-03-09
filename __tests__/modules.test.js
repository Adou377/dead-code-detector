/**
 * 新模块测试 - export-types.js, analyzer.js, fixer.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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
  handleFixError,
  applyFixToFile,
  removeUnusedExports,
  fixUnusedExports,
  fixUnusedComponents,
  deleteUnusedToolFiles,
  groupByFile,
  generateFixPreview,
  showFixPreview,
  printFixSummary,
  confirmFix,
} = require('../src/fixer.js');

describe('export-types.js', () => {
  describe('isGroupExport', () => {
    test('应该识别普通分组导出', () => {
      expect(isGroupExport('export { foo, bar }')).toBe(true);
    });

    test('应该识别类型分组导出', () => {
      expect(isGroupExport('export type { Foo, Bar }')).toBe(true);
    });

    test('应该返回 false 对于非分组导出', () => {
      expect(isGroupExport('export default foo')).toBe(false);
      expect(isGroupExport('export const foo = 1')).toBe(false);
      expect(isGroupExport('import { foo } from "./bar"')).toBe(false);
    });
  });

  describe('isTypeExport', () => {
    test('应该识别 type 导出', () => {
      expect(isTypeExport('export type Foo = string;')).toBe(true);
    });

    test('应该识别 interface 导出', () => {
      expect(isTypeExport('export interface Bar {}')).toBe(true);
    });

    test('应该识别 enum 导出', () => {
      expect(isTypeExport('export enum Baz {}')).toBe(true);
    });

    test('应该识别 namespace 导出', () => {
      expect(isTypeExport('export namespace NS {}')).toBe(true);
    });

    test('应该返回 false 对于非类型导出', () => {
      expect(isTypeExport('export const foo = 1;')).toBe(false);
      expect(isTypeExport('export function bar() {}')).toBe(false);
    });
  });

  describe('isDefaultExport', () => {
    test('应该识别默认导出', () => {
      expect(isDefaultExport('export default foo;')).toBe(true);
      expect(isDefaultExport('export default function() {}')).toBe(true);
      expect(isDefaultExport('export default class {}')).toBe(true);
    });

    test('应该返回 false 对于非默认导出', () => {
      expect(isDefaultExport('export const foo = 1;')).toBe(false);
      expect(isDefaultExport('export { foo }')).toBe(false);
    });
  });

  describe('isNamedExport', () => {
    test('应该识别 const 导出', () => {
      expect(isNamedExport('export const foo = 1;')).toBe(true);
    });

    test('应该识别 let 导出', () => {
      expect(isNamedExport('export let foo = 1;')).toBe(true);
    });

    test('应该识别 var 导出', () => {
      expect(isNamedExport('export var foo = 1;')).toBe(true);
    });

    test('应该识别 function 导出', () => {
      expect(isNamedExport('export function bar() {}')).toBe(true);
    });

    test('应该识别 class 导出', () => {
      expect(isNamedExport('export class Baz {}')).toBe(true);
    });

    test('应该返回 false 对于非命名导出', () => {
      expect(isNamedExport('export default foo')).toBe(false);
      expect(isNamedExport('export { foo }')).toBe(false);
    });
  });

  describe('isStarExport', () => {
    test('应该识别星号导出', () => {
      expect(isStarExport('export * from "./module";')).toBe(true);
      expect(isStarExport('export * as foo from "./module";')).toBe(true);
    });

    test('应该返回 false 对于非星号导出', () => {
      expect(isStarExport('export const foo = 1;')).toBe(false);
      expect(isStarExport('export { foo } from "./module"')).toBe(false);
    });
  });

  describe('isReExport', () => {
    test('应该识别重新导出', () => {
      expect(isReExport('export { foo } from "./module";')).toBe(true);
      expect(isReExport('export { foo, bar } from "./utils";')).toBe(true);
    });

    test('应该返回 false 对于非重新导出', () => {
      expect(isReExport('export const foo = 1;')).toBe(false);
      expect(isReExport('export { foo }')).toBe(false);
    });
  });

  describe('isMultiLineExport', () => {
    test('应该识别多行导出开始', () => {
      const lines = ['export {', '  foo,', '  bar', '};'];
      expect(isMultiLineExport(lines, 0)).toBe(true);
    });

    test('应该返回 false 对于非多行导出开始', () => {
      const lines = ['export {', '  foo,', '  bar', '};'];
      expect(isMultiLineExport(lines, 1)).toBe(false);
      expect(isMultiLineExport(lines, 2)).toBe(false);
      expect(isMultiLineExport(lines, 3)).toBe(false);
    });

    test('应该返回 false 对于单行导出', () => {
      const lines = ['export { foo, bar };'];
      expect(isMultiLineExport(lines, 0)).toBe(false);
    });

    test('应该处理空行', () => {
      const lines = ['', 'export { foo };'];
      expect(isMultiLineExport(lines, 0)).toBe(false);
    });
  });
});

describe('analyzer.js', () => {
  describe('groupItemsByLine', () => {
    test('应该正确分组多个项', () => {
      const items = [
        { name: 'foo', line: 1 },
        { name: 'bar', line: 1 },
        { name: 'baz', line: 2 },
        { name: 'qux', line: 3 },
      ];

      const result = groupItemsByLine(items);

      expect(result.size).toBe(3);
      expect(result.get(1)).toHaveLength(2);
      expect(result.get(2)).toHaveLength(1);
      expect(result.get(3)).toHaveLength(1);
    });

    test('应该处理空数组', () => {
      const result = groupItemsByLine([]);
      expect(result.size).toBe(0);
    });

    test('应该处理单个项', () => {
      const result = groupItemsByLine([{ name: 'foo', line: 1 }]);
      expect(result.size).toBe(1);
      expect(result.get(1)).toHaveLength(1);
    });
  });

  describe('analyzeLinesToRemove', () => {
    test('应该分析需要移除的行', () => {
      const content = 'export const foo = 1;\nexport const bar = 2;\nexport const baz = 3;';
      const items = [
        { name: 'foo', line: 1 },
        { name: 'baz', line: 3 },
      ];

      const result = analyzeLinesToRemove(content, items);

      expect(result.lines).toHaveLength(3);
      expect(result.linesToRemove.size).toBe(2);
      expect(result.modified).toBe(true);
    });

    test('应该处理分组导出的部分移除', () => {
      const content = 'export { foo, bar, baz };';
      const items = [{ name: 'foo', line: 1 }];

      const result = analyzeLinesToRemove(content, items);

      expect(result.modified).toBe(true);
      expect(result.linesToRemove.size).toBe(0); // 部分移除不删除整行
    });

    test('应该处理无修改的情况', () => {
      const content = 'export const foo = 1;';
      const items = [];

      const result = analyzeLinesToRemove(content, items);

      expect(result.modified).toBe(false);
      expect(result.linesToRemove.size).toBe(0);
    });

    test('应该处理无效行号', () => {
      const content = 'export const foo = 1;';
      const items = [{ name: 'foo', line: 100 }];

      const result = analyzeLinesToRemove(content, items);

      expect(result.modified).toBe(false);
    });
  });

  describe('analyzeExportLine', () => {
    test('应该分析分组导出', () => {
      const lines = ['export { foo, bar };'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.partialRemove).toBe(true);
    });

    test('应该分析命名导出', () => {
      const lines = ['export const foo = 1;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该分析默认导出', () => {
      const lines = ['export default foo;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该分析类型导出', () => {
      const lines = ['export type Foo = string;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'Foo' }]);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该分析星号导出', () => {
      const lines = ['export * from "./module";'];
      const result = analyzeExportLine(lines, 0, []);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该分析重新导出', () => {
      const lines = ['export { foo } from "./module";'];
      const result = analyzeExportLine(lines, 0, []);

      expect(result).toBeDefined();
    });

    test('应该处理空行', () => {
      const lines = ['', 'export const foo = 1;'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(false);
    });

    test('应该处理名称匹配', () => {
      const lines = ['// some comment with foo'];
      const result = analyzeExportLine(lines, 0, [{ name: 'foo' }]);

      expect(result.shouldRemove).toBe(true);
    });
  });

  describe('analyzeGroupExport', () => {
    test('应该部分移除分组导出', () => {
      const lines = ['export { foo, bar, baz };'];
      const result = analyzeGroupExport(lines, 0, ['foo']);

      expect(result.partialRemove).toBe(true);
      expect(result.newLine).toContain('bar');
      expect(result.newLine).toContain('baz');
    });

    test('应该完全移除分组导出', () => {
      const lines = ['export { foo, bar };'];
      const result = analyzeGroupExport(lines, 0, ['foo', 'bar']);

      expect(result.shouldRemove).toBe(true);
    });

    test('应该处理无效的分组导出格式', () => {
      const lines = ['export const foo = 1;'];
      const result = analyzeGroupExport(lines, 0, ['foo']);

      expect(result.shouldRemove).toBe(false);
    });

    test('应该处理带别名的导出', () => {
      const lines = ['export { foo as bar, baz };'];
      const result = analyzeGroupExport(lines, 0, ['foo']);

      expect(result.partialRemove).toBe(true);
    });
  });

  describe('analyzeMultiLineExport', () => {
    test('应该分析多行导出', () => {
      const lines = ['export {', '  foo,', '  bar', '};'];
      const result = analyzeMultiLineExport(lines, 0, ['foo']);

      expect(result.shouldRemove).toBe(true);
      expect(result.startLine).toBe(0);
      expect(result.endLine).toBe(3);
    });

    test('应该处理非多行导出开始', () => {
      const lines = ['export { foo };'];
      const result = analyzeMultiLineExport(lines, 0, ['foo']);

      expect(result.shouldRemove).toBe(false);
    });

    test('应该处理嵌套大括号', () => {
      const lines = ['export {', '  foo: { bar }', '};'];
      const result = analyzeMultiLineExport(lines, 0, ['foo']);

      expect(result.shouldRemove).toBe(true);
    });
  });
});

describe('fixer.js', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-fixer-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createBackupDir', () => {
    test('应该创建备份目录', () => {
      const backupDir = createBackupDir(testDir);

      expect(typeof backupDir).toBe('string');
      expect(fs.existsSync(backupDir)).toBe(true);
    });

    test('应该返回已存在的备份目录', () => {
      const backupDir1 = createBackupDir(testDir);
      const backupDir2 = createBackupDir(testDir);

      expect(backupDir1).toBe(backupDir2);
    });
  });

  describe('backupFile', () => {
    test('应该备份文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');
      const backupDir = createBackupDir(testDir);

      backupFile(testFile, backupDir, 'test.js');

      const backupPath = path.join(backupDir, 'test.js');
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    test('应该处理带路径分隔符的文件名', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');
      const backupDir = createBackupDir(testDir);

      backupFile(testFile, backupDir, 'src/utils/test.js');

      const backupPath = path.join(backupDir, 'src_utils_test.js');
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('writeFixedFile', () => {
    test('应该写入修复后的文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;\nexport const bar = 2;');

      const lines = ['export const foo = 1;', 'export const bar = 2;'];
      const linesToRemove = new Set([0]);

      writeFixedFile(testFile, lines, linesToRemove);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('export const bar = 2;');
    });

    test('应该处理删除所有行的情况', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const lines = ['export const foo = 1;'];
      const linesToRemove = new Set([0]);

      writeFixedFile(testFile, lines, linesToRemove);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('handleFixError', () => {
    test('应该恢复原始文件内容', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'original content');
      const originalContent = 'original content';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      handleFixError(testFile, originalContent, new Error('test error'));
      consoleSpy.mockRestore();

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('original content');
    });
  });

  describe('applyFixToFile', () => {
    test('应该在修改时写入文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const analysisResult = {
        lines: ['export const bar = 2;'],
        linesToRemove: new Set(),
        modified: true,
      };

      applyFixToFile(testFile, 'export const foo = 1;', analysisResult);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('export const bar = 2;');
    });

    test('应该在没有修改时不写入文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'original');

      const analysisResult = {
        lines: ['original'],
        linesToRemove: new Set(),
        modified: false,
      };

      applyFixToFile(testFile, 'original', analysisResult);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('original');
    });
  });

  describe('removeUnusedExports', () => {
    test('应该移除未使用的导出', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;\nexport const bar = 2;');

      const items = [{ name: 'foo', line: 1 }];

      removeUnusedExports(testFile, items);

      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('export const bar = 2;');
    });

    test('应该处理移除失败的情况', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'original content');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      removeUnusedExports(testFile, [{ name: 'foo', line: 100 }]);
      consoleSpy.mockRestore();
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('original content');
    });
  });

  describe('fixUnusedExports', () => {
    test('应该修复未使用的导出', async () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const unused = 1;\nexport const used = 2;');

      const unusedExports = [{ file: 'test.js', name: 'unused', type: 'named', line: 1 }];
      const backupDir = createBackupDir(testDir);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await fixUnusedExports(unusedExports, testDir, backupDir);
      consoleSpy.mockRestore();

      expect(result).toBe(1);
    });

    test('应该跳过不存在的文件', async () => {
      const unusedExports = [{ file: 'nonexistent.js', name: 'foo', line: 1 }];
      const backupDir = createBackupDir(testDir);

      const result = await fixUnusedExports(unusedExports, testDir, backupDir);

      expect(result).toBe(0);
    });
  });

  describe('fixUnusedComponents', () => {
    test('应该删除未使用的组件', async () => {
      const testFile = path.join(testDir, 'test.vue');
      fs.writeFileSync(testFile, '<template><div></div></template>');

      const unusedComponents = [{ file: 'test.vue', name: 'Test' }];
      const backupDir = createBackupDir(testDir);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await fixUnusedComponents(unusedComponents, testDir, backupDir);
      consoleSpy.mockRestore();

      expect(result).toBe(1);
      expect(fs.existsSync(testFile)).toBe(false);
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

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = deleteUnusedToolFiles(unusedToolFiles, testDir, backupDir);
      consoleSpy.mockRestore();

      expect(result).toBe(1);
      expect(fs.existsSync(testFile)).toBe(false);
    });

    test('应该处理空列表', () => {
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

  describe('groupByFile', () => {
    test('应该按文件分组', () => {
      const items = [
        { file: 'a.js', name: 'foo' },
        { file: 'a.js', name: 'bar' },
        { file: 'b.js', name: 'baz' },
      ];

      const result = groupByFile(items);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['a.js']).toHaveLength(2);
      expect(result['b.js']).toHaveLength(1);
    });

    test('应该处理空数组', () => {
      const result = groupByFile([]);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('generateFixPreview', () => {
    test('应该生成修复预览', () => {
      const unusedExports = [{ file: 'a.js', name: 'foo', line: 1 }];
      const unusedComponents = [{ file: 'b.vue', name: 'Bar' }];
      const unusedToolFiles = ['c.js'];

      const preview = generateFixPreview(unusedExports, unusedComponents, unusedToolFiles);

      expect(preview.unusedExports).toBe(1);
      expect(preview.unusedComponents).toBe(1);
      expect(preview.unusedToolFiles).toBe(1);
      expect(preview.details).toBeDefined();
    });

    test('应该处理空列表', () => {
      const preview = generateFixPreview([], [], null);

      expect(preview.unusedExports).toBe(0);
      expect(preview.unusedComponents).toBe(0);
      expect(preview.unusedToolFiles).toBe(0);
    });
  });

  describe('showFixPreview', () => {
    test('应该显示修复预览', () => {
      const preview = {
        unusedExports: 1,
        unusedComponents: 1,
        unusedToolFiles: 1,
        details: {
          unusedExports: [{ file: 'a.js', name: 'foo', line: 1 }],
          unusedComponents: [{ file: 'b.vue', name: 'Bar' }],
          unusedToolFiles: ['c.js'],
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

    test('应该处理大量导出', () => {
      const preview = {
        unusedExports: 10,
        unusedComponents: 10,
        unusedToolFiles: 10,
        details: {
          unusedExports: Array(10).fill({ file: 'a.js', name: 'foo', line: 1 }),
          unusedComponents: Array(10).fill({ file: 'b.vue', name: 'Bar' }),
          unusedToolFiles: Array(10).fill('c.js'),
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
});
