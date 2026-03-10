/**
 * 基于 AST 的死代码检测器
 *
 * 使用 Babel AST 解析进行更准确的检测：
 * - 未使用的导出
 * - 未使用的组件
 * - 未使用的工具文件
 *
 * 支持：JavaScript、TypeScript、Vue SFC、React JSX
 */

const fsPromises = require('fs').promises;
const path = require('path');

const {
  IGNORE_MACROS,
  IGNORE_EXPORTS,
  NON_COMPONENT_DIRS,
} = require('./constants.js');

const { processParallel, printProgress, PerformanceStats, isSafePath } = require('./utils.js');
const { DeadCodeFinderBase } = require('./detector-base.js');
const { Reporter } = require('./reporter.js');
const {
  createBackupDir,
  fixUnusedExports,
  fixUnusedComponents,
  deleteUnusedToolFiles,
  groupByFile,
  generateFixPreview,
  showFixPreview,
  printFixSummary,
  confirmFix,
} = require('./fixer.js');

const { parse } = require('./parser/index.js');
const { parseVueComponent } = require('./parser/vue.js');
const { walkExports, walkImports, walkJSX, walkComponents } = require('./parser/walker.js');
const { createWorkerPool, DEFAULT_WORKER_COUNT } = require('./worker/index.js');

const WORKER_THRESHOLD = 500;
const BATCH_SIZE = 50;

class DeadCodeFinderAST extends DeadCodeFinderBase {
  constructor(options = {}) {
    super(options);
    this.jsxUsage = new Map();
    this.performanceStats = new PerformanceStats();

    this.useWorker = options.useWorker;
    this.workerThreshold = options.workerThreshold ?? WORKER_THRESHOLD;
    this.workerCount = options.workerCount ?? DEFAULT_WORKER_COUNT;
    this.workerPool = null;
  }

  /**
   * 从内容中提取导入
   * @param {string} content - 文件内容
   * @returns {Array} 导入数组
   */
  extractImportsFromContent(content) {
    const result = parse(content, 'temp.js');
    if (result.success && result.ast) {
      const imports = walkImports(result.ast);
      return [...imports.static, ...imports.default, ...imports.namespace];
    }
    return [];
  }

