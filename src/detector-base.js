const fsPromises = require('fs').promises;
const path = require('path');

const {
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_DIRS,
  TEST_DIRS,
  MAX_CONCURRENCY,
  MAX_FILE_SIZE,
} = require('./constants.js');

const { normalizePath, isSafePath, hasPathTraversal } = require('./utils.js');
const { PathResolver } = require('./resolver.js');
const { ComponentDetector } = require('./component-detector.js');

/**
 * 正则表达式缓存工厂
 * 避免重复编译相同的正则表达式模式
 */
class RegexCache {
  /**
   * 创建正则表达式缓存实例
   */
  constructor() {
    this.cache = new Map();
  }

  /**
   * 获取或创建正则表达式
   * @param {string|RegExp} pattern - 正则表达式模式
   * @param {string} [flags='g'] - 正则表达式标志
   * @returns {RegExp} 正则表达式实例
   */
  get(pattern, flags = 'g') {
    const key = `${pattern.toString()}:${flags}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new RegExp(pattern, flags));
    }
    const regex = this.cache.get(key);
    regex.lastIndex = 0;
    return regex;
  }

  /**
   * 获取或创建针对特定名称的正则表达式
   * @param {string} name - 要匹配的名称
   * @param {string} type - 正则类型（export-group, export-decl, var-decl, decorator, name）
   * @returns {RegExp} 正则表达式实例
   */
  getForName(name, type) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const key = `${type}:${escapedName}`;
    if (!this.cache.has(key)) {
      switch (type) {
        case 'export-group':
          this.cache.set(key, new RegExp(`export\\s+\\{[^}]*\\b${escapedName}\\b[^}]*\\}`, 'g'));
          break;
        case 'export-decl':
          this.cache.set(key, new RegExp(`export\\s+(?:const|let|var|function|class)\\s+${escapedName}\\b[^;]*;?`, 'g'));
          break;
        case 'var-decl':
          this.cache.set(key, new RegExp(`\\b(?:const|let|var|function|class)\\s+${escapedName}\\b`, 'g'));
          break;
        case 'decorator':
          this.cache.set(key, new RegExp(`^\\s*@${escapedName}(?:\\s*\\([^)]*\\))?`, 'gm'));
          break;
        case 'name':
          this.cache.set(key, new RegExp(`\\b${escapedName}\\b`, 'g'));
          break;
        default:
          this.cache.set(key, new RegExp(escapedName, flags));
      }
    }
    const regex = this.cache.get(key);
    regex.lastIndex = 0;
    return regex;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }
}

const globalRegexCache = new RegexCache();

const PRECOMPILED_REGEX = {
  cleanImportStatements: /import\s+.*from\s+['"][^'"]+['"]/g,
  cleanStringLiterals: /(['"`])(?:\\.|(?!\1)[^\\])*\1/g,
  cleanRegex: /\/(?:[^\/\\]|\\.)*\/[gimsuvy]*/g,
  cleanCommentsBlock: /\/\*[\s\S]*?\*\//g,
  cleanCommentsLine: /\/\/.*$/gm,
};

/**
 * 死代码检测器基类
 * 提供文件扫描、导入解析、使用计数等通用功能
 */
class DeadCodeFinderBase {
  /**
   * 创建检测器基类实例
   * @param {Object} options - 配置选项
   * @param {string} [options.srcDir] - 源代码目录路径
   * @param {string[]} [options.extensions] - 要扫描的文件扩展名
   * @param {string[]} [options.ignoreDirs] - 要忽略的目录
   * @param {boolean} [options.verbose] - 是否输出详细日志
   * @param {number} [options.maxFileSize] - 最大文件大小（字节）
   * @param {number} [options.concurrency] - 并发处理数
   */
  constructor(options = {}) {
    this.srcDir = options.srcDir || path.join(process.cwd(), 'src');
    this.extensions = options.extensions || DEFAULT_EXTENSIONS;
    this.ignoreDirs = options.ignoreDirs || DEFAULT_IGNORE_DIRS;
    this.verbose = options.verbose || false;
    this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
    this.concurrency = options.concurrency || MAX_CONCURRENCY;

    this.sourceFiles = [];
    this.fileContents = new Map();
    this.exports = new Map();
    this.imports = new Map();
    this.components = new Map();
    this.unusedExports = [];
    this.unusedComponents = [];
    this.unusedToolFiles = [];
    this.localComponents = new Map();

    this.pathResolver = new PathResolver(this.srcDir);
    this.componentDetector = new ComponentDetector({
      toPascalCase: this.toPascalCase.bind(this),
      toKebabCase: this.toKebabCase.bind(this),
    });
  }

