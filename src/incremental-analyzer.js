/**
 * 增量分析模块
 *
 * 支持基于 Git 变更的增量检测，提升大型项目的分析速度
 * 支持持久化缓存，复用未变更文件的分析结果
 */

const { execSync } = require('child_process');
const path = require('path');
const { defaultLogger } = require('./logger');
const { CacheManager, createCacheManager } = require('./cache');

/**
 * 获取 Git 变更的文件列表
 * @param {string} srcDir - 源代码目录
 * @param {string} baseBranch - 基准分支（默认 main）
 * @returns {string[]} 变更的文件列表
 */
function getChangedFiles(srcDir, baseBranch = 'main') {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: srcDir, stdio: 'pipe' });
  } catch {
    defaultLogger.warn('当前目录不是 Git 仓库，将使用全量分析模式', 'E006', {
      目录: srcDir,
    });
    return null;
  }

  try {
    const changedFiles = execSync(
      `git diff --name-only --diff-filter=ACMR ${baseBranch}...HEAD`,
      { cwd: srcDir, encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .filter(file => file.length > 0);

    const srcPath = path.basename(srcDir);
    return changedFiles.filter(file => {
      const ext = path.extname(file);
      return (
        ['.js', '.jsx', '.ts', '.tsx', '.vue'].includes(ext) &&
        (file.startsWith(srcPath + '/') || file.startsWith(srcPath + '\\'))
      );
    });
  } catch (error) {
    defaultLogger.warn('获取 Git 变更失败，将使用全量分析模式', 'E006', {
      目录: srcDir,
      错误信息: error.message,
    });
    return null;
  }
}

/**
 * 获取未提交的变更文件
 * @param {string} srcDir - 源代码目录
 * @returns {string[]} 未提交变更的文件列表
 */
function getUncommittedChanges(srcDir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: srcDir, stdio: 'pipe' });
  } catch {
    return null;
  }

  try {
    const changedFiles = execSync(
      'git diff --name-only --diff-filter=ACMR',
      { cwd: srcDir, encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .filter(file => file.length > 0);

    const stagedFiles = execSync(
      'git diff --name-only --diff-filter=ACMR --cached',
      { cwd: srcDir, encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .filter(file => file.length > 0);

    return [...new Set([...changedFiles, ...stagedFiles])];
  } catch {
    return [];
  }
}

/**
 * 分析变更文件的依赖关系
 * @param {string[]} changedFiles - 变更的文件列表
 * @param {Map} imports - 所有导入映射
 * @returns {Set} 受影响的文件集合
 */
function analyzeAffectedFiles(changedFiles, imports) {
  const affectedFiles = new Set(changedFiles);

  // 构建反向依赖图
  const reverseDeps = new Map();

  for (const [file, fileImports] of imports) {
    for (const imp of fileImports) {
      if (imp.source && imp.isInternal) {
        const sourcePath = imp.source;
        if (!reverseDeps.has(sourcePath)) {
          reverseDeps.set(sourcePath, new Set());
        }
        reverseDeps.get(sourcePath).add(file);
      }
    }
  }

  // BFS 查找所有受影响的文件
  const queue = [...changedFiles];
  while (queue.length > 0) {
    const currentFile = queue.shift();
    const normalizedPath = currentFile.replace(/\\/g, '/');

    // 查找依赖当前文件的其他文件
    for (const [source, dependents] of reverseDeps) {
      if (normalizedPath.includes(source.replace(/^\.\//, ''))) {
        for (const dependent of dependents) {
          if (!affectedFiles.has(dependent)) {
            affectedFiles.add(dependent);
            queue.push(dependent);
          }
        }
      }
    }
  }

  return affectedFiles;
}

/**
 * 过滤导出结果，只保留受影响文件的导出
 * @param {Array} unusedExports - 未使用的导出列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用导出列表
 */
function filterUnusedExports(unusedExports, affectedFiles) {
  return unusedExports.filter(exp => {
    const normalizedFile = exp.file.replace(/\\/g, '/');
    for (const affected of affectedFiles) {
      if (normalizedFile === affected.replace(/\\/g, '/')) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 过滤组件结果，只保留受影响文件的组件
 * @param {Array} unusedComponents - 未使用的组件列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用组件列表
 */
function filterUnusedComponents(unusedComponents, affectedFiles) {
  return unusedComponents.filter(comp => {
    const normalizedFile = comp.file.replace(/\\/g, '/');
    for (const affected of affectedFiles) {
      if (normalizedFile === affected.replace(/\\/g, '/')) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 过滤工具文件结果，只保留受影响的工具文件
 * @param {Array} unusedToolFiles - 未使用的工具文件列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用工具文件列表
 */
function filterUnusedToolFiles(unusedToolFiles, affectedFiles) {
  if (!unusedToolFiles) return [];

  return unusedToolFiles.filter(file => {
    const normalizedFile = file.replace(/\\/g, '/');
    for (const affected of affectedFiles) {
      if (normalizedFile === affected.replace(/\\/g, '/')) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 检查是否支持增量分析
 * @param {string} srcDir - 源代码目录
 * @returns {boolean} 是否支持增量分析
 */
function isIncrementalSupported(srcDir) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: srcDir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前分支名
 * @param {string} srcDir - 源代码目录
 * @returns {string|null} 当前分支名
 */
function getCurrentBranch(srcDir) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: srcDir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 获取最近一次提交的哈希
 * @param {string} srcDir - 源代码目录
 * @returns {string|null} 提交哈希
 */
function getLastCommitHash(srcDir) {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: srcDir,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 创建增量分析缓存管理器
 * @param {Object} options - 配置选项
 * @param {string} options.projectRoot - 项目根目录
 * @param {string} [options.cacheDir] - 缓存目录
 * @param {number} [options.maxAge] - 缓存最大有效期（毫秒）
 * @returns {CacheManager} 缓存管理器实例
 */
function createIncrementalCache(options) {
  return createCacheManager({
    projectRoot: options.projectRoot,
    cacheDir: options.cacheDir,
    maxAge: options.maxAge,
  });
}

/**
 * 分析文件并缓存结果
 * @param {string} filePath - 文件路径
 * @param {Function} analyzer - 分析函数
 * @param {CacheManager} cacheManager - 缓存管理器
 * @returns {Object} 分析结果
 */
function analyzeFileWithCache(filePath, analyzer, cacheManager) {
  const cached = cacheManager.get(filePath);
  if (cached) {
    defaultLogger.debug(`使用缓存: ${filePath}`);
    return { data: cached, fromCache: true };
  }

  const result = analyzer(filePath);
  cacheManager.set(filePath, result);
  return { data: result, fromCache: false };
}

/**
 * 批量分析文件，使用缓存优化
 * @param {string[]} filePaths - 文件路径列表
 * @param {Function} analyzer - 分析函数
 * @param {CacheManager} cacheManager - 缓存管理器
 * @returns {Object} 分析结果，包含缓存命中统计
 */
function analyzeFilesWithCache(filePaths, analyzer, cacheManager) {
  const results = {
    data: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    errors: [],
  };

  for (const filePath of filePaths) {
    try {
      const { data, fromCache } = analyzeFileWithCache(filePath, analyzer, cacheManager);
      results.data.set(filePath, data);
      if (fromCache) {
        results.cacheHits++;
      } else {
        results.cacheMisses++;
      }
    } catch (error) {
      results.errors.push({ filePath, error: error.message });
    }
  }

  return results;
}

/**
 * 获取缓存统计信息
 * @param {CacheManager} cacheManager - 缓存管理器
 * @returns {Object} 缓存统计
 */
function getCacheStats(cacheManager) {
  return cacheManager.getStats();
}

/**
 * 清理缓存
 * @param {CacheManager} cacheManager - 缓存管理器
 * @returns {boolean} 是否成功
 */
function clearCache(cacheManager) {
  return cacheManager.clear();
}

/**
 * 增量分析器类
 * 封装增量分析逻辑，支持缓存和 Git 变更检测
 */
class IncrementalAnalyzer {
  constructor(options = {}) {
    this.srcDir = options.srcDir || process.cwd();
    this.baseBranch = options.baseBranch || 'main';
    this.cacheManager = options.cacheManager || createIncrementalCache({
      projectRoot: this.srcDir,
      cacheDir: options.cacheDir,
      maxAge: options.maxAge,
    });
    this.verbose = options.verbose || false;
  }

  initialize() {
    this.cacheManager.load();
    return this;
  }

  getChangedFiles() {
    return getChangedFiles(this.srcDir, this.baseBranch);
  }

  getUncommittedChanges() {
    return getUncommittedChanges(this.srcDir);
  }

  analyzeWithCache(filePaths, analyzer) {
    return analyzeFilesWithCache(filePaths, analyzer, this.cacheManager);
  }

  saveCache() {
    return this.cacheManager.save();
  }

  getCacheStats() {
    return getCacheStats(this.cacheManager);
  }

  clearCache() {
    return clearCache(this.cacheManager);
  }

  isIncrementalSupported() {
    return isIncrementalSupported(this.srcDir);
  }

  getCurrentBranch() {
    return getCurrentBranch(this.srcDir);
  }

  getLastCommitHash() {
    return getLastCommitHash(this.srcDir);
  }
}

module.exports = {
  getChangedFiles,
  getUncommittedChanges,
  analyzeAffectedFiles,
  filterUnusedExports,
  filterUnusedComponents,
  filterUnusedToolFiles,
  isIncrementalSupported,
  getCurrentBranch,
  getLastCommitHash,
  createIncrementalCache,
  analyzeFileWithCache,
  analyzeFilesWithCache,
  getCacheStats,
  clearCache,
  IncrementalAnalyzer,
  CacheManager,
};