  /**
   * 解析单个文件使用AST
   * @param {string} filePath - 文件路径
   * @returns {Promise<void>}
   */
  async parseFile(filePath) {
    // 路径安全检查：确保文件在源目录范围内
    if (!isSafePath(this.srcDir, filePath)) {
      console.warn(`⚠️  路径安全警告: 文件路径超出源目录范围，已跳过: ${filePath}`);
      return;
    }

    try {
      const relativePath = path.relative(this.srcDir, filePath);
      const ext = path.extname(filePath);

      const content = await fsPromises.readFile(filePath, 'utf-8');

      if (content.length > this.maxFileSize) {
        console.warn(`⚠️  文件过大，跳过解析: ${filePath}`);
        return;
      }

      if (ext === '.vue') {
        this.fileContents.set(relativePath, content);
      }

      if (ext === '.vue') {
        const vueInfo = parseVueComponent(content);
        const fileName = path.basename(filePath, '.vue');

        if (vueInfo.isComponent && fileName !== 'index') {
          this.components.set(relativePath, {
            name: fileName,
            used: false,
            isGlobal: fileName.startsWith('The') || fileName.startsWith('App'),
            isScriptSetup: vueInfo.hasScriptSetup,
            composables: vueInfo.composables,
            exposed: vueInfo.exposed,
          });
        }

        const result = parse(content, filePath);
        // 区分有脚本块和无脚本块的情况
        if (result.success && result.ast) {
          // 有脚本块且解析成功，处理 AST
          this.processAstResult(relativePath, result.ast, content);
        }
        // 纯模板组件（hasScript: false）不需要处理 AST，组件信息已通过 parseVueComponent 获取
      } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        const result = parse(content, filePath);

        if (result.success && result.ast) {
          const components = walkComponents(result.ast);
          const fileName = path.basename(filePath, ext);

          if (components.functions.length > 0 || components.classes.length > 0) {
            const dirName = path.basename(path.dirname(filePath)).toLowerCase();

            if (!NON_COMPONENT_DIRS.includes(dirName)) {
              const compName = components.functions[0]?.name || components.classes[0]?.name;
              if (compName && fileName !== 'index') {
                this.components.set(relativePath, {
                  name: compName,
                  used: false,
                  isGlobal: fileName.startsWith('The') || fileName.startsWith('App'),
                });
              }
            }
          }

          this.processAstResult(relativePath, result.ast, content);
        }
      }
    } catch (error) {
      console.warn(`⚠️  解析文件失败: ${filePath}`);
      console.warn(`   错误信息: ${error.message}`);
    }
  }

  /**
   * 处理AST结果提取导出和导入
   * @param {string} relativePath - 相对文件路径
   * @param {Object} ast - 解析后的AST
   * @param {string} content - 原始内容
   */
  processAstResult(relativePath, ast, _content) {
    const exports = walkExports(ast);

    const filteredExports = [];

    for (const exp of exports.named) {
      if (!IGNORE_EXPORTS.has(exp.name) && !IGNORE_MACROS.includes(exp.name)) {
        filteredExports.push(exp);
      }
    }

    if (exports.default && !IGNORE_EXPORTS.has(exports.default.name)) {
      filteredExports.push(exports.default);
    }

    for (const exp of exports.group) {
      if (!IGNORE_EXPORTS.has(exp.name)) {
        filteredExports.push(exp);
      }
    }

    for (const exp of exports.reexport) {
      if (!IGNORE_EXPORTS.has(exp.name)) {
        filteredExports.push(exp);
      }
    }

    if (filteredExports.length > 0) {
      this.exports.set(relativePath, filteredExports);
    }

    const imports = walkImports(ast);
    const allImports = [
      ...imports.static,
      ...imports.default,
      ...imports.namespace,
      ...imports.dynamic,
    ];

    if (allImports.length > 0) {
      this.imports.set(relativePath, allImports);
    }

    const jsxComponents = walkJSX(ast);
    if (jsxComponents.length > 0) {
      const uniqueComponents = [...new Set(jsxComponents)];
      this.jsxUsage.set(relativePath, uniqueComponents);
    }
  }

  /**
   * 运行完整分析
   * @returns {Promise<Object>} 分析结果
   */
  async analyze() {
    this.performanceStats.start();

    await this.scanSourceFiles();

    this.performanceStats.recordFile(this.sourceFiles.length);

    const testImports = await this.scanTestFiles();

    await this.parseSourceFiles();

    this.performanceStats.recordExport(this.getExportCount());
    this.performanceStats.recordComponent(this.components.size);

    const allImports = this.collectAllImports(testImports);

    await this.detectUnusedCode(allImports, testImports);

    this.performanceStats.end();
    this.performanceStats.printReport();

    Reporter.printAnalysisComplete(this.performanceStats.getFormattedTime());

    return {
      unusedExports: this.unusedExports,
      unusedComponents: this.unusedComponents,
      unusedToolFiles: this.unusedToolFiles,
    };
  }

  /**
   * 扫描源文件
   * @private
   */
  async scanSourceFiles() {
    console.log('🔍 扫描源文件 (AST 模式)...\n');
    this.sourceFiles = await this.scanFiles(this.srcDir);
    console.log(`📁 找到 ${this.sourceFiles.length} 个源文件\n`);
  }

  /**
   * 解析源文件
   * @private
   */
  async parseSourceFiles() {
    const shouldUseWorker = this.shouldUseWorkerMode();

    if (shouldUseWorker) {
      await this.parseSourceFilesWithWorker();
    } else {
      await this.parseSourceFilesDirectly();
    }

    console.log(`📦 发现 ${this.getExportCount()} 个导出\n`);
  }

  /**
   * 判断是否应该使用 Worker 模式
   * @returns {boolean}
   * @private
   */
  shouldUseWorkerMode() {
    if (this.useWorker === true) {
      return true;
    }
    if (this.useWorker === false) {
      return false;
    }
    return this.sourceFiles.length >= this.workerThreshold;
  }

  /**
   * 使用 Worker 线程解析源文件
   * @private
   */
  async parseSourceFilesWithWorker() {
    console.log(`📝 解析文件 (Worker 模式, ${this.workerCount} 个线程)...`);

    this.workerPool = createWorkerPool({
      workerCount: this.workerCount,
    });

    try {
      await this.workerPool.initialize();

      const total = this.sourceFiles.length;
      let completed = 0;

      const batches = this.createBatches(this.sourceFiles, BATCH_SIZE);

      for (const batch of batches) {
        const results = await this.workerPool.execute({
          type: 'parseFiles',
          options: {
            filePaths: batch,
            srcDir: this.srcDir,
            maxFileSize: this.maxFileSize,
          },
        });

        for (const result of results) {
          this.processWorkerResult(result);
        }

        completed += batch.length;
        printProgress(completed, total, '   解析进度:');
      }
    } finally {
      await this.workerPool.shutdown();
      this.workerPool = null;
    }
  }

  /**
   * 直接解析源文件（不使用 Worker）
   * @private
   */
  async parseSourceFilesDirectly() {
    console.log('📝 解析文件 (AST)...');
    await processParallel(
      this.sourceFiles,
      file => this.parseFile(file),
      this.concurrency,
      (current, total) => printProgress(current, total, '   解析进度:')
    );
  }

  /**
   * 创建文件批次
   * @param {string[]} files - 文件列表
   * @param {number} batchSize - 批次大小
   * @returns {string[][]} 批次数组
   * @private
   */
  createBatches(files, batchSize) {
    const batches = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 处理 Worker 返回的解析结果
   * @param {Object} result - Worker 解析结果
   * @private
   */
  processWorkerResult(result) {
    const { relativePath, success, exports, imports, jsxComponents, componentInfo, vueInfo, error } = result;

    if (error) {
      console.warn(`⚠️  解析文件失败: ${result.filePath}`);
      console.warn(`   错误信息: ${error}`);
      return;
    }

    if (!success) {
      return;
    }

    if (componentInfo) {
      this.components.set(relativePath, {
        name: componentInfo.name,
        used: false,
        isGlobal: componentInfo.isGlobal,
        isScriptSetup: componentInfo.isScriptSetup,
        composables: componentInfo.composables,
        exposed: componentInfo.exposed,
      });
    }

    if (vueInfo && vueInfo.isComponent) {
      const content = require('fs').readFileSync(result.filePath, 'utf-8');
      this.fileContents.set(relativePath, content);
    }

    if (exports && exports.length > 0) {
      this.exports.set(relativePath, exports);
    }

    if (imports && imports.length > 0) {
      this.imports.set(relativePath, imports);
    }

    if (jsxComponents && jsxComponents.length > 0) {
      this.jsxUsage.set(relativePath, jsxComponents);
    }
  }

  /**
   * 添加导入到映射
   * @param {Map} importMap - 导入映射
   * @param {string} name - 导入名称
   * @param {string} file - 文件路径
   * @private
   */
  addImportToMap(importMap, name, file) {
    if (!importMap.has(name)) {
      importMap.set(name, new Set());
    }
    importMap.get(name).add(file);
  }

  /**
   * 处理动态导入
   * @param {Map} importMap - 导入映射
   * @param {Object} imp - 导入对象
   * @param {string} file - 当前文件路径
   * @private
   */
  processDynamicImport(importMap, imp, file) {
    const resolvedPath = this.resolveImportPath(imp.source, file);
    if (!resolvedPath) return;

    const moduleExports = this.exports.get(resolvedPath);
    if (!moduleExports) return;

    for (const exp of moduleExports) {
      this.addImportToMap(importMap, exp.name, file);
    }
  }

  /**
   * 处理副作用导入（无名称但有 source）
   * @param {Map} importMap - 导入映射
   * @param {Object} imp - 导入对象
   * @param {string} file - 当前文件路径
   * @private
   */
  processSideEffectImport(importMap, imp, file) {
    const resolvedPath = this.resolveImportPath(imp.source, file);
    if (!resolvedPath) return;

    const moduleExports = this.exports.get(resolvedPath);
    if (!moduleExports) return;

    for (const exp of moduleExports) {
      this.addImportToMap(importMap, exp.name, file);
    }
  }

  /**
   * 收集所有导入
   * @param {Map} testImports - 测试导入
   * @returns {Map} 所有导入的映射
   * @private
   */
  collectAllImports(testImports) {
    console.log('🔎 分析使用情况...');
    const allImports = new Map();

    for (const [file, imports] of this.imports) {
      for (const imp of imports) {
        if (imp.isInternal === false) continue;

        if (imp.isDynamic) {
          this.processDynamicImport(allImports, imp, file);
        } else if (imp.name) {
          this.addImportToMap(allImports, imp.name, file);
        } else if (imp.source) {
          this.processSideEffectImport(allImports, imp, file);
        }
      }
    }

    for (const [name, files] of testImports) {
      for (const file of files) {
        this.addImportToMap(allImports, name, file);
      }
    }

    return allImports;
  }

  /**
   * 检测未使用的代码
   * @param {Map} allImports - 所有导入
   * @param {Map} testImports - 测试导入
   * @private
   */
  async detectUnusedCode(allImports, testImports) {
    Reporter.printDetectionStage('未使用的导出');
    await this.detectUnusedExports(allImports);

    Reporter.printDetectionStage('未使用的组件');
    await this.detectUnusedComponents(testImports);

    Reporter.printDetectionStage('未使用的工具文件');
    this.unusedToolFiles = this.detectUnusedToolFiles();
  }

  /**
   * 收集副作用导入的文件
   * @returns {Set} 副作用导入文件集合
   * @private
   */
  collectSideEffectImportedFiles() {
    const files = new Set();
    for (const [file, imports] of this.imports) {
      for (const imp of imports) {
        if (imp.isInternal && !imp.name && imp.source) {
          const resolvedPath = this.resolveImportPath(imp.source, file);
          if (resolvedPath) {
            files.add(resolvedPath);
          }
        }
      }
    }
    return files;
  }

  /**
   * 检查导出是否未使用
   * @param {Object} exp - 导出项
   * @param {string} file - 文件路径
   * @param {Map} allImports - 所有导入映射
   * @param {boolean} isSideEffectImported - 是否为副作用导入
   * @returns {Promise<boolean>} 是否未使用
   * @private
   */
  async isExportUnused(exp, file, allImports, isSideEffectImported) {
    const usedBy = allImports.get(exp.name);
    if ((!usedBy || usedBy.size === 0) && !isSideEffectImported) {
      const localUsage = await this.countLocalUsage(file, exp.name);
      return localUsage === 0;
    }
    return false;
  }

  /**
   * 处理单个导出批次
   * @param {Array} batch - 导出批次
   * @param {Map} allImports - 所有导入映射
   * @param {Set} sideEffectImportedFiles - 副作用导入文件集合
   * @returns {Promise<Array>} 未使用的导出列表
   * @private
   */
  async processExportBatch(batch, allImports, sideEffectImportedFiles) {
    const results = [];
    for (const [file, exports] of batch) {
      const isSideEffectImported =
        sideEffectImportedFiles.has(file) ||
        sideEffectImportedFiles.has(file.replace(/^\.\//, ''));
      for (const exp of exports) {
        if (await this.isExportUnused(exp, file, allImports, isSideEffectImported)) {
          results.push({ file, ...exp });
        }
      }
    }
    return results;
  }

  /**
   * 检测未使用的导出
   * @param {Map} allImports - 所有导入映射
   */
  async detectUnusedExports(allImports) {
    const sideEffectImportedFiles = this.collectSideEffectImportedFiles();

    const exportCount = this.exports.size;
    let processed = 0;

    this.unusedExports = [];

    const batchSize = 100;
    const exportEntries = Array.from(this.exports.entries());

    for (let i = 0; i < exportEntries.length; i += batchSize) {
      const batch = exportEntries.slice(i, i + batchSize);
      const batchResults = await this.processExportBatch(batch, allImports, sideEffectImportedFiles);
      this.unusedExports.push(...batchResults);

      processed += batch.length;
      printProgress(Math.min(processed, exportCount), exportCount, '   导出检测:');
    }
  }

  /**
   * 检测未使用的组件
   * @param {Map} testImports - 测试导入
   */
  async detectUnusedComponents(testImports = new Map()) {
    const componentUsages = this.componentDetector.collectComponentUsages(this.imports, testImports);

    console.log('   构建组件标签索引...');
    const componentTagIndex = this.buildComponentTagIndex();
    console.log(`   索引了 ${componentTagIndex.size} 个组件标签`);

    this.unusedComponents = this.componentDetector.detectUnusedComponents(
      this.components,
      componentUsages,
      componentTagIndex,
      this.localComponents,
      (current, total) => printProgress(current, total, '   组件检测:')
    );
  }

  /**
   * 构建组件标签索引
   * @returns {Map} 组件标签索引
   * @private
   */
  buildComponentTagIndex() {
    const componentTagIndex = new Map();

    const jsxIndex = this.componentDetector.buildComponentTagIndexFromJSX(this.jsxUsage);
    this.componentDetector.mergeComponentTagIndex(componentTagIndex, jsxIndex);

    const vueIndex = this.componentDetector.buildComponentTagIndexFromFileContents(this.fileContents);
    this.componentDetector.mergeComponentTagIndex(componentTagIndex, vueIndex);

    return componentTagIndex;
  }

  /**
   * 生成并打印报告
   * @returns {Object} 报告数据
   */
  report() {
    console.clear();

    return Reporter.generate(
      {
        unusedExports: this.unusedExports,
        unusedComponents: this.unusedComponents,
        unusedToolFiles: this.unusedToolFiles,
      },
      {
        mode: 'ast',
        stats: {
          fileCount: this.sourceFiles.length,
          exportCount: this.getExportCount(),
          componentCount: this.components.size,
        },
      }
    );
  }

  async fix(options = {}) {
    const { dryRun = false, confirm: needConfirm = false } = options;

    console.log('\n🔧 开始自动修复未使用的代码...\n');

    const fixPreview = generateFixPreview(
      this.unusedExports,
      this.unusedComponents,
      this.unusedToolFiles
    );
    showFixPreview(fixPreview, groupByFile);

    if (needConfirm) {
      const shouldProceed = await confirmFix(fixPreview);
      if (!shouldProceed) {
        console.log('\n🛑 修复已取消\n');
        return { cancelled: true };
      }
    }

    if (dryRun) {
      console.log('\n📋 预览模式：未执行实际修复操作\n');
      return { preview: fixPreview, dryRun: true };
    }

    const backupDir = createBackupDir(this.srcDir);
    const fixResult = {
      unusedExports: await fixUnusedExports(this.unusedExports, this.srcDir, backupDir),
      unusedComponents: await fixUnusedComponents(this.unusedComponents, this.srcDir, backupDir),
      unusedToolFiles: deleteUnusedToolFiles(this.unusedToolFiles, this.srcDir, backupDir),
    };

    printFixSummary(backupDir, fixResult);
    return fixResult;
  }
}

module.exports = { DeadCodeFinderAST };
