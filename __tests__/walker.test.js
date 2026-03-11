const { walkExports, walkImports, walkJSX, walkComponents } = require('../src/parser/walker');
const { parse } = require('../src/parser/index');
const { isInternalImport } = require('../src/constants');

describe('AST Walker', () => {
  test('walkExports should collect all exports', () => {
    const code = `
export const foo = 'bar';
export default function baz() {}
export { a, b } from './module';
export * from './other';
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const exports = walkExports(result.ast);
    expect(exports.named).toHaveLength(1);
    expect(exports.named[0].name).toBe('foo');
    expect(exports.default).toBeDefined();
    expect(exports.default.name).toBe('baz');
    expect(exports.reexport).toHaveLength(2);
    expect(exports.star).toHaveLength(1);
  });

  test('walkExports should collect function and class exports', () => {
    const code = `
export function myFunction() {}
export class MyClass {}
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const exports = walkExports(result.ast);
    expect(exports.named).toHaveLength(2);
    expect(exports.named[0].name).toBe('myFunction');
    expect(exports.named[1].name).toBe('MyClass');
  });

  test('walkExports should collect TypeScript type exports', () => {
    const code = `
export type MyType = { foo: string };
export interface MyInterface { bar: number };
`;

    const result = parse(code, 'test.ts');
    expect(result.success).toBe(true);

    const exports = walkExports(result.ast);
    expect(exports.named).toHaveLength(2);
    expect(exports.named[0].name).toBe('MyType');
    expect(exports.named[1].name).toBe('MyInterface');
  });

  test('walkExports should collect group exports', () => {
    const code = `
const a = 1;
const b = 2;
export { a, b };
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const exports = walkExports(result.ast);
    expect(exports.group).toHaveLength(2);
    expect(exports.group[0].name).toBe('a');
    expect(exports.group[1].name).toBe('b');
  });

  test('walkExports should collect anonymous default export', () => {
    const code = `
export default () => 'anonymous';
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const exports = walkExports(result.ast);
    expect(exports.default).toBeDefined();
    expect(exports.default.name).toBe('anonymous');
  });

  test('walkImports should collect all imports', () => {
    const code = `
import { foo, bar } from './module';
import baz from './default';
import * as ns from './namespace';
import('./dynamic');
import './side-effect';
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const imports = walkImports(result.ast);
    expect(imports.static).toHaveLength(2);
    expect(imports.default).toHaveLength(1);
    expect(imports.namespace).toHaveLength(1);
    expect(imports.dynamic).toHaveLength(1);
  });

  test('walkImports should skip external imports', () => {
    const code = `
import React from 'react';
import { useState } from 'react';
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const imports = walkImports(result.ast);
    expect(imports.static).toHaveLength(0);
    expect(imports.default).toHaveLength(0);
  });

  test('walkImports should handle dynamic import with template literal', () => {
    const code = `
const moduleName = 'test';
import(\`./\${moduleName}\`);
`;

    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const imports = walkImports(result.ast);
    expect(imports.dynamic).toHaveLength(1);
  });

  test('walkJSX should collect React components', () => {
    const code = `
const App = () => {
  return (
    <div>
      <Header />
      <Main title="Hello">
        <Button variant="primary" />
      </Main>
      <Footer />
    </div>
  );
};
`;

    const result = parse(code, 'test.jsx');
    expect(result.success).toBe(true);

    const components = walkJSX(result.ast);
    expect(components).toContain('Header');
    expect(components).toContain('Main');
    expect(components).toContain('Button');
    expect(components).toContain('Footer');
  });

  test('walkJSX should collect JSX member expressions', () => {
    const code = `
const App = () => {
  return (
    <React.Fragment>
      <Modal.Header />
      <Modal.Body />
    </React.Fragment>
  );
};
`;

    const result = parse(code, 'test.jsx');
    expect(result.success).toBe(true);

    const components = walkJSX(result.ast);
    expect(components).toContain('React.Fragment');
    expect(components).toContain('Modal.Header');
    expect(components).toContain('Modal.Body');
  });

  test('walkComponents should collect component declarations', () => {
    const code = `
// Function component
const MyComponent = () => {
  return <div>Hello</div>;
};

// Class component
class MyClassComponent extends React.Component {
  render() {
    return <div>Hello</div>;
  }
}

// Hook
const useCustomHook = () => {
  return { value: 42 };
};
`;

    const result = parse(code, 'test.jsx');
    expect(result.success).toBe(true);

    const components = walkComponents(result.ast);
    expect(components.functions).toHaveLength(1);
    expect(components.functions[0].name).toBe('MyComponent');
    expect(components.classes).toHaveLength(1);
    expect(components.classes[0].name).toBe('MyClassComponent');
    expect(components.hooks).toHaveLength(1);
    expect(components.hooks[0].name).toBe('useCustomHook');
  });

  test('walkComponents should collect function declaration components', () => {
    const code = `
function MyFunctionComponent() {
  return <div>Hello</div>;
}
`;

    const result = parse(code, 'test.jsx');
    expect(result.success).toBe(true);

    const components = walkComponents(result.ast);
    expect(components.functions).toHaveLength(1);
    expect(components.functions[0].name).toBe('MyFunctionComponent');
  });

  test('walkComponents should collect class components with different inheritance patterns', () => {
    const code = `
class MyComponent1 extends Component {
  render() { return <div />; }
}

class MyComponent2 extends React.PureComponent {
  render() { return <div />; }
}

class MyComponent3 extends PureComponent {
  render() { return <div />; }
}
`;

    const result = parse(code, 'test.jsx');
    expect(result.success).toBe(true);

    const components = walkComponents(result.ast);
    expect(components.classes).toHaveLength(3);
    expect(components.classes.map(c => c.name)).toEqual([
      'MyComponent1',
      'MyComponent2',
      'MyComponent3',
    ]);
  });

  test('isInternalImport should identify internal imports', () => {
    expect(isInternalImport('./module')).toBe(true);
    expect(isInternalImport('../module')).toBe(true);
    expect(isInternalImport('@/module')).toBe(true);
    expect(isInternalImport('/src/module')).toBe(true);
    expect(isInternalImport('react')).toBe(false);
    expect(isInternalImport('lodash')).toBe(false);
  });

  test('isInternalImport should handle null or undefined', () => {
    expect(isInternalImport(null)).toBe(false);
    expect(isInternalImport(undefined)).toBe(false);
    expect(isInternalImport('')).toBe(false);
  });

  describe('动态导入边界测试', () => {
    test('应该处理字符串模板动态导入 - 基础路径', () => {
      const code = `
const name = 'module';
import(\`./modules/\${name}\`);
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.dynamic).toHaveLength(1);
      expect(imports.dynamic[0].source).toBe('./modules/');
    });

    test('应该处理字符串模板动态导入 - 完整模板', () => {
      const code = `
const folder = 'components';
const file = 'Button';
import(\`./\${folder}/\${file}.vue\`);
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.dynamic).toHaveLength(1);
      expect(imports.dynamic[0].source).toBe('./');
    });

    test('应该处理变量路径动态导入 - 标识符参数', () => {
      const code = `
const modulePath = './utils/helper';
import(modulePath);
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      // 变量路径无法静态分析，不会收集
      expect(imports.dynamic).toHaveLength(0);
    });

    test('应该处理动态导入失败场景 - 外部模块', () => {
      const code = `
import('react');
import('lodash/debounce');
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      // 外部模块不应该被收集
      expect(imports.dynamic).toHaveLength(0);
    });

    test('应该处理动态导入失败场景 - 空参数', () => {
      const code = `
import('');
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      // 空字符串不是有效的内部导入
      expect(imports.dynamic).toHaveLength(0);
    });

    test('应该处理嵌套动态导入', () => {
      const code = `
async function loadModule() {
  const module1 = await import('./module1');
  const module2 = await import('./module2');
  return { module1, module2 };
}

async function loadNested() {
  const outer = await import('./outer');
  const inner = await outer.loadInner();
  return inner;
}
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.dynamic).toHaveLength(3);
      expect(imports.dynamic.map(i => i.source)).toContain('./module1');
      expect(imports.dynamic.map(i => i.source)).toContain('./module2');
      expect(imports.dynamic.map(i => i.source)).toContain('./outer');
    });

    test('应该处理动态导入与静态导入混合', () => {
      const code = `
import { foo } from './static';
import('./dynamic1');
import('./dynamic2');
import { bar } from './another';
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.static).toHaveLength(2);
      expect(imports.dynamic).toHaveLength(2);
    });

    test('应该处理动态导入中的模板字面量 - 复杂表达式', () => {
      const code = `
const base = './modules';
const name = 'test';
import(\`\${base}/\${name}.js\`);
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      // 模板字面量以变量开头，无法提取基础路径
      expect(imports.dynamic).toHaveLength(0);
    });

    test('应该处理动态导入中的模板字面量 - 带标签模板', () => {
      const code = `
import(tag\`./module/\${name}\`);
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      // 标签模板不是动态导入
      expect(imports.dynamic).toHaveLength(0);
    });

    test('应该处理条件动态导入', () => {
      const code = `
async function load(condition) {
  if (condition) {
    return import('./moduleA');
  } else {
    return import('./moduleB');
  }
}
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.dynamic).toHaveLength(2);
      expect(imports.dynamic.map(i => i.source)).toContain('./moduleA');
      expect(imports.dynamic.map(i => i.source)).toContain('./moduleB');
    });

    test('应该处理动态导入中的路径别名', () => {
      const code = `
import('@/utils/helper');
import('@@/components/Button');
`;
      const result = parse(code, 'test.js');
      expect(result.success).toBe(true);

      const imports = walkImports(result.ast);
      expect(imports.dynamic).toHaveLength(2);
      expect(imports.dynamic.map(i => i.source)).toContain('@/utils/helper');
      expect(imports.dynamic.map(i => i.source)).toContain('@@/components/Button');
    });
  });
});
