const path = require('path');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');
const { ExportItem } = require('../src/models.js');

describe('detector.js - 导出提取测试', () => {
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
      const content = "export * from './module'";
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
      const content = "export * as utils from './utils'";
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
      const content = "export { foo, bar } from './module'";
      const exports = [];

      finder.extractGroupReexports(content, exports);

      expect(exports.length).toBe(2);
      expect(exports.every(e => e.type === 'reexport')).toBe(true);
      expect(exports.every(e => e.source === './module')).toBe(true);
    });
  });

  describe('extractDefaultReexports 方法', () => {
    test('应该提取默认重新导出', () => {
      const content = "export { default as Button } from './Button'";
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
      const content = "export type { UserType } from './types'";
      const exports = [];

      finder.extractTsTypeReexports(content, exports);

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].name).toBe('UserType');
      expect(exports[0].type).toBe('ts-type-reexport');
      expect(exports[0].source).toBe('./types');
    });
  });
});
