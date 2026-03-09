# Dead Code Detector API 文档

本文档详细介绍死代码检测工具的 API 接口，帮助开发者在代码中集成使用。

## 核心模块

### 1. `detect` 函数

主要的检测函数，用于分析项目中的死代码。

#### 语法

```javascript
async function detect(options = {})
```

#### 参数

| 参数                 | 类型       | 描述                       | 默认值                                   |
| -------------------- | ---------- | -------------------------- | ---------------------------------------- |
| `options.srcDir`     | `string`   | 源代码目录                 | `'./src'`                                |
| `options.extensions` | `string[]` | 文件扩展名数组             | `['.js', '.vue', '.jsx', '.ts', '.tsx']` |
| `options.ignoreDirs` | `string[]` | 忽略的目录数组             | `['node_modules', 'dist', '.git']`       |
| `options.verbose`    | `boolean`  | 是否显示详细日志           | `false`                                  |
| `options.mode`       | `string`   | 检测模式: 'ast' 或 'regex' | `'ast'`                                  |
| `options.config`     | `string`   | 配置文件路径               | `undefined`                              |
| `options.maxFileSize`| `number`   | 最大文件大小（字节）       | `1000000` (1MB)                          |
| `options.concurrency`| `number`   | 最大并发数                 | `50`                                     |

#### 返回值

返回一个 Promise，解析为包含以下属性的对象：

| 属性                       | 类型     | 描述                 |
| -------------------------- | -------- | -------------------- |
| `finder`                   | `Object` | 检测器实例           |
| `results`                  | `Object` | 检测结果             |
| `results.unusedExports`    | `Array`  | 未使用的导出列表     |
| `results.unusedComponents` | `Array`  | 未使用的组件列表     |
| `results.unusedToolFiles`  | `Array`  | 未使用的工具文件列表 |

#### 示例

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function main() {
  const result = await detect({
    srcDir: './src',
    mode: 'ast',
    verbose: true,
  });

  console.log('未使用的导出:', result.results.unusedExports);
  console.log('未使用的组件:', result.results.unusedComponents);
  console.log('未使用的工具文件:', result.results.unusedToolFiles);
}

main();
```

### 2. `DeadCodeFinderAST` 类

基于 AST 的死代码检测器类，提供更准确的检测能力。

#### 构造函数

```javascript
const { DeadCodeFinderAST } = require('@is_adou/dead-code-detector');

const finder = new DeadCodeFinderAST({
  srcDir: './src',
  extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
  ignoreDirs: ['node_modules', 'dist', '.git'],
  verbose: false,
});
```

#### 方法

##### `analyze()`

执行完整的死代码分析。

**语法**:

```javascript
async function analyze()
```

**返回值**:
返回一个 Promise，解析为包含检测结果的对象。

##### `report()`

生成并打印分析报告。

**语法**:

```javascript
function report()
```

**返回值**:
返回包含检测结果的对象。

##### `fix(options)`

自动修复未使用的代码。

**语法**:

```javascript
async function fix(options = {})
```

**参数**:
| 参数 | 类型 | 描述 | 默认值 |
|------|------|------|--------|
| `options.dryRun` | `boolean` | 是否仅预览修复，不实际执行 | `false` |
| `options.confirm` | `boolean` | 是否需要用户确认 | `false` |

**返回值**:
返回一个 Promise，解析为修复结果对象。

#### 示例

```javascript
const { DeadCodeFinderAST } = require('@is_adou/dead-code-detector');

async function main() {
  const finder = new DeadCodeFinderAST({
    srcDir: './src',
    verbose: true,
  });

  // 执行分析
  await finder.analyze();

  // 生成报告
  const report = finder.report();

  // 自动修复
  const fixResult = await finder.fix({
    dryRun: false,
    confirm: true,
  });

  console.log('修复结果:', fixResult);
}

