/**
 * 死代码检测器
 *
 * 用于查找未使用的导出、组件和工具文件的主检测器类
 * 支持 Vue 2/3 和 React 项目
 */

const fsPromises = require('fs').promises;
const path = require('path');

const {
  REGEX_COMPONENTS_OBJECT,
  REGEX_COMPONENT_NAME,
  REGEX_JSX_TAG,
  REGEX_HOC_PATTERN,
  REGEX_REDUX_CONNECT,
  REGEX_REDUX_HOOKS,
} = require('./constants.js');

const { processParallel, printProgress } = require('./utils.js');
const { DeadCodeFinderBase } = require('./detector-base.js');
const { Reporter } = require('./reporter.js');
const { ComponentItem, UnusedExportItem, AnalysisResult, FixResult } = require('./models.js');
const { ExportExtractor, getLineNumber } = require('./export-extractor.js');
const { ImportExtractor } = require('./import-extractor.js');

class DeadCodeFinder extends DeadCodeFinderBase {
  constructor(options = {}) {
    super(options);
  }

  extractImportsFromContent(content) {
    return ImportExtractor.extractAll(content);
  }

  async parseFile(filePath) {
    try {
      const relativePath = path.relative(this.srcDir, filePath);
      const ext = path.extname(filePath);
      const content = await fsPromises.readFile(filePath, 'utf-8');

      if (content.length > this.maxFileSize) {
        console.warn(`⚠️  文件过大，跳过解析: ${filePath}`);
        return;
      }

      this.fileContents.set(relativePath, content);

      if (ext === '.vue') {
        this.parseVueFile(relativePath, filePath, content);
      } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        this.parseJsFile(relativePath, filePath, content);
      }
    } catch (error) {
      console.warn(`⚠️  解析文件失败: ${filePath}`);
      console.warn(`   错误信息: ${error.message}`);
    }
  }

  parseVueFile(relativePath, filePath, content) {
    const fileName = path.basename(filePath, '.vue');
    if (fileName !== 'index') {
      this.components.set(relativePath, new ComponentItem(
        fileName,
        false,
        fileName.startsWith('The') || fileName.startsWith('App')
      ));
    }
    this.parseJsContent(relativePath, content);
  }

  parseJsFile(relativePath, filePath, content) {
    if (this.isReactComponentFile(filePath, content)) {
      const fileName = path.basename(filePath, path.extname(filePath));
      this.components.set(relativePath, new ComponentItem(fileName, false, false));
    }

    this.parseJsContent(relativePath, content);
    const localComponents = this.extractVueComponents(content);
    if (localComponents.length > 0) {
      this.localComponents.set(relativePath, localComponents);
    }
  }

  extractVueComponents(content) {
    const components = [];
    for (const match of content.matchAll(REGEX_COMPONENTS_OBJECT)) {
      const componentStr = match[1];
      for (const nameMatch of componentStr.matchAll(REGEX_COMPONENT_NAME)) {
        components.push(nameMatch[2]);
      }
    }
    return components;
  }

  isReactComponentFile(filePath, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    if (fileName.startsWith('index.')) return false;

    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    const nonComponentDirs = [
      'utils',
      'tools',
      'helpers',
      'lib',
      'services',
      'api',
      'hooks',
      'store',
      'context',
    ];
    if (nonComponentDirs.includes(dirName)) return false;

    const hasReactImport = /import\s+.*\b(React|from\s+['"]react['"])/.test(content);
    const hasJsx = REGEX_JSX_TAG.test(content) || /jsx|tsx/.test(ext);

    const hasFunctionComponent = this.checkFunctionComponentPatterns(content);
    const hasClassComponent = this.checkClassComponentPatterns(content);

    const hasHoc = REGEX_HOC_PATTERN.test(content);
    const hasReduxConnect = REGEX_REDUX_CONNECT.test(content);
    const hasReduxHooks = REGEX_REDUX_HOOKS.test(content);

    return (
      (hasReactImport || hasJsx) &&
      (hasFunctionComponent || hasClassComponent || hasHoc || hasReduxConnect || hasReduxHooks)
    );
  }

  checkFunctionComponentPatterns(content) {
    const patterns = [
      /export\s+(?:default\s+)?function\s+([A-Z]\w+)/,
      /export\s+(?:default\s+)?const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/,
      /export\s+(?:default\s+)?const\s+([A-Z]\w+)\s*=\s*function\b/,
      /export\s+default\s+(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>/,
    ];
    return patterns.some(p => p.test(content));
  }

  checkClassComponentPatterns(content) {
    const patterns = [
      /export\s+(?:default\s+)?class\s+([A-Z]\w+)\s+extends\s+(?:React\.)?Component/,
      /export\s+(?:default\s+)?class\s+([A-Z]\w+)\s+extends\s+(?:React\.)?PureComponent/,
    ];
    return patterns.some(p => p.test(content));
  }

  getLineNumber(content, matchIndex) {
    return getLineNumber(content, matchIndex);
  }

  extractExportsFromContent(content) {
    return ExportExtractor.extractAll(content);
  }

  extractNamedExports(content, exports) {
    const { extractNamedExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractTsTypeExports(content, exports) {
    const { extractTsTypeExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractTsEnumExports(content, exports) {
    const { extractTsEnumExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractTsNamespaceExports(content, exports) {
    const { extractTsNamespaceExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractDefaultExports(content, exports) {
    const { extractDefaultExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractGroupExports(content, exports) {
    const { extractGroupExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractStarExports(content, exports) {
    const { extractStarExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractNamespaceReexports(content, exports) {
    const { extractNamespaceReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractGroupReexports(content, exports) {
    const { extractGroupReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractDefaultReexports(content, exports) {
    const { extractDefaultReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractTsTypeGroupExports(content, exports) {
    const { extractTsTypeGroupExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractTsTypeReexports(content, exports) {
    const { extractTsTypeReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  extractStaticImports(content, imports) {
    const { extractStaticImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  extractDynamicImports(content, imports) {
    const { extractDynamicImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  extractSideEffectImports(content, imports) {
    const { extractSideEffectImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  parseJsContent(relativePath, content) {
    const exports = this.extractExportsFromContent(content);
    const imports = this.extractImportsFromContent(content);

    if (exports.length > 0) {
      this.exports.set(relativePath, exports);
    }
    if (imports.length > 0) {
      this.imports.set(relativePath, imports);
    }
  }

  async analyze() {
    const startTime = Date.now();

    Reporter.printAnalysisStart();

    this.sourceFiles = await this.scanFiles(this.srcDir);
    console.log(`📁 找到 ${this.sourceFiles.length} 个源文件\n`);

    console.log('🔍 扫描测试文件...\n');
    const testImports = await this.scanTestFiles();
    console.log(`📁 收集到 ${testImports.size} 个测试导入\n`);

    console.log('📝 解析文件...');
    await processParallel(
      this.sourceFiles,
      file => this.parseFile(file),
      this.concurrency,
      (current, total) => printProgress(current, total, '   解析进度:')
    );
    console.log(`📦 发现 ${this.getExportCount()} 个导出\n`);

    await this.detectUnusedExports(testImports);

    Reporter.printDetectionStage('未使用的组件');
    await this.detectUnusedComponents(testImports);

    Reporter.printDetectionStage('未使用的工具文件');
    this.unusedToolFiles = this.detectUnusedToolFiles();

    const elapsed = (Date.now() - startTime) / 1000;
    Reporter.printAnalysisComplete(elapsed);

    return new AnalysisResult(
      this.unusedExports,
      this.unusedComponents,
      this.unusedToolFiles
    );
  }

  async detectUnusedExports(testImports) {
    Reporter.printDetectionStage('未使用的导出');

    const allImports = this.buildAllImportsIndex(testImports);
    const sideEffectImportedFiles = this.collectSideEffectImports();

    const exportCount = this.exports.size;
    let processed = 0;

    for (const [file, exports] of this.exports.entries()) {
      const isSideEffectImported =
        sideEffectImportedFiles.has(file) || sideEffectImportedFiles.has(file.replace(/^\.\//, ''));

      for (const exp of exports) {
        const usedBy = allImports.get(exp.name);
        if ((!usedBy || usedBy.size === 0) && !isSideEffectImported) {
          const localUsage = await this.countLocalUsage(file, exp.name);
          if (localUsage === 0) {
            this.unusedExports.push(new UnusedExportItem(file, exp.name, exp.type, exp.line, exp.code, exp.source));
          }
        }
      }
      processed++;
      if (processed % 100 === 0) {
        printProgress(processed, exportCount, '   导出检测:');
      }
    }
    printProgress(exportCount, exportCount, '   导出检测:');
  }

  buildAllImportsIndex(testImports) {
    const allImports = new Map();

    for (const [file, imports] of this.imports) {
      for (const imp of imports) {
        if (imp.isInternal !== false) {
          if (!allImports.has(imp.name)) {
            allImports.set(imp.name, new Set());
          }
          allImports.get(imp.name).add(file);
        }
      }
    }

    for (const [name, files] of testImports) {
      if (!allImports.has(name)) {
        allImports.set(name, new Set());
      }
      for (const file of files) {
        allImports.get(name).add(file);
      }
    }

    return allImports;
  }

  collectSideEffectImports() {
    const sideEffectImportedFiles = new Set();
    for (const [file, imports] of this.imports) {
      for (const imp of imports) {
        if (imp.isInternal && !imp.name && imp.source) {
          const resolvedPath = this.resolveImportPath(imp.source, file);
          if (resolvedPath) {
            sideEffectImportedFiles.add(resolvedPath);
          }
        }
      }
    }
    return sideEffectImportedFiles;
  }

  async detectUnusedComponents(testImports = new Map()) {
    const componentUsages = this.componentDetector.collectComponentUsages(this.imports, testImports);

    console.log('   构建组件标签索引...');
    const componentTagIndex = this.componentDetector.buildComponentTagIndexFromFileContents(
      this.fileContents
    );
    console.log(`   索引了 ${componentTagIndex.size} 个组件标签`);

    this.unusedComponents = this.componentDetector.detectUnusedComponents(
      this.components,
      componentUsages,
      componentTagIndex,
      this.localComponents,
      (current, total) => printProgress(current, total, '   组件检测:')
    );

    console.log('   检测局部组件...');
  }

  report() {
    return Reporter.generate({
      unusedExports: this.unusedExports,
      unusedComponents: this.unusedComponents,
      unusedToolFiles: this.unusedToolFiles,
    });
  }

  async fix() {
    console.log('\n🔧 开始自动修复未使用的代码...\n');

    const backupDir = path.join(this.srcDir, '../backup');
    try {
      await fsPromises.access(backupDir);
    } catch {
      await fsPromises.mkdir(backupDir, { recursive: true });
    }

    await this.fixUnusedExports(backupDir);
    await this.deleteUnusedToolFiles(backupDir);

    console.log('\n📋 修复完成！\n');
    console.log(`   - 已修复 ${this.unusedExports.length} 个未使用的导出`);
    console.log(`   - 已删除 ${this.unusedToolFiles.length} 个未使用的工具文件`);
    console.log(`   - 备份文件保存在 ${backupDir} 目录中`);

    return new FixResult(
      false,
      this.unusedExports.length,
      0,
      this.unusedToolFiles.length,
      backupDir
    );
  }

  async fixUnusedExports(backupDir) {
    const exportsByFile = this.groupByFile(this.unusedExports);
    for (const [file, items] of Object.entries(exportsByFile)) {
      const fullPath = path.join(this.srcDir, file);
      try {
        await fsPromises.access(fullPath);
      } catch {
        continue;
      }

      const backupPath = path.join(backupDir, file.replace(/[\/\\]/g, '_'));
      await fsPromises.copyFile(fullPath, backupPath);

      const content = await fsPromises.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      items.sort((a, b) => b.line - a.line);

      let lineOffset = 0;
      for (const item of items) {
        const targetLine = item.line - 1 - lineOffset;
        if (targetLine >= 0 && targetLine < lines.length) {
          const lineContent = lines[targetLine];
          if (lineContent && lineContent.includes(item.name)) {
            lines.splice(targetLine, 1);
            lineOffset++;
          }
        }
      }

      await fsPromises.writeFile(fullPath, lines.join('\n'));
      console.log(`✅ 已修复 ${file} 中的 ${items.length} 个未使用导出`);
    }
  }

  async deleteUnusedToolFiles(backupDir) {
    for (const file of this.unusedToolFiles) {
      const fullPath = path.join(this.srcDir, file);
      try {
        await fsPromises.access(fullPath);
        const backupPath = path.join(backupDir, file.replace(/[\/\\]/g, '_'));
        await fsPromises.copyFile(fullPath, backupPath);

        await fsPromises.unlink(fullPath);
        console.log(`✅ 已删除未使用的工具文件: ${file}`);
      } catch {
        // 文件不存在，跳过
      }
    }
  }
}

module.exports = { DeadCodeFinder };
