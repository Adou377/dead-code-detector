/**
 * 增量分析模块
 *
 * 支持基于 Git 变更的增量检测，提升大型项目的分析速度
 * 支持持久化缓存，复用未变更文件的分析结果
 * 
 * 优化版本：
 * - 使用预构建的反向依赖图索引
 * - 统一路径规范化处理
 * - 提取通用过滤逻辑
 * - 支持依赖图缓存和增量更新
 */

const { execSync } = require('child_process');
const path = require('path');
const { defaultLogger } = require('./logger');
const { CacheManager, createCacheManager } = require('./cache');

const PATH_SEP = '/';
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);

/**
 * 规范化文件路径（统一使用正斜杠）
 * @param {string} filePath - 文件路径
 * @returns {string} 规范化后的路径
 */
function normalizePath(filePath) {
  if (!filePath) return '';
  return filePath.replace(/\\/g, PATH_SEP);
}

/**
 * 依赖图管理类
 * 负责构建、缓存和查询文件依赖关系
 */
class DependencyGraph {
  constructor() {
    // 正向依赖：文件 -> 它导入的文件
    this.forwardDeps = new Map();
    // 反向依赖：文件 -> 导入它的文件（用于增量分析）
    this.reverseDeps = new Map();
    // 路径索引：用于快速查找
    this.pathIndex = new Map();
  }

  /**
   * 添加依赖关系
   * @param {string} from - 导入方文件
   * @param {string} to - 被导入的文件
   */
  addDependency(from, to) {
    const normalizedFrom = normalizePath(from);
    const normalizedTo = normalizePath(to);

    // 更新正向依赖
    if (!this.forwardDeps.has(normalizedFrom)) {
      this.forwardDeps.set(normalizedFrom, new Set());
    }
    this.forwardDeps.get(normalizedFrom).add(normalizedTo);

    // 更新反向依赖
    if (!this.reverseDeps.has(normalizedTo)) {
      this.reverseDeps.set(normalizedTo, new Set());
    }
    this.reverseDeps.get(normalizedTo).add(normalizedFrom);

    // 更新路径索引（支持部分路径匹配）
    this._updatePathIndex(normalizedTo);
  }

  /**
   * 批量构建依赖图
   * @param {Map} imports - 导入映射（文件 -> 导入列表）
   * @param {string} srcDir - 源代码目录
   */
  buildFromImports(imports, srcDir) {
    this.clear();

    // 第一遍：收集所有文件路径用于后续匹配
    const allFiles = new Set();
    for (const [file] of imports) {
      allFiles.add(normalizePath(file));
    }

    for (const [file, fileImports] of imports) {
      const normalizedFile = normalizePath(file);
      
      for (const imp of fileImports) {
        if (imp.source && imp.isInternal) {
          // 尝试多种解析策略
          let resolvedPath = this._resolveImportPath(imp.source, file, srcDir);
          
          // 如果文件系统解析失败，尝试路径推导
          if (!resolvedPath) {
            resolvedPath = this._resolveByPathInference(imp.source, file, allFiles);
          }
          
          if (resolvedPath) {
            this.addDependency(normalizedFile, resolvedPath);
          } else {
            // 无法解析时，存储原始路径用于模糊匹配
            this._addFuzzyDependency(normalizedFile, imp.source);
          }
        }
      }
    }
  }

