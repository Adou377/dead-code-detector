/**
 * 工具函数
 */

const path = require('path');

const MAX_FILE_SIZE_10MB = 10 * 1024 * 1024;

/**
 * 验证配置选项
 * @param {Object} options - 配置选项
 * @param {string} options.srcDir - 源代码目录
 * @param {number} [options.concurrency] - 并发数
 * @param {number} [options.maxFileSize] - 最大文件大小
 * @throws {Error} 验证失败时抛出错误
 */
function validateOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('配置选项必须是一个对象');
  }

  const { srcDir, concurrency, maxFileSize } = options;

  if (srcDir !== undefined) {
    if (typeof srcDir !== 'string' || srcDir.trim() === '') {
      throw new Error('srcDir 必须是非空字符串');
    }

    const normalizedPath = path.normalize(srcDir);
    if (normalizedPath.includes('\0')) {
      throw new Error('srcDir 包含非法字符');
    }

    if (!path.isAbsolute(normalizedPath) && !normalizedPath.startsWith('.')) {
      try {
        path.resolve(normalizedPath);
      } catch {
        throw new Error(`srcDir 路径格式无效: ${srcDir}`);
      }
    }
  }

  if (concurrency !== undefined) {
    if (typeof concurrency !== 'number' || !Number.isInteger(concurrency)) {
      throw new Error('concurrency 必须是整数');
    }
    if (concurrency < 1 || concurrency > 1000) {
      throw new Error('concurrency 必须在 1 到 1000 之间');
    }
  }

  if (maxFileSize !== undefined) {
    if (typeof maxFileSize !== 'number' || isNaN(maxFileSize)) {
      throw new Error('maxFileSize 必须是数字');
    }
    if (maxFileSize < 0 || maxFileSize > MAX_FILE_SIZE_10MB) {
      throw new Error('maxFileSize 必须在 0 到 10MB 之间');
    }
  }
}

/**
 * 检测路径是否包含路径遍历字符
 * 用于在路径规范化之前进行早期检测
 * @param {string} inputPath - 输入路径
 * @returns {boolean} - 如果包含路径遍历字符返回 true
 */
function hasPathTraversal(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return false;
  }

  const traversalPatterns = [
    /\.\./,           // 匹配 ..
    /\.\.%2[fF]/,     // URL 编码的 ../
    /\.\.%5[cC]/,     // URL 编码的 ..\
    /%2[eE]%2[eE]/,   // URL 编码的 ..
    /\.\.\//,         // 匹配 ../
    /\.\.\\/,         // 匹配 ..\
  ];

  return traversalPatterns.some(pattern => pattern.test(inputPath));
}

/**
 * 验证路径是否在安全范围内
 * 防止路径遍历攻击，确保目标路径在基础路径内
 * @param {string} basePath - 基础路径（源目录）
 * @param {string} targetPath - 目标路径
 * @returns {boolean} - 如果目标路径在基础路径内返回 true
 */
function isSafePath(basePath, targetPath) {
  if (!basePath || !targetPath) {
    return false;
  }

  // 规范化路径，处理 .. 和 . 以及不同操作系统的路径分隔符
  const normalizedBase = path.normalize(basePath);
  const normalizedTarget = path.normalize(targetPath);

  // 确保基础路径以分隔符结尾，避免部分匹配
  // 例如：/app/src 不应匹配 /app/src-backup
  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  // 检查目标路径是否以基础路径开头
  // 目标路径等于基础路径也被认为是安全的
  return (
    normalizedTarget === normalizedBase ||
    normalizedTarget.startsWith(baseWithSep)
  );
}

/**
 * 规范化路径：将反斜杠转换为正斜杠，并检测路径遍历攻击
 * @param {string} p - 路径
 * @param {Object} options - 配置选项
 * @param {boolean} [options.detectTraversal=false] - 是否检测路径遍历攻击
 * @param {string} [options.basePath] - 基础路径，用于验证路径安全性
 * @returns {Object|string} - 返回规范化后的路径字符串，或包含路径和安全性检查结果的对象
 */
function normalizePath(p, options = {}) {
  const { detectTraversal = false, basePath = null } = options;

  const normalized = p.replace(/\\/g, '/');

  if (detectTraversal) {
    const hasTraversal = hasPathTraversal(p);

    if (hasTraversal && basePath) {
      const isSafe = isSafePath(basePath, p);
      return {
        path: normalized,
        hasTraversal,
        isSafe,
      };
    }

    return {
      path: normalized,
      hasTraversal,
      isSafe: !hasTraversal,
    };
  }

  return normalized;
}

/**
 * 解析命令行参数
 * @param {string[]} args - 命令行参数
 * @returns {Object} 解析后的参数
 */