main();
```

### 3. `DeadCodeFinder` 类

基于正则表达式的死代码检测器类，提供向后兼容的检测能力。

#### 构造函数

```javascript
const { DeadCodeFinder } = require('@is_adou/dead-code-detector');

const finder = new DeadCodeFinder({
  srcDir: './src',
  extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
  ignoreDirs: ['node_modules', 'dist', '.git'],
  verbose: false,
});
```

#### 方法

与 `DeadCodeFinderAST` 类相同，包含 `analyze()`、`report()` 和 `fix()` 方法。

### 4. 配置相关函数

#### `loadConfig(configPath)`

加载配置文件。

**语法**:

```javascript
function loadConfig(configPath)
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `configPath` | `string` | 配置文件路径 |

**返回值**:
返回配置对象，如果没有找到配置文件则返回 `undefined`。

#### `mergeConfig(options, configFile)`

合并命令行选项和配置文件。

**语法**:

```javascript
function mergeConfig(options, configFile)
```

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `options` | `Object` | 命令行选项 |
| `configFile` | `Object` | 配置文件对象 |

**返回值**:
返回合并后的配置对象。

## 检测结果格式

### 未使用的导出

```javascript
[
  {
    file: 'path/to/file.js', // 文件路径
    name: 'unusedFunction', // 导出名称
    type: 'function', // 导出类型: function, variable, class, type, interface, enum
    line: 10, // 行号
    isDefault: false, // 是否为默认导出
  },
  // 更多未使用的导出...
];
```

### 未使用的组件

```javascript
[
  {
    file: 'components/UnusedComponent.vue', // 组件文件路径
    name: 'UnusedComponent', // 组件名称
  },
  // 更多未使用的组件...
];
```

### 未使用的工具文件

```javascript
[
  'utils/unusedUtil.js', // 未使用的工具文件路径
  'helpers/oldHelper.ts', // 未使用的工具文件路径
  // 更多未使用的工具文件...
];
```

## 错误处理

当遇到解析错误时，工具会记录警告并继续执行，不会因为单个文件的错误而中断整个检测过程。

```javascript
try {
  const result = await detect({
    srcDir: './src',
  });
  // 处理结果
} catch (error) {
  console.error('检测过程中发生错误:', error);
}
```

## 缓存模块

### `CacheManager` 类

缓存管理器，用于持久化缓存分析结果，支持增量分析。

#### 构造函数

```javascript
const { CacheManager } = require('@is_adou/dead-code-detector');

const cacheManager = new CacheManager({
  projectRoot: './my-project',
  cacheDir: '.dead-code-cache',
  cacheFile: 'analysis-cache.json',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  maxEntries: 100, // 最大缓存条目数
});
```

**参数**:
| 参数 | 类型 | 描述 | 默认值 |
|------|------|------|--------|
| `projectRoot` | `string` | 项目根目录 | `process.cwd()` |
| `cacheDir` | `string` | 缓存目录名 | `'.dead-code-cache'` |
| `cacheFile` | `string` | 缓存文件名 | `'analysis-cache.json'` |
| `maxAge` | `number` | 缓存过期时间（毫秒） | `604800000` (7天) |
| `maxEntries` | `number` | 最大缓存条目数 | `100` |

#### 方法

##### `load()`

加载缓存数据。

**返回值**: 缓存对象

##### `save()`

保存缓存到文件。

**返回值**: `boolean` - 是否保存成功

##### `get(filePath)`

获取文件缓存数据。

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `filePath` | `string` | 文件路径 |

**返回值**: 缓存数据或 `null`

##### `set(filePath, data)`

设置文件缓存数据。

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `filePath` | `string` | 文件路径 |
| `data` | `any` | 缓存数据 |

**返回值**: `boolean` - 是否设置成功

##### `invalidate(filePath)`

使指定文件的缓存失效。

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `filePath` | `string` | 文件路径 |

**返回值**: `boolean` - 是否操作成功

##### `clear()`

清空所有缓存。

**返回值**: `boolean` - 是否清空成功

##### `getStats()`

获取缓存统计信息。

