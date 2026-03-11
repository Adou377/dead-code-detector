# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-03-11

### Added

- **智能增量分析** - 增量分析体验优化
  - 自动检测默认分支（支持 `main` 和 `master`）
  - 非标准分支名称时自动回退到全量分析，避免报错
  - 新增 `detectDefaultBranch()` 函数用于自动检测 Git 默认分支
  - 新增 `branchExists()` 函数验证分支存在性

### Changed

- **增量分析 API 重构** - 返回值结构优化
  - `getChangedFiles()` 返回值从数组改为对象格式，包含更丰富的元数据
  - 新增返回字段：
    - `files`: 变更文件列表
    - `branch`: 实际使用的基准分支
    - `autoDetected`: 是否自动检测分支
    - `fallback`: 是否回退到全量分析
    - `reason`: 回退原因（如适用）
  - 支持不指定 `--since` 参数时自动检测基准分支

### Fixed

- **Worker 线程池资源泄漏** - 进程挂起问题修复
  - 修复任务完成时超时定时器未清除，导致进程无法正常退出的问题
  - 修复 Worker 错误/退出时未正确终止，导致进程挂起的问题
  - 影响：使用 `--incremental` 或大项目分析时可能出现

- **纯模板 Vue 组件解析** - 解析字段缺失修复
  - 修复 `parse-worker.js` 中 `vueInfo` 缺少 `isPureTemplateComponent` 字段的问题
  - 正确区分纯模板组件（无 `<script>` 块）和有脚本组件的处理逻辑

### Documentation

- 更新 README.md 和 README.zh-CN.md，添加增量分析功能说明
- 优化 API.md 文档，补充新增 API 说明
- 更新 MIGRATION.md，添加 1.0.x → 1.1.x 升级指南

### Upgrade Notes

从 1.1.0 升级到 1.1.1 无破坏性变更，直接更新即可

## [1.1.0] - 2026-03-11

### Performance

- **LRU 缓存策略**
  - 实现 Map + 双向链表 LRU 缓存，支持自动淘汰
  - 新增 `maxEntries` 和 `maxMemoryMB` 配置项
  - 内存占用监控和自动清理机制

- **正则表达式优化**
  - 预编译常用正则表达式，减少 99%+ 对象创建
  - 新增 `RegexCache` 类缓存动态正则表达式

- **增量分析优化**
  - 新增 `DependencyGraph` 类封装依赖图管理
  - 依赖查找从 O(n²) 优化到 O(1)
  - 双向索引支持正向和反向依赖查询

- **Worker 池优化**
  - 超时任务正确清理和资源释放
  - 动态并发调整支持
  - 任务优先级队列支持

### Changed

- **代码复杂度降低**
  - 最长函数从 74 行降至 25 行
  - 新增 20+ 辅助函数提升可读性
  - 拆分 detector-ast.js、detector.js、walker.js 核心模块

- **重复代码消除**
  - 新增 `error-handler.js` 统一错误处理模块
  - 统一文件读取工具函数
  - 配置验证逻辑集中到 config.js

- **测试文件重构**
  - 拆分 2202 行测试文件为 6 个模块化文件
  - 移除约 10 个重复测试用例
  - 新增边界情况测试覆盖

### Removed

- 移除未使用的 `MemoryMonitor` 类

### Documentation

- 补充 53 个函数的 JSDoc 注释
- detector.js 新增 43 个方法的完整文档

### Fixed

- 修复 ESLint 警告

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
