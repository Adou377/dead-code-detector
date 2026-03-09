const { parse, parseJs, parseVue, traverseAst, getLocation } = require('../src/parser/index.js');

// 描述：AST 解析器测试
describe('Parser', () => {
  // 测试：parseJs 方法
  describe('parseJs', () => {
    test('应该正确解析 JavaScript 代码', () => {
      const content = 'const foo = 1;';
      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('应该正确解析 TypeScript 代码', () => {
      const content = 'const foo: number = 1;';
      const result = parseJs(content, 'test.ts');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('应该正确解析 JSX 代码', () => {
      const content = '<div>Hello</div>;';
      const result = parseJs(content, 'test.jsx');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('应该正确解析 TypeScript JSX 代码', () => {
      const content = '<div>Hello</div>;';
      const result = parseJs(content, 'test.tsx');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('对于无效的代码应该返回失败结果', () => {
      const content = 'invalid javascript code';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  // 测试：parseVue 方法
  describe('parseVue', () => {
    test('应该正确解析包含 script 的 Vue 组件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default {
          name: 'TestComponent'
        };
        </script>
      `;

      const result = parseVue(content, 'TestComponent.vue');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('应该正确解析包含 script setup 的 Vue 组件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script setup>
        const msg = 'Hello';
        </script>
      `;

      const result = parseVue(content, 'TestComponent.vue');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.isScriptSetup).toBe(true);
    });

    test('对于没有 script 块的 Vue 组件应该返回失败', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
      `;

      const result = parseVue(content, 'TestComponent.vue');

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
    });
  });

  // 测试：parse 方法
  describe('parse', () => {
    test('应该正确解析 JavaScript 文件', () => {
      const content = 'const foo = 1;';
      const result = parse(content, 'test.js');

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('应该正确解析 Vue 文件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default {};
        </script>
      `;

      const result = parse(content, 'test.vue');

      expect(result.success).toBe(true);
    });

    test('应该正确解析 TypeScript 文件', () => {
      const content = 'const foo: number = 1;';
      const result = parse(content, 'test.ts');

      expect(result.success).toBe(true);
    });
  });

  // 测试：traverseAst 方法
  describe('traverseAst', () => {
    test('应该正确遍历 AST', () => {
      const content = 'const foo = 1;';
      const { ast } = parseJs(content, 'test.js');

      let visited = false;

      traverseAst(ast, {
        VariableDeclaration() {
          visited = true;
        },
      });

      expect(visited).toBe(true);
    });
  });

  // 测试：getLocation 方法
  describe('getLocation', () => {
    test('应该正确获取节点位置信息', () => {
      const content = 'const foo = 1;';
      const { ast } = parseJs(content, 'test.js');

      const node = ast.program.body[0];
      const location = getLocation(node);

      expect(location).toBeDefined();
      expect(location.start).toBe(1);
      expect(location.end).toBe(1);
    });

    test('对于没有位置信息的节点应该返回 null', () => {
      const node = { type: 'Identifier', name: 'foo' };
      const location = getLocation(node);

      expect(location).toBeNull();
    });
  });

  // 测试：多种文件类型
  describe('多种文件类型支持', () => {
    test('应该支持 .js 文件', () => {
      const result = parse('const foo = 1;', 'test.js');
      expect(result.success).toBe(true);
    });

    test('应该支持 .ts 文件', () => {
      const result = parse('const foo: number = 1;', 'test.ts');
      expect(result.success).toBe(true);
    });

    test('应该支持 .jsx 文件', () => {
      const result = parse('<div>Hello</div>;', 'test.jsx');
      expect(result.success).toBe(true);
    });

    test('应该支持 .tsx 文件', () => {
      const result = parse('<div>Hello</div>;', 'test.tsx');
      expect(result.success).toBe(true);
    });
  });

  // 测试：复杂场景
  describe('复杂场景', () => {
    test('应该正确解析包含类和装饰器的代码', () => {
      const content = `
        @decorator
        class TestClass {
          constructor() {
            this.prop = 1;
          }
        }
      `;

      const result = parseJs(content, 'test.js');
      expect(result.success).toBe(true);
    });

    test('应该正确解析包含导出语句的代码', () => {
      const content = `
        export const foo = 1;
        export default function() {};
      `;

      const result = parseJs(content, 'test.js');
      expect(result.success).toBe(true);
    });
  });

  // 测试：无效语法处理
  describe('无效语法处理', () => {
    test('应该正确处理未闭合的花括号', () => {
      const content = 'function foo() { return 1;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理未闭合的括号', () => {
      const content = 'const foo = (1 + 2;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理未闭合的字符串', () => {
      const content = 'const foo = "unclosed string;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理无效的对象语法', () => {
      const content = 'const obj = { a: 1, b: 2,, };';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理无效的导入语句', () => {
      const content = 'import { from "module";';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理无效的导出语句', () => {
      const content = 'export { foo from "./module";';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理保留字作为变量名', () => {
      const content = 'const class = 1;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理无效的 TypeScript 类型语法', () => {
      const content = 'const foo: = 1;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.ts');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理无效的 JSX 语法', () => {
      const content = 'const elem = <div><span></div></span>;';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseJs(content, 'test.jsx');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  // 测试：无效 Vue 文件处理
  describe('无效 Vue 文件处理', () => {
    test('应该正确处理空的 Vue 文件', () => {
      const content = '';

      const result = parseVue(content, 'Empty.vue');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No script block');
    });

    test('应该正确处理只有 template 的 Vue 文件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
      `;

      const result = parseVue(content, 'NoScript.vue');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No script block');
    });

    test('应该正确处理只有 style 的 Vue 文件', () => {
      const content = `
        <style>
        .test { color: red; }
        </style>
      `;

      const result = parseVue(content, 'OnlyStyle.vue');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No script block');
    });

    test('应该正确处理 script 内容无效的 Vue 文件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default { name: 'Test'
        </script>
      `;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseVue(content, 'InvalidScript.vue');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理 script setup 内容无效的 Vue 文件', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script setup>
        const foo = { unclosed
        </script>
      `;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseVue(content, 'InvalidSetup.vue');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });

    test('应该正确处理未闭合的 script 标签', () => {
      const content = `
        <template>
          <div>Hello</div>
        </template>
        <script>
        export default { name: 'Test' }
      `;

      const result = parseVue(content, 'UnclosedScript.vue');

      expect(result.success).toBe(false);
    });

    test('应该正确处理 script 标签内包含无效 JavaScript 的 Vue 文件', () => {
      const content = `
        <template><div>test</div></template>
        <script>
        import from 'vue';
        </script>
      `;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseVue(content, 'InvalidImport.vue');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  // 测试：边界情况
  describe('边界情况', () => {
    test('应该正确处理只有空白的文件', () => {
      const content = '   \n\t\n   ';

      const result = parseJs(content, 'whitespace.js');

      expect(result.success).toBe(true);
    });

    test('应该正确处理只有注释的文件', () => {
      const content = '// 这是一个注释\n/* 多行注释 */';

      const result = parseJs(content, 'comment.js');

      expect(result.success).toBe(true);
    });

    test('应该正确处理超长单行代码', () => {
      const content = `const x = ${'1 + '.repeat(1000)}1;`;

      const result = parseJs(content, 'longline.js');

      expect(result.success).toBe(true);
    });

    test('应该正确处理多层嵌套的代码', () => {
      let content = 'const obj = ';
      for (let i = 0; i < 100; i++) {
        content += '{ a: ';
      }
      content += '1';
      for (let i = 0; i < 100; i++) {
        content += ' }';
      }
      content += ';';

      const result = parseJs(content, 'nested.js');

      expect(result.success).toBe(true);
    });

    test('应该正确处理包含 Unicode 字符的代码', () => {
      const content = `
        const 你好 = '世界';
        const emoji = '🎉';
        export { 你好, emoji };
      `;

      const result = parseJs(content, 'unicode.js');

      expect(result.success).toBe(true);
    });

    test('应该正确处理包含正则表达式的代码', () => {
      const content = `
        const pattern = /^[a-z]+$/gi;
        export { pattern };
      `;

      const result = parseJs(content, 'regex.js');

      expect(result.success).toBe(true);
    });
  });
});
