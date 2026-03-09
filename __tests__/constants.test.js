const {
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_DIRS,
  TEST_DIRS,
  MAX_CONCURRENCY,
  MAX_FILE_SIZE,
  NON_COMPONENT_DIRS,
  IGNORE_MACROS,
  IGNORE_EXPORTS,
  DETECTION_MODES,
  DEFAULT_MODE,
  REGEX_NAMED_EXPORT,
  REGEX_TS_NAMED_EXPORT,
  REGEX_TS_ENUM_EXPORT,
  REGEX_TS_NAMESPACE_EXPORT,
  REGEX_DEFAULT_EXPORT,
  REGEX_GROUP_EXPORT,
  REGEX_GROUP_REEXPORT,
  REGEX_STAR_EXPORT,
  REGEX_STAR_AS_NAMESPACE_EXPORT,
  REGEX_DEFAULT_REEXPORT,
  REGEX_TS_TYPE_GROUP_EXPORT,
  REGEX_TS_TYPE_REEXPORT,
  REGEX_STATIC_IMPORT,
  REGEX_DYNAMIC_IMPORT,
  REGEX_SIDE_EFFECT_IMPORT,
  REGEX_COMPONENTS_OBJECT,
  REGEX_COMPONENT_NAME,
  REGEX_JSX_TAG,
  REGEX_HOC_PATTERN,
  REGEX_REDUX_CONNECT,
  REGEX_REDUX_HOOKS,
} = require('../src/constants.js');

