# Dead Code Detector

An efficient dead code detection tool designed for Vue 2/3 and React projects, helping identify and clean up unused code, exports, and components. Save time and reduce bundle size by eliminating code that's no longer needed.

## ✨ Key Features

- **Comprehensive Detection**: Unused exports, components, and utility files
- **Multi-framework Support**: Vue 2/3 (including `<script setup>`), React, TypeScript, JSX/TSX
- **Dual Detection Modes**: AST (accurate) and regex (compatible with legacy projects)
- **Smart Auto-fix**: Group export partial removal, multi-line export handling, error recovery
- **Configuration Flexibility**: `.deadcoderc.json`, `.deadcoderc.js`, and `deadcode.config.js`
- **Path Alias Support**: Auto-detects and resolves path aliases from project config
- **Test File Awareness**: Tracks imports from test files to avoid false positives
- **Persistent Cache**: Incremental analysis with file-based cache for faster re-runs
- **Backup System**: Creates automatic backups before making changes
- **Verbose Mode**: Detailed progress and analysis information

## 🚀 Quick Start

```bash
# 1. Install globally
npm install -g dead-code-detector

# 2. Run detection in your project
cd your-project
dead-code

# 3. View results and optionally fix
dead-code --fix
```

## 📦 Installation

```bash
# Global installation (recommended for frequent use)
npm install -g dead-code-detector

# Local installation (for project-specific usage)
npm install dead-code-detector --save-dev
```

## 🛠️ Usage

### Command Line Usage

#### Basic Detection
```bash
# Detect in current directory src folder
dead-code

# Specify directory and mode
dead-code --src ./src --mode ast
```

#### Auto-fix Mode
```bash
# Auto-fix unused code
dead-code --fix

# Preview fix without making changes
dead-code --fix --dry-run

# Auto-fix with confirmation prompt
dead-code --fix --confirm
```

### Configuration

#### Config Files

The tool supports multiple configuration file formats (in priority order):

- `.deadcoderc.json` (recommended)
- `.deadcoderc.js` (for dynamic configuration)
- `deadcode.config.js` (alternative name)

#### Configuration Options

```json
{
  "srcDir": "./src",           // Source directory to scan
  "extensions": [".js", ".vue", ".jsx", ".ts", ".tsx"],  // File extensions to include
  "ignoreDirs": ["node_modules", "dist", ".git"],  // Directories to ignore
  "mode": "ast",               // Detection mode: "ast" (accurate) or "regex" (fast)
  "fix": false,                // Enable auto-fix mode
  "verbose": false,            // Enable detailed output
  "maxFileSize": 1000000,      // Max file size in bytes, files larger than this will be skipped (default: 1MB)
  "concurrency": 50,           // Maximum concurrency (default: 50)
  "cache": true,               // Enable persistent cache (default: true)
  "cacheDir": ".dead-code-cache",  // Cache directory (default: .dead-code-cache)
  "cacheMaxAge": 604800000     // Cache max age in ms (default: 7 days)
}
```

### Cache System

The tool uses a persistent cache to speed up incremental analysis:

- **Cache Location**: `.dead-code-cache/analysis-cache.json`
- **Cache Validation**: Based on file modification time (mtime) and file size
- **Cache Expiration**: Default 7 days, configurable via `cacheMaxAge`
- **Cache Invalidation**: Automatic when files are modified

```bash
# Cache is automatically created and used
dead-code

# To clear the cache manually, delete the cache directory
rm -rf .dead-code-cache
```

The cache stores:
- File analysis results (exports, imports)
- File metadata (mtime, size, hash)
- Timestamps for expiration management

### API Usage

#### Basic API

```javascript
const { detect } = require('dead-code-detector');

async function main() {
  // Run detection
  const result = await detect({
    srcDir: './src',        // Source directory
    mode: 'ast',            // Detection mode
    config: './.deadcoderc.json',  // Optional config file
  });

  // Access results
  console.log('Unused exports:', result.results.unusedExports);
  console.log('Unused components:', result.results.unusedComponents);
  console.log('Unused utility files:', result.results.unusedToolFiles);

  // Auto-fix
  const fixResult = await result.finder.fix({
    dryRun: false,   // Set to true to preview changes
    confirm: true,   // Set to true for confirmation prompt
  });

  console.log('Fix result:', fixResult);
}

main();
```

#### Advanced API

```javascript
const { DeadCodeFinderAST, DeadCodeFinderRegex } = require('dead-code-detector');

async function main() {
  // Create finder instance
  const finder = new DeadCodeFinderAST({
    srcDir: './src',
    extensions: ['.js', '.vue', '.tsx'],
    ignoreDirs: ['node_modules', 'dist'],
  });

  // Run analysis
  const results = await finder.analyze();
  
  // Get results
  console.log('Results:', results);

  // Fix unused code
  await finder.fix({ dryRun: false });
}

main();
```

## 🔍 Detection Modes

### AST Mode (Default)

