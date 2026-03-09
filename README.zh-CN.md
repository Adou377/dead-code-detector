# 死代码检测工具 (Dead Code Detector)

一个高效的死代码检测工具，专为 Vue 2/3 和 React 项目设计，帮助识别和清理未使用的代码、导出和组件。节省时间并通过消除不再需要的代码来减少包大小。

## ✨ 主要特性

- **全面检测**: 未使用的导出、组件和工具文件
- **多框架支持**: Vue 2/3（包括 `<script setup>`）、React、TypeScript、JSX/TSX
- **双检测模式**: AST（精确）和正则（兼容旧项目）
- **智能自动修复**: 分组导出部分移除、多行导出处理、错误恢复
- **配置灵活性**: `.deadcoderc.json`、`.deadcoderc.js` 和 `deadcode.config.js`
- **路径别名支持**: 自动检测和解析项目配置中的路径别名
- **测试文件感知**: 跟踪测试文件中的导入，避免误报
- **备份系统**: 在进行更改前自动创建备份
- **详细模式**: 提供详细的进度和分析信息

## 🚀 快速开始

```bash
# 1. 全局安装
npm install -g dead-code-detector

# 2. 在项目中运行检测
cd your-project
dead-code

# 3. 查看结果并选择是否修复
dead-code --fix
```

## 📦 安装

```bash
# 全局安装（推荐频繁使用）
npm install -g dead-code-detector

# 本地安装（项目特定使用）
npm install dead-code-detector --save-dev
```

## 🛠️ 使用方式

### 命令行使用

#### 基础检测
```bash
# 检测当前目录 src 文件夹
dead-code

# 指定目录和模式
dead-code --src ./src --mode ast
```

#### 自动修复模式
```bash
# 自动修复未使用的代码
dead-code --fix

# 预览修复而不进行更改
dead-code --fix --dry-run

# 带确认提示的自动修复
dead-code --fix --confirm
```

### 配置

#### 配置文件

工具支持多种配置文件格式（优先级从高到低）：

- `.deadcoderc.json`（推荐）
- `.deadcoderc.js`（用于动态配置）
- `deadcode.config.js`（替代名称）

#### 配置选项

```json
{
  "srcDir": "./src",           // 要扫描的源目录
  "extensions": [".js", ".vue", ".jsx", ".ts", ".tsx"],  // 要包含的文件扩展名
  "ignoreDirs": ["node_modules", "dist", ".git"],  // 要忽略的目录
  "mode": "ast",               // 检测模式: "ast"（精确）或 "regex"（快速）
  "fix": false,                // 启用自动修复模式
  "verbose": false,            // 启用详细输出
  "maxFileSize": 1000000,      // 最大文件大小（字节），超过此大小的文件将被跳过（默认: 1MB）
  "concurrency": 50            // 最大并发数（默认: 50）
}
```

### API 使用

#### 基础 API

```javascript
const { detect } = require('dead-code-detector');

async function main() {
  // 运行检测
  const result = await detect({
    srcDir: './src',        // 源目录
    mode: 'ast',            // 检测模式
    config: './.deadcoderc.json',  // 可选配置文件
  });

  // 访问结果
  console.log('未使用的导出:', result.results.unusedExports);
  console.log('未使用的组件:', result.results.unusedComponents);
  console.log('未使用的工具文件:', result.results.unusedToolFiles);

  // 自动修复
  const fixResult = await result.finder.fix({
    dryRun: false,   // 设置为 true 预览更改
    confirm: true,   // 设置为 true 进行确认提示
  });

  console.log('修复结果:', fixResult);
}

main();
```

#### 高级 API

```javascript
const { DeadCodeFinderAST, DeadCodeFinderRegex } = require('dead-code-detector');

async function main() {
  // 创建查找器实例
  const finder = new DeadCodeFinderAST({
    srcDir: './src',
    extensions: ['.js', '.vue', '.tsx'],
    ignoreDirs: ['node_modules', 'dist'],
  });

  // 运行分析
  const results = await finder.analyze();
  
  // 获取结果
  console.log('结果:', results);

  // 修复未使用的代码
  await finder.fix({ dryRun: false });
}

main();
```

## 🔍 检测模式

### AST 模式（默认）

**推荐用于大多数项目**
- 使用 Babel AST 解析进行高精度检测
- 支持多行导出、TypeScript 类型和 Vue `<script setup>`
- 更好地处理复杂的导出/导入模式
- 更可靠的组件检测

### 正则模式（兼容）

**用于旧项目或性能关键场景**
- 使用传统正则表达式进行更快的扫描
- 准确性较低但适用于旧代码库
- 仅当 AST 模式存在性能问题时推荐使用
- 对复杂语法特性的支持有限

## 🛠️ 自动修复

工具可以使用 `--fix` 参数自动删除未使用的代码。以下是其工作原理：

### 自动修复特性

