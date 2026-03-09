# Migration Guide

This guide helps you migrate from other dead code detection tools to Dead Code Detector, and provides version upgrade instructions.

## Table of Contents

- [Migrating from Other Tools](#migrating-from-other-tools)
  - [From ts-prune](#from-ts-prune)
  - [From unused](#from-unused)
  - [From webpack-deadcode-plugin](#from-webpack-deadcode-plugin)
  - [From depcheck](#from-depcheck)
  - [From ESLint no-unused-vars](#from-eslint-no-unused-vars)
- [Version Upgrade Guide](#version-upgrade-guide)
  - [From 0.x to 1.0.0](#from-0x-to-100)
  - [Future Version Upgrades](#future-version-upgrades)
- [Configuration Migration](#configuration-migration)
- [FAQ](#faq)

---

## Migrating from Other Tools

### From ts-prune

[ts-prune](https://github.com/nadeesha/ts-prune) is a popular tool for finding unused exports in TypeScript projects. Here's how to migrate:

#### Key Differences

| Feature | ts-prune | Dead Code Detector |
|---------|----------|-------------------|
| TypeScript Support | Primary focus | Full support |
| Vue Support | Limited | Full (Vue 2/3, `<script setup>`) |
| React Support | Via TypeScript | Native JSX/TSX support |
| Auto-fix | No | Yes |
| Detection Mode | Single mode | AST + Regex modes |
| Cache | No | Yes (persistent) |
| Component Detection | No | Yes |

#### Migration Steps

1. **Remove ts-prune**:
   ```bash
   npm uninstall ts-prune
   ```

2. **Install Dead Code Detector**:
   ```bash
   npm install dead-code-detector --save-dev
   ```

3. **Create configuration file**:

   If you were using ts-prune with default settings:
   ```json
   {
     "srcDir": "./src",
     "extensions": [".ts", ".tsx"],
     "mode": "ast"
   }
   ```

4. **Update npm scripts**:

   Before:
   ```json
   {
     "scripts": {
       "find-dead-code": "ts-prune"
     }
   }
   ```

   After:
   ```json
   {
     "scripts": {
       "find-dead-code": "dead-code",
       "fix-dead-code": "dead-code --fix --dry-run"
     }
   }
   ```

5. **Run detection**:
   ```bash
   npm run find-dead-code
   ```

#### Configuration Mapping

| ts-prune Option | Dead Code Detector Option |
|-----------------|--------------------------|
| Project root (auto-detected) | `srcDir: "./src"` |
| `-p, --project` | Not needed (auto-detects tsconfig) |
| `-i, --ignore` | `ignoreDirs: [...]` |
| `-e, --error` | Exit with error code by default |

---

### From unused

[unused](https://github.com/unused-code/unused) is a general-purpose unused code finder. Here's how to migrate:

#### Key Differences

| Feature | unused | Dead Code Detector |
|---------|--------|-------------------|
| Language Support | Multiple languages | JavaScript/TypeScript focused |
| Framework Support | Generic | Vue/React optimized |
| Auto-fix | No | Yes |
| Component Detection | No | Yes |
| Path Alias | Manual | Auto-detect |

#### Migration Steps

1. **Remove unused**:
   ```bash
   npm uninstall unused
   ```

2. **Install Dead Code Detector**:
   ```bash
   npm install dead-code-detector --save-dev
   ```

3. **Create configuration file**:

   If you had an `unused.yml`:
   ```yaml
   # unused.yml
   files:
     - "src/**/*.js"
   ignore:
     - "node_modules"
   ```

   Convert to `.deadcoderc.json`:
   ```json
   {
     "srcDir": "./src",
     "extensions": [".js"],
     "ignoreDirs": ["node_modules"],
     "mode": "ast"
   }
   ```

4. **Update npm scripts**:
   ```json
   {
     "scripts": {
       "find-dead-code": "dead-code --verbose"
     }
   }
   ```

---

### From webpack-deadcode-plugin

[webpack-deadcode-plugin](https://github.com/MQuy/webpack-deadcode-plugin) integrates with webpack's build process. Here's how to migrate:

#### Key Differences

| Feature | webpack-deadcode-plugin | Dead Code Detector |
|---------|------------------------|-------------------|
| Integration | webpack plugin | CLI tool |
| Build Required | Yes | No |
| Vue Support | Limited | Full |
| Auto-fix | No | Yes |
| Standalone | No | Yes |

#### Migration Steps

1. **Remove the plugin from webpack config**:

   Before:
   ```javascript
   const DeadCodePlugin = require('webpack-deadcode-plugin');

   module.exports = {
     plugins: [
       new DeadCodePlugin({
         patterns: ['src/**/*.*'],
         exclude: ['**/node_modules/**']
       })
     ]
   };
   ```

   After: Remove the plugin import and configuration.

2. **Install Dead Code Detector**:
   ```bash
   npm install dead-code-detector --save-dev
   ```

3. **Create configuration file**:
   ```json
   {
     "srcDir": "./src",
     "extensions": [".js", ".jsx", ".ts", ".tsx", ".vue"],
     "ignoreDirs": ["node_modules", "dist"],
     "mode": "ast"
   }
   ```

4. **Add npm scripts**:
   ```json
   {
     "scripts": {
       "find-dead-code": "dead-code",
       "analyze": "dead-code --verbose"
     }
   }
   ```

#### Benefits of Migration

- **No build required**: Run detection anytime without building
- **Faster iteration**: No need to wait for webpack compilation
- **Auto-fix capability**: Automatically remove unused code
- **Better Vue support**: Native Vue 2/3 and `<script setup>` support

---

### From depcheck

[depcheck](https://github.com/depcheck/depcheck) checks for unused dependencies in package.json. While it serves a different purpose, you might want to use both tools together.

#### Recommended Approach

Use both tools for comprehensive cleanup:

```json
{
  "scripts": {
    "check-unused": "npm run check-deps && npm run check-code",
    "check-deps": "depcheck",
    "check-code": "dead-code"
  }
}
```

#### What Each Tool Detects

| Tool | Detects |
|------|---------|
| depcheck | Unused npm dependencies |
| Dead Code Detector | Unused exports, components, files |

---

### From ESLint no-unused-vars

ESLint's `no-unused-vars` rule detects unused variables within files. Dead Code Detector complements this by finding unused exports across files.

#### Key Differences

| Feature | ESLint no-unused-vars | Dead Code Detector |
|---------|----------------------|-------------------|
| Scope | Within file | Across project |
| Exports | Not tracked | Primary focus |
| Components | Limited | Full support |
| Auto-fix | Yes (limited) | Yes (comprehensive) |

#### Recommended Setup

Use both together:

```json
{
  "scripts": {
    "lint": "eslint src/",
    "check-dead-code": "dead-code",
    "check-all": "npm run lint && npm run check-dead-code"
  }
}
```

---

## Version Upgrade Guide

### From 0.x to 1.0.0

Version 1.0.0 is the first stable release with several improvements and changes.

#### Breaking Changes

1. **Default mode changed to AST**

   Before (0.x): Default was regex mode
   After (1.0.0): Default is AST mode

   If you want to keep using regex mode:
   ```bash
   dead-code --mode regex
   ```

   Or in config:
   ```json
   {
     "mode": "regex"
   }
   ```

2. **Configuration file priority changed**

   New priority order:
   1. `.deadcoderc.json`
   2. `.deadcoderc.js`
   3. `deadcode.config.js`

3. **Exit code behavior**

   Now exits with code 1 when dead code is found (useful for CI)

#### New Features in 1.0.0

- **Auto-fix**: Automatically remove unused code with `--fix`
- **Dry-run**: Preview changes with `--dry-run`
- **Backup**: Automatic backup before fixing
- **Cache**: Persistent cache for faster re-runs
- **Component detection**: Vue and React component detection
- **Path alias auto-detection**: Automatically resolves path aliases

#### Migration Steps

1. **Update package**:
   ```bash
   npm install dead-code-detector@latest
   ```

2. **Review configuration**:
   - If using regex mode, explicitly set `"mode": "regex"`
   - Consider switching to AST mode for better accuracy

3. **Update CI scripts**:
   ```yaml
   # GitHub Actions example
   - name: Check for dead code
     run: npx dead-code
   ```

4. **Test the upgrade**:
   ```bash
   # Run detection first
   dead-code --verbose

   # Preview fixes
   dead-code --fix --dry-run
   ```

---

### Future Version Upgrades

#### Checking for Updates

```bash
npm outdated dead-code-detector
```

#### Upgrade Best Practices

1. **Read CHANGELOG.md** before upgrading
2. **Run tests** after upgrade:
   ```bash
   dead-code --verbose
   ```
3. **Use dry-run** for auto-fix:
   ```bash
   dead-code --fix --dry-run
   ```
4. **Check backups** if something goes wrong

---

## Configuration Migration

### Quick Reference

| Tool | Config File | Dead Code Detector Config |
|------|-------------|--------------------------|
| ts-prune | tsconfig.json | `.deadcoderc.json` |
| unused | unused.yml | `.deadcoderc.json` |
| webpack-deadcode-plugin | webpack.config.js | `.deadcoderc.json` |
| depcheck | .depcheckrc | Keep both configs |

### Common Configuration Patterns

#### TypeScript Project
```json
{
  "srcDir": "./src",
  "extensions": [".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "dist", "test"],
  "mode": "ast"
}
```

#### Vue Project
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".vue", ".ts"],
  "ignoreDirs": ["node_modules", "dist"],
  "mode": "ast"
}
```

#### React Project
```json
{
  "srcDir": "./src",
  "extensions": [".js", ".jsx", ".ts", ".tsx"],
  "ignoreDirs": ["node_modules", "build", "coverage"],
  "mode": "ast"
}
```

#### Monorepo Project
```json
{
  "srcDir": "./packages",
  "extensions": [".js", ".jsx", ".ts", ".tsx", ".vue"],
  "ignoreDirs": ["node_modules", "dist", "**/node_modules"],
  "mode": "ast"
}
```

---

## FAQ

### Q: Can I use Dead Code Detector alongside other tools?

**A:** Yes! Dead Code Detector works well with:
- ESLint (for within-file checks)
- depcheck (for dependency checks)
- TypeScript compiler (for type checks)

### Q: Will Dead Code Detector detect the same issues as ts-prune?

**A:** Dead Code Detector may find additional issues:
- Unused Vue components
- Unused React components
- Unused utility files
- Cross-file export tracking

Some differences:
- Dynamic imports may be detected differently
- Type-only exports handling may vary

### Q: How do I migrate my CI pipeline?

**A:** Update your CI configuration:

```yaml
# Before (ts-prune example)
- name: Check unused exports
  run: npx ts-prune

# After
- name: Check dead code
  run: npx dead-code
```

### Q: What if I find false positives?

**A:** 
1. Check if the code is dynamically imported
2. Verify path aliases are correctly resolved
3. Add files to `ignoreDirs` if needed
4. Use `--verbose` to understand detection logic

### Q: Can I gradually migrate?

**A:** Yes! You can:
1. Run both tools in parallel initially
2. Compare results
3. Gradually phase out the old tool

---

## Need Help?

- [GitHub Issues](https://github.com/your-repo/dead-code-detector/issues)
- [Documentation](./README.md)
- [API Reference](./API.md)
