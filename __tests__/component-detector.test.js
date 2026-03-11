const { ComponentDetector } = require('../src/component-detector.js');

describe('ComponentDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ComponentDetector();
  });

  describe('constructor', () => {
    test('应该正确创建实例', () => {
      expect(detector).toBeInstanceOf(ComponentDetector);
    });

    test('应该使用默认的大小写转换函数', () => {
      expect(detector.toPascalCase('test-component')).toBe('TestComponent');
      expect(detector.toKebabCase('TestComponent')).toBe('test-component');
    });

    test('应该接受自定义的大小写转换函数', () => {
      const customDetector = new ComponentDetector({
        toPascalCase: str => str.toUpperCase(),
        toKebabCase: str => str.toLowerCase(),
      });

      expect(customDetector.toPascalCase('test')).toBe('TEST');
      expect(customDetector.toKebabCase('TEST')).toBe('test');
    });
  });

  describe('defaultToPascalCase', () => {
    test('应该转换为 PascalCase', () => {
      expect(detector.defaultToPascalCase('test-component')).toBe('TestComponent');
      expect(detector.defaultToPascalCase('my-test-component')).toBe('MyTestComponent');
      expect(detector.defaultToPascalCase('a-b-c')).toBe('ABC');
    });

    test('应该处理已经是 PascalCase 的字符串', () => {
      expect(detector.defaultToPascalCase('TestComponent')).toBe('TestComponent');
      expect(detector.defaultToPascalCase('ABC')).toBe('ABC');
    });

    test('应该处理单个单词', () => {
      expect(detector.defaultToPascalCase('test')).toBe('Test');
      expect(detector.defaultToPascalCase('a')).toBe('A');
    });

    test('应该处理空字符串', () => {
      expect(detector.defaultToPascalCase('')).toBe('');
    });
  });

  describe('defaultToKebabCase', () => {
    test('应该转换为 kebab-case', () => {
      expect(detector.defaultToKebabCase('TestComponent')).toBe('test-component');
      expect(detector.defaultToKebabCase('MyTestComponent')).toBe('my-test-component');
      expect(detector.defaultToKebabCase('ABC')).toBe('abc');
    });

    test('应该处理已经是 kebab-case 的字符串', () => {
      expect(detector.defaultToKebabCase('test-component')).toBe('test-component');
      expect(detector.defaultToKebabCase('a-b-c')).toBe('a-b-c');
    });

    test('应该处理单个单词', () => {
      expect(detector.defaultToKebabCase('test')).toBe('test');
      expect(detector.defaultToKebabCase('A')).toBe('a');
    });

    test('应该处理空字符串', () => {
      expect(detector.defaultToKebabCase('')).toBe('');
    });
  });

  describe('collectComponentUsages', () => {
    test('应该收集组件使用情况', () => {
      const imports = new Map([['file.js', [{ name: 'TestComponent', isInternal: true }]]]);
      const testImports = new Map();

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('TestComponent')).toBe(true);
      expect(result.get('TestComponent').has('file.js')).toBe(true);
    });

    test('应该合并测试导入', () => {
      const imports = new Map();
      const testImports = new Map([['TestComponent', new Set(['test.js'])]]);

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result.has('TestComponent')).toBe(true);
      expect(result.get('TestComponent').has('test.js')).toBe(true);
    });

    test('应该跳过外部导入', () => {
      const imports = new Map([['file.js', [{ name: 'ExternalComponent', isInternal: false }]]]);
      const testImports = new Map();

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result.has('ExternalComponent')).toBe(false);
    });

    test('应该处理多个文件的导入', () => {
      const imports = new Map([
        ['file1.js', [{ name: 'ComponentA', isInternal: true }]],
        ['file2.js', [{ name: 'ComponentA', isInternal: true }]],
        ['file3.js', [{ name: 'ComponentB', isInternal: true }]],
      ]);
      const testImports = new Map();

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result.get('ComponentA').size).toBe(2);
      expect(result.get('ComponentB').size).toBe(1);
    });

    test('应该处理空导入', () => {
      const imports = new Map();
      const testImports = new Map();

      const result = detector.collectComponentUsages(imports, testImports);

      expect(result.size).toBe(0);
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

    test('应该识别 PascalCase 组件标签', () => {
      const fileContents = new Map([['test.vue', '<template><TestComponent /></template>']]);

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result.has('TestComponent')).toBe(true);
    });

    test('应该识别 kebab-case 组件标签', () => {
      const fileContents = new Map([['test.vue', '<template><test-component /></template>']]);

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result.has('test-component')).toBe(true);
    });

    test('应该记录标签出现的文件', () => {
      const fileContents = new Map([
        ['file1.vue', '<template><TestComponent /></template>'],
        ['file2.vue', '<template><TestComponent /></template>'],
      ]);

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result.get('TestComponent').size).toBe(2);
      expect(result.get('TestComponent').has('file1.vue')).toBe(true);
      expect(result.get('TestComponent').has('file2.vue')).toBe(true);
    });

    test('应该处理空文件内容', () => {
      const fileContents = new Map();

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result.size).toBe(0);
    });

    test('应该处理没有组件标签的内容', () => {
      const fileContents = new Map([
        ['test.vue', '<template><div>Hello</div><span>World</span></template>'],
      ]);

      const result = detector.buildComponentTagIndexFromFileContents(fileContents);

      expect(result.size).toBe(3);
    });
  });

  describe('buildComponentTagIndexFromJSX', () => {
    test('应该从 JSX 使用映射构建索引', () => {
      const jsxUsage = new Map([
        ['file.jsx', ['TestComponent', 'MyButton']],
        ['app.jsx', ['TestComponent']],
      ]);

      const result = detector.buildComponentTagIndexFromJSX(jsxUsage);

      expect(result).toBeInstanceOf(Map);
      expect(result.has('TestComponent')).toBe(true);
      expect(result.has('MyButton')).toBe(true);
      expect(result.get('TestComponent').size).toBe(2);
    });

    test('应该处理空映射', () => {
      const jsxUsage = new Map();

      const result = detector.buildComponentTagIndexFromJSX(jsxUsage);

      expect(result.size).toBe(0);
    });
  });

  describe('mergeComponentTagIndex', () => {
    test('应该合并两个索引', () => {
      const target = new Map([['ComponentA', new Set(['file1.js'])]]);
      const source = new Map([
        ['ComponentA', new Set(['file2.js'])],
        ['ComponentB', new Set(['file3.js'])],
      ]);

      detector.mergeComponentTagIndex(target, source);

      expect(target.get('ComponentA').size).toBe(2);
      expect(target.has('ComponentB')).toBe(true);
    });

    test('应该处理空源索引', () => {
      const target = new Map([['ComponentA', new Set(['file1.js'])]]);
      const source = new Map();

      detector.mergeComponentTagIndex(target, source);

      expect(target.size).toBe(1);
    });

    test('应该处理空目标索引', () => {
      const target = new Map();
      const source = new Map([['ComponentA', new Set(['file1.js'])]]);

      detector.mergeComponentTagIndex(target, source);

      expect(target.size).toBe(1);
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

    test('当组件在标签中使用时应该返回 true', () => {
      const componentUsages = new Map();
      const componentTagIndex = new Map([['TestComponent', new Set(['other.vue'])]]);

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

    test('当组件只在定义文件中使用时应该返回 false', () => {
      const componentUsages = new Map();
      const componentTagIndex = new Map([['TestComponent', new Set(['TestComponent.vue'])]]);

      const result = detector.isComponentUsed(
        'TestComponent',
        'TestComponent.vue',
        componentUsages,
        componentTagIndex
      );

      expect(result).toBe(false);
    });

    test('应该同时检查 PascalCase 和 kebab-case', () => {
      const componentUsages = new Map([['test-component', new Set(['other.js'])]]);
      const componentTagIndex = new Map();

      const result = detector.isComponentUsed(
        'TestComponent',
        'test.js',
        componentUsages,
        componentTagIndex
      );

      expect(result).toBe(true);
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
      const components = new Map([['TheHeader.vue', { name: 'TheHeader', isGlobal: true }]]);
      const componentUsages = new Map();
      const componentTagIndex = new Map();

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex
      );

      expect(result).toHaveLength(0);
    });

    test('应该检测局部组件', () => {
      const components = new Map();
      const componentUsages = new Map();
      const componentTagIndex = new Map();
      const localComponents = new Map([['parent.vue', ['LocalComponent']]]);

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex,
        localComponents
      );

      expect(result.some(c => c.name === 'LocalComponent' && c.isLocal)).toBe(true);
    });

    test('应该调用进度回调', () => {
      const components = new Map([
        ['Component1.vue', { name: 'Component1', isGlobal: false }],
        ['Component2.vue', { name: 'Component2', isGlobal: false }],
      ]);
      const componentUsages = new Map();
      const componentTagIndex = new Map();

      const progressCallback = jest.fn();

      detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex,
        new Map(),
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalled();
    });

    test('应该处理空组件映射', () => {
      const components = new Map();
      const componentUsages = new Map();
      const componentTagIndex = new Map();

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex
      );

      expect(result).toHaveLength(0);
    });

    test('应该处理大量组件', () => {
      const components = new Map();
      for (let i = 0; i < 100; i++) {
        components.set(`Component${i}.vue`, { name: `Component${i}`, isGlobal: false });
      }
      const componentUsages = new Map([['Component50', new Set(['app.js'])]]);
      const componentTagIndex = new Map();

      const result = detector.detectUnusedComponents(
        components,
        componentUsages,
        componentTagIndex
      );

      expect(result.length).toBe(99);
      expect(result.some(c => c.name === 'Component50')).toBe(false);
    });
  });

  describe('detectUnusedLocalComponents', () => {
    test('应该检测未使用的局部组件', () => {
      const localComponents = new Map([['parent.vue', ['LocalComponent']]]);
      const componentUsages = new Map();
      const componentTagIndex = new Map();
      const unusedComponents = [];

      detector.detectUnusedLocalComponents(
        localComponents,
        componentUsages,
        componentTagIndex,
        unusedComponents
      );

      expect(unusedComponents.length).toBe(1);
      expect(unusedComponents[0].name).toBe('LocalComponent');
      expect(unusedComponents[0].isLocal).toBe(true);
    });

    test('不应该重复添加已存在的组件', () => {
      const localComponents = new Map([['parent.vue', ['ExistingComponent']]]);
      const componentUsages = new Map();
      const componentTagIndex = new Map();
      const unusedComponents = [{ file: 'parent.vue', name: 'ExistingComponent' }];

      detector.detectUnusedLocalComponents(
        localComponents,
        componentUsages,
        componentTagIndex,
        unusedComponents
      );

      const existingCount = unusedComponents.filter(c => c.name === 'ExistingComponent').length;
      expect(existingCount).toBe(1);
    });

    test('应该处理空局部组件映射', () => {
      const localComponents = new Map();
      const componentUsages = new Map();
      const componentTagIndex = new Map();
      const unusedComponents = [];

      detector.detectUnusedLocalComponents(
        localComponents,
        componentUsages,
        componentTagIndex,
        unusedComponents
      );

      expect(unusedComponents.length).toBe(0);
    });
  });
});
