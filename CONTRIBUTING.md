# 贡献指南

感谢您对本项目的关注！我们欢迎各种形式的贡献，包括但不限于代码改进、文档完善、Bug 修复等。

## 目录

- [行为准则](#行为准则)
- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [代码规范](#代码规范)
- [Git 提交规范](#git-提交规范)
- [Pull Request 流程](#pull-request-流程)
- [测试规范](#测试规范)
- [问题反馈](#问题反馈)
- [许可证](#许可证)

---

## 行为准则

请阅读并遵守我们的行为准则，保持友好和尊重的交流氛围。

---

## 开发环境设置

### 前置要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- Git

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Adou377/dead-code-detector.git
cd dead-code-detector

# 安装依赖
npm install

# 运行测试
npm test

# 运行 lint 检查
npm run lint

# 修复 lint 问题
npm run lint:fix

# 格式化代码
npm run format

# 检查格式
npm run format:check
```

---

## 项目结构

```
dead-code-detector/
├── bin/                    # CLI 入口
│   └── dead-code.js        # 命令行入口文件
├── src/                    # 源代码
│   ├── index.js            # 主入口，导出公共 API
│   ├── detector.js         # 正则检测器
│   ├── detector-ast.js     # AST 检测器
│   ├── detector-base.js    # 检测器基类
│   ├── incremental-analyzer.js  # 增量分析器
│   ├── parser/             # 解析器
│   │   ├── vue.js          # Vue 解析器
│   │   ├── react.js        # React 解析器
│   │   └── ...
│   ├── utils/              # 工具函数
│   ├── models/             # 数据模型
│   └── ...
├── types/                  # TypeScript 类型定义
│   └── index.d.ts
├── __tests__/              # 测试文件
│   ├── fixtures/           # 测试数据
│   ├── e2e-project/        # E2E 测试项目
│   └── *.test.js           # 单元测试
├── docs/                   # 文档
├── package.json
└── README.md
```

---

## 代码规范

### 代码风格

本项目使用 ESLint 和 Prettier 进行代码规范检查：

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

### 命名规范

| 类型         | 规范             | 示例                                         |
| ------------ | ---------------- | -------------------------------------------- |
| 变量和函数   | camelCase        | `extractImports`, `findUnusedExports`        |
| 类名和组件名 | PascalCase       | `DeadCodeFinder`, `IncrementalAnalyzer`      |
| 常量         | UPPER_SNAKE_CASE | `DEFAULT_EXTENSIONS`, `MAX_CACHE_SIZE`       |
| 文件名       | kebab-case       | `detector-ast.js`, `incremental-analyzer.js` |
| 私有方法     | \_前缀           | `_parseContent`, `_resolvePath`              |

### 注释规范

```javascript
/**
 * 提取文件中的导入语句
 * @param {string} content - 文件内容
 * @param {Object} options - 解析选项
 * @param {string} options.filePath - 文件路径
 * @returns {ImportInfo[]} 导入信息数组
 */
function extractImports(content, options) {
  // 实现...
}
```

注释原则：

- 为公共 API 添加 JSDoc 注释
- 注释应该解释"为什么"，而不是"做什么"
- 更新代码时同步更新注释
- 复杂逻辑添加行内注释说明

### 代码质量

避免以下代码坏味道：

```javascript
// ❌ 神秘命名
const d = new Date();
const x = process(a, b);

// ✅ 清晰命名
const currentDate = new Date();
const parsedResult = parseContent(rawContent, options);

// ❌ 过长函数
function doEverything() {
  // 100+ 行代码...
}

// ✅ 拆分函数
function detectDeadCode() {
  const exports = collectExports();
  const imports = collectImports();
  return findUnused(exports, imports);
}

// ❌ 重复代码
function processVue() {
  /* 重复逻辑 */
}
function processReact() {
  /* 重复逻辑 */
}

// ✅ 提取公共逻辑
function processFile(content, fileType) {
  const parser = getParser(fileType);
  return parser.parse(content);
}
```

---

## Git 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型     | 说明                   | 示例                     |
| -------- | ---------------------- | ------------------------ |
| feat     | 新功能                 | feat: 添加增量分析功能   |
| fix      | Bug 修复               | fix: 修复 Vue 3 解析错误 |
| docs     | 文档更新               | docs: 更新 API 文档      |
| style    | 代码格式（不影响功能） | style: 格式化代码        |
| refactor | 重构                   | refactor: 优化检测算法   |
| perf     | 性能优化               | perf: 优化大文件解析速度 |
| test     | 测试相关               | test: 添加 E2E 测试      |
| chore    | 构建/工具变动          | chore: 更新依赖版本      |

### Scope 范围

常用 scope：

- `detector`: 检测器相关
- `parser`: 解析器相关
- `cli`: 命令行相关
- `cache`: 缓存相关
- `docs`: 文档相关

### 提交示例

```
feat(detector): 添加 Vue 3 script setup 支持

- 新增对 <script setup> 语法的解析
- 支持 defineProps 和 defineEmits 宏
- 支持 defineExpose 导出检测

Closes #123
```

```
fix(parser): 修复 JSX 泛型组件解析错误

修复了在解析带泛型的 JSX 组件时出现的语法错误

Fixes #456
```

---

## Pull Request 流程

### 1. 创建分支

```bash
# 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 或修复分支
git checkout -b fix/bug-description
```

分支命名规范：

- `feature/`: 新功能
- `fix/`: Bug 修复
- `docs/`: 文档更新
- `refactor/`: 代码重构

### 2. 开发与测试

```bash
# 开发过程中运行测试
npm run test:watch

# 确保代码规范
npm run lint
npm run format:check

# 运行完整测试
npm test
npm run test:coverage
```

### 3. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 4. 推送并创建 PR

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

### 5. PR 描述模板

```markdown
## 描述

简要说明这个 PR 解决了什么问题

## 改动类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新

## 改动的文件

- src/detector-ast.js
- src/parser/vue.js

## 测试

- [ ] 已添加测试用例
- [ ] 本地测试通过
- [ ] 覆盖率满足要求

## 检查清单

- [ ] 代码符合项目规范
- [ ] 已更新相关文档
- [ ] 提交信息符合规范
```

### 6. 代码审查

- 响应审查意见并及时修改
- 保持讨论专业和友好
- 每个 PR 至少需要一位维护者审核通过

---

## 测试规范

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# 运行单个测试文件
npm test -- utils.test.js

# 运行特定测试
npm test -- -t "extractImports"
```

### 编写测试

测试文件放在 `__tests__/` 目录，使用 Jest 框架：

```javascript
describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    instance = new ModuleName();
  });

  describe('methodName', () => {
    test('should return expected value', () => {
      const result = instance.methodName();
      expect(result).toBe(expected);
    });

    test('should handle edge case', () => {
      expect(() => instance.methodName(null)).toThrow();
    });
  });
});
```

### 测试原则

1. **AAA 模式**: Arrange → Act → Assert
2. **单一职责**: 每个测试只验证一个行为
3. **清晰命名**: 测试名称描述测试内容
4. **独立运行**: 测试之间无依赖
5. **覆盖边界**: 测试边界条件和异常情况

### 覆盖率要求

| 指标     | 最低要求 |
| -------- | -------- |
| 语句覆盖 | 80%      |
| 分支覆盖 | 70%      |
| 函数覆盖 | 80%      |
| 行覆盖   | 80%      |

详细测试指南请参阅 [TESTING.md](./TESTING.md)。

---

## 问题反馈

如果您发现 Bug 或有功能建议，请通过 [GitHub Issues](https://github.com/Adou377/dead-code-detector/issues) 反馈。

### Bug 报告模板

```markdown
## 问题描述

简要描述遇到的问题

## 复现步骤

1. 创建配置文件 '...'
2. 运行命令 '...'
3. 出现错误

## 期望结果

描述期望的正确行为

## 实际结果

描述实际发生的情况

## 环境信息

- Node.js 版本: v18.17.0
- npm 版本: 9.6.7
- 操作系统: Windows 11 / macOS 14 / Ubuntu 22.04
- 项目类型: Vue 3 / React / TypeScript

## 错误日志
```

粘贴错误日志

````

## 配置文件

```json
粘贴相关配置
````

````

### 功能请求模板

```markdown
## 功能描述

描述您希望添加的功能

## 使用场景

描述这个功能解决什么问题

## 建议方案

如果有实现思路，请描述

## 替代方案

描述您考虑过的其他方案
````

---

## 许可证

通过贡献代码，您同意将您的贡献内容以 MIT 许可证发布。

---

## 相关文档

- [README.md](./README.md) - 项目介绍
- [API.md](./API.md) - API 参考
- [TESTING.md](./TESTING.md) - 测试指南
- [MIGRATION.md](./MIGRATION.md) - 迁移指南

---

## 联系方式

- GitHub Issues: https://github.com/Adou377/dead-code-detector/issues
- GitHub Discussions: https://github.com/Adou377/dead-code-detector/discussions

感谢您的贡献！
