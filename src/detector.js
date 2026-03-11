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
  REGEX_REACT_IMPORT,
  REGEX_JSX_EXTENSION,
  REGEX_FUNCTION_COMPONENT_PATTERNS,
  REGEX_CLASS_COMPONENT_PATTERNS,
  NON_COMPONENT_DIRS,
} = require('./constants.js');

const { processParallel, printProgress } = require('./utils.js');
const { DeadCodeFinderBase } = require('./detector-base.js');
const { Reporter } = require('./reporter.js');
const { ComponentItem, UnusedExportItem, AnalysisResult, FixResult } = require('./models.js');
const { ExportExtractor, getLineNumber } = require('./export-extractor.js');
const { ImportExtractor } = require('./import-extractor.js');

class DeadCodeFinder extends DeadCodeFinderBase {
  /**
   * 创建死代码检测器实例
   * @param {Object} options - 配置选项
   * @param {string} options.srcDir - 源代码目录路径
   * @param {number} [options.concurrency=50] - 并发处理数
   * @param {number} [options.maxFileSize=1000000] - 最大文件大小（字节）
   */
  constructor(options = {}) {
    super(options);
  }

  /**
   * 从文件内容中提取所有导入信息
   * @param {string} content - 文件内容
   * @returns {Array<Object>} 导入项数组
   */
  extractImportsFromContent(content) {
    return ImportExtractor.extractAll(content);
  }

  /**
   * 解析单个文件，提取导出和导入信息
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<void>}
   */
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

  /**
   * 解析 Vue 单文件组件
   * @param {string} relativePath - 相对于源目录的路径
   * @param {string} filePath - 文件绝对路径
   * @param {string} content - 文件内容
   * @private
   */
  parseVueFile(relativePath, filePath, content) {
    const fileName = path.basename(filePath, '.vue');
    if (fileName !== 'index') {
      this.components.set(
        relativePath,
        new ComponentItem(fileName, false, fileName.startsWith('The') || fileName.startsWith('App'))
      );
    }
    this.parseJsContent(relativePath, content);
  }

  /**
   * 解析 JavaScript/TypeScript 文件
   * @param {string} relativePath - 相对于源目录的路径
   * @param {string} filePath - 文件绝对路径
   * @param {string} content - 文件内容
   * @private
   */
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

  /**
   * 从 Vue 组件注册中提取局部组件名称
   * @param {string} content - 文件内容
   * @returns {string[]} 组件名称数组
   * @private
   */
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

  /**
   * 判断文件是否为 React 组件文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {boolean} 是否为 React 组件
   * @private
   */
  isReactComponentFile(filePath, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    if (fileName.startsWith('index.')) return false;

    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    if (NON_COMPONENT_DIRS.includes(dirName)) return false;

    const hasReactFeatures = this.hasReactSyntax(content, ext);
    if (!hasReactFeatures) return false;

    return this.hasComponentPatterns(content);
  }

  /**
   * 检查文件是否包含 React 语法特征
   * @param {string} content - 文件内容
   * @param {string} ext - 文件扩展名
   * @returns {boolean} 是否包含 React 语法
   * @private
   */
  hasReactSyntax(content, ext) {
    const hasReactImport = REGEX_REACT_IMPORT.test(content);
    const hasJsx = REGEX_JSX_TAG.test(content) || REGEX_JSX_EXTENSION.test(ext);
    return hasReactImport || hasJsx;
  }

  /**
   * 检查文件是否包含组件模式（函数组件、类组件或 HOC）
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含组件模式
   * @private
   */
  hasComponentPatterns(content) {
    return (
      this.hasFunctionComponent(content) ||
      this.hasClassComponent(content) ||
      this.hasHocPattern(content)
    );
  }

  /**
   * 检查是否包含函数组件模式
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含函数组件
   * @private
   */
  hasFunctionComponent(content) {
    return REGEX_FUNCTION_COMPONENT_PATTERNS.some(p => p.test(content));
  }

  /**
   * 检查是否包含类组件模式
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含类组件
   * @private
   */
  hasClassComponent(content) {
    return REGEX_CLASS_COMPONENT_PATTERNS.some(p => p.test(content));
  }

  /**
   * 检查是否包含高阶组件（HOC）模式
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含 HOC 模式
   * @private
   */
  hasHocPattern(content) {
    return (
      REGEX_HOC_PATTERN.test(content) ||
      REGEX_REDUX_CONNECT.test(content) ||
      REGEX_REDUX_HOOKS.test(content)
    );
  }

  /**
   * 检查函数组件模式（别名方法）
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含函数组件
   * @deprecated 使用 hasFunctionComponent 代替
   */
  checkFunctionComponentPatterns(content) {
    return this.hasFunctionComponent(content);
  }

  /**
   * 检查类组件模式（别名方法）
   * @param {string} content - 文件内容
   * @returns {boolean} 是否包含类组件
   * @deprecated 使用 hasClassComponent 代替
   */
  checkClassComponentPatterns(content) {
    return this.hasClassComponent(content);
  }

