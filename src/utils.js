/**
 * 工具函数
 */

const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE_10MB = 10 * 1024 * 1024;

/**
 * 预编译的路径遍历检测正则表达式
 * 避免每次调用时重复创建正则表达式对象
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./,
  /\.\.%2[fF]/,
  /\.\.%5[cC]/,
  /%2[eE]%2[eE]/,
  /\.\.\//,
  /\.\.\\/,
];

/**
 * 验证配置选项
 * @param {Object} options - 配置选项
 * @param {string} options.srcDir - 源代码目录
 * @param {number} [options.concurrency] - 并发数
 * @param {number} [options.maxFileSize] - 最大文件大小
 * @throws {Error} 验证失败时抛出错误
 */
function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
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

  return PATH_TRAVERSAL_PATTERNS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(inputPath);
  });
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

  const normalizedBase = path.normalize(basePath);
  const normalizedTarget = path.normalize(targetPath);

  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

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
 * 统一文件读取结果
 * @typedef {Object} FileReadResult
 * @property {boolean} success - 是否成功
 * @property {string|Buffer|null} content - 文件内容
 * @property {Error|null} error - 错误信息
 */

/**
 * 读取文件内容为字符串
 * @param {string} filePath - 文件路径
 * @param {Object} options - 配置选项
 * @param {string} [options.encoding='utf-8'] - 文件编码
 * @returns {FileReadResult} 读取结果
 */
function readFileContent(filePath, options = {}) {
  const { encoding = 'utf-8' } = options;

  try {
    const content = fs.readFileSync(filePath, encoding);
    return { success: true, content, error: null };
  } catch (error) {
    return { success: false, content: null, error };
  }
}

/**
 * 读取文件为 Buffer
 * @param {string} filePath - 文件路径
 * @returns {FileReadResult} 读取结果
 */
function readFileBuffer(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return { success: true, content, error: null };
  } catch (error) {
    return { success: false, content: null, error };
  }
}

/**
 * 读取并解析 JSON 文件
 * @param {string} filePath - JSON 文件路径
 * @returns {Object} 包含 success, data, error 的结果对象
 */
function readJsonFile(filePath) {
  const result = readFileContent(filePath);

  if (!result.success) {
    return { success: false, data: null, error: result.error };
  }

  try {
    const data = JSON.parse(result.content);
    return { success: true, data, error: null };
  } catch (error) {
    return { success: false, data: null, error };
  }
}

/**
 * 性能统计收集器
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

  start() {
    this.startTime = Date.now();
    this._startMemoryMonitoring();
  }

  end() {
    this.endTime = Date.now();
    this._stopMemoryMonitoring();
    this._updateMemoryPeak();
  }

  recordFile(count = 1) {
    this.fileCount += count;
  }

  recordExport(count = 1) {
    this.exportCount += count;
  }

  recordComponent(count = 1) {
    this.componentCount += count;
  }

  getElapsedTime() {
    return this.endTime - this.startTime;
  }

  getFormattedTime() {
    const elapsed = this.getElapsedTime();
    if (elapsed < 1000) {
      return `${elapsed}ms`;
    }
    return `${(elapsed / 1000).toFixed(2)}s`;
  }

  getCurrentMemory() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

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

  _startMemoryMonitoring() {
    this._updateMemoryPeak();
    this._memoryInterval = setInterval(() => {
      this._updateMemoryPeak();
    }, 500);
  }

  _stopMemoryMonitoring() {
    if (this._memoryInterval) {
      clearInterval(this._memoryInterval);
      this._memoryInterval = null;
    }
  }

  _updateMemoryPeak() {
    const current = this.getCurrentMemory();
    if (current > this.memoryPeak) {
      this.memoryPeak = current;
    }
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
  readFileContent,
  readFileBuffer,
  readJsonFile,
};