**返回值**:
```javascript
{
  totalFiles: number,      // 缓存文件总数
  totalSize: number,       // 缓存总大小（字节）
  oldestEntry: Date | null, // 最早条目时间
  newestEntry: Date | null, // 最新条目时间
  lastSaved: Date | null,   // 最后保存时间
  hits: number,            // 缓存命中次数
  misses: number,          // 缓存未命中次数
  hitRate: number,         // 缓存命中率 (0-1)
}
```

##### `getAge(filePath)`

获取缓存条目的年龄（毫秒）。

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `filePath` | `string` | 文件路径 |

**返回值**: `number | null` - 缓存年龄（毫秒），不存在则返回 `null`

##### `isExpired(filePath)`

检查缓存条目是否已过期。

**参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `filePath` | `string` | 文件路径 |

**返回值**: `boolean` - 是否已过期

##### `getHitRate()`

获取缓存命中率。

**返回值**: `number` - 命中率 (0-1)

##### `resetStats()`

重置命中率统计。

#### 示例

```javascript
const { CacheManager } = require('@is_adou/dead-code-detector');

const cache = new CacheManager({
  projectRoot: './my-project',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  maxEntries: 100,
});

// 加载缓存
cache.load();

// 设置缓存
cache.set('/path/to/file.js', { exports: ['foo', 'bar'] });

// 获取缓存
const data = cache.get('/path/to/file.js');
console.log(data); // { exports: ['foo', 'bar'] }

// 获取缓存统计
const stats = cache.getStats();
console.log(`缓存命中率: ${(stats.hitRate * 100).toFixed(2)}%`);

// 检查缓存年龄
const age = cache.getAge('/path/to/file.js');
console.log(`缓存年龄: ${age}ms`);

// 保存缓存
cache.save();
```

## 性能优化

1. **并行处理**: 工具默认使用最多 50 个文件同时处理，提高检测速度
2. **内存优化**: 按需加载文件内容，避免一次性加载所有文件到内存
3. **文件大小限制**: 对过大的文件会跳过解析，避免内存溢出

## 最佳实践

1. **先分析后修复**: 先运行不带 `--fix` 的检测，确认需要删除的内容
2. **备份重要代码**: 虽然工具会自动创建备份，但仍建议手动备份重要代码
3. **合理配置**: 根据项目特点调整配置选项，提高检测准确性
4. **定期检测**: 将死代码检测集成到 CI/CD 流程中，定期运行

## 常见问题

### Q: 为什么某些导出没有被检测到？

A: 可能的原因包括：

- 导出被动态导入使用
- 导出被作为副作用导入
- 导出在测试文件中使用
- 路径别名解析失败

### Q: 为什么组件被标记为未使用？

A: 可能的原因包括：

- 组件确实未被使用
- 组件使用了不同的命名方式（如 PascalCase vs kebab-case）
- 组件在模板中使用但未在脚本中导入

### Q: 自动修复会删除哪些内容？

A: 自动修复会删除：

- 未使用的导出语句
- 未使用的组件文件
- 未使用的工具文件

## 版本兼容性

- Node.js: >= 12.0.0
- Babel: >= 7.0.0
- Vue: 2.x 和 3.x
- React: 16.x 和 17.x
- TypeScript: >= 3.0.0

## 示例代码

### 基本用法

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function checkDeadCode() {
  console.log('开始检测死代码...');

  const result = await detect({
    srcDir: './src',
    mode: 'ast',
    verbose: true,
  });

  console.log('检测完成！');
  console.log(`发现 ${result.results.unusedExports.length} 个未使用的导出`);
  console.log(`发现 ${result.results.unusedComponents.length} 个未使用的组件`);
  console.log(`发现 ${result.results.unusedToolFiles.length} 个未使用的工具文件`);

  // 显示详细信息
  if (result.results.unusedExports.length > 0) {
    console.log('\n未使用的导出:');
    result.results.unusedExports.forEach(exp => {
      console.log(`- ${exp.name} (${exp.file}:${exp.line})`);
    });
  }
}