  /**
   * 获取受影响的所有文件（使用 BFS）
   * @param {string[]} changedFiles - 变更的文件列表
   * @returns {Set} 受影响的文件集合
   */
  getAffectedFiles(changedFiles) {
    const affected = new Set();
    const queue = [];
    const visited = new Set();

    // 初始化队列
    for (const file of changedFiles) {
      const normalized = normalizePath(file);
      if (!visited.has(normalized)) {
        visited.add(normalized);
        queue.push(normalized);
        affected.add(file); // 保留原始路径格式
      }
    }

    // BFS 遍历反向依赖
    while (queue.length > 0) {
      const current = queue.shift();

      // 精确匹配
      const dependents = this.reverseDeps.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
            affected.add(dep);
          }
        }
      }

      // 模糊匹配（处理路径解析失败的情况）
      const fuzzyMatches = this._findFuzzyMatches(current);
      for (const match of fuzzyMatches) {
        if (!visited.has(match)) {
          visited.add(match);
          queue.push(match);
          affected.add(match);
        }
      }
    }

    return affected;
  }

  /**
   * 清空依赖图
   */
  clear() {
    this.forwardDeps.clear();
    this.reverseDeps.clear();
    this.pathIndex.clear();
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      totalFiles: this.forwardDeps.size,
      totalDependencies: Array.from(this.forwardDeps.values())
        .reduce((sum, deps) => sum + deps.size, 0),
      reverseDepsCount: this.reverseDeps.size,
    };
  }

  /**
   * 更新路径索引
   * @private
   */
  _updatePathIndex(normalizedPath) {
    // 提取文件名部分用于索引
    const parts = normalizedPath.split(PATH_SEP);
    const fileName = parts[parts.length - 1];
    
    if (!this.pathIndex.has(fileName)) {
      this.pathIndex.set(fileName, new Set());
    }
    this.pathIndex.get(fileName).add(normalizedPath);
  }

  /**
   * 解析导入路径
   * @private
   */
  _resolveImportPath(importSource, fromFile, _srcDir) {
    if (!importSource || !importSource.startsWith('.')) {
      return null;
    }

    try {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, importSource);
      
      // 尝试各种可能的扩展名
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.vue'];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        if (require('fs').existsSync(withExt)) {
          return normalizePath(withExt);
        }
      }
      
      // 尝试 index 文件
      for (const ext of extensions) {
        const indexPath = path.join(resolved, 'index' + ext);
        if (require('fs').existsSync(indexPath)) {
          return normalizePath(indexPath);
        }
      }
    } catch {
      // 忽略解析错误
    }

    return null;
  }

  /**
   * 通过路径推导解析导入路径（用于测试环境或虚拟文件路径）
   * @private
   */
  _resolveByPathInference(importSource, fromFile, allFiles) {
    if (!importSource || !importSource.startsWith('.')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    const resolved = normalizePath(path.resolve(fromDir, importSource));

    // 尝试精确匹配
    for (const ext of SOURCE_EXTENSIONS) {
      const withExt = resolved + ext;
      if (allFiles.has(withExt)) {
        return withExt;
      }
    }

    // 尝试 index 文件
    for (const ext of SOURCE_EXTENSIONS) {
      const indexPath = resolved + '/index' + ext;
      if (allFiles.has(indexPath)) {
        return indexPath;
      }
    }

    // 尝试在已知文件中查找匹配
    for (const knownFile of allFiles) {
      if (knownFile === resolved || knownFile.startsWith(resolved + '.')) {
        return knownFile;
      }
    }

    // 如果仍然找不到，返回推导出的路径（即使不在 allFiles 中）
    // 这对于处理变更文件不在 imports Map 中的情况很重要
    // 默认使用 .js 扩展名
    return resolved + '.js';
  }

  /**
   * 添加模糊依赖（用于路径解析失败时的回退匹配）
   * @private
   */
  _addFuzzyDependency(from, importSource) {
    // 提取导入路径的文件名部分
    const fileName = importSource.split('/').pop();
    if (fileName && this.pathIndex.has(fileName)) {
      const candidates = this.pathIndex.get(fileName);
      for (const candidate of candidates) {
        this.addDependency(from, candidate);
      }
    }
  }

  /**
   * 查找模糊匹配
   * @private
   */
  _findFuzzyMatches(normalizedPath) {
    const matches = new Set();
    const fileName = normalizedPath.split(PATH_SEP).pop();

    if (fileName && this.pathIndex.has(fileName)) {
      const candidates = this.pathIndex.get(fileName);
      for (const candidate of candidates) {
        if (candidate !== normalizedPath && candidate.endsWith(fileName)) {
          matches.add(candidate);
        }
      }
    }

    return matches;
  }
}

// 全局依赖图实例（支持跨调用缓存）
let globalDependencyGraph = null;

/**
 * 获取或创建依赖图实例
 * @returns {DependencyGraph} 依赖图实例
 */
function getDependencyGraph() {
  if (!globalDependencyGraph) {
    globalDependencyGraph = new DependencyGraph();
  }
  return globalDependencyGraph;
}