**Recommended for most projects**
- Uses Babel AST parsing for highly accurate detection
- Supports multi-line exports, TypeScript types, and Vue `<script setup>`
- Better handling of complex export/import patterns
- More reliable component detection

### Regex Mode (Backward Compatible)

**For legacy projects or performance-critical scenarios**
- Uses traditional regular expressions for faster scanning
- Less accurate but works with older codebases
- Recommended only when AST mode has performance issues
- Limited support for complex syntax features

## 🛠️ Auto-fix

The tool can automatically remove unused code with the `--fix` parameter. Here's how it works:

### Auto-fix Features

- **Smart Export Removal**: Removes unused exports while preserving used ones
- **Multi-line Export Handling**: Properly handles complex multi-line export statements
- **Component Cleanup**: Removes unused Vue and React components
- **File Deletion**: Removes entirely unused utility files
- **Backup System**: Creates automatic backups before making changes
- **Error Recovery**: Handles syntax errors gracefully

### Safety Measures

1. **Always run without `--fix` first** to preview changes
2. **Use `--dry-run`** to see what would be deleted
3. **Use `--confirm`** for interactive confirmation
4. **Check backups** in the `backup/` directory if needed

### Example Workflow

```bash
# 1. Preview what will be fixed
dead-code --fix --dry-run

# 2. Run with confirmation
dead-code --fix --confirm

# 3. Run without confirmation (use with caution!)
dead-code --fix
```



## 📚 Advanced Usage

### Command Line Options

#### Filter by Extensions
```bash
# Only scan JavaScript and TypeScript files
dead-code --ext .js,.ts,.tsx

# Only scan Vue files
dead-code --ext .vue
```

#### Ignore Directories
```bash
# Ignore multiple directories
dead-code --ignore node_modules,dist,.git,coverage
```

#### Verbose Output
```bash
# Show detailed progress and analysis
dead-code --verbose
```

#### Custom Source Directory
```bash
# Specify custom source directory
dead-code --src ./src/components
```

#### Combine Multiple Options
```bash
# Full-featured command
dead-code --src ./src --mode ast --ext .js,.vue,.tsx --ignore node_modules,dist --verbose
```

## 📝 Configuration Examples

### Basic Configuration

**File: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "mode": "ast"
}
```

### Full Configuration

**File: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", ".git", "coverage", ".history"],
  "mode": "ast",
  "fix": false,
  "verbose": false
}
```

### Framework-Specific Configurations

#### Vue 3 Project
**File: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".ts"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "ast"
}
```

#### React + TypeScript Project
**File: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", "build"],
  "mode": "ast"
}
```

#### Legacy Project (Regex Mode)
**File: `.deadcoderc.json`**
```json
{
  "srcDir": "./src",
  "extensions": [".js"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "regex"
}
```

## 🛠️ Troubleshooting

### Common Issues

#### Q: Why are some exports not detected?

**Possible reasons:**
- Export is dynamically imported
- Export is imported as a side effect
- Export is used in test files
- Path alias resolution failed
- Export is used in a way that AST can't detect (e.g., string-based imports)

#### Q: Why are components marked as unused?

**Possible reasons:**
- Component is truly unused
- Component uses different naming convention (PascalCase vs kebab-case)
- Component is used in template but not properly imported in script
- Component is registered globally but not imported locally

#### Q: What if auto-fix deleted wrong code?

**Solution:** The tool automatically creates backups in the `backup/` directory. You can restore files from there.

#### Q: Detection is slow for large projects?

**Optimizations:**
1. Use AST mode (default) - it's actually faster for large projects
2. Add large directories to ignore list with `--ignore`
3. Limit file extensions with `--ext`
4. Use regex mode for very large projects (trade-off: less accuracy)

#### Q: How to handle path aliases?

**Solution:** The tool automatically detects path aliases from your project configuration (webpack, vite, etc.). If it's not working, you can manually specify aliases in your config file.

### Error Messages

#### "Cannot parse file"

This means the file has syntax errors. The tool will skip these files and continue analysis.

#### "Path alias not resolved"

Check your project configuration for path aliases, or manually specify them in your config file.

#### "No files found"

Make sure you've specified the correct source directory with `--src`.

## 📖 API Documentation

Type definitions are available in [`types/index.d.ts`](./types/index.d.ts). The main API includes:

- `detect(options)` - Run dead code detection
- `DeadCodeFinderAST` - AST-based finder class
- `DeadCodeFinder` - Regex-based finder class
- `loadConfig(path)` - Load configuration file
- `mergeConfig(cliArgs, configFile)` - Merge configuration options

## 📄 Changelog

See the [CHANGELOG.md](./CHANGELOG.md) file for a comprehensive list of changes and updates, including:
- Version history
- New features
- Bug fixes
- Breaking changes

## 🌍 Languages

- [English](./README.md)
- [中文](./README.zh-CN.md)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](https://opensource.org/licenses/MIT) file for details.

## 🙏 Acknowledgments

- Built with Babel for AST parsing
- Inspired by various dead code detection tools
- Thanks to all contributors and users

---

**Happy coding!** 🎉