function parseArgs(args) {
  const result = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--src' || arg === '-s') {
      result.src = args[++i];
    } else if (arg === '--ext' || arg === '-e') {
      result.ext = args[++i];
    } else if (arg === '--ignore' || arg === '-i') {
      result.ignore = args[++i];
    } else if (arg === '--fix') {
      result.fix = true;
    } else if (arg === '--verbose') {
      result.verbose = true;
    } else if (arg === '--mode') {
      result.mode = args[++i];
    } else if (arg === '--maxFileSize') {
      result.maxFileSize = parseInt(args[++i], 10);
    } else if (arg === '--concurrency') {
      result.concurrency = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

/**
 * 并发处理项目，控制并发数量
 * @param {Object} options - 配置选项
 * @param {Array} options.items - 要处理的项目
 * @param {Function} options.processor - 异步处理函数
 * @param {number} [options.concurrency=50] - 最大并发操作数
 * @param {Function} [options.onProgress=null] - 进度回调
 * @param {number} [options.progressInterval=50] - 进度更新间隔
 * @returns {Promise<Array>} 结果
 */
async function processParallel(options) {
  let items, processor, concurrency, onProgress, progressInterval;

  if (Array.isArray(options)) {
    items = options;
    processor = arguments[1];
    concurrency = arguments[2] !== undefined ? arguments[2] : 50;
    onProgress = arguments[3] !== undefined ? arguments[3] : null;
    progressInterval = arguments[4] !== undefined ? arguments[4] : 50;
  } else {
    items = options.items;
    processor = options.processor;
    concurrency = options.concurrency !== undefined ? options.concurrency : 50;
    onProgress = options.onProgress !== undefined ? options.onProgress : null;
    progressInterval = options.progressInterval !== undefined ? options.progressInterval : 50;
  }

  const results = [];
  const total = items.length;
  let completed = 0;
  let lastProgress = 0;

  for (let i = 0; i < total; i += concurrency) {
    const batch = items.slice(i, Math.min(i + concurrency, total));
    const batchResults = await Promise.all(
      batch.map(async (item, index) => {
        try {
          return await processor(item, i + index);
        } catch (error) {
          console.warn(`⚠️  处理失败: ${item}`);
          console.warn(`   错误信息: ${error.message}`);
          if (error.stack) {
            console.warn(`   错误堆栈: ${error.stack.split('\n')[1]?.trim()}`);
          }
          return null;
        }
      })
    );

    results.push(...batchResults.filter(r => r !== null));
    completed += batch.length;

    if (onProgress && (completed - lastProgress >= progressInterval || completed === total)) {
      onProgress(completed, total);
      lastProgress = completed;
    }
  }

  return results;
}

/**
 * 打印进度条
 * @param {number} current - 当前计数
 * @param {number} total - 总计数
 * @param {string} prefix - 前缀文本
 */
function printProgress(current, total, prefix = '') {
  // 处理总数为 0 的情况（没有项目需要处理）
  if (total === 0) {
    const barWidth = 30;
    const bar = '░'.repeat(barWidth);
    process.stdout.write(`\r${prefix} [${bar}] 0% (0/0)`);
    process.stdout.write('\n');
    return;
  }

  const percentage = Math.round((current / total) * 100);
  const barWidth = 30;
  const filled = Math.round((barWidth * current) / total);
  const empty = barWidth - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r${prefix} [${bar}] ${percentage}% (${current}/${total})`);

  if (current === total) {
    process.stdout.write('\n');
  }
}

/**
 * 性能统计收集器
 * 用于收集和报告分析过程中的性能数据
 */
class PerformanceStats {
  constructor() {
    this.startTime = 0;
    this.endTime = 0;
    this.fileCount = 0;
    this.exportCount = 0;
    this.componentCount = 0;
    this.memoryPeak = 0;
    this._memoryInterval = null;
  }

  /**
   * 开始性能监控
   */
  start() {
    this.startTime = Date.now();
    this._startMemoryMonitoring();
  }

  /**
   * 结束性能监控
   */
  end() {
    this.endTime = Date.now();
    this._stopMemoryMonitoring();
    this._updateMemoryPeak();
  }

  /**
   * 记录文件数量
   * @param {number} count - 文件数量，默认为 1
   */
  recordFile(count = 1) {
    this.fileCount += count;
  }

  /**
   * 记录导出数量
   * @param {number} count - 导出数量，默认为 1
   */
  recordExport(count = 1) {
    this.exportCount += count;
  }

  /**
   * 记录组件数量
   * @param {number} count - 组件数量，默认为 1
   */
  recordComponent(count = 1) {
    this.componentCount += count;
  }

  /**
   * 获取分析耗时（毫秒）
   * @returns {number}
   */
  getElapsedTime() {
    return this.endTime - this.startTime;
  }

  /**
   * 获取格式化的耗时字符串
   * @returns {string}
   */
  getFormattedTime() {
    const elapsed = this.getElapsedTime();
    if (elapsed < 1000) {
      return `${elapsed}ms`;
    }
    return `${(elapsed / 1000).toFixed(2)}s`;
  }

  /**
   * 获取当前内存使用量（MB）
   * @returns {number}
   */
  getCurrentMemory() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * 获取性能统计报告
   * @returns {Object}
   */
  getReport() {
    return {
      fileCount: this.fileCount,
      exportCount: this.exportCount,
      componentCount: this.componentCount,
      elapsedTime: this.getElapsedTime(),
      formattedTime: this.getFormattedTime(),
      memoryPeak: this.memoryPeak,
    };
  }

  /**
   * 打印性能统计报告
   */
  printReport() {
    console.log('\n📊 性能统计报告');
    console.log('─'.repeat(40));
    console.log(`📁 文件数量: ${this.fileCount}`);
    console.log(`📦 导出数量: ${this.exportCount}`);
    console.log(`🧩 组件数量: ${this.componentCount}`);
    console.log(`⏱️  分析耗时: ${this.getFormattedTime()}`);
    console.log(`💾 内存峰值: ${this.memoryPeak}MB`);
    console.log('─'.repeat(40));
  }

  /**
   * 启动内存监控
   * @private
   */
  _startMemoryMonitoring() {
    this._updateMemoryPeak();
    this._memoryInterval = setInterval(() => {
      this._updateMemoryPeak();
    }, 500);
  }

  /**
   * 停止内存监控
   * @private
   */
  _stopMemoryMonitoring() {
    if (this._memoryInterval) {
      clearInterval(this._memoryInterval);
      this._memoryInterval = null;
    }
  }

  /**
   * 更新内存峰值
   * @private
   */
  _updateMemoryPeak() {
    const current = this.getCurrentMemory();
    if (current > this.memoryPeak) {
      this.memoryPeak = current;
    }
  }
}

/**
 * 内存监控器
 * 用于监控内存使用，防止内存溢出
 */
class MemoryMonitor {
  /**
   * @param {Object} options - 配置选项
   * @param {number} [options.warningThreshold=500] - 警告阈值（MB）
   * @param {number} [options.criticalThreshold=800] - 临界阈值（MB）
   * @param {Function} [options.onWarning] - 警告回调
   */
  constructor(options = {}) {
    this.warningThreshold = options.warningThreshold || 500;
    this.criticalThreshold = options.criticalThreshold || 800;
    this.onWarning = options.onWarning || this._defaultWarning;
    this.checkCount = 0;
    this.warningCount = 0;
  }

  /**
   * 获取当前内存使用量（MB）
   * @returns {number}
   */
  getCurrentMemory() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * 检查内存阈值
   * @returns {Object} 检查结果
   */
  checkThreshold() {
    this.checkCount++;
    const currentMemory = this.getCurrentMemory();
    const result = {
      memoryMB: currentMemory,
      isWarning: false,
      isCritical: false,
    };

    if (currentMemory > this.criticalThreshold) {
      result.isCritical = true;
      const error = new Error(`内存使用超过临界阈值: ${currentMemory}MB > ${this.criticalThreshold}MB`);
      error.memoryMB = currentMemory;
      error.threshold = this.criticalThreshold;
      throw error;
    }

    if (currentMemory > this.warningThreshold) {
      result.isWarning = true;
      this.warningCount++;
      this.onWarning(currentMemory, this.warningThreshold);
    }

    return result;
  }

  /**
   * 安全检查（不抛出错误）
   * @returns {Object} 检查结果
   */
  safeCheck() {
    try {
      return this.checkThreshold();
    } catch (error) {
      return {
        memoryMB: error.memoryMB,
        isWarning: true,
        isCritical: true,
        error: error.message,
      };
    }
  }

  /**
   * 获取内存统计
   * @returns {Object}
   */
  getStats() {
    return {
      currentMemoryMB: this.getCurrentMemory(),
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      checkCount: this.checkCount,
      warningCount: this.warningCount,
    };
  }

  /**
   * 默认警告处理
   * @param {number} currentMemory - 当前内存
   * @param {number} threshold - 阈值
   * @private
   */
  _defaultWarning(currentMemory, threshold) {
    console.warn(`⚠️  内存警告: 当前内存 ${currentMemory}MB 超过警告阈值 ${threshold}MB`);
  }
}

module.exports = {
  normalizePath,
  parseArgs,
  processParallel,
  printProgress,
  isSafePath,
  hasPathTraversal,
  PerformanceStats,
  validateOptions,
  MemoryMonitor,
};
