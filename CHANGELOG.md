# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
