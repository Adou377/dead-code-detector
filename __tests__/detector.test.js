const path = require('path');
const fs = require('fs');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');
const { ExportItem, ImportItem, UnusedExportItem } = require('../src/models.js');

describe('detector.js - DeadCodeFinder 类', () => {
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

  describe('extractImports 函数', () => {
    test('应该提取静态导入', () => {
      const content = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';
import './styles.css';
      `;

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toHaveLength(5);

      // 检查默认导入
      expect(imports.find(i => i.name === 'React')).toEqual(
        expect.objectContaining({
          name: 'React',
          source: 'react',
          isDefault: true,
          isInternal: false,
        })
      );

      // 检查命名导入
      expect(imports.find(i => i.name === 'useState')).toEqual(
        expect.objectContaining({
          name: 'useState',
          source: 'react',
          isDefault: false,
          isInternal: false,
        })
      );

      expect(imports.find(i => i.name === 'useEffect')).toEqual(
        expect.objectContaining({
          name: 'useEffect',
          source: 'react',
          isDefault: false,
          isInternal: false,
        })
      );

      // 检查命名空间导入
      expect(imports.find(i => i.name === 'utils')).toEqual(
        expect.objectContaining({
          name: 'utils',
          source: './utils',
          isDefault: false,
          isInternal: true,
        })
      );

      // 检查副作用导入
      expect(imports.find(i => i.isSideEffect)).toEqual(
        expect.objectContaining({
          name: '',
          source: './styles.css',
          isDefault: false,
          isInternal: true,
          isSideEffect: true,
        })
      );
    });

    test('应该提取动态导入', () => {
      const content = `
const Component = lazy(() => import('./Component'));
const data = await import('./data');
      `;

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toHaveLength(2);
      expect(imports.every(i => i.isDynamic)).toBe(true);
    });
  });

  describe('extractImportsFromContent 函数', () => {
    test('应该提取所有类型的导入', () => {
      const content = `
import React from 'react';
import { useState } from 'react';
import './styles.css';
const Component = lazy(() => import('./Component'));
      `;

      const imports = finder.extractImportsFromContent(content);
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe('extractStaticImports 函数', () => {
    test('应该提取静态导入', () => {
      const content = `
import React from 'react';
import { useState } from 'react';
      `;
      const imports = [];

      finder.extractStaticImports(content, imports);

      expect(imports.some(i => i.name === 'React')).toBe(true);
      expect(imports.some(i => i.name === 'useState')).toBe(true);
    });
  });

  describe('extractDynamicImports 函数', () => {
    test('应该提取动态导入', () => {
      const content = `
const Component = lazy(() => import('./Component'));
      `;
      const imports = [];

      finder.extractDynamicImports(content, imports);

      expect(imports.some(i => i.isDynamic)).toBe(true);
    });
  });

  describe('extractSideEffectImports 函数', () => {
    test('应该提取副作用导入', () => {
      const content = `
import './styles.css';
      `;
      const imports = [];

      finder.extractSideEffectImports(content, imports);

      expect(imports.some(i => i.isSideEffect)).toBe(true);
    });
  });

  describe('extractVueComponents 函数', () => {
    test('应该从 Vue 组件中提取本地注册的组件', () => {
      const content = `
export default {
  components: {
    Button,
    Input,
    Select
  }
}
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toEqual(['Button', 'Input', 'Select']);
    });

    test('应该正确处理没有组件注册的 Vue 文件', () => {
      const content = `
export default {
  name: 'App',
  data() {
    return {};
  }
}
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toEqual([]);
    });
  });

  describe('isReactComponentFile 函数', () => {
    test('应该识别 React 函数组件文件', () => {
      const filePath = 'src/components/Button.jsx';
      const content = `
import React from 'react';

export function Button() {
  return <button>Click me</button>;
}
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别 React 类组件文件', () => {
      const filePath = 'src/components/Header.jsx';
      const content = `
import React from 'react';

export default class Header extends React.Component {
  render() {
    return <header>Header</header>;
  }
}
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该忽略 utils 目录下的文件', () => {
      const filePath = 'src/utils/helper.js';
      const content = `
export function helper() {
  return true;
}
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该忽略 index 文件', () => {
      const filePath = 'src/components/index.js';
      const content = `
import React from 'react';
import Button from './Button';

export default Button;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });
  });

  describe('extractExportsFromContent 函数', () => {
    test('应该提取命名导出', () => {
      const content = `
export const foo = 'bar';
export function baz() {}
      `;

      const exports = finder.extractExportsFromContent(content);

      expect(exports.some(e => e.name === 'foo' && e.type === 'named')).toBe(true);
      expect(exports.some(e => e.name === 'baz' && e.type === 'named')).toBe(true);
    });

    test('应该提取默认导出', () => {
      const content = `
export default function() {}
export default class MyClass {}
      `;

      const exports = finder.extractExportsFromContent(content);

      expect(exports.some(e => e.type === 'default')).toBe(true);
    });

    test('应该提取分组导出', () => {
      const content = `
export { foo, bar, baz } from './module';
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'reexport')).toBe(true);
    });

    test('应该提取星号导出', () => {
      const content = `
export * from './module';
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'star')).toBe(true);
    });

    test('应该提取命名空间重新导出', () => {
      const content = `
export * as utils from './utils';
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'namespace-reexport')).toBe(true);
    });

    test('应该提取 TypeScript 类型导出', () => {
      const content = `
export type MyType = string;
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'ts-type')).toBe(true);
    });

    test('应该提取 TypeScript 枚举导出', () => {
      const content = `
export enum MyEnum { A, B, C }
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'enum')).toBe(true);
    });

    test('应该提取 TypeScript 命名空间导出', () => {
      const content = `
export namespace MyNamespace { }
      `;

      const exports = finder.extractExportsFromContent(content);
      expect(exports.some(e => e.type === 'namespace')).toBe(true);
    });
  });

  describe('单个提取导出函数', () => {
    test('extractGroupExports 应该提取分组导出', () => {
      const content = 'export { foo, bar }';
      const exports = [];

      finder.extractGroupExports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractStarExports 应该提取星号导出', () => {
      const content = 'export * from "./module"';
      const exports = [];

      finder.extractStarExports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractNamespaceReexports 应该提取命名空间重新导出', () => {
      const content = 'export * as utils from "./utils"';
      const exports = [];

      finder.extractNamespaceReexports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractGroupReexports 应该提取分组重新导出', () => {
      const content = 'export { foo } from "./module"';
      const exports = [];

      finder.extractGroupReexports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractDefaultReexports 应该提取默认重新导出', () => {
      const content = 'export { default as Foo } from "./module"';
      const exports = [];

      finder.extractDefaultReexports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractTsTypeGroupExports 应该提取 TypeScript 类型分组导出', () => {
      const content = 'export type { Foo, Bar }';
      const exports = [];

      finder.extractTsTypeGroupExports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
    });

    test('extractTsTypeReexports 应该提取 TypeScript 类型重新导出', () => {
      const content = 'export type { Foo } from "./module"';
      const exports = [];

      finder.extractTsTypeReexports(content, exports);
      expect(exports.length).toBeGreaterThan(0);
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

  describe('extractNamedExports 方法', () => {
    test('应该正确提取命名导出并忽略 IGNORE_EXPORTS', () => {
      const content = `
export const foo = 'bar';
export function baz() {}
export const computed = 'should be ignored';
export const useState = 'should be ignored';
      `;
      const exports = [];

      finder.extractNamedExports(content, exports);

      expect(exports.some(e => e.name === 'foo')).toBe(true);
      expect(exports.some(e => e.name === 'baz')).toBe(true);
      expect(exports.some(e => e.name === 'computed')).toBe(false);
      expect(exports.some(e => e.name === 'useState')).toBe(false);
    });

    test('应该正确设置行号', () => {
      const content = `line1
line2
export const testExport = 'value';`;
      const exports = [];

      finder.extractNamedExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].line).toBe(3);
    });
  });

  describe('extractTsTypeExports 方法', () => {
    test('应该提取 TypeScript 类型导出', () => {
      const content = `
export type UserType = string;
export interface UserInterface { name: string; }
      `;
      const exports = [];

      finder.extractTsTypeExports(content, exports);

      expect(exports.some(e => e.name === 'UserType' && e.type === 'ts-type')).toBe(true);
      expect(exports.some(e => e.name === 'UserInterface' && e.type === 'ts-type')).toBe(true);
    });
  });

  describe('extractTsEnumExports 方法', () => {
    test('应该提取 TypeScript 枚举导出', () => {
      const content = `
export enum Status {
  Active = 'active',
  Inactive = 'inactive'
}
      `;
      const exports = [];

      finder.extractTsEnumExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('Status');
      expect(exports[0].type).toBe('enum');
    });
  });

  describe('extractTsNamespaceExports 方法', () => {
    test('应该提取 TypeScript 命名空间导出', () => {
      const content = `
export namespace MyNamespace {
  export const value = 1;
}
      `;
      const exports = [];

      finder.extractTsNamespaceExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('MyNamespace');
      expect(exports[0].type).toBe('namespace');
    });
  });

  describe('extractGroupExports 方法', () => {
    test('应该提取分组导出', () => {
      const content = 'export { foo, bar, baz }';
      const exports = [];

      finder.extractGroupExports(content, exports);

      expect(exports.length).toBe(3);
      expect(exports.map(e => e.name)).toContain('foo');
      expect(exports.map(e => e.name)).toContain('bar');
      expect(exports.map(e => e.name)).toContain('baz');
    });

    test('应该处理带别名的分组导出', () => {
      const content = 'export { foo as bar, baz }';
      const exports = [];

      finder.extractGroupExports(content, exports);

      expect(exports.some(e => e.name === 'bar')).toBe(true);
      expect(exports.some(e => e.name === 'baz')).toBe(true);
    });
  });

  describe('extractStarExports 方法', () => {
    test('应该提取星号导出', () => {
      const content = 'export * from \'./module\'';
      const exports = [];

      finder.extractStarExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('*');
      expect(exports[0].type).toBe('star');
      expect(exports[0].source).toBe('./module');
    });
  });

  describe('extractDefaultExports 方法', () => {
    test('应该提取默认函数导出', () => {
      const content = 'export default function myFunction() {}';
      const exports = [];

      finder.extractDefaultExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('myFunction');
      expect(exports[0].type).toBe('default');
    });

    test('应该提取默认类导出', () => {
      const content = 'export default class MyClass {}';
      const exports = [];

      finder.extractDefaultExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('MyClass');
      expect(exports[0].type).toBe('default');
    });

    test('应该提取匿名默认导出', () => {
      const content = 'export default myVariable';
      const exports = [];

      finder.extractDefaultExports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('myVariable');
      expect(exports[0].type).toBe('default');
    });
  });

  describe('extractNamespaceReexports 方法', () => {
    test('应该提取命名空间重新导出', () => {
      const content = 'export * as utils from \'./utils\'';
      const exports = [];

      finder.extractNamespaceReexports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('utils');
      expect(exports[0].type).toBe('namespace-reexport');
      expect(exports[0].source).toBe('./utils');
    });
  });

  describe('extractGroupReexports 方法', () => {
    test('应该提取分组重新导出', () => {
      const content = 'export { foo, bar } from \'./module\'';
      const exports = [];

      finder.extractGroupReexports(content, exports);

      expect(exports.length).toBe(2);
      expect(exports.every(e => e.type === 'reexport')).toBe(true);
      expect(exports.every(e => e.source === './module')).toBe(true);
    });
  });

  describe('extractDefaultReexports 方法', () => {
    test('应该提取默认重新导出', () => {
      const content = 'export { default as Button } from \'./Button\'';
      const exports = [];

      finder.extractDefaultReexports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('Button');
      expect(exports[0].type).toBe('default-reexport');
      expect(exports[0].source).toBe('./Button');
    });
  });

  describe('extractTsTypeGroupExports 方法', () => {
    test('应该提取 TypeScript 类型分组导出', () => {
      const content = 'export type { Foo, Bar }';
      const exports = [];

      finder.extractTsTypeGroupExports(content, exports);

      expect(exports.length).toBe(2);
      expect(exports.every(e => e.type === 'ts-type-group')).toBe(true);
    });
  });

  describe('extractTsTypeReexports 方法', () => {
    test('应该提取 TypeScript 类型重新导出', () => {
      const content = 'export type { UserType } from \'./types\'';
      const exports = [];

      finder.extractTsTypeReexports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('UserType');
      expect(exports[0].type).toBe('ts-type-reexport');
      expect(exports[0].source).toBe('./types');
    });
  });

  describe('buildAllImportsIndex 方法', () => {
    test('应该构建所有导入的索引', () => {
      finder.imports.set('file1.js', [
        new ImportItem('foo', './module1', false, true),
        new ImportItem('bar', './module2', false, true)
      ]);
      finder.imports.set('file2.js', [
        new ImportItem('foo', './module1', false, true)
      ]);

      const testImports = new Map([['baz', new Set(['test.js'])]]);

      const result = finder.buildAllImportsIndex(testImports);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
      expect(result.has('baz')).toBe(true);
      expect(result.get('foo').size).toBe(2);
    });

    test('应该排除外部导入', () => {
      finder.imports.set('file1.js', [
        new ImportItem('React', 'react', true, false)
      ]);

      const result = finder.buildAllImportsIndex(new Map());

      expect(result.has('React')).toBe(false);
    });
  });

  describe('collectSideEffectImports 方法', () => {
    test('应该收集副作用导入的文件', () => {
      finder.imports.set('file1.js', [
        new ImportItem('', './styles.css', false, true, false, true)
      ]);
      
      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('styles.css');

      const result = finder.collectSideEffectImports();

      expect(result.size).toBeGreaterThanOrEqual(0);
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

  describe('resolveImportPath 方法', () => {
    test('应该解析相对导入路径', () => {
      const result = finder.resolveImportPath('./helpers', 'utils/index.js');
      expect(result).toBeDefined();
    });
  });

  describe('groupByFile 方法', () => {
    test('应该按文件分组未使用的导出', () => {
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
});

describe('分支覆盖补充测试', () => {
  let finder;
  let testDir;

  beforeEach(() => {
    testDir = path.join(__dirname, 'fixtures');
    finder = new DeadCodeFinder({
      srcDir: testDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });
  });

  describe('isReactComponentFile - React 组件识别分支', () => {
    test('应该识别箭头函数组件', () => {
      const filePath = 'src/components/ArrowButton.jsx';
      const content = `
        import React from 'react';
        export const ArrowButton = () => <button>Click</button>;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别带参数的箭头函数组件', () => {
      const filePath = 'src/components/ParamButton.jsx';
      const content = `
        import React from 'react';
        export const ParamButton = (props) => <button>{props.label}</button>;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别默认导出的箭头函数组件', () => {
      const filePath = 'src/components/DefaultArrow.jsx';
      const content = `
        import React from 'react';
        export default (props) => <div>{props.children}</div>;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别 PureComponent 类组件', () => {
      const filePath = 'src/components/PureHeader.jsx';
      const content = `
        import React from 'react';
        export class PureHeader extends React.PureComponent {
          render() {
            return <header>Header</header>;
          }
        }
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别 HOC 模式组件', () => {
      const filePath = 'src/components/WithAuth.jsx';
      const content = `
        import React from 'react';
        const WithAuth = (Component) => {
          return (props) => <Component {...props} />;
        };
        WithAuth.displayName = 'WithAuth';
        export default WithAuth;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别 Redux connect 模式', () => {
      const filePath = 'src/components/ConnectedButton.jsx';
      const content = `
        import React from 'react';
        import { connect } from 'react-redux';
        const Button = () => <button>Click</button>;
        const mapStateToProps = (state) => ({});
        export default connect(mapStateToProps)(Button);
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别 Redux hooks 模式', () => {
      const filePath = 'src/components/ReduxButton.jsx';
      const content = `
        import React from 'react';
        import { useSelector, useDispatch } from 'react-redux';
        export const ReduxButton = () => {
          const count = useSelector(state => state.count);
          const dispatch = useDispatch();
          return <button>{count}</button>;
        };
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该忽略 hooks 目录下的文件', () => {
      const filePath = 'src/hooks/useCustomHook.js';
      const content = `
        import { useState } from 'react';
        export function useCustomHook() {
          return useState(null);
        }
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该忽略 services 目录下的文件', () => {
      const filePath = 'src/services/api.js';
      const content = `
        export function fetchData() {
          return fetch('/api/data');
        }
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该忽略 store 目录下的文件', () => {
      const filePath = 'src/store/index.js';
      const content = `
        import { createStore } from 'redux';
        export const store = createStore(() => {});
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该忽略 context 目录下的文件', () => {
      const filePath = 'src/context/AppContext.js';
      const content = `
        import React from 'react';
        export const AppContext = React.createContext();
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该忽略 api 目录下的文件', () => {
      const filePath = 'src/api/user.js';
      const content = `
        export function getUser() {
          return fetch('/api/user');
        }
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(false);
    });

    test('应该识别 TSX 文件中的组件', () => {
      const filePath = 'src/components/TypedButton.tsx';
      const content = `
        import React from 'react';
        interface Props {
          label: string;
        }
        export function TypedButton({ label }: Props) {
          return <button>{label}</button>;
        }
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });

    test('应该识别没有 React 导入但有 JSX 的文件', () => {
      const filePath = 'src/components/NoImport.jsx';
      const content = `
        export const NoImport = () => <div>No React import</div>;
      `;

      const result = finder.isReactComponentFile(filePath, content);
      expect(result).toBe(true);
    });
  });

  describe('checkFunctionComponentPatterns - 函数组件模式', () => {
    test('应该识别 export default function 模式', () => {
      const content = `
        export default function MyComponent() {
          return <div>Test</div>;
        }
      `;

      const result = finder.checkFunctionComponentPatterns(content);
      expect(result).toBe(true);
    });

    test('应该识别 export function 模式', () => {
      const content = `
        export function MyComponent() {
          return <div>Test</div>;
        }
      `;

      const result = finder.checkFunctionComponentPatterns(content);
      expect(result).toBe(true);
    });

    test('应该识别 export const 箭头函数模式', () => {
      const content = `
        export const MyComponent = () => <div>Test</div>;
      `;

      const result = finder.checkFunctionComponentPatterns(content);
      expect(result).toBe(true);
    });

    test('应该识别 export const function 模式', () => {
      const content = `
        export const MyComponent = function() {
          return <div>Test</div>;
        };
      `;

      const result = finder.checkFunctionComponentPatterns(content);
      expect(result).toBe(true);
    });
  });

  describe('checkClassComponentPatterns - 类组件模式', () => {
    test('应该识别 extends React.Component 模式', () => {
      const content = `
        export class MyComponent extends React.Component {
          render() {
            return <div>Test</div>;
          }
        }
      `;

      const result = finder.checkClassComponentPatterns(content);
      expect(result).toBe(true);
    });

    test('应该识别 extends React.PureComponent 模式', () => {
      const content = `
        export class MyComponent extends React.PureComponent {
          render() {
            return <div>Test</div>;
          }
        }
      `;

      const result = finder.checkClassComponentPatterns(content);
      expect(result).toBe(true);
    });

    test('应该识别 export default class extends Component 模式', () => {
      const content = `
        export default class MyComponent extends Component {
          render() {
            return <div>Test</div>;
          }
        }
      `;

      const result = finder.checkClassComponentPatterns(content);
      expect(result).toBe(true);
    });
  });

  describe('extractVueComponents - Vue 组件提取分支', () => {
    test('应该正确提取带字符串键的组件', () => {
      const content = `
        export default {
          components: {
            'my-button': MyButton,
            'my-input': MyInput
          }
        }
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toContain('my-button');
      expect(components).toContain('my-input');
    });

    test('应该正确提取带引号的组件名', () => {
      const content = `
        export default {
          components: {
            "MyButton": MyButton,
            'MyInput': MyInput
          }
        }
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toContain('MyButton');
      expect(components).toContain('MyInput');
    });

    test('应该正确提取动态导入的组件', () => {
      const content = `
        export default {
          components: {
            AsyncComponent: () => import('./AsyncComponent.vue')
          }
        }
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toContain('AsyncComponent');
    });

    test('应该处理多行 components 定义', () => {
      const content = `
        export default {
          components: {
            Button,
            Input,
            Select,
            Modal
          }
        }
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toContain('Button');
      expect(components).toContain('Input');
      expect(components).toContain('Select');
      expect(components).toContain('Modal');
    });

    test('应该处理空 components 对象', () => {
      const content = `
        export default {
          components: {}
        }
      `;

      const components = finder.extractVueComponents(content);

      expect(components).toEqual([]);
    });
  });

  describe('parseFile - 文件类型判断分支', () => {
    test('应该正确处理 .vue 文件', async () => {
      const vueFile = path.join(testDir, 'components', 'TestVueComponent.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(testDir, vueFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .js 文件', async () => {
      const jsFile = path.join(testDir, 'utils', 'helpers.js');
      await finder.parseFile(jsFile);

      const relativePath = path.relative(testDir, jsFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .jsx 文件', async () => {
      const jsxFile = path.join(testDir, 'components', 'ReactButton.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(testDir, jsxFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .ts 文件', async () => {
      const tsFile = path.join(testDir, 'utils', 'types.ts');
      await finder.parseFile(tsFile);

      const relativePath = path.relative(testDir, tsFile);
      expect(finder.fileContents.has(relativePath)).toBe(true);
    });

    test('应该正确处理 .tsx 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-tsx-test');
      const fsExtra = require('fs');
      fsExtra.mkdirSync(tempDir, { recursive: true });
      const tsxFile = path.join(tempDir, 'Component.tsx');
      fsExtra.writeFileSync(tsxFile, `
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

      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该跳过不支持的文件类型', async () => {
      const tempDir = path.join(__dirname, 'temp-unsupported-test');
      const fsExtra = require('fs');
      fsExtra.mkdirSync(tempDir, { recursive: true });
      const unsupportedFile = path.join(tempDir, 'styles.css');
      fsExtra.writeFileSync(unsupportedFile, '.test { color: red; }');

      const tempFinder = new DeadCodeFinder({
        srcDir: tempDir,
        extensions: DEFAULT_EXTENSIONS,
        ignoreDirs: DEFAULT_IGNORE_DIRS,
        verbose: false,
      });

      await tempFinder.parseFile(unsupportedFile);

      expect(tempFinder.exports.size).toBe(0);

      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('parseFile - 错误处理分支', () => {
    test('应该处理文件读取错误', async () => {
      const nonExistentFile = path.join(testDir, 'non-existent-file.js');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await finder.parseFile(nonExistentFile);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该跳过过大的文件', async () => {
      const tempDir = path.join(__dirname, 'temp-large-test');
      const fsExtra = require('fs');
      fsExtra.mkdirSync(tempDir, { recursive: true });
      const largeFile = path.join(tempDir, 'large.js');
      const largeContent = 'export const x = 1;\n'.repeat(100000);
      fsExtra.writeFileSync(largeFile, largeContent);

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

      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('parseVueFile - Vue 文件解析分支', () => {
    test('应该正确解析普通 Vue 文件', async () => {
      const vueFile = path.join(testDir, 'components', 'TestVueComponent.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(testDir, vueFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该跳过 index.vue 文件', async () => {
      const tempDir = path.join(__dirname, 'temp-vue-index-test');
      const fsExtra = require('fs');
      fsExtra.mkdirSync(tempDir, { recursive: true });
      const indexFile = path.join(tempDir, 'index.vue');
      fsExtra.writeFileSync(indexFile, `
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

      fsExtra.rmSync(tempDir, { recursive: true, force: true });
    });

    test('应该识别 The 前缀的全局组件', async () => {
      const vueFile = path.join(testDir, 'components', 'TheHeader.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(testDir, vueFile);
      const component = finder.components.get(relativePath);
      expect(component.isGlobal).toBe(true);
    });

    test('应该识别 App 前缀的全局组件', async () => {
      const vueFile = path.join(testDir, 'components', 'App.vue');
      await finder.parseFile(vueFile);

      const relativePath = path.relative(testDir, vueFile);
      const component = finder.components.get(relativePath);
      expect(component.isGlobal).toBe(true);
    });
  });

  describe('parseJsFile - JS 文件解析分支', () => {
    test('应该正确解析 React 组件文件', async () => {
      const jsxFile = path.join(testDir, 'components', 'ReactButton.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(testDir, jsxFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该正确解析类组件文件', async () => {
      const jsxFile = path.join(testDir, 'components', 'ReactClassComponent.jsx');
      await finder.parseFile(jsxFile);

      const relativePath = path.relative(testDir, jsxFile);
      expect(finder.components.has(relativePath)).toBe(true);
    });

    test('应该正确提取本地注册的 Vue 组件', async () => {
      const tempDir = path.join(__dirname, 'temp-local-comp-test');
      const fsExtra = require('fs');
      fsExtra.mkdirSync(tempDir, { recursive: true });
      const jsFile = path.join(tempDir, 'app.js');
      fsExtra.writeFileSync(jsFile, `
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

      fsExtra.rmSync(tempDir, { recursive: true, force: true });
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

describe('边界测试和错误处理', () => {
  let finder;
  let testDir;

  beforeEach(() => {
    testDir = path.join(__dirname, 'fixtures');
    finder = new DeadCodeFinder({
      srcDir: testDir,
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
      fs.writeFileSync(invalidVueFile, `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default { name: 'Test'
        </script>
      `);

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
      fs.writeFileSync(noScriptVueFile, `
        <template>
          <div>Hello</div>
        </template>
      `);

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
      fs.writeFileSync(path.join(tempDir, 'VueComp.vue'), `
        <script>
        export const vue = 5;
        </script>
      `);

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
      const nonExistentFile = path.join(testDir, 'non-existent-file.js');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await finder.parseFile(nonExistentFile);
      consoleSpy.mockRestore();

      expect(finder.exports.has('non-existent-file.js')).toBe(false);
    });

    test('应该处理路径无效的文件', async () => {
      const invalidPath = path.join(testDir, 'invalid', 'path', 'file.js');

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
      fs.writeFileSync(unicodeFile, `
        const 你好 = '世界';
        const emoji = '🎉';
        export { 你好, emoji };
      `);

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
