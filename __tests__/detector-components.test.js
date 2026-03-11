const path = require('path');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');

describe('detector.js - 组件识别测试', () => {
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
});
