const {
  ImportItem,
  ExportItem,
  ComponentItem,
  UnusedExportItem,
  AnalysisResult,
  FixResult,
} = require('../src/models.js');

describe('ImportItem', () => {
  test('应该正确创建导入项', () => {
    const item = new ImportItem('foo', './utils', true, false, false, false);

    expect(item.name).toBe('foo');
    expect(item.source).toBe('./utils');
    expect(item.isDefault).toBe(true);
    expect(item.isInternal).toBe(false);
    expect(item.isDynamic).toBe(false);
    expect(item.isSideEffect).toBe(false);
  });

  test('应该使用默认参数', () => {
    const item = new ImportItem('bar', './helpers');

    expect(item.name).toBe('bar');
    expect(item.source).toBe('./helpers');
    expect(item.isDefault).toBe(false);
    expect(item.isInternal).toBe(false);
    expect(item.isDynamic).toBe(false);
    expect(item.isSideEffect).toBe(false);
  });

  test('应该正确创建动态导入项', () => {
    const item = new ImportItem('module', './dynamic', false, true, true, false);

    expect(item.isDynamic).toBe(true);
    expect(item.isInternal).toBe(true);
  });

  test('应该正确创建副作用导入项', () => {
    const item = new ImportItem(null, './styles', false, false, false, true);

    expect(item.isSideEffect).toBe(true);
  });
});

describe('ExportItem', () => {
  test('应该正确创建导出项', () => {
    const item = new ExportItem('foo', 'named', 10, 'export const foo = 1;');

    expect(item.name).toBe('foo');
    expect(item.type).toBe('named');
    expect(item.line).toBe(10);
    expect(item.code).toBe('export const foo = 1;');
    expect(item.source).toBeNull();
  });

  test('应该正确创建带源的导出项', () => {
    const item = new ExportItem('bar', 'reexport', 20, 'export { bar } from "./utils";', './utils');

    expect(item.source).toBe('./utils');
  });

  describe('静态工厂方法', () => {
    test('createNamed 应创建命名导出', () => {
      const item = ExportItem.createNamed('foo', 10, 'export const foo = 1;');

      expect(item.name).toBe('foo');
      expect(item.type).toBe('named');
      expect(item.line).toBe(10);
      expect(item.code).toBe('export const foo = 1;');
    });

    test('createDefault 应创建默认导出', () => {
      const item = ExportItem.createDefault('App', 5, 'export default App;');

      expect(item.name).toBe('App');
      expect(item.type).toBe('default');
      expect(item.line).toBe(5);
    });

    test('createReexport 应创建重新导出', () => {
      const item = ExportItem.createReexport(
        'utils',
        15,
        'export { utils } from "./lib";',
        './lib'
      );

      expect(item.name).toBe('utils');
      expect(item.type).toBe('reexport');
      expect(item.source).toBe('./lib');
    });
  });
});

describe('ComponentItem', () => {
  test('应该正确创建组件项', () => {
    const item = new ComponentItem('Button', true, false);

    expect(item.name).toBe('Button');
    expect(item.used).toBe(true);
    expect(item.isGlobal).toBe(false);
  });

  test('应该使用默认参数', () => {
    const item = new ComponentItem('Card');

    expect(item.name).toBe('Card');
    expect(item.used).toBe(false);
    expect(item.isGlobal).toBe(false);
  });

  test('应该正确创建全局组件', () => {
    const item = new ComponentItem('TheHeader', false, true);

    expect(item.isGlobal).toBe(true);
  });
});

describe('UnusedExportItem', () => {
  test('应该正确创建未使用导出项', () => {
    const item = new UnusedExportItem(
      'src/utils.js',
      'unusedFunc',
      'named',
      10,
      'export const unusedFunc = () => {};',
      null
    );

    expect(item.file).toBe('src/utils.js');
    expect(item.name).toBe('unusedFunc');
    expect(item.type).toBe('named');
    expect(item.line).toBe(10);
    expect(item.code).toBe('export const unusedFunc = () => {};');
    expect(item.source).toBeNull();
  });

  test('应该正确创建带源的未使用导出项', () => {
    const item = new UnusedExportItem(
      'src/index.js',
      'reexported',
      'reexport',
      5,
      'export { reexported } from "./module";',
      './module'
    );

    expect(item.source).toBe('./module');
  });

  test('应该继承 ExportItem 的属性', () => {
    const item = new UnusedExportItem('file.js', 'test', 'named', 1, 'code');

    expect(item).toBeInstanceOf(ExportItem);
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('line');
    expect(item).toHaveProperty('code');
  });
});

describe('AnalysisResult', () => {
  test('应该正确创建分析结果', () => {
    const result = new AnalysisResult();

    expect(result.unusedExports).toEqual([]);
    expect(result.unusedComponents).toEqual([]);
    expect(result.unusedToolFiles).toEqual([]);
  });

  test('应该接受自定义参数', () => {
    const exports = [{ file: 'a.js', name: 'foo' }];
    const components = [{ file: 'b.vue', name: 'Button' }];
    const toolFiles = ['utils.js'];

    const result = new AnalysisResult(exports, components, toolFiles);

    expect(result.unusedExports).toBe(exports);
    expect(result.unusedComponents).toBe(components);
    expect(result.unusedToolFiles).toBe(toolFiles);
  });
});

describe('FixResult', () => {
  test('应该正确创建修复结果', () => {
    const result = new FixResult();

    expect(result.cancelled).toBe(false);
    expect(result.fixedExports).toBe(0);
    expect(result.deletedComponents).toBe(0);
    expect(result.deletedToolFiles).toBe(0);
    expect(result.backupDir).toBeNull();
  });

  test('应该接受自定义参数', () => {
    const result = new FixResult(false, 10, 5, 3, '/backup/dir');

    expect(result.cancelled).toBe(false);
    expect(result.fixedExports).toBe(10);
    expect(result.deletedComponents).toBe(5);
    expect(result.deletedToolFiles).toBe(3);
    expect(result.backupDir).toBe('/backup/dir');
  });

  test('应该正确创建取消的结果', () => {
    const result = new FixResult(true);

    expect(result.cancelled).toBe(true);
  });
});