describe('Constants', () => {
  describe('DEFAULT_EXTENSIONS', () => {
    test('should be an array of file extensions', () => {
      expect(Array.isArray(DEFAULT_EXTENSIONS)).toBe(true);
      expect(DEFAULT_EXTENSIONS).toContain('.js');
      expect(DEFAULT_EXTENSIONS).toContain('.vue');
    });
  });

  describe('DEFAULT_IGNORE_DIRS', () => {
    test('should contain common directories to ignore', () => {
      expect(DEFAULT_IGNORE_DIRS).toContain('node_modules');
      expect(DEFAULT_IGNORE_DIRS).toContain('dist');
      expect(DEFAULT_IGNORE_DIRS).toContain('.git');
    });
  });

  describe('TEST_DIRS', () => {
    test('should contain common test directory names', () => {
      expect(TEST_DIRS).toContain('test');
      expect(TEST_DIRS).toContain('tests');
      expect(TEST_DIRS).toContain('__tests__');
    });
  });

  describe('MAX_CONCURRENCY', () => {
    test('should be a positive number', () => {
      expect(typeof MAX_CONCURRENCY).toBe('number');
      expect(MAX_CONCURRENCY).toBeGreaterThan(0);
    });
  });

  describe('MAX_FILE_SIZE', () => {
    test('should be a positive number representing bytes', () => {
      expect(typeof MAX_FILE_SIZE).toBe('number');
      expect(MAX_FILE_SIZE).toBeGreaterThan(0);
      expect(MAX_FILE_SIZE).toBe(1000000);
    });
  });

  describe('NON_COMPONENT_DIRS', () => {
    test('should contain non-component directory names', () => {
      expect(NON_COMPONENT_DIRS).toContain('utils');
      expect(NON_COMPONENT_DIRS).toContain('helpers');
      expect(NON_COMPONENT_DIRS).toContain('services');
    });
  });

  describe('IGNORE_MACROS', () => {
    test('should contain Vue macro names', () => {
      expect(IGNORE_MACROS).toContain('defineProps');
      expect(IGNORE_MACROS).toContain('defineEmits');
      expect(IGNORE_MACROS).toContain('defineExpose');
    });
  });

  describe('IGNORE_EXPORTS', () => {
    test('should be a Set', () => {
      expect(IGNORE_EXPORTS).toBeInstanceOf(Set);
    });

    test('should contain common framework exports to ignore', () => {
      expect(IGNORE_EXPORTS.has('useState')).toBe(true);
      expect(IGNORE_EXPORTS.has('useEffect')).toBe(true);
      expect(IGNORE_EXPORTS.has('computed')).toBe(true);
    });

    test('should contain common utility names', () => {
      expect(IGNORE_EXPORTS.has('default')).toBe(true);
      expect(IGNORE_EXPORTS.has('index')).toBe(true);
    });
  });

  describe('DETECTION_MODES', () => {
    test('should have AST and REGEX modes', () => {
      expect(DETECTION_MODES.AST).toBe('ast');
      expect(DETECTION_MODES.REGEX).toBe('regex');
    });
  });

  describe('DEFAULT_MODE', () => {
    test('should be AST by default', () => {
      expect(DEFAULT_MODE).toBe('ast');
    });
  });

  describe('Regular Expressions', () => {
    describe('REGEX_NAMED_EXPORT', () => {
      test('should match named exports', () => {
        const content = 'export const foo = 1; export function bar() {}';
        const matches = [...content.matchAll(REGEX_NAMED_EXPORT)];
        expect(matches.length).toBe(2);
      });
    });

    describe('REGEX_TS_NAMED_EXPORT', () => {
      test('should match TypeScript named exports', () => {
        const content = 'export const foo = 1; export type MyType = string;';
        const matches = [...content.matchAll(REGEX_TS_NAMED_EXPORT)];
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    describe('REGEX_TS_ENUM_EXPORT', () => {
      test('should match TypeScript enum exports', () => {
        const content = 'export enum MyEnum { A, B }';
        const matches = [...content.matchAll(REGEX_TS_ENUM_EXPORT)];
        expect(matches.length).toBe(1);
        expect(matches[0][1]).toBe('MyEnum');
      });
    });

    describe('REGEX_DEFAULT_EXPORT', () => {
      test('should match default function exports', () => {
        const content = 'export default function App() {}';
        const matches = [...content.matchAll(REGEX_DEFAULT_EXPORT)];
        expect(matches.length).toBe(1);
      });

      test('should match default class exports', () => {
        const content = 'export default class MyClass {}';
        const matches = [...content.matchAll(REGEX_DEFAULT_EXPORT)];
        expect(matches.length).toBe(1);
      });
    });

    describe('REGEX_GROUP_EXPORT', () => {
      test('should match grouped exports', () => {
        const content = 'export { foo, bar };';
        const matches = [...content.matchAll(REGEX_GROUP_EXPORT)];
        expect(matches.length).toBe(1);
      });
    });

    describe('REGEX_STATIC_IMPORT', () => {
      test('should match named imports', () => {
        const content = "import { foo, bar } from './module';";
        const matches = [...content.matchAll(REGEX_STATIC_IMPORT)];
        expect(matches.length).toBe(1);
      });

      test('should match default imports', () => {
        const content = "import MyComponent from './component';";
        const matches = [...content.matchAll(REGEX_STATIC_IMPORT)];
        expect(matches.length).toBe(1);
        expect(matches[0][2]).toBe('MyComponent');
      });

      test('should match namespace imports', () => {
        const content = "import * as utils from './utils';";
        const matches = [...content.matchAll(REGEX_STATIC_IMPORT)];
        expect(matches.length).toBe(1);
        expect(matches[0][3]).toBe('utils');
      });
    });

    describe('REGEX_DYNAMIC_IMPORT', () => {
      test('should match dynamic imports with single quotes', () => {
        const content = "import('./dynamic')";
        const matches = [...content.matchAll(REGEX_DYNAMIC_IMPORT)];
        expect(matches.length).toBe(1);
      });

      test('should match dynamic imports with double quotes', () => {
        const content = 'import("./dynamic")';
        const matches = [...content.matchAll(REGEX_DYNAMIC_IMPORT)];
        expect(matches.length).toBe(1);
      });

      test('should match dynamic imports with template literals', () => {
        const content = 'import(`./dynamic/${name}`)';
        const matches = [...content.matchAll(REGEX_DYNAMIC_IMPORT)];
        expect(matches.length).toBe(1);
      });
    });

    describe('REGEX_JSX_TAG', () => {
      test('should match JSX tags', () => {
        expect(REGEX_JSX_TAG.test('<MyComponent>')).toBe(true);
        expect(REGEX_JSX_TAG.test('<div>')).toBe(false);
      });
    });

    describe('REGEX_COMPONENTS_OBJECT', () => {
      test('should match Vue components object', () => {
        const content = 'components: { MyComponent, AnotherComponent }';
        const matches = [...content.matchAll(REGEX_COMPONENTS_OBJECT)];
        expect(matches.length).toBe(1);
      });
    });
  });
});
