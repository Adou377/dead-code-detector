# 测试指南

本文档介绍如何为 @is_adou/dead-code-detector 项目编写和运行测试。

## 目录

- [测试框架](#测试框架)
- [运行测试](#运行测试)
- [测试目录结构](#测试目录结构)
- [测试分类](#测试分类)
- [编写测试](#编写测试)
- [覆盖率要求](#覆盖率要求)
- [测试最佳实践](#测试最佳实践)
- [调试测试](#调试测试)
- [CI 集成](#ci-集成)

---

## 测试框架

本项目使用 [Jest](https://jestjs.io/) 作为测试框架。

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

---

## 运行测试

### 运行所有测试

```bash
npm test
```

### 监听模式

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

覆盖率报告将生成在 `coverage/` 目录下。

---

## 测试目录结构

```
__tests__/
├── fixtures/                    # 测试数据和固定数据
│   ├── components/              # 组件测试文件
│   │   ├── App.vue
│   │   ├── ReactButton.jsx
│   │   ├── ReactClassComponent.jsx
│   │   ├── TestVueComponent.vue
│   │   └── TheHeader.vue
│   ├── e2e-project/             # E2E 测试项目
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── utils/
│   │   │   ├── views/
│   │   │   ├── App.vue
│   │   │   └── main.js
│   │   └── ...
│   └── utils/                   # 测试工具函数
│       ├── helpers.js
│       ├── index.js
│       └── types.ts
├── benchmark.test.js            # 性能基准测试
├── cache.test.js                # 缓存管理测试
├── cli.test.js                  # CLI 命令测试
├── component-detector.test.js   # 组件检测测试
├── config.test.js               # 配置文件测试
├── constants.test.js            # 常量测试
├── detector-ast.test.js         # AST 检测器测试
├── detector-base.test.js        # 检测器基类测试
├── detector-components.test.js  # 组件检测功能测试
├── detector-detection.test.js   # 检测逻辑测试
├── detector-edge-cases.test.js  # 边界情况测试
├── detector-exports.test.js     # 导出检测测试
├── detector-imports.test.js     # 导入检测测试
├── detector-parse.test.js       # 解析功能测试
├── e2e.test.js                  # 端到端测试
├── edge-cases.test.js           # 边界情况综合测试
├── errors.test.js               # 错误处理测试
├── incremental-analyzer.test.js # 增量分析测试
├── index.test.js                # 主入口测试
├── logger.test.js               # 日志模块测试
├── models.test.js               # 数据模型测试
├── modules.test.js              # 模块解析测试
├── parse-worker.test.js         # 解析 Worker 测试
├── parser.test.js               # 解析器测试
├── reporter.test.js             # 报告生成测试
├── resolver.test.js             # 路径解析测试
├── utils.test.js                # 工具函数测试
├── vue.test.js                  # Vue 解析器测试
├── walker.test.js               # AST 遍历器测试
└── worker.test.js               # Worker 测试
```

---

## 测试分类

### 单元测试

测试单个函数或模块的功能。

```bash
# 运行单个测试文件
npm test -- utils.test.js

# 运行匹配名称的测试
npm test -- -t "extractImports"
```

### 集成测试

测试多个模块协作的功能，如检测器与解析器的配合。

### E2E 测试

使用 `fixtures/e2e-project/` 模拟真实项目进行端到端测试。

```bash
npm test -- e2e.test.js
```

### 性能测试

验证检测性能是否满足要求。

```bash
npm test -- benchmark.test.js
```

---

## 编写测试

### 基本结构

```javascript
const { SomeModule } = require('../src/someModule.js');

describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    instance = new SomeModule();
  });

  afterEach(() => {
    // 清理资源
  });

  describe('methodName', () => {
    test('should do something specific', () => {
      const result = instance.methodName();
      expect(result).toBe(expectedValue);
    });

    test('should handle edge case', () => {
      expect(() => instance.methodName(null)).toThrow();
    });
  });
});
```

### 测试示例

```javascript
// 测试 extractImports 方法
describe('extractImports', () => {
  test('should extract named imports', () => {
    const content = `import { foo, bar } from './module';`;
    const imports = finder.extractImports(content);
    expect(imports).toHaveLength(2);
    expect(imports[0].name).toBe('foo');
    expect(imports[1].name).toBe('bar');
  });

  test('should extract default import', () => {
    const content = `import React from 'react';`;
    const imports = finder.extractImports(content);
    expect(imports).toHaveLength(1);
    expect(imports[0].name).toBe('React');
    expect(imports[0].type).toBe('default');
  });
});
```

### 使用 Fixtures

```javascript
const path = require('path');
const { readFileSync } = require('fs');

describe('Vue Parser', () => {
  const fixturePath = path.join(__dirname, 'fixtures/components');

  test('should parse Vue SFC', () => {
    const vueContent = readFileSync(path.join(fixturePath, 'TestVueComponent.vue'), 'utf-8');
    const result = parseVue(vueContent);
    expect(result.script).toBeDefined();
  });
});
```

---

## 覆盖率要求

| 指标     | 最低要求 | 目标 |
| -------- | -------- | ---- |
| 语句覆盖 | 80%      | 90%  |
| 分支覆盖 | 70%      | 80%  |
| 函数覆盖 | 80%      | 90%  |
| 行覆盖   | 80%      | 90%  |

### 查看覆盖率报告

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## 测试最佳实践

### 1. AAA 模式

Arrange（准备）→ Act（执行）→ Assert（断言）

```javascript
test('should detect unused export', () => {
  // Arrange
  const finder = new DeadCodeFinderAST({ srcDir: './src' });

  // Act
  const result = finder.detect();

  // Assert
  expect(result.unusedExports).toContain('unusedFunction');
});
```

### 2. 单一职责

每个测试只验证一个行为：

```javascript
// 好的做法
test('should return empty array when no imports found', () => {
  const result = extractImports('const x = 1;');
  expect(result).toEqual([]);
});

// 不好的做法
test('should handle various cases', () => {
  // 测试太多东西
});
```

### 3. 清晰命名

测试名称应清晰描述测试内容：

```javascript
// 好的命名
test('should throw error when config file is invalid JSON', () => {});

// 不好的命名
test('error case', () => {});
```

### 4. 独立运行

测试之间不应有依赖关系：

```javascript
// 每个测试都应该能独立运行
beforeEach(() => {
  // 重置状态
});
```

### 5. 边界条件

特别注意边界条件和异常情况：

```javascript
describe('parseConfig', () => {
  test('should handle empty config', () => {});
  test('should handle null values', () => {});
  test('should handle invalid types', () => {});
  test('should handle missing required fields', () => {});
});
```

---

## 调试测试

### 查看详细输出

```bash
npm test -- --verbose
```

### 运行单个测试文件

```bash
npm test -- utils.test.js
```

### 运行单个测试

```bash
npm test -- -t "should extract named imports"
```

### 使用 debugger

```javascript
test('debug example', () => {
  const result = someFunction();
  debugger; // 在此处断点
  expect(result).toBe(true);
});
```

然后运行：

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 查看控制台输出

```bash
npm test -- --verbose --detectOpenHandles
```

---

## CI 集成

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [14, 16, 18, 20]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hook

使用 husky 在提交前自动运行测试：

```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "npm test"
```

---

## 常见问题

### Q: 测试运行很慢怎么办？

**A:**

1. 使用 `--onlyChanged` 只运行修改的测试
2. 使用 `--maxWorkers` 限制并行数
3. 检查是否有重复的初始化代码

### Q: 如何 mock 文件系统？

**A:** 使用 Jest 的 mock 功能：

```javascript
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'mocked content'),
  existsSync: jest.fn(() => true),
}));
```

### Q: 如何测试异步代码？

**A:** 使用 async/await：

```javascript
test('async test', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

---

## 相关文档

- [贡献指南](./CONTRIBUTING.md)
- [API 参考](./API.md)
- [迁移指南](./MIGRATION.md)
