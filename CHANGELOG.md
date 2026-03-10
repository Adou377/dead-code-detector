# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-03-10

### Changed

- **测试目录检测优化**
  - 测试目录不存在时静默跳过，不再输出警告信息
  - 只有当测试目录存在但无法访问时才输出警告
  - 避免给用户造成"出错"的错觉

- **Vue 解析器优化**
  - 支持纯模板组件（无 `<script>` 块的 Vue 组件）
  - 支持 SVG 图标组件的正确识别
  - 新增 `hasScript` 字段区分"无脚本块"和"解析失败"两种状态
  - 纯模板组件不被追踪为组件（没有可追踪的导出）

### Added

- **模板信息提取**
  - 新增 `extractTemplateInfo` 函数
  - 自动检测 SVG 图标组件
  - 提取模板中的组件引用信息

### Fixed

- 修复纯 SVG 图标组件被误报为"解析失败"的问题
- 修复测试目录不存在时输出过多警告的问题

### Documentation

- 补充本地安装后的使用方式说明
- 新增 `npx dead-code` 和 npm scripts 配置示例

## [1.0.0] - 2026-03-05

### Added

- **双检测模式**
  - AST 模式（默认）：使用 Babel AST 解析，精确度高
  - 正则模式：传统正则匹配，兼容性好

- **多框架支持**
  - Vue 2/3 组件检测，支持 `<script setup>` 语法
  - React 函数组件和类组件检测
  - TypeScript、JSX、TSX 文件支持

- **导出检测**
  - 命名导出检测
  - 默认导出检测
  - 分组导出检测
  - 重导出检测

- **组件检测**
  - Vue 组件注册和使用追踪
  - React 组件引用分析

- **工具文件检测**
  - 未使用的工具文件识别

- **自动修复功能**
  - 自动移除未使用的导出
  - 自动删除未使用的文件
  - 修复前自动备份
  - Dry-run 预览模式

- **配置支持**
  - `.deadcoderc.json` 配置文件
  - `.deadcoderc.js` 配置文件
  - `deadcode.config.js` 配置文件

- **其他功能**
  - 路径别名解析
  - 测试文件导入追踪
  - 详细输出模式
  - 增量分析支持

### Configuration Options

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `srcDir` | 源代码目录 | `./src` |
| `extensions` | 扫描的文件扩展名 | `.js, .vue, .jsx, .ts, .tsx` |
| `ignoreDirs` | 忽略的目录 | `node_modules, dist, .git` |
| `mode` | 检测模式 | `ast` |
| `fix` | 启用自动修复 | `false` |
| `verbose` | 详细输出 | `false` |

### Dependencies

- @babel/parser: ^7.27.2
- @babel/traverse: ^7.27.2
- chalk: ^4.1.2
- commander: ^12.1.0
- ora: ^5.4.1

### Known Limitations

- 动态导入在某些情况下可能无法完全检测
- 使用字符串方式解析的组件可能无法检测
- 导出/导入解析的某些边界情况可能未处理