  /**
   * 获取指定位置在内容中的行号
   * @param {string} content - 文件内容
   * @param {number} matchIndex - 匹配位置的索引
   * @returns {number} 行号（从 1 开始）
   */
  getLineNumber(content, matchIndex) {
    return getLineNumber(content, matchIndex);
  }

  /**
   * 从文件内容中提取所有导出信息
   * @param {string} content - 文件内容
   * @returns {Array<Object>} 导出项数组
   */
  extractExportsFromContent(content) {
    return ExportExtractor.extractAll(content);
  }

  /**
   * 提取命名导出（export const/let/var/function/class）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractNamedExports(content, exports) {
    const { extractNamedExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取 TypeScript 类型导出
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractTsTypeExports(content, exports) {
    const { extractTsTypeExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取 TypeScript 枚举导出
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractTsEnumExports(content, exports) {
    const { extractTsEnumExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取 TypeScript 命名空间导出
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractTsNamespaceExports(content, exports) {
    const { extractTsNamespaceExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取默认导出
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractDefaultExports(content, exports) {
    const { extractDefaultExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取分组导出（export { foo, bar }）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractGroupExports(content, exports) {
    const { extractGroupExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取星号重导出（export * from './module'）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractStarExports(content, exports) {
    const { extractStarExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取命名空间重导出（export * as namespace from './module'）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractNamespaceReexports(content, exports) {
    const { extractNamespaceReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取分组重导出（export { foo } from './module'）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractGroupReexports(content, exports) {
    const { extractGroupReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取默认重导出（export { default as name } from './module'）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractDefaultReexports(content, exports) {
    const { extractDefaultReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取 TypeScript 类型分组导出（export type { ... }）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractTsTypeGroupExports(content, exports) {
    const { extractTsTypeGroupExports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取 TypeScript 类型重导出（export type { Type } from './module'）
   * @param {string} content - 文件内容
   * @param {Array} exports - 导出数组（输出参数）
   */
  extractTsTypeReexports(content, exports) {
    const { extractTsTypeReexports: extract } = require('./export-extractor.js');
    extract(content, exports);
  }

  /**
   * 提取静态导入（import { foo } from './module'）
   * @param {string} content - 文件内容
   * @param {Array} imports - 导入数组（输出参数）
   */
  extractStaticImports(content, imports) {
    const { extractStaticImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  /**
   * 提取动态导入（import('./module')）
   * @param {string} content - 文件内容
   * @param {Array} imports - 导入数组（输出参数）
   */
  extractDynamicImports(content, imports) {
    const { extractDynamicImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  /**
   * 提取副作用导入（import './styles.css'）
   * @param {string} content - 文件内容
   * @param {Array} imports - 导入数组（输出参数）
   */
  extractSideEffectImports(content, imports) {
    const { extractSideEffectImports: extract } = require('./import-extractor.js');
    extract(content, imports);
  }

  /**
   * 解析 JavaScript/TypeScript 内容，提取导出和导入
   * @param {string} relativePath - 相对于源目录的路径
   * @param {string} content - 文件内容
   * @private
   */
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

  /**
   * 运行完整的死代码分析流程
   * @returns {Promise<AnalysisResult>} 分析结果对象
   */
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

    return new AnalysisResult(this.unusedExports, this.unusedComponents, this.unusedToolFiles);
  }

  /**
   * 检测未使用的导出
   * @param {Map<string, Set<string>>} testImports - 测试文件中的导入映射
   * @returns {Promise<void>}
   */
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
            this.unusedExports.push(
              new UnusedExportItem(file, exp.name, exp.type, exp.line, exp.code, exp.source)
            );
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

  /**
   * 构建所有导入的索引映射
   * @param {Map<string, Set<string>>} testImports - 测试文件中的导入映射
   * @returns {Map<string, Set<string>>} 导入名称到使用文件的映射
   * @private
   */
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

  /**
   * 收集副作用导入的文件集合
   * @returns {Set<string>} 副作用导入的文件路径集合
   * @private
   */
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

  /**
   * 检测未使用的组件
   * @param {Map<string, Set<string>>} [testImports=new Map()] - 测试文件中的导入映射
   * @returns {Promise<void>}
   */
  async detectUnusedComponents(testImports = new Map()) {
    const componentUsages = this.componentDetector.collectComponentUsages(
      this.imports,
      testImports
    );

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

  /**
   * 生成并打印分析报告
   * @returns {Object} 报告数据对象
   */
  report() {
    return Reporter.generate({
      unusedExports: this.unusedExports,
      unusedComponents: this.unusedComponents,
      unusedToolFiles: this.unusedToolFiles,
    });
  }

  /**
   * 自动修复未使用的代码
   * @returns {Promise<FixResult>} 修复结果对象
   */
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

  /**
   * 修复未使用的导出（删除导出语句）
   * @param {string} backupDir - 备份目录路径
   * @returns {Promise<void>}
   * @private
   */
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

  /**
   * 删除未使用的工具文件
   * @param {string} backupDir - 备份目录路径
   * @returns {Promise<void>}
   * @private
   */
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
