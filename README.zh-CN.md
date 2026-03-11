# 死代码检测工具 (Dead Code Detector)

![npm version](https://img.shields.io/npm/v/@is_adou/dead-code-detector)
![license](https://img.shields.io/npm/l/@is_adou/dead-code-detector)

一个高效的死代码检测工具，专为 Vue 2/3 和 React 项目设计，帮助识别和清理未使用的代码、导出和组件。节省时间并通过消除不再需要的代码来减少包大小。

## ✨ 主要特性

- **全面检测**: 未使用的导出、组件和工具文件
- **多框架支持**: Vue 2/3（包括 `<script setup>`）、React、TypeScript、JSX/TSX
- **双检测模式**: AST（精确）和正则（兼容旧项目）
- **智能自动修复**: 分组导出部分移除、多行导出处理、错误恢复
- **配置灵活性**: `.deadcoderc.json`、`.deadcoderc.js` 和 `deadcode.config.js`
- **路径别名支持**: 自动检测和解析项目配置中的路径别名
- **测试文件感知**: 跟踪测试文件中的导入，避免误报
- **LRU 缓存**: 内存高效的缓存系统，支持自动淘汰 (v1.1.0)
- **增量分析**: 基于文件的缓存加速重复运行，优化的依赖关系图
- **备份系统**: 在进行更改前自动创建备份
- **详细模式**: 提供详细的进度和分析信息

## 🚀 快速开始

```bash
# 全局安装（推荐）
npm install -g @is_adou/dead-code-detector

# 在项目中运行检测
cd your-project
dead-code

# 自动修复未使用的代码
dead-code --fix
```

<details>
<summary>其他安装方式</summary>

```bash
# 本地安装
npm install @is_adou/dead-code-detector --save-dev

# 使用 npx 运行
npx dead-code

# 或添加到 package.json scripts
# {
#   "scripts": {
#     "dead-code": "dead-code"
#   }
# }
npm run dead-code
```

</details>

## 🛠️ 使用方式

### 命令行

```bash
# 基础检测
dead-code

# 指定目录和模式
dead-code --src ./src --mode ast

# 预览修复
dead-code --fix --dry-run

# 带确认的自动修复
dead-code --fix --confirm
```

### 配置

在项目根目录创建 `.deadcoderc.json`：

```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", ".git"],
  "mode": "ast",
  "cache": true,
  "cacheDir": ".dead-code-cache"
}
```

<details>
<summary>完整配置选项</summary>

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `srcDir` | 要扫描的源目录 | `./src` |
| `extensions` | 要包含的文件扩展名 | `[".js", ".vue", ".jsx", ".ts", ".tsx"]` |
| `ignoreDirs` | 要忽略的目录 | `["node_modules", "dist", ".git"]` |
| `mode` | 检测模式: "ast" 或 "regex" | `"ast"` |
| `fix` | 启用自动修复模式 | `false` |
| `verbose` | 启用详细输出 | `false` |
| `maxFileSize` | 最大文件大小（字节） | `1000000` (1MB) |
| `concurrency` | 最大并发数 | `50` |
| `cache` | 启用持久化缓存 | `true` |
| `cacheDir` | 缓存目录 | `.dead-code-cache` |
| `cacheMaxAge` | 缓存最大有效期（毫秒） | `604800000` (7天) |
| `maxEntries` | 最大缓存条目数 | `100` |
| `maxMemoryMB` | 缓存最大内存使用量 | `50` |

</details>

### 增量分析

仅分析变更的文件，加速重复运行：

```bash
# 增量分析（自动检测 main/master 分支）
dead-code --incremental

# 指定基准分支
dead-code --incremental --base-branch develop
```

| 场景 | 命令 |
|------|------|
| 日常开发 | `dead-code --incremental` |
| PR 代码审查 | `dead-code --incremental --base-branch main` |
| 完整代码审计 | `dead-code` |

## 🔍 检测模式

### AST 模式（默认）

**推荐用于大多数项目**
- 使用 Babel AST 解析进行高精度检测
- 支持多行导出、TypeScript 类型和 Vue `<script setup>`
- 更好地处理复杂的导出/导入模式

### 正则模式

**用于旧项目或性能关键场景**
- 使用传统正则表达式进行更快的扫描
- 准确性较低但适用于旧代码库
- 对复杂语法特性的支持有限

## 🛠️ 自动修复

```bash
# 预览修复内容
dead-code --fix --dry-run

# 带确认的修复
dead-code --fix --confirm

# 直接修复（谨慎使用！）
dead-code --fix
```

**安全措施：**
1. 始终先不带 `--fix` 运行以预览
2. 使用 `--dry-run` 查看将被删除的内容
3. 使用 `--confirm` 进行交互式确认
4. 如需恢复，检查 `backup/` 目录

## 📚 高级用法

```bash
# 按扩展名过滤
dead-code --ext .js,.ts,.tsx

# 忽略目录
dead-code --ignore node_modules,dist,.git,coverage

# 详细输出
dead-code --verbose

# 自定义源目录
dead-code --src ./src/components

# 组合选项
dead-code --src ./src --mode ast --ext .js,.vue,.tsx --ignore node_modules,dist --verbose
```

## 📝 配置示例

<details>
<summary>Vue 3 项目</summary>

```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".ts"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "ast"
}
```

</details>

<details>
<summary>React + TypeScript 项目</summary>

```json
{
  "srcDir": "./src",
  "extensions": [".js", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", "build"],
  "mode": "ast"
}
```

</details>

<details>
<summary>旧项目（正则模式）</summary>

```json
{
  "srcDir": "./src",
  "extensions": [".js"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "regex"
}
```

</details>

## 🛠️ 故障排查

### 常见问题

**Q: 为什么某些导出没有被检测到？**

可能原因：动态导入、副作用导入、测试文件中使用、路径别名解析失败。

**Q: 为什么组件被标记为未使用？**

可能原因：命名约定不同（PascalCase vs kebab-case）、模板中使用但脚本未导入、全局注册。

**Q: 自动修复误删了代码怎么办？**

从 `backup/` 目录恢复。工具会在修改前自动创建备份。

**Q: 大项目检测速度慢？**

1. 使用 AST 模式（默认）- 对大项目更快
2. 用 `--ignore` 添加大目录到忽略列表
3. 用 `--ext` 限制文件扩展名

### 错误信息

| 错误 | 解决方案 |
|------|----------|
| "无法解析文件" | 文件有语法错误，将被跳过 |
| "路径别名未解析" | 检查项目配置或手动指定 |
| "未找到文件" | 用 `--src` 检查源目录 |

## 📖 API 文档

详细 API 文档请查看 [API.md](./API.md)。

```javascript
const { detect } = require('@is_adou/dead-code-detector');

const result = await detect({ srcDir: './src' });
console.log('未使用的导出:', result.results.unusedExports);
```

## 🔄 迁移指南

从其他工具迁移？请查看 [MIGRATION.md](./MIGRATION.md)，包括：
- 从 ts-prune、unused、webpack-deadcode-plugin 迁移
- 版本升级说明
- 配置迁移示例

## 🤝 贡献

请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献指南。

## 📄 变更日志

请查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本历史。

## 🌍 语言

- [English](./README.md)
- [中文](./README.zh-CN.md)

## 📝 许可证

MIT 许可证 - 详见 [LICENSE](https://opensource.org/licenses/MIT)。

## 🙏 致谢

- 使用 Babel 进行 AST 解析
- 受各种死代码检测工具的启发

---

**愉快编码！** 🎉
