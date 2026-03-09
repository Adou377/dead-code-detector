# 贡献指南

感谢您对本项目的关注！我们欢迎各种形式的贡献，包括但不限于代码改进、文档完善、Bug 修复等。

## 开发环境设置

### 前置要求

- Node.js >= 12.0.0
- npm >= 6.0.0

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
```

## 代码规范

### 代码风格

本项目使用 ESLint 进行代码规范检查，请确保代码通过 lint 检查后再提交。

```bash
npm run lint
```

### 命名规范

- 变量和函数使用 camelCase
- 类名和组件名使用 PascalCase
- 常量使用 UPPER_SNAKE_CASE
- 文件名使用 kebab-case

### 注释规范

- 为公共 API 添加 JSDoc 注释
- 注释应该解释"为什么"，而不是"做什么"
- 更新代码时同步更新注释

### Git 提交规范

提交信息格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

| 类型     | 说明                           |
| -------- | ------------------------------ |
| feat     | 新功能                         |
| fix      | Bug 修复                       |
| docs     | 文档更新                       |
| style    | 代码格式（不影响功能）         |
| refactor | 重构（既不是新功能也不是修复） |
| test     | 测试相关                       |
| chore    | 构建过程或辅助工具变动         |

#### 示例

```
feat(detector): 添加 Vue 3 script setup 支持

- 新增对 <script setup> 语法的解析
- 支持 defineProps 和 defineEmits 宏

Closes #123
```

## Pull Request 流程

### 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/bug-description
```

### 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
```

### 推送并创建 PR

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

### PR 描述模板

```markdown
## 描述

简要说明这个 PR 解决了什么问题

## 改动的文件

- src/detector-ast.js
- src/parser/vue.js

## 测试

- [ ] 已添加测试用例
- [ ] 本地测试通过

## 截图（如适用）
```

## 测试规范

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 编写测试

- 测试文件放在 `__tests__/` 目录
- 使用 describe/it/expect 语法
- 确保新功能有对应的测试用例

## 问题反馈

如果您发现 Bug 或有功能建议，请通过 GitHub Issues 反馈。

请提供以下信息：

1. 问题描述
2. 复现步骤
3. 环境信息（Node.js 版本、操作系统等）
4. 错误日志（如有）

## 许可证

通过贡献代码，您同意将您的贡献内容以 MIT 许可证发布。