- **智能导出移除**: 移除未使用的导出，同时保留使用的导出
- **多行导出处理**: 正确处理复杂的多行导出语句
- **组件清理**: 移除未使用的 Vue 和 React 组件
- **文件删除**: 移除完全未使用的工具文件
- **备份系统**: 在进行更改前自动创建备份
- **错误恢复**: 优雅处理语法错误

### 安全措施

1. **始终先不带 `--fix` 运行**以预览更改
2. **使用 `--dry-run`** 查看将被删除的内容
3. **使用 `--confirm`** 进行交互式确认
4. **检查备份**在 `backup/` 目录中（如果需要）

### 示例工作流程

```bash
# 1. 预览将修复的内容
dead-code --fix --dry-run

# 2. 带确认运行
dead-code --fix --confirm

# 3. 不带确认运行（谨慎使用!）
dead-code --fix
```



## 📚 高级用法

### 命令行选项

#### 按扩展名过滤
```bash
# 仅扫描 JavaScript 和 TypeScript 文件
dead-code --ext .js,.ts,.tsx

# 仅扫描 Vue 文件
dead-code --ext .vue
```

#### 忽略目录
```bash
# 忽略多个目录
dead-code --ignore node_modules,dist,.git,coverage
```

#### 详细输出
```bash
# 显示详细进度和分析
dead-code --verbose
```

#### 自定义源目录
```bash
# 指定自定义源目录
dead-code --src ./src/components
```

#### 组合多个选项
```bash
# 完整功能命令
dead-code --src ./src --mode ast --ext .js,.vue,.tsx --ignore node_modules,dist --verbose
```

## 📝 配置示例

### 基础配置

**文件: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "mode": "ast"
}
```

### 完整配置

**文件: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", ".git", "coverage", ".history"],
  "mode": "ast",
  "fix": false,
  "verbose": false,
  "maxFileSize": 1000000,
  "concurrency": 50
}
```

### 框架特定配置

#### Vue 3 项目
**文件: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".ts"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "ast"
}
```

#### React + TypeScript 项目
**文件: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", "build"],
  "mode": "ast"
}
```

#### 旧项目（正则模式）
**文件: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "regex"
}
```

## 🛠️ 故障排查

### 常见问题

#### Q: 为什么某些导出没有被检测到？

**可能的原因：**
- 导出被动态导入使用
- 导出被作为副作用导入
- 导出在测试文件中使用
- 路径别名解析失败
- 导出以 AST 无法检测的方式使用（例如基于字符串的导入）

#### Q: 为什么组件被标记为未使用？

**可能的原因：**
- 组件确实未被使用
- 组件使用了不同的命名约定（PascalCase vs kebab-case）
- 组件在模板中使用但未在脚本中正确导入
- 组件全局注册但未本地导入

#### Q: 自动修复误删了代码怎么办？

**解决方案：** 工具会自动在 `backup/` 目录创建备份，可以从中恢复文件。

#### Q: 大项目检测速度慢？

**优化方法：**
1. 使用 AST 模式（默认）- 对于大项目实际上更快
2. 使用 `--ignore` 将大目录添加到忽略列表
3. 使用 `--ext` 限制文件扩展名
4. 对于非常大的项目使用正则模式（权衡：准确性较低）

#### Q: 如何处理路径别名？

**解决方案：** 工具会自动从项目配置（webpack、vite 等）中检测路径别名。如果不起作用，可以在配置文件中手动指定别名。

### 错误信息

#### "无法解析文件"

这意味着文件存在语法错误。工具会跳过这些文件并继续分析。

#### "路径别名未解析"

检查项目配置中的路径别名，或在配置文件中手动指定。

#### "未找到文件"

确保使用 `--src` 指定了正确的源目录。

## 📖 API 文档

详细的 API 文档请查看 [API.md](./API.md) 文件。它包括：
- 完整的 API 参考
- 详细的方法描述
- 类型定义
- 高级使用示例

## 🔄 迁移指南

从其他死代码检测工具迁移？请查看我们的 [迁移指南](./MIGRATION.md)，包括：
- 从 ts-prune、unused、webpack-deadcode-plugin 等工具迁移
- 版本升级说明
- 配置迁移示例
- 常见迁移问题解答

## 🤝 贡献

我们欢迎为改进项目做出贡献！请阅读我们的 [贡献指南](./CONTRIBUTING.md) 以开始。贡献包括：
- 代码改进和 bug 修复
- 文档增强
- 测试覆盖率改进
- 新功能建议

## 📄 变更日志

请查看 [CHANGELOG.md](./CHANGELOG.md) 文件了解全面的变更和更新，包括：
- 版本历史
- 新功能
- bug 修复
- 重大变更

## 🌍 语言

- [English](./README.md)
- [中文](./README.zh-CN.md)

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](https://opensource.org/licenses/MIT) 文件。

## 🙏 致谢

- 使用 Babel 进行 AST 解析
- 受各种死代码检测工具的启发
- 感谢所有贡献者和用户

---

**愉快编码！** 🎉
