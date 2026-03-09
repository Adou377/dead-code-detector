# 测试指南

本文档介绍如何为 dead-code-detector 项目编写和运行测试。

## 测试框架

本项目使用 [Jest](https://jestjs.io/) 作为测试框架。

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

## 测试目录结构

```
__tests__/
├── config.test.js         # 配置文件测试
├── constants.test.js     # 常量测试
├── detector-ast.test.js  # AST 检测器测试
├── detector.test.js      # 正则检测器测试
├── detector-base.test.js # 基类测试
├── index.test.js         # 主入口测试
├── utils.test.js         # 工具函数测试
├── vue.test.js           # Vue 解析器测试
├── walker.test.js        # AST 遍历器测试
└── cli.test.js           # CLI 测试
```

## 编写测试

### 基本结构

```javascript
const { SomeModule } = require('../src/someModule.js');

describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    // 每个测试前准备
    instance = new SomeModule();
  });

  describe('methodName', () => {
    test('should do something specific', () => {
      const result = instance.methodName();
      expect(result).toBe(expectedValue);
    });
  });
});
```

### 测试示例

```javascript
// 测试 extractImports 方法
test('should extract named imports', () => {
  const content = `import { foo, bar } from './module';`;
  const imports = finder.extractImports(content);
  expect(imports.length).toBe(2);
  expect(imports[0].name).toBe('foo');
});
```

## 覆盖率要求

| 指标     | 最低要求 |
| -------- | -------- |
| 语句覆盖 | 80%      |
| 分支覆盖 | 70%      |
| 函数覆盖 | 80%      |
| 行覆盖   | 80%      |

## 测试最佳实践

1. **AAA 模式**: Arrange（准备）→ Act（执行）→ Assert（断言）
2. **单一职责**: 每个测试只验证一个行为
3. **清晰命名**: 测试名称应清晰描述测试内容
4. **独立运行**: 测试之间不应有依赖关系
5. **边界条件**: 特别注意边界条件和异常情况

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
npm test -- -t "test name"
```

## CI 集成

建议在 CI/CD 流程中添加测试检查：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```