checkDeadCode().catch(console.error);
```

### 自动修复

```javascript
const { detect } = require('@is_adou/dead-code-detector');

async function fixDeadCode() {
  console.log('开始检测并修复死代码...');

  const result = await detect({
    srcDir: './src',
    mode: 'ast',
  });

  // 预览修复
  const fixPreview = result.finder.generateFixPreview();
  console.log('修复预览:', fixPreview);

  // 执行修复
  const fixResult = await result.finder.fix({
    dryRun: false,
    confirm: true,
  });

  console.log('修复完成！');
  console.log(`已修复 ${fixResult.unusedExports} 个未使用的导出`);
  console.log(`已删除 ${fixResult.unusedComponents} 个未使用的组件`);
  console.log(`已删除 ${fixResult.unusedToolFiles} 个未使用的工具文件`);
}

fixDeadCode().catch(console.error);
```

### 集成到构建流程

```javascript
// 在构建脚本中使用
const { detect } = require('@is_adou/dead-code-detector');

async function build() {
  // 先检测死代码
  console.log('检测死代码...');
  const result = await detect({
    srcDir: './src',
    mode: 'ast',
  });

  // 检查是否有未使用的代码
  const hasDeadCode =
    result.results.unusedExports.length > 0 ||
    result.results.unusedComponents.length > 0 ||
    result.results.unusedToolFiles.length > 0;

  if (hasDeadCode) {
    console.warn('警告: 发现未使用的代码！');
    // 可以选择退出构建或继续
  }

  // 继续构建流程
  console.log('开始构建...');
  // 构建代码...
}

build().catch(console.error);
```

## TypeScript 类型定义

### 核心类型

```typescript
// 检测选项
interface DetectOptions {
  srcDir?: string;
  extensions?: string[];
  ignoreDirs?: string[];
  verbose?: boolean;
  mode?: 'ast' | 'regex';
  config?: string;
}

// 检测结果
interface DetectResult {
  finder: DeadCodeFinder | DeadCodeFinderAST;
  results: {
    unusedExports: UnusedExport[];
    unusedComponents: UnusedComponent[];
    unusedToolFiles: string[];
  };
}

// 未使用的导出
interface UnusedExport {
  file: string;
  name: string;
  type:
    | 'function'
    | 'variable'
    | 'class'
    | 'type'
    | 'interface'
    | 'enum'
    | 'default'
    | 'named'
    | 'star'
    | 'reexport';
  line: number;
  isDefault?: boolean;
  code?: string;
}

// 未使用的组件
interface UnusedComponent {
  file: string;
  name: string;
  isLocal?: boolean;
}

// 修复选项
interface FixOptions {
  dryRun?: boolean;
  confirm?: boolean;
}

// 修复结果
interface FixResult {
  unusedExports: number;
  unusedComponents: number;
  unusedToolFiles: number;
  cancelled?: boolean;
}
```

### 使用示例

```typescript
import { detect, DeadCodeFinderAST } from '@is_adou/dead-code-detector';

const result = await detect({
  srcDir: './src',
  mode: 'ast',
  extensions: ['.js', '.vue', '.ts'],
  ignoreDirs: ['node_modules', 'dist'],
  verbose: true,
});

const { unusedExports, unusedComponents, unusedToolFiles } = result.results;
```

## 错误码说明

| 错误码 | 说明             | 解决方案             |
| ------ | ---------------- | -------------------- |
| E001   | 无法访问源目录   | 检查目录路径是否正确 |
| E002   | 配置文件格式错误 | 检查 JSON 语法       |
| E003   | 文件解析失败     | 检查文件语法是否正确 |
| E004   | 自动修复失败     | 手动备份后重试       |

## 相关链接

- [GitHub 仓库](https://github.com/Adou377/dead-code-detector)
- [问题反馈](https://github.com/Adou377/dead-code-detector/issues)
