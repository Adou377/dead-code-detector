const { parseVueComponent, extractVueMacros } = require('../src/parser/vue');
const { parse } = require('../src/parser/index');

describe('Vue Parser', () => {
  test('parseVueComponent should detect script setup', () => {
    const content = `
<template>
  <div>Hello</div>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
`;

    const result = parseVueComponent(content);
    expect(result.isComponent).toBe(true);
    expect(result.hasScriptSetup).toBe(true);
  });

  test('parseVueComponent should detect regular script', () => {
    const content = `
<template>
  <div>Hello</div>
</template>

<script>
export default {
  name: 'MyComponent'
};
</script>
`;

    const result = parseVueComponent(content);
    expect(result.isComponent).toBe(true);
    expect(result.hasScriptSetup).toBe(false);
  });

  test('parseVueComponent should extract Vue macros from script setup', () => {
    const content = `
<script setup>
const props = defineProps({
  title: String
});
const emit = defineEmits(['click']);
defineExpose({
  open,
  close
});
</script>
`;

    const result = parseVueComponent(content);
    expect(result.props).not.toBeNull();
    expect(result.emits).not.toBeNull();
    expect(result.exposed).toContain('open');
    expect(result.exposed).toContain('close');
  });

  test('parseVueComponent should extract composables', () => {
    const content = `
<script setup>
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { fetchUser } from './api';
import { getConfig } from './config';
import { loadData } from './data';

const store = useStore();
const router = useRouter();
</script>
`;

    const result = parseVueComponent(content);
    expect(result.composables).toContain('useStore');
    expect(result.composables).toContain('useRouter');
  });

  test('parseVueComponent should extract components', () => {
    const content = `
<script>
const Button = () => {};
const Input = () => {};
const MyComponent = () => {};

export default {
  components: {
    Button,
    Input
  }
};
</script>
`;

    const result = parseVueComponent(content);
    expect(result.components).toContain('Button');
    expect(result.components).toContain('Input');
    expect(result.components).toContain('MyComponent');
  });

  test('parseVueComponent should handle files without script', () => {
    const content = `
<template>
  <div>Hello</div>
</template>
`;

    const result = parseVueComponent(content);
    expect(result.isComponent).toBe(false);
  });

  test('extractVueMacros should extract defineProps', () => {
    const code = `
const props = defineProps({
  title: String,
  count: Number
});
`;
    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const macros = extractVueMacros(code, result.ast);
    expect(macros.defineProps).not.toBeNull();
  });

  test('extractVueMacros should extract defineEmits', () => {
    const code = `
const emit = defineEmits(['click', 'change']);
`;
    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const macros = extractVueMacros(code, result.ast);
    expect(macros.defineEmits).not.toBeNull();
  });

  test('extractVueMacros should extract defineExpose', () => {
    const code = `
defineExpose({
  open,
  close,
  toggle
});
`;
    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const macros = extractVueMacros(code, result.ast);
    expect(macros.defineExpose).toEqual(['open', 'close', 'toggle']);
  });

  test('extractVueMacros should extract composables', () => {
    const code = `
const store = useStore();
const router = useRouter();
const user = fetchUser();
const config = getConfig();
const data = loadData();
`;
    const result = parse(code, 'test.js');
    expect(result.success).toBe(true);

    const macros = extractVueMacros(code, result.ast);
    expect(macros.composables).toContain('useStore');
    expect(macros.composables).toContain('useRouter');
    expect(macros.composables).toContain('fetchUser');
    expect(macros.composables).toContain('getConfig');
    expect(macros.composables).toContain('loadData');
  });

  test('extractVueMacros should handle null AST', () => {
    const macros = extractVueMacros('', null);
    expect(macros.defineProps).toBeNull();
    expect(macros.defineEmits).toBeNull();
    expect(macros.defineExpose).toEqual([]);
  });

  test('parseVueComponent should handle invalid script content', () => {
    const content = `
<script>
this is invalid syntax
</script>
`;

    const result = parseVueComponent(content);
    expect(result.isComponent).toBe(false);
  });

  describe('Vue script setup 边界测试', () => {
    test('应该正确解析 script setup 带 TypeScript 泛型', () => {
      const content = `
<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>
`;

      const result = parseVueComponent(content);
      expect(result.isComponent).toBe(true);
      expect(result.hasScriptSetup).toBe(true);
    });

    test('应该正确解析 script setup 带 defineProps', () => {
      const content = `
<script setup>
const props = defineProps({
  title: String,
  count: Number
});
</script>
`;

      const result = parseVueComponent(content);
      expect(result.isComponent).toBe(true);
      expect(result.hasScriptSetup).toBe(true);
      expect(result.props).not.toBeNull();
    });

    test('应该正确解析 script setup 带多个宏', () => {
      const content = `
<script setup>
const props = defineProps({
  modelValue: String
});

const emit = defineEmits(['update:modelValue', 'change']);

defineExpose({
  open: () => {},
  close: () => {}
});

defineOptions({
  name: 'MyComponent',
  inheritAttrs: false
});
</script>
`;

      const result = parseVueComponent(content);
      expect(result.isComponent).toBe(true);
      expect(result.hasScriptSetup).toBe(true);
      expect(result.props).not.toBeNull();
      expect(result.emits).not.toBeNull();
      expect(result.exposed).toContain('open');
      expect(result.exposed).toContain('close');
    });

    test('应该正确解析 script setup 带顶层 await', () => {
      const content = `
<script setup>
const data = await fetch('/api/data');
const posts = await data.json();
</script>
`;

      const result = parseVueComponent(content);
      expect(result.isComponent).toBe(true);
      expect(result.hasScriptSetup).toBe(true);
    });

    test('应该正确解析 script setup 带自定义指令', () => {
      const content = `
<script setup>
const vFocus = {
  mounted: (el) => el.focus()
};
</script>
<template>
  <input v-focus />
</template>
`;

      const result = parseVueComponent(content);
      expect(result.isComponent).toBe(true);
      expect(result.hasScriptSetup).toBe(true);
    });
  });

  describe('TypeScript 类型导出边界测试', () => {
    test('应该正确解析 TypeScript 类型导出', () => {
      const code = `
export type User = {
  id: number;
  name: string;
};

export interface Product {
  id: number;
  name: string;
  price: number;
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.named).toHaveLength(2);
      expect(exports.named[0].name).toBe('User');
      expect(exports.named[1].name).toBe('Product');
    });

    test('应该正确解析 TypeScript 泛型类型导出', () => {
      const code = `
export type Response<T> = {
  data: T;
  status: number;
};

export interface ApiResponse<T, E = Error> {
  data: T;
  error?: E;
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.named).toHaveLength(2);
    });

    test('应该正确解析 TypeScript 类型重导出', () => {
      const code = `
export type { User } from './types';
export type { Product as ProductType } from './product';
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.reexport).toHaveLength(2);
    });
  });

  describe('TypeScript 枚举导出边界测试', () => {
    test('应该正确解析 TypeScript 枚举导出', () => {
      const code = `
export enum Status {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Inactive = 'INACTIVE'
}

export enum Direction {
  Up,
  Down,
  Left,
  Right
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.named).toHaveLength(2);
      expect(exports.named[0].name).toBe('Status');
      expect(exports.named[1].name).toBe('Direction');
    });

    test('应该正确解析 TypeScript 常量枚举导出', () => {
      const code = `
export const enum Colors {
  Red = 'RED',
  Green = 'GREEN',
  Blue = 'BLUE'
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.named).toHaveLength(1);
      expect(exports.named[0].name).toBe('Colors');
    });

    test('应该正确解析 TypeScript 混合枚举导出', () => {
      const code = `
export enum BooleanEnum {
  False = 0,
  True = 1
}

export enum MixedEnum {
  No = 'NO',
  Yes = 'YES'
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      expect(exports.named).toHaveLength(2);
    });
  });

  describe('TypeScript 命名空间导出边界测试', () => {
    test('应该正确解析 TypeScript 命名空间导出', () => {
      const code = `
export namespace Utils {
  export function format(str: string): string {
    return str.trim();
  }
  
  export const VERSION = '1.0.0';
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 命名空间导出会包含命名空间本身和内部导出的成员
      expect(exports.named.length).toBeGreaterThanOrEqual(1);
      expect(exports.named.some(e => e.name === 'Utils')).toBe(true);
    });

    test('应该正确解析嵌套命名空间导出', () => {
      const code = `
export namespace Outer {
  export namespace Inner {
    export const value = 42;
  }
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 嵌套命名空间会导出所有层级
      expect(exports.named.length).toBeGreaterThanOrEqual(1);
      expect(exports.named.some(e => e.name === 'Outer')).toBe(true);
    });

    test('应该正确解析声明合并的命名空间', () => {
      const code = `
export interface User {
  name: string;
}

export namespace User {
  export function create(name: string): User {
    return { name };
  }
}
`;
      const result = parse(code, 'test.ts');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 声明合并会导出多次同名项
      expect(exports.named.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('React forwardRef 组件边界测试', () => {
    test('应该正确解析 React forwardRef 组件导出', () => {
      const code = `
import React, { forwardRef } from 'react';

const MyInput = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

export default MyInput;
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证默认导出存在
      expect(exports.default).not.toBeNull();
      // export default MyInput 导出的名称是 'default'
      expect(exports.default.name).toBe('default');
    });

    test('应该正确解析带 displayName 的 forwardRef 组件导出', () => {
      const code = `
import React, { forwardRef } from 'react';

const Button = forwardRef(({ children, ...props }, ref) => {
  return <button ref={ref} {...props}>{children}</button>;
});

Button.displayName = 'Button';

export { Button };
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证命名导出存在
      expect(exports.group.length).toBeGreaterThanOrEqual(1);
    });

    test('应该正确解析 TypeScript forwardRef 组件导出', () => {
      const code = `
import React, { forwardRef } from 'react';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ value, onChange }, ref) => {
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
);

export default Input;
`;
      const result = parse(code, 'test.tsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证默认导出存在
      expect(exports.default).not.toBeNull();
      expect(exports.default.name).toBe('default');
    });
  });

  describe('React memo 组件边界测试', () => {
    test('应该正确解析 React memo 组件导出', () => {
      const code = `
import React, { memo } from 'react';

const MyComponent = memo(() => {
  return <div>Hello</div>;
});

export default MyComponent;
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证默认导出存在
      expect(exports.default).not.toBeNull();
      expect(exports.default.name).toBe('default');
    });

    test('应该正确解析带比较函数的 memo 组件导出', () => {
      const code = `
import React, { memo } from 'react';

const ListItem = memo(({ item }) => {
  return <li>{item.name}</li>;
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id;
});

export { ListItem };
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证命名导出存在
      expect(exports.group.length).toBeGreaterThanOrEqual(1);
    });

    test('应该正确解析 memo + forwardRef 组合导出', () => {
      const code = `
import React, { memo, forwardRef } from 'react';

const InputField = memo(forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
}));

export default InputField;
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证默认导出存在
      expect(exports.default).not.toBeNull();
      expect(exports.default.name).toBe('default');
    });

    test('应该正确解析 TypeScript memo 组件导出', () => {
      const code = `
import React, { memo } from 'react';

interface CardProps {
  title: string;
  content: string;
}

const Card = memo<CardProps>(({ title, content }) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  );
});

export { Card };
`;
      const result = parse(code, 'test.tsx');
      expect(result.success).toBe(true);

      const { walkExports } = require('../src/parser/walker');
      const exports = walkExports(result.ast);
      
      // 验证命名导出存在
      expect(exports.group.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('混合组件类型边界测试', () => {
    test('应该正确解析多种组件类型混合导出', () => {
      const code = `
import React, { memo, forwardRef, Component } from 'react';

// 函数组件
const FunctionalButton = () => <button>Click</button>;

// 类组件
class ClassButton extends Component {
  render() {
    return <button>Click</button>;
  }
}

// memo 组件
const MemoButton = memo(() => <button>Click</button>);

// forwardRef 组件
const RefButton = forwardRef((props, ref) => (
  <button ref={ref}>Click</button>
));

export { FunctionalButton, ClassButton, MemoButton, RefButton };
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkComponents, walkExports } = require('../src/parser/walker');
      const components = walkComponents(result.ast);
      const exports = walkExports(result.ast);
      
      // 验证函数组件被识别
      expect(components.functions.length).toBeGreaterThanOrEqual(1);
      // 验证类组件被识别
      expect(components.classes).toHaveLength(1);
      // 验证导出数量
      expect(exports.group.length).toBe(4);
    });

    test('应该正确解析自定义 Hook', () => {
      const code = `
import { useState, useEffect } from 'react';

const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(initialValue);
  return [value, setValue];
};

export { useLocalStorage };
`;
      const result = parse(code, 'test.jsx');
      expect(result.success).toBe(true);

      const { walkComponents } = require('../src/parser/walker');
      const components = walkComponents(result.ast);
      
      // 验证 Hook 被识别
      expect(components.hooks.length).toBeGreaterThanOrEqual(1);
      expect(components.hooks.map(h => h.name)).toContain('useLocalStorage');
    });
  });
});
