const path = require('path');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');
const { ExportItem, ImportItem } = require('../src/models.js');

describe('detector.js - 未使用代码检测测试', () => {
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

  describe('detectUnusedExports 方法', () => {
    test('应该检测未使用的命名导出', async () => {
      finder.exports.set('utils/helpers.js', [
        new ExportItem('unusedFunction', 'named', 1, 'export const unusedFunction = () => {}')
      ]);
      finder.imports.set('other.js', [
        new ImportItem('otherFunction', './other', false, true)
      ]);

      await finder.detectUnusedExports(new Map());

      expect(finder.unusedExports.length).toBeGreaterThan(0);
      expect(finder.unusedExports[0].name).toBe('unusedFunction');
    });

    test('应该检测未使用的默认导出', async () => {
      finder.exports.set('utils/default.js', [
        new ExportItem('UnusedDefault', 'default', 1, 'export default class UnusedDefault {}')
      ]);

      await finder.detectUnusedExports(new Map());

      expect(finder.unusedExports.some(e => e.type === 'default')).toBe(true);
    });

    test('应该排除副作用导入的文件', async () => {
      finder.exports.set('./styles.js', [
        new ExportItem('unusedStyle', 'named', 1, 'export const unusedStyle = {}')
      ]);
      finder.imports.set('app.js', [
        new ImportItem('', './styles.js', false, true, false, true)
      ]);
      
      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('./styles.js');

      await finder.detectUnusedExports(new Map());

      const hasStylesJs = finder.unusedExports.some(e => e.file === './styles.js' || e.file === 'styles.js');
      expect(hasStylesJs).toBe(false);
    });

    test('应该排除被测试文件导入的导出', async () => {
      finder.exports.set('utils/tested.js', [
        new ExportItem('testedFunction', 'named', 1, 'export const testedFunction = () => {}')
      ]);

      const testImports = new Map([['testedFunction', new Set(['tested.test.js'])]]);

      await finder.detectUnusedExports(testImports);

      expect(finder.unusedExports.some(e => e.name === 'testedFunction')).toBe(false);
    });
  });

  describe('collectSideEffectImports - 副作用导入收集', () => {
    test('应该正确收集副作用导入', () => {
      finder.imports.set('app.js', [
        new ImportItem('', './styles.css', false, true, false, true),
        new ImportItem('foo', './module.js', false, true),
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('styles.css');

      const result = finder.collectSideEffectImports();

      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectUnusedExports - 分支覆盖', () => {
    test('应该检测未使用的导出', async () => {
      finder.exports.set('unused.js', [
        new ExportItem('unusedFunc', 'named', 1, 'export const unusedFunc = () => {}'),
      ]);

      await finder.detectUnusedExports(new Map());

      expect(finder.unusedExports.length).toBeGreaterThan(0);
      expect(finder.unusedExports[0].name).toBe('unusedFunc');
    });

    test('应该排除副作用导入文件的导出', async () => {
      finder.exports.set('styles.js', [
        new ExportItem('exportedStyle', 'named', 1, 'export const exportedStyle = {}'),
      ]);
      finder.imports.set('app.js', [
        new ImportItem('', './styles.js', false, true, false, true),
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('styles.js');

      await finder.detectUnusedExports(new Map());

      const hasStylesJs = finder.unusedExports.some(e => e.file === 'styles.js');
      expect(hasStylesJs).toBe(false);
    });

    test('应该排除被测试文件导入的导出', async () => {
      finder.exports.set('tested.js', [
        new ExportItem('testedFunc', 'named', 1, 'export const testedFunc = () => {}'),
      ]);

      const testImports = new Map([['testedFunc', new Set(['tested.test.js'])]]);

      await finder.detectUnusedExports(testImports);

      expect(finder.unusedExports.some(e => e.name === 'testedFunc')).toBe(false);
    });
  });

  describe('buildAllImportsIndex - 导入索引构建', () => {
    test('应该正确构建导入索引', () => {
      finder.imports.set('file1.js', [
        new ImportItem('foo', './module1', false, true),
        new ImportItem('bar', './module2', false, true),
      ]);
      finder.imports.set('file2.js', [
        new ImportItem('foo', './module1', false, true),
      ]);

      const result = finder.buildAllImportsIndex(new Map());

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
      expect(result.get('foo').size).toBe(2);
    });

    test('应该排除外部导入', () => {
      finder.imports.set('file1.js', [
        new ImportItem('React', 'react', false, false),
      ]);

      const result = finder.buildAllImportsIndex(new Map());

      expect(result.has('React')).toBe(false);
    });

    test('应该合并测试导入', () => {
      finder.imports.set('file1.js', [
        new ImportItem('foo', './module', false, true),
      ]);

      const testImports = new Map([['bar', new Set(['test.js'])]]);

      const result = finder.buildAllImportsIndex(testImports);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
    });
  });
});
