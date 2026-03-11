const path = require('path');
const fs = require('fs');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');

describe('detector.js - 文件解析测试', () => {
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

  describe('parseJsContent 函数', () => {
    test('应该解析 JS 内容并提取导入和导出', () => {
      const content = `
export const foo = 'bar';
import React from 'react';
      `;

      finder.parseJsContent('test.js', content);

      expect(finder.exports.has('test.js')).toBe(true);
      expect(finder.imports.has('test.js')).toBe(true);
    });
  });

  describe('getLineNumber 函数', () => {
    test('应该正确计算行号', () => {
      const content = 'line 1\nline 2\nline 3';
      const matchIndex = content.indexOf('line 3');

      const lineNumber = finder.getLineNumber(content, matchIndex);

      expect(lineNumber).toBe(3);
    });
  });

  describe('构造函数和基本属性', () => {
    test('应该正确初始化 DeadCodeFinder 实例', () => {
      expect(finder).toBeDefined();
      expect(finder.srcDir).toEqual(path.join(__dirname, 'fixtures'));
      expect(finder.extensions).toEqual(DEFAULT_EXTENSIONS);
      expect(finder.ignoreDirs).toEqual(DEFAULT_IGNORE_DIRS);
      expect(finder.verbose).toBe(false);
    });
  });

  describe('report 函数', () => {
    test('应该返回报告对象', () => {
      finder.unusedExports = [];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];

      const result = finder.report();

      expect(result).toHaveProperty('unusedExports');
      expect(result).toHaveProperty('unusedComponents');
      expect(result).toHaveProperty('unusedToolFiles');
    });
  });

  describe('parseFile 方法', () => {
    test('应该正确解析 Vue 文件并提取组件信息', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'TestVueComponent.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
      expect(finder.components.has(relativePath)).toBe(true);
      
      const component = finder.components.get(relativePath);
      expect(component.name).toBe('TestVueComponent');
      expect(component.isGlobal).toBe(false);
    });

    test('应该识别 The 前缀的 Vue 组件为全局组件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'TheHeader.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      expect(finder.components.has(relativePath)).toBe(true);
      
      const component = finder.components.get(relativePath);
      expect(component.name).toBe('TheHeader');
      expect(component.isGlobal).toBe(true);
    });

    test('应该识别 App 前缀的 Vue 组件为全局组件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'App.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      expect(finder.components.has(relativePath)).toBe(true);
      
      const component = finder.components.get(relativePath);
      expect(component.name).toBe('App');
      expect(component.isGlobal).toBe(true);
    });

    test('应该正确解析 JSX 文件并识别 React 组件', async () => {
      const jsxFile = path.join(fixturesDir, 'components', 'ReactButton.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(fixturesDir, jsxFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
      expect(finder.components.has(relativePath)).toBe(true);
      
      const component = finder.components.get(relativePath);
      expect(component.name).toBe('ReactButton');
    });

    test('应该正确解析 React 类组件文件', async () => {
      const jsxFile = path.join(fixturesDir, 'components', 'ReactClassComponent.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(fixturesDir, jsxFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该正确解析 TypeScript 文件', async () => {
      const tsFile = path.join(fixturesDir, 'utils', 'types.ts');
      await finder.parseFile(tsFile);

      const relativePath = path.relative(fixturesDir, tsFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
      expect(finder.exports.has(relativePath)).toBe(true);
    });

    test('应该处理文件读取错误', async () => {
      const nonExistentFile = path.join(fixturesDir, 'non-existent-file.js');
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await finder.parseFile(nonExistentFile);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('应该提取 Vue 文件中的本地组件注册', async () => {
      const content = `
        <script>
        import ChildComponent from './ChildComponent.vue';
        export default {
          components: {
            ChildComponent,
            AnotherChild: () => import('./AnotherChild.vue')
          }
        }
        </script>
      `;
      
      const localComponents = finder.extractVueComponents(content);
      expect(localComponents).toContain('ChildComponent');
      expect(localComponents).toContain('AnotherChild');
    });
  });

  describe('resolveImportPath 方法', () => {
    test('应该解析相对导入路径', () => {
      const result = finder.resolveImportPath('./helpers', 'utils/index.js');
      expect(result).toBeDefined();
    });
  });

  describe('groupByFile 方法', () => {
    test('应该按文件分组未使用的导出', () => {
      const { UnusedExportItem } = require('../src/models.js');
      finder.unusedExports = [
        new UnusedExportItem('file1.js', 'foo', 'named', 1, 'export const foo = 1'),
        new UnusedExportItem('file1.js', 'bar', 'named', 2, 'export const bar = 2'),
        new UnusedExportItem('file2.js', 'baz', 'named', 1, 'export const baz = 3')
      ];

      const result = finder.groupByFile(finder.unusedExports);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['file1.js']).toHaveLength(2);
      expect(result['file2.js']).toHaveLength(1);
    });
  });

  describe('fix 方法', () => {
    test('应该返回修复结果', async () => {
      finder.unusedExports = [];
      finder.unusedToolFiles = [];

      const result = await finder.fix();

      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('fixedExports');
      expect(result).toHaveProperty('deletedToolFiles');
      expect(result).toHaveProperty('backupDir');
    });
  });

  describe('parseFile - 文件类型判断分支', () => {
    test('应该正确处理 .vue 文件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'TestVueComponent.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .js 文件', async () => {
      const jsFile = path.join(fixturesDir, 'utils', 'helpers.js');
      await finder.parseFile(jsFile);

      const relativePath = path.relative(fixturesDir, jsFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .jsx 文件', async () => {
      const jsxFile = path.join(fixturesDir, 'components', 'ReactButton.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(fixturesDir, jsxFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .ts 文件', async () => {
      const tsFile = path.join(fixturesDir, 'utils', 'types.ts');
      await finder.parseFile(tsFile);

      const relativePath = path.relative(fixturesDir, tsFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .tsx 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-tsx-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const tsxFile = path.join(tempDir, 'Component.tsx');
      fs.writeFileSync(tsxFile, `
        import React from 'react';
        export const Component: React.FC = () => <div>Test</div>;
      `);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(tsxFile);

      expect(tempFinder.fileContents.has('Component.tsx')).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该跳过不支持的文件类型', async () => {
      const tempDir = path.join(__dirname, 'temp-unsupported-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const unsupportedFile = path.join(tempDir, 'styles.css');
      fs.writeFileSync(unsupportedFile, '.test { color: red; }');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(unsupportedFile);

      expect(tempFinder.exports.size).toBe(0);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('parseFile - 错误处理分支', () => {
    test('应该处理文件读取错误', async () => {
      const nonExistentFile = path.join(fixturesDir, 'non-existent-file.js');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await finder.parseFile(nonExistentFile);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该跳过过大的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-large-test');
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
  });

  describe('parseVueFile - Vue 文件解析分支', () => {
    test('应该正确解析普通 Vue 文件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'TestVueComponent.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该跳过 index.vue 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-vue-index-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const indexFile = path.join(tempDir, 'index.vue');
      fs.writeFileSync(indexFile, `
        <template><div>Index</div></template>
        <script>
        export default { name: 'Index' }
        </script>
      `);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(indexFile);

      expect(tempFinder.components.has('index.vue')).toBe(false);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该识别 The 前缀的全局组件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'TheHeader.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      const component = finder.components.get(relativePath);
      expect(component.isGlobal).toBe(true);
    });

    test('应该识别 App 前缀的全局组件', async () => {
      const vueFile = path.join(fixturesDir, 'components', 'App.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(fixturesDir, vueFile);
      const component = finder.components.get(relativePath);
      expect(component.isGlobal).toBe(true);
    });
  });

  describe('parseJsFile - JS 文件解析分支', () => {
    test('应该正确解析 React 组件文件', async () => {
      const jsxFile = path.join(fixturesDir, 'components', 'ReactButton.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(fixturesDir, jsxFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该正确解析类组件文件', async () => {
      const jsxFile = path.join(fixturesDir, 'components', 'ReactClassComponent.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(fixturesDir, jsxFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该正确提取本地注册的 Vue 组件', async () => {
      const tempDir = path.join(__dirname, 'temp-local-comp-test');
      fs.mkdirSync(tempDir, { recursive: true });
      const jsFile = path.join(tempDir, 'app.js');
      fs.writeFileSync(jsFile, `
        import ChildComponent from './ChildComponent.vue';
        export default {
          components: {
            ChildComponent,
            AnotherChild: () => import('./AnotherChild.vue')
          }
        }
      `);

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(jsFile);

      expect(tempFinder.localComponents.has('app.js')).toBe(true);
      const localComps = tempFinder.localComponents.get('app.js');
      expect(localComps).toContain('ChildComponent');
      expect(localComps).toContain('AnotherChild');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
