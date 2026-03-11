# Dead Code Detector

![npm version](https://img.shields.io/npm/v/@is_adou/dead-code-detector)
![license](https://img.shields.io/npm/l/@is_adou/dead-code-detector)

An efficient dead code detection tool designed for Vue 2/3 and React projects, helping identify and clean up unused code, exports, and components. Save time and reduce bundle size by eliminating code that's no longer needed.

## ✨ Key Features

- **Comprehensive Detection**: Unused exports, components, and utility files
- **Multi-framework Support**: Vue 2/3 (including `<script setup>`), React, TypeScript, JSX/TSX
- **Dual Detection Modes**: AST (accurate) and regex (compatible with legacy projects)
- **Smart Auto-fix**: Group export partial removal, multi-line export handling, error recovery
- **Configuration Flexibility**: `.deadcoderc.json`, `.deadcoderc.js`, and `deadcode.config.js`
- **Path Alias Support**: Auto-detects and resolves path aliases from project config
- **Test File Awareness**: Tracks imports from test files to avoid false positives
- **LRU Cache**: Memory-efficient caching with automatic eviction (v1.1.0)
- **Incremental Analysis**: File-based cache for faster re-runs with optimized dependency graph
- **Backup System**: Creates automatic backups before making changes
- **Verbose Mode**: Detailed progress and analysis information

## 🚀 Quick Start

```bash
# Install globally (recommended)
npm install -g @is_adou/dead-code-detector

# Run detection in your project
cd your-project
dead-code

# Auto-fix unused code
dead-code --fix
```

<details>
<summary>Other installation methods</summary>

```bash
# Local installation
npm install @is_adou/dead-code-detector --save-dev

# Run with npx
npx dead-code

# Or add to package.json scripts
# {
#   "scripts": {
#     "dead-code": "dead-code"
#   }
# }
npm run dead-code
```

</details>

## 🛠️ Usage

### Command Line

```bash
# Basic detection
dead-code

# Specify directory and mode
dead-code --src ./src --mode ast

# Auto-fix with preview
dead-code --fix --dry-run

# Auto-fix with confirmation
dead-code --fix --confirm
```

### Configuration

Create `.deadcoderc.json` in your project root:

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
<summary>Full configuration options</summary>

| Option | Description | Default |
|--------|-------------|---------|
| `srcDir` | Source directory to scan | `./src` |
| `extensions` | File extensions to include | `[".js", ".vue", ".jsx", ".ts", ".tsx"]` |
| `ignoreDirs` | Directories to ignore | `["node_modules", "dist", ".git"]` |
| `mode` | Detection mode: "ast" or "regex" | `"ast"` |
| `fix` | Enable auto-fix mode | `false` |
| `verbose` | Enable detailed output | `false` |
| `maxFileSize` | Max file size in bytes | `1000000` (1MB) |
| `concurrency` | Maximum concurrency | `50` |
| `cache` | Enable persistent cache | `true` |
| `cacheDir` | Cache directory | `.dead-code-cache` |
| `cacheMaxAge` | Cache max age in ms | `604800000` (7 days) |
| `maxEntries` | Maximum cache entries | `100` |
| `maxMemoryMB` | Maximum memory for cache | `50` |

</details>

### Incremental Analysis

Speed up re-runs by analyzing only changed files:

```bash
# Incremental analysis (auto-detect main/master branch)
dead-code --incremental

# Specify base branch
dead-code --incremental --base-branch develop
```

| Scenario | Command |
|----------|---------|
| Daily development | `dead-code --incremental` |
| PR code review | `dead-code --incremental --base-branch main` |
| Full code audit | `dead-code` |

## 🔍 Detection Modes

### AST Mode (Default)

**Recommended for most projects**
- Uses Babel AST parsing for highly accurate detection
- Supports multi-line exports, TypeScript types, and Vue `<script setup>`
- Better handling of complex export/import patterns

### Regex Mode

**For legacy projects or performance-critical scenarios**
- Uses traditional regular expressions for faster scanning
- Less accurate but works with older codebases
- Limited support for complex syntax features

## 🛠️ Auto-fix

```bash
# Preview changes
dead-code --fix --dry-run

# Fix with confirmation
dead-code --fix --confirm

# Fix directly (use with caution!)
dead-code --fix
```

**Safety Measures:**
1. Always run without `--fix` first to preview
2. Use `--dry-run` to see what would be deleted
3. Use `--confirm` for interactive confirmation
4. Check `backup/` directory if needed

## 📚 Advanced Usage

```bash
# Filter by extensions
dead-code --ext .js,.ts,.tsx

# Ignore directories
dead-code --ignore node_modules,dist,.git,coverage

# Verbose output
dead-code --verbose

# Custom source directory
dead-code --src ./src/components

# Combine options
dead-code --src ./src --mode ast --ext .js,.vue,.tsx --ignore node_modules,dist --verbose
```

## 📝 Configuration Examples

<details>
<summary>Vue 3 Project</summary>

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
<summary>React + TypeScript Project</summary>

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
<summary>Legacy Project (Regex Mode)</summary>

```json
{
  "srcDir": "./src",
  "extensions": [".js"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "regex"
}
```

</details>

## 🛠️ Troubleshooting

### Common Issues

**Q: Why are some exports not detected?**

Possible reasons: dynamically imported, imported as side effect, used in test files, or path alias resolution failed.

**Q: Why are components marked as unused?**

Possible reasons: different naming convention (PascalCase vs kebab-case), used in template but not imported in script, or globally registered.

**Q: What if auto-fix deleted wrong code?**

Restore from `backup/` directory. The tool creates automatic backups before making changes.

**Q: Detection is slow for large projects?**

1. Use AST mode (default) - it's faster for large projects
2. Add large directories to ignore list with `--ignore`
3. Limit file extensions with `--ext`

### Error Messages

| Error | Solution |
|-------|----------|
| "Cannot parse file" | File has syntax errors, will be skipped |
| "Path alias not resolved" | Check project config or specify manually |
| "No files found" | Check source directory with `--src` |

## 📖 API Documentation

For detailed API documentation, see [API.md](./API.md).

```javascript
const { detect } = require('@is_adou/dead-code-detector');

const result = await detect({ srcDir: './src' });
console.log('Unused exports:', result.results.unusedExports);
```

## 🔄 Migration Guide

Migrating from other tools? See [MIGRATION.md](./MIGRATION.md) for:
- Migration from ts-prune, unused, webpack-deadcode-plugin
- Version upgrade instructions
- Configuration migration examples

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## 🌍 Languages

- [English](./README.md)
- [中文](./README.zh-CN.md)

## 📝 License

MIT License - see [LICENSE](https://opensource.org/licenses/MIT) for details.

## 🙏 Acknowledgments

- Built with Babel for AST parsing
- Inspired by various dead code detection tools

---

**Happy coding!** 🎉