  /**
   * 扫描目录获取源文件（使用队列避免递归栈溢出）
   * @param {string} dir - 目录路径
   * @param {Object} options - 可选配置
   * @param {string} [options.baseDir] - 路径安全检查的基础目录，默认为 this.srcDir
   * @returns {Promise<string[]>} 源文件路径数组
   */
  async scanFiles(dir, options = {}) {
    const { baseDir = this.srcDir } = options;
    const files = [];
    const queue = [dir];

    while (queue.length > 0) {
      const directory = queue.shift();

      // 路径安全检查：确保目录在基础目录范围内
      if (!isSafePath(baseDir, directory)) {
        console.warn(`⚠️  路径安全警告: 检测到路径遍历尝试，已跳过: ${directory}`);
        continue;
      }

      try {
        const items = await fsPromises.readdir(directory);
        for (const item of items) {
          const fullPath = path.join(directory, item);

          // 检测路径遍历攻击
          if (hasPathTraversal(item)) {
            console.warn(`⚠️  路径安全警告: 检测到可疑路径遍历字符，已跳过: ${item}`);
            continue;
          }

          // 路径安全检查
          if (!isSafePath(baseDir, fullPath)) {
            console.warn(`⚠️  路径安全警告: 路径超出基础目录范围，已跳过: ${fullPath}`);
            continue;
          }

          try {
            const stat = await fsPromises.stat(fullPath);

            if (stat.isDirectory()) {
              if (!this.ignoreDirs.includes(item) && !item.startsWith('.')) {
                queue.push(fullPath);
              }
            } else {
              const ext = path.extname(item);
              if (this.extensions.includes(ext)) {
                files.push(fullPath);
              }
            }
          } catch (e) {
            console.warn(`⚠️  无法访问: ${fullPath}`);
            console.warn(`   错误信息: ${e.message}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️  无法访问: ${directory}`);
        console.warn(`   错误信息: ${e.message}`);
      }
    }

    return files;
  }

  /**
   * 扫描测试文件并收集导入
   * @returns {Promise<Map>} 测试导入映射
   */
  async scanTestFiles() {
    const testImports = new Map();
    const rootDir = path.dirname(this.srcDir);

    for (const testDir of TEST_DIRS) {
      const testDirPath = path.join(rootDir, testDir);
      try {
        const stat = await fsPromises.stat(testDirPath);
        if (stat.isDirectory()) {
          // 扫描测试文件时，使用测试目录本身作为基础目录
          const testFiles = await this.scanFiles(testDirPath, { baseDir: testDirPath });
          for (const file of testFiles) {
            try {
              const content = await fsPromises.readFile(file, 'utf-8');
              const imports = this.extractImportsFromContent(content);
              for (const imp of imports) {
                if (imp.isInternal !== false) {
                  if (!testImports.has(imp.name)) {
                    testImports.set(imp.name, new Set());
                  }
                  testImports.get(imp.name).add(file);
                }
              }
            } catch (e) {
              console.warn(`⚠️  解析测试文件失败: ${file}`);
              console.warn(`   错误信息: ${e.message}`);
            }
          }
        }
      } catch (e) {
        // 区分目录不存在（ENOENT）和目录存在但无法访问的情况
        if (e.code === 'ENOENT') {
          // 目录不存在，静默跳过，不输出警告
          continue;
        }
        // 目录存在但无法访问，保留警告输出
        console.warn(`⚠️  无法访问测试目录: ${testDirPath}`);
        console.warn(`   错误信息: ${e.message}`);
      }
    }

    return testImports;
  }

  /**
   * 从内容中提取导入（供子类重写）
   * @param {string} content - 文件内容
   * @returns {Array} 导入数组
   */
  extractImportsFromContent(_content) {
    return [];
  }

  /**
   * 计算文件中名称的本地使用次数
   * @param {string} file - 文件路径
   * @param {string} name - 要计算的名称
   * @returns {Promise<number>} 使用次数
   */
  async countLocalUsage(file, name) {
    const content = this.fileContents.get(file);
    if (!content) {
      const fullPath = path.join(this.srcDir, file);
      try {
        await fsPromises.access(fullPath);
        const fileContent = await fsPromises.readFile(fullPath, 'utf-8');
        return this.countUsageInContent(fileContent, name);
      } catch {
        return 0;
      }
    }
    return this.countUsageInContent(content, name);
  }

  /**
   * 清理内容中的干扰项
   * @param {string} content - 原始内容
   * @param {string} escapedName - 转义后的名称
   * @returns {string} 清理后的内容
   */
  cleanContent(content, escapedName) {
    let cleaned = content;
    cleaned = this.cleanCommentsFast(cleaned);
    cleaned = this.cleanImportStatementsFast(cleaned);
    cleaned = this.cleanStringLiteralsFast(cleaned);
    cleaned = this.cleanRegexFast(cleaned);
    cleaned = this.cleanExportDeclarationsFast(cleaned, escapedName);
    cleaned = this.cleanVariableDeclarationsFast(cleaned, escapedName);
    return cleaned;
  }

  /**
   * 计算匹配数量
   * @param {RegExpMatchArray|null} matches - 匹配结果
   * @returns {number} 匹配数量
   */
  countMatches(matches) {
    return matches ? matches.length : 0;
  }

  /**
   * 计算内容中的使用次数（只计数实际使用，不计数声明）
   * @param {string} content - 内容
   * @param {string} name - 名称
   * @returns {number} 使用次数
   */
  countUsageInContent(content, name) {
    const cleanedContent = this.cleanContent(content, name);
    const decoratorMatches = this.findDecoratorUsageFast(cleanedContent, name);
    const nameMatches = this.findNameUsageFast(cleanedContent, name);
    return this.countMatches(nameMatches) + this.countMatches(decoratorMatches);
  }

  /**
   * 清除导出声明（使用预编译正则）
   * @param {string} content - 内容
   * @param {string} name - 名称
   * @returns {string} 清除后的内容
   */
  cleanExportDeclarationsFast(content, name) {
    let cleaned = content;
    const exportGroupRegex = globalRegexCache.getForName(name, 'export-group');
    cleaned = cleaned.replace(exportGroupRegex, '');
    const exportDeclRegex = globalRegexCache.getForName(name, 'export-decl');
    cleaned = cleaned.replace(exportDeclRegex, '');
    return cleaned;
  }

  /**
   * 清除变量声明（使用预编译正则）
   * @param {string} content - 内容
   * @param {string} name - 名称
   * @returns {string} 清除后的内容
   */
  cleanVariableDeclarationsFast(content, name) {
    const varDeclRegex = globalRegexCache.getForName(name, 'var-decl');
    return content.replace(varDeclRegex, '');
  }

  /**
   * 清除导入语句（使用预编译正则）
   * @param {string} content - 内容
   * @returns {string} 清除后的内容
   */
  cleanImportStatementsFast(content) {
    PRECOMPILED_REGEX.cleanImportStatements.lastIndex = 0;
    return content.replace(PRECOMPILED_REGEX.cleanImportStatements, '');
  }

  /**
   * 清除字符串字面量（使用预编译正则）
   * @param {string} content - 内容
   * @returns {string} 清除后的内容
   */
  cleanStringLiteralsFast(content) {
    PRECOMPILED_REGEX.cleanStringLiterals.lastIndex = 0;
    return content.replace(PRECOMPILED_REGEX.cleanStringLiterals, '');
  }

  /**
   * 清除正则表达式（使用预编译正则）
   * @param {string} content - 内容
   * @returns {string} 清除后的内容
   */
  cleanRegexFast(content) {
    PRECOMPILED_REGEX.cleanRegex.lastIndex = 0;
    return content.replace(PRECOMPILED_REGEX.cleanRegex, '');
  }

  /**
   * 清除注释（使用预编译正则）
   * @param {string} content - 内容
   * @returns {string} 清除后的内容
   */
  cleanCommentsFast(content) {
    let cleaned = content;
    PRECOMPILED_REGEX.cleanCommentsBlock.lastIndex = 0;
    cleaned = cleaned.replace(PRECOMPILED_REGEX.cleanCommentsBlock, '');
    PRECOMPILED_REGEX.cleanCommentsLine.lastIndex = 0;
    cleaned = cleaned.replace(PRECOMPILED_REGEX.cleanCommentsLine, '');
    return cleaned;
  }

  /**
   * 查找装饰器使用（使用缓存正则）
   * @param {string} content - 内容
   * @param {string} name - 名称
   * @returns {RegExpMatchArray|null} 匹配结果
   */
  findDecoratorUsageFast(content, name) {
    const decoratorRegex = globalRegexCache.getForName(name, 'decorator');
    return content.match(decoratorRegex);
  }

  /**
   * 查找名称使用（使用缓存正则）
   * @param {string} content - 内容
   * @param {string} name - 名称
   * @returns {RegExpMatchArray|null} 匹配结果
   */
  findNameUsageFast(content, name) {
    const nameRegex = globalRegexCache.getForName(name, 'name');
    return content.match(nameRegex);
  }

  /**
   * 转换为 PascalCase
   * @param {string} str - 字符串
   * @returns {string}
   */
  toPascalCase(str) {
    return str
      .replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(\w)/, (_, c) => c.toUpperCase());
  }

  /**
   * 转换为 kebab-case
   * @param {string} str - 字符串
   * @returns {string}
   */
  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 获取总导出数
   * @returns {number}
   */
  getExportCount() {
    let total = 0;
    for (const exports of this.exports.values()) {
      total += exports.length;
    }
    return total;
  }

  /**
   * 按文件分组项目
   * @param {Array} items - 项目
   * @returns {Object} 分组结果
   */
  groupByFile(items) {
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.file]) grouped[item.file] = [];
      grouped[item.file].push(item);
    }
    return grouped;
  }

  /**
   * 检测未使用的工具文件
   * @returns {string[]} 未使用的文件
   */
  detectUnusedToolFiles() {
    const unusedToolFiles = [];
    const usedFiles = new Set();

    const toolDirs = ['utils', 'tools', 'helpers', 'lib', 'composables', 'hooks'];

    for (const [file, imports] of this.imports) {
      for (const imp of imports) {
        const relativePath = this.resolveImportPath(imp.source, file);
        if (relativePath) {
          usedFiles.add(relativePath);
        }
      }
    }

    for (const file of this.exports.keys()) {
      const normalizedFile = normalizePath(file);
      if (!usedFiles.has(normalizedFile)) {
        const filePath = path.join(this.srcDir, file);
        const dirName = path.basename(path.dirname(filePath));
        if (toolDirs.includes(dirName)) {
          unusedToolFiles.push(file);
        }
      }
    }

    return unusedToolFiles;
  }

  /**
   * 解析导入路径为相对路径
   * @param {string} importPath - 导入路径
   * @param {string} currentFile - 当前文件路径
   * @returns {string|null} 解析后的相对路径，解析失败返回 null
   */
  resolveImportPath(importPath, currentFile) {
    return this.pathResolver.resolve(importPath, currentFile);
  }

  /**
   * 运行完整分析（供子类重写）
   * @returns {Promise<Object>} 分析结果
   */
  async analyze() {
    return {
      unusedExports: [],
      unusedComponents: [],
      unusedToolFiles: [],
    };
  }

  /**
   * 生成并打印报告（供子类重写）
   * @returns {Object} 报告数据
   */
  report() {
    return {
      unusedExports: this.unusedExports,
      unusedComponents: this.unusedComponents,
      unusedToolFiles: this.unusedToolFiles,
    };
  }

  /**
   * 自动修复未使用的代码（供子类重写）
   * @param {Object} options - 修复选项
   * @returns {Promise<Object>} 修复结果
   */
  async fix(_options = {}) {
    return { cancelled: false };
  }
}

module.exports = { DeadCodeFinderBase };
