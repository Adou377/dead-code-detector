# Dead Code Detector API 文档

本文档详细介绍死代码检测工具的 API 接口，帮助开发者在代码中集成使用。

## 目录

- [快速开始](#快速开始)
- [核心 API](#核心-api)
  - [detect()](#detect)
  - [DeadCodeFinderAST](#deadcodefinderast)
  - [DeadCodeFinder](#deadcodefinder)
- [增量分析](#增量分析)
  - [IncrementalAnalyzer](#incrementalanalyzer)
  - [DependencyGraph](#dependencygraph)
- [缓存管理](#缓存管理)
  - [CacheManager](#cachemanager)
- [配置管理](#配置管理)
- [类型定义](#类型定义)
- [示例代码](#示例代码)

## 快速开始

### 安装

```bash
npm install @is_adou/dead-code-detector
```

### 基础用法

```javascript
const { detect } = require('@is_adou/dead-code-detector');

const result = await detect({ srcDir: './src' });

console.log('未使用的导出:', result.results.unusedExports);
console.log('未使用的组件:', result.results.unusedComponents);
console.log('未使用的工具文件:', result.results.unusedToolFiles);
```

### ESM 导入

```javascript
import { detect, DeadCodeFinderAST } from '@is_adou/dead-code-detector';
```

---

## 核心 API

### detect()

主要的检测函数，用于分析项目中的死代码。

#### 语法

```typescript
async function detect(options?: DetectOptions): Promise<DetectResult>
```

#### 参数

| 参数 | 类型 | 描述 | 默认值 |
|------|------|------|--------|
| `srcDir` | `string` | 源代码目录 | `'./src'` |
| `extensions` | `string[]` | 文件扩展名数组 | `['.js', '.vue', '.jsx', '.ts', '.tsx']` |
| `ignoreDirs` | `string[]` | 忽略的目录数组 | `['node_modules', 'dist', '.git']` |
| `mode` | `'ast' \| 'regex'` | 检测模式 | `'ast'` |
| `verbose` | `boolean` | 是否显示详细日志 | `false` |
| `config` | `string` | 配置文件路径 | `undefined` |
| `maxFileSize` | `number` | 最大文件大小（字节） | `1000000` (1MB) |
| `concurrency` | `number` | 最大并发数 | `50` |

#### 返回值

```typescript
interface DetectResult {
  finder: DeadCodeFinderAST | DeadCodeFinder;
  results: {
    unusedExports: UnusedExport[];
    unusedComponents: UnusedComponent[];
    unusedToolFiles: string[];
  };
}
```

#### 示例

```javascript
const { detect } = require('@is_adou/dead-code-detector');

const result = await detect({
  srcDir: './src',
  mode: 'ast',
  verbose: true,
  maxFileSize: 2000000,
  concurrency: 100,
});

if (result.results.unusedExports.length > 0) {
  console.log('发现未使用的导出:');
  result.results.unusedExports.forEach(exp => {
    console.log(`  - ${exp.name} (${exp.file}:${exp.line})`);
  });
}
```

---

### DeadCodeFinderAST

基于 AST 的死代码检测器类，提供更准确的检测能力。

#### 构造函数

```javascript
const { DeadCodeFinderAST } = require('@is_adou/dead-code-detector');

const finder = new DeadCodeFinderAST({
  srcDir: './src',
  extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
  ignoreDirs: ['node_modules', 'dist', '.git'],
  verbose: false,
  maxFileSize: 1000000,
  concurrency: 50,
});
```

#### 方法

##### `analyze()`

执行完整的死代码分析。

```typescript
async function analyze(): Promise<AnalysisResults>
```

##### `report()`

生成并打印分析报告。

```typescript
function report(): AnalysisResults
```

##### `fix(options)`

自动修复未使用的代码。

```typescript
async function fix(options?: FixOptions): Promise<FixResult>
```

| 参数 | 类型 | 描述 | 默认值 |
|------|------|------|--------|
| `dryRun` | `boolean` | 仅预览，不实际执行 | `false` |
| `confirm` | `boolean` | 需要用户确认 | `false` |

##### `generateFixPreview()`

生成修复预览，返回将要删除的内容。

```typescript
function generateFixPreview(): FixPreview
```

#### 属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `unusedExports` | `UnusedExport[]` | 未使用的导出列表 |
| `unusedComponents` | `UnusedComponent[]` | 未使用的组件列表 |
| `unusedToolFiles` | `string[]` | 未使用的工具文件列表 |
| `exports` | `Map<string, ExportItem[]>` | 所有导出映射 |
| `imports` | `Map<string, any[]>` | 所有导入映射 |
| `components` | `Map<string, ComponentItem>` | 所有组件映射 |

#### 示例

```javascript
const { DeadCodeFinderAST } = require('@is_adou/dead-code-detector');

async function main() {
  const finder = new DeadCodeFinderAST({
    srcDir: './src',
    verbose: true,
  });

  await finder.analyze();
  
  const report = finder.report();
  console.log(`发现 ${report.unusedExports.length} 个未使用的导出`);

  const fixResult = await finder.fix({
    dryRun: true,
    confirm: true,
  });
  
  console.log('修复结果:', fixResult);
}

main();
```

---

### DeadCodeFinder

基于正则表达式的死代码检测器类，提供向后兼容的检测能力。

#### 构造函数

与 `DeadCodeFinderAST` 相同。

#### 方法

与 `DeadCodeFinderAST` 类相同，包含 `analyze()`、`report()` 和 `fix()` 方法。

> **注意**: 正则模式不支持 `generateFixPreview()` 方法。

---

## 增量分析

### IncrementalAnalyzer

增量分析器类，封装增量分析逻辑，支持缓存和 Git 变更检测。

#### 构造函数

```javascript
const { IncrementalAnalyzer } = require('@is_adou/dead-code-detector');

const analyzer = new IncrementalAnalyzer({
  srcDir: './src',
  baseBranch: 'main',
  cacheDir: '.dead-code-cache',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  verbose: false,
});
```

#### 方法

##### `initialize()`

初始化分析器，加载缓存。

```typescript
function initialize(): IncrementalAnalyzer
```

##### `getChangedFiles()`

获取相对于基准分支的变更文件列表。

```typescript
function getChangedFiles(): {
  files: string[] | null;
  branch: string;
  autoDetected: boolean;
  fallback: boolean;
  reason: string;
}
```

##### `getUncommittedChanges()`

获取未提交的变更文件列表。

```typescript
function getUncommittedChanges(): string[] | null
```

##### `analyzeAffectedFiles(changedFiles, imports)`

分析受影响的文件（使用依赖图）。

```typescript
function analyzeAffectedFiles(
  changedFiles: string[],
  imports: Map<string, any[]>
): Set<string>
```

##### `analyzeWithCache(filePaths, analyzer)`

批量分析文件，使用缓存优化。

```typescript
function analyzeWithCache(
  filePaths: string[],
  analyzer: (filePath: string) => any
): {
  data: Map<string, any>;
  cacheHits: number;
  cacheMisses: number;
  errors: Array<{ filePath: string; error: string }>;
}
```

##### `isIncrementalSupported()`

检查是否支持增量分析（是否在 Git 仓库中）。

```typescript
function isIncrementalSupported(): boolean
```

##### `getCurrentBranch()`

获取当前分支名。

```typescript
function getCurrentBranch(): string | null
```

##### `getLastCommitHash()`

获取最近一次提交的哈希。

```typescript
function getLastCommitHash(): string | null
```

#### 示例

```javascript
const { IncrementalAnalyzer } = require('@is_adou/dead-code-detector');

const analyzer = new IncrementalAnalyzer({
  srcDir: './src',
  baseBranch: 'main',
}).initialize();

const changedFiles = analyzer.getChangedFiles();

if (changedFiles.files && changedFiles.files.length > 0) {
  console.log(`检测到 ${changedFiles.files.length} 个变更文件`);
  console.log(`基准分支: ${changedFiles.branch}`);
}

const stats = analyzer.getCacheStats();
console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(2)}%`);
```

---

### DependencyGraph

依赖图管理类，负责构建、缓存和查询文件依赖关系。

#### 构造函数

```javascript
const { DependencyGraph } = require('@is_adou/dead-code-detector');

const depGraph = new DependencyGraph();
```

#### 方法

##### `addDependency(from, to)`

添加依赖关系。

```typescript
function addDependency(from: string, to: string): void
```

##### `buildFromImports(imports, srcDir)`

批量构建依赖图。

```typescript
function buildFromImports(
  imports: Map<string, any[]>,
  srcDir: string
): void
```

##### `getAffectedFiles(changedFiles)`

获取受影响的所有文件（使用 BFS 遍历反向依赖）。

```typescript
function getAffectedFiles(changedFiles: string[]): Set<string>
```

##### `getStats()`

获取统计信息。

```typescript
function getStats(): {
  totalFiles: number;
  totalDependencies: number;
  reverseDepsCount: number;
}
```

##### `clear()`

清空依赖图。

```typescript
function clear(): void
```

#### 示例

```javascript
const { DependencyGraph } = require('@is_adou/dead-code-detector');

const depGraph = new DependencyGraph();

depGraph.buildFromImports(importsMap, './src');

const affectedFiles = depGraph.getAffectedFiles(['src/utils/helper.js']);
console.log(`受影响的文件: ${affectedFiles.size} 个`);

const stats = depGraph.getStats();
console.log(`总文件数: ${stats.totalFiles}`);
console.log(`总依赖数: ${stats.totalDependencies}`);
```

---

## 缓存管理

### CacheManager

缓存管理器，用于持久化缓存分析结果。

#### 构造函数

```javascript
const { CacheManager } = require('@is_adou/dead-code-detector');

const cache = new CacheManager({
  projectRoot: './my-project',
  cacheDir: '.dead-code-cache',
  cacheFile: 'analysis-cache.json',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 100,
  maxMemoryMB: 50,
});
```

#### 方法

##### `load()`

加载缓存数据。

```typescript
function load(): CacheData
```

##### `save()`

保存缓存到文件。

```typescript
function save(): boolean
```

##### `get(filePath)`

获取文件缓存数据。

```typescript
function get(filePath: string): any | null
```

##### `set(filePath, data)`

设置文件缓存数据。

```typescript
function set(filePath: string, data: any): boolean
```

##### `invalidate(filePath)`

使指定文件的缓存失效。

```typescript
function invalidate(filePath: string): boolean
```

##### `clear()`

清空所有缓存。

```typescript
function clear(): boolean
```

##### `getStats()`

获取缓存统计信息。

```typescript
function getStats(): {
  totalFiles: number;
  totalSize: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  lastSaved: Date | null;
  hits: number;
  misses: number;
  hitRate: number;
}
```

##### `getAge(filePath)`

获取缓存条目的年龄（毫秒）。

```typescript
function getAge(filePath: string): number | null
```

##### `isExpired(filePath)`

检查缓存条目是否已过期。

```typescript
function isExpired(filePath: string): boolean
```

#### 示例

```javascript
const { CacheManager } = require('@is_adou/dead-code-detector');

const cache = new CacheManager({
  projectRoot: './my-project',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

cache.load();

cache.set('/path/to/file.js', { exports: ['foo', 'bar'] });

const data = cache.get('/path/to/file.js');
console.log(data);

const stats = cache.getStats();
console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(2)}%`);

cache.save();
```

---

## 配置管理

### loadConfig()

加载配置文件。

```typescript
function loadConfig(configPath?: string): ConfigFileOptions | null
```

支持以下配置文件格式（优先级从高到低）：
- `.deadcoderc.json`
- `.deadcoderc.js`
- `deadcode.config.js`

### mergeConfig()

合并命令行选项和配置文件。

```typescript
function mergeConfig(
  cliArgs?: Partial<ConfigFileOptions>,
  configFile?: ConfigFileOptions | null
): ConfigFileOptions
```

合并优先级：CLI 参数 > 配置文件 > 默认值

### validateConfig()

验证配置对象。

```typescript
function validateConfig(config: any): boolean
```

---

## 类型定义

### 核心类型

```typescript
interface DetectOptions {
  srcDir?: string;
  extensions?: string[];
  ignoreDirs?: string[];
  verbose?: boolean;
  mode?: 'ast' | 'regex';
  config?: string;
  maxFileSize?: number;
  concurrency?: number;
}

interface AnalysisResults {
  unusedExports: UnusedExport[];
  unusedComponents: UnusedComponent[];
  unusedToolFiles: string[];
}

interface UnusedExport {
  file: string;
  name: string;
  type: 'function' | 'variable' | 'class' | 'type' | 'interface' | 'enum' | 'default' | 'named' | 'star' | 'reexport';
  line: number;
  isDefault?: boolean;
  code?: string;
}

interface UnusedComponent {
  file: string;
  name: string;
  isLocal?: boolean;
  isGlobal?: boolean;
  isScriptSetup?: boolean;
}

interface FixOptions {
  dryRun?: boolean;
  confirm?: boolean;
}

interface FixResult {
  unusedExports: number;
  unusedComponents: number;
  unusedToolFiles: number;
  cancelled?: boolean;
  preview?: any;
  dryRun?: boolean;
}

interface ExportItem {
  name: string;
  type: string;
  line: number;
  code: string;
  source?: string;
}

interface ComponentItem {
  file: string;
  name: string;
  used?: boolean;
  isGlobal?: boolean;
  isLocal?: boolean;
  isScriptSetup?: boolean;
  composables?: string[];
  exposed?: string[];
}
```

---

## 示例代码

### 基本检测

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function checkDeadCode() {
  const result = await detect({
    srcDir: './src',
    mode: 'ast',
    verbose: true,
  });

  console.log(`发现 ${result.results.unusedExports.length} 个未使用的导出`);
  console.log(`发现 ${result.results.unusedComponents.length} 个未使用的组件`);
  console.log(`发现 ${result.results.unusedToolFiles.length} 个未使用的工具文件`);
}

checkDeadCode().catch(console.error);
```

### 自动修复

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function fixDeadCode() {
  const result = await detect({ srcDir: './src' });

  const fixResult = await result.finder.fix({
    dryRun: false,
    confirm: true,
  });

  console.log(`已修复 ${fixResult.unusedExports} 个未使用的导出`);
  console.log(`已删除 ${fixResult.unusedComponents} 个未使用的组件`);
  console.log(`已删除 ${fixResult.unusedToolFiles} 个未使用的工具文件`);
}

fixDeadCode().catch(console.error);
```

### 增量分析

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function incrementalCheck() {
  const result = await detect({
    srcDir: './src',
    incremental: true,
    baseBranch: 'main',
  });

  console.log('增量分析结果:', result.results);
}

incrementalCheck().catch(console.error);
```

### 集成到构建流程

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function build() {
  console.log('检测死代码...');
  
  const result = await detect({
    srcDir: './src',
    mode: 'ast',
  });

  const hasDeadCode =
    result.results.unusedExports.length > 0 ||
    result.results.unusedComponents.length > 0 ||
    result.results.unusedToolFiles.length > 0;

  if (hasDeadCode) {
    console.warn('警告: 发现未使用的代码！');
    process.exitCode = 1;
  }

  console.log('开始构建...');
}

build().catch(console.error);
```

### TypeScript 使用

```typescript
import {
  detect,
  DeadCodeFinderAST,
  type DetectOptions,
  type DetectResult,
  type AnalysisResults
} from '@is_adou/dead-code-detector';

const options: DetectOptions = {
  srcDir: './src',
  mode: 'ast',
  extensions: ['.js', '.vue', '.ts'],
  ignoreDirs: ['node_modules', 'dist'],
  verbose: true,
};

const result: DetectResult = await detect(options);
const { unusedExports, unusedComponents, unusedToolFiles }: AnalysisResults = result.results;
```

---

## 错误码说明

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| E001 | 无法访问源目录 | 检查目录路径是否正确 |
| E002 | 配置文件格式错误 | 检查 JSON 语法 |
| E003 | 文件解析失败 | 检查文件语法是否正确 |
| E004 | 自动修复失败 | 手动备份后重试 |

## 版本兼容性

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 12.0.0 |
| Babel | >= 7.0.0 |
| Vue | 2.x 和 3.x |
| React | 16.x+ |
| TypeScript | >= 3.0.0 |

## 相关链接

- [GitHub 仓库](https://github.com/Adou377/dead-code-detector)
- [问题反馈](https://github.com/Adou377/dead-code-detector/issues)
- [更新日志](./CHANGELOG.md)