/**
 * 重置依赖图（用于测试或强制重建）
 */
function resetDependencyGraph() {
  if (globalDependencyGraph) {
    globalDependencyGraph.clear();
  }
  globalDependencyGraph = null;
}

/**
 * 自动检测默认分支名称
 * 检测顺序：origin/HEAD -> main -> master
 * @param {string} srcDir - 源代码目录
 * @returns {Object} 检测结果 { branch: string|null, detected: boolean, reason: string }
 */
function detectDefaultBranch(srcDir) {
  // 尝试通过 origin/HEAD 获取默认分支
  try {
    const headRef = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
      cwd: srcDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // refs/remotes/origin/main -> main
    const branch = headRef.replace(/^refs\/remotes\/origin\//, '');
    return {
      branch,
      detected: true,
      reason: `通过 origin/HEAD 自动检测到默认分支: ${branch}`,
    };
  } catch {
    // 继续尝试其他方式
  }

  // 尝试检查 main 分支是否存在
  const commonBranches = ['main', 'master'];
  for (const branch of commonBranches) {
    try {
      // 检查本地或远程是否存在该分支
      execSync(`git rev-parse --verify ${branch}`, {
        cwd: srcDir,
        stdio: 'pipe',
      });
      return {
        branch,
        detected: true,
        reason: `检测到常见分支名称: ${branch}`,
      };
    } catch {
      // 尝试检查远程分支
      try {
        execSync(`git rev-parse --verify origin/${branch}`, {
          cwd: srcDir,
          stdio: 'pipe',
        });
        return {
          branch,
          detected: true,
          reason: `检测到远程分支: origin/${branch}`,
        };
      } catch {
        // 继续尝试下一个
      }
    }
  }

  return {
    branch: null,
    detected: false,
    reason: '无法自动检测默认分支，请使用 --base-branch 手动指定',
  };
}

/**
 * 检查分支是否存在
 * @param {string} srcDir - 源代码目录
 * @param {string} branch - 分支名称
 * @returns {boolean} 分支是否存在
 */
function branchExists(srcDir, branch) {
  try {
    execSync(`git rev-parse --verify ${branch}`, {
      cwd: srcDir,
      stdio: 'pipe',
    });
    return true;
  } catch {
    try {
      execSync(`git rev-parse --verify origin/${branch}`, {
        cwd: srcDir,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 获取 Git 变更的文件列表
 * @param {string} srcDir - 源代码目录
 * @param {string} baseBranch - 基准分支（可选，不提供则自动检测）
 * @returns {Object} 结果对象 { files: string[]|null, branch: string, autoDetected: boolean, fallback: boolean, reason: string }
 */
function getChangedFiles(srcDir, baseBranch = null) {
  // 检查是否在 Git 仓库中
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: srcDir, stdio: 'pipe' });
  } catch {
    return {
      files: null,
      branch: null,
      autoDetected: false,
      fallback: true,
      reason: '当前目录不是 Git 仓库',
    };
  }

  let targetBranch = baseBranch;
  let autoDetected = false;

  // 如果没有指定基准分支，尝试自动检测
  if (!targetBranch) {
    const detection = detectDefaultBranch(srcDir);
    if (detection.detected) {
      targetBranch = detection.branch;
      autoDetected = true;
    } else {
      return {
        files: null,
        branch: null,
        autoDetected: false,
        fallback: true,
        reason: detection.reason,
      };
    }
  }

  // 验证分支是否存在
  if (!branchExists(srcDir, targetBranch)) {
    return {
      files: null,
      branch: targetBranch,
      autoDetected,
      fallback: true,
      reason: `分支 "${targetBranch}" 不存在`,
    };
  }

  try {
    const changedFiles = execSync(
      `git diff --name-only --diff-filter=ACMR ${targetBranch}...HEAD`,
      { cwd: srcDir, encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .filter(file => file.length > 0);

    const srcPath = path.basename(srcDir);
    const filteredFiles = changedFiles.filter(file => {
      const ext = path.extname(file);
      return (
        SOURCE_EXTENSIONS.has(ext) &&
        (file.startsWith(srcPath + '/') || file.startsWith(srcPath + '\\'))
      );
    });

    return {
      files: filteredFiles,
      branch: targetBranch,
      autoDetected,
      fallback: false,
      reason: autoDetected
        ? `自动检测到基准分支: ${targetBranch}`
        : `使用指定基准分支: ${targetBranch}`,
    };
  } catch (error) {
    return {
      files: null,
      branch: targetBranch,
      autoDetected,
      fallback: true,
      reason: `获取 Git 变更失败: ${error.message}`,
    };
  }
}

/**
 * 获取未提交的变更文件
 * @param {string} srcDir - 源代码目录
 * @returns {string[]|null} 未提交变更的文件列表
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
 * 分析变更文件的依赖关系（优化版本）
 * @param {string[]} changedFiles - 变更的文件列表
 * @param {Map} imports - 所有导入映射
 * @param {string} [srcDir] - 源代码目录（可选，用于路径解析）
 * @returns {Set} 受影响的文件集合
 */
function analyzeAffectedFiles(changedFiles, imports, srcDir) {
  if (!changedFiles || changedFiles.length === 0) {
    return new Set();
  }

  // 使用优化的依赖图
  const depGraph = getDependencyGraph();
  depGraph.buildFromImports(imports, srcDir);
  
  return depGraph.getAffectedFiles(changedFiles);
}

/**
 * 创建路径匹配集合（用于快速查找）
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Set} 规范化后的路径集合
 */
function createNormalizedSet(affectedFiles) {
  const normalized = new Set();
  for (const file of affectedFiles) {
    normalized.add(normalizePath(file));
  }
  return normalized;
}

/**
 * 通用过滤函数
 * @param {Array} items - 待过滤的列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @param {Function} getPath - 获取文件路径的函数
 * @returns {Array} 过滤后的列表
 */
function filterByAffectedFiles(items, affectedFiles, getPath) {
  if (!items || items.length === 0) {
    return [];
  }

  const normalizedAffected = createNormalizedSet(affectedFiles);
  
  return items.filter(item => {
    const itemPath = normalizePath(getPath(item));
    return normalizedAffected.has(itemPath);
  });
}

/**
 * 过滤导出结果，只保留受影响文件的导出
 * @param {Array} unusedExports - 未使用的导出列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用导出列表
 */
function filterUnusedExports(unusedExports, affectedFiles) {
  return filterByAffectedFiles(unusedExports, affectedFiles, exp => exp.file);
}

/**
 * 过滤组件结果，只保留受影响文件的组件
 * @param {Array} unusedComponents - 未使用的组件列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用组件列表
 */
function filterUnusedComponents(unusedComponents, affectedFiles) {
  return filterByAffectedFiles(unusedComponents, affectedFiles, comp => comp.file);
}

/**
 * 过滤工具文件结果，只保留受影响的工具文件
 * @param {Array} unusedToolFiles - 未使用的工具文件列表
 * @param {Set} affectedFiles - 受影响的文件集合
 * @returns {Array} 过滤后的未使用工具文件列表
 */
function filterUnusedToolFiles(unusedToolFiles, affectedFiles) {
  if (!unusedToolFiles) return [];
  return filterByAffectedFiles(unusedToolFiles, affectedFiles, file => file);
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
    this.dependencyGraph = new DependencyGraph();
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

  /**
   * 分析受影响的文件（使用实例级依赖图）
   * @param {string[]} changedFiles - 变更的文件列表
   * @param {Map} imports - 导入映射
   * @returns {Set} 受影响的文件集合
   */
  analyzeAffectedFiles(changedFiles, imports) {
    this.dependencyGraph.buildFromImports(imports, this.srcDir);
    return this.dependencyGraph.getAffectedFiles(changedFiles);
  }

  /**
   * 获取依赖图统计信息
   * @returns {Object} 统计信息
   */
  getDependencyStats() {
    return this.dependencyGraph.getStats();
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
  detectDefaultBranch,
  branchExists,
  createIncrementalCache,
  analyzeFileWithCache,
  analyzeFilesWithCache,
  getCacheStats,
  clearCache,
  IncrementalAnalyzer,
  CacheManager,
  DependencyGraph,
  normalizePath,
  getDependencyGraph,
  resetDependencyGraph,
};
