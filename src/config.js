/**
 * 配置文件读取模块
 * 支持读取 .deadcoderc.json 配置文件
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE } = require('./constants.js');
const { readJsonFile } = require('./utils.js');

/**
 * 配置项限制常量
 */
const CONFIG_LIMITS = {
  MAX_FILE_SIZE_10MB: 10 * 1024 * 1024,
  MAX_CONCURRENCY: 1000,
  MIN_CONCURRENCY: 1,
  MIN_FILE_SIZE: 0,
};

/**
 * 验证 srcDir 配置项
 * @param {string} srcDir - 源目录路径
 * @param {string[]} errors - 错误信息数组
 */
function validateSrcDir(srcDir, errors) {
  if (srcDir === undefined) return;

  if (typeof srcDir !== 'string' || srcDir.trim() === '') {
    errors.push('srcDir: 必须是非空字符串');
    return;
  }

  const normalizedPath = path.normalize(srcDir);
  if (normalizedPath.includes('\0')) {
    errors.push('srcDir: 包含非法字符');
    return;
  }

  if (!path.isAbsolute(normalizedPath) && !normalizedPath.startsWith('.')) {
    try {
      path.resolve(normalizedPath);
    } catch {
      errors.push(`srcDir: 路径格式无效: ${srcDir}`);
      return;
    }
  }

  if (!fs.existsSync(srcDir)) {
    errors.push(`srcDir: 目录不存在 "${srcDir}"`);
  }
}

/**
 * 验证 extensions 配置项
 * @param {string[]} extensions - 文件扩展名数组
 * @param {string[]} errors - 错误信息数组
 */
function validateExtensions(extensions, errors) {
  if (extensions === undefined) return;

  if (!Array.isArray(extensions)) {
    errors.push('extensions: 必须是数组');
    return;
  }

  const invalidExts = extensions.filter(ext => typeof ext !== 'string' || !ext.startsWith('.'));
  if (invalidExts.length > 0) {
    errors.push(`extensions: 扩展名必须以 "." 开头，无效项: ${invalidExts.join(', ')}`);
  }
}

/**
 * 验证 concurrency 配置项
 * @param {number} concurrency - 并发数
 * @param {string[]} errors - 错误信息数组
 */
function validateConcurrency(concurrency, errors) {
  if (concurrency === undefined) return;

  if (typeof concurrency !== 'number' || !Number.isInteger(concurrency)) {
    errors.push('concurrency: 必须是整数');
    return;
  }

  if (concurrency < CONFIG_LIMITS.MIN_CONCURRENCY || concurrency > CONFIG_LIMITS.MAX_CONCURRENCY) {
    errors.push(
      `concurrency: 必须在 ${CONFIG_LIMITS.MIN_CONCURRENCY} 到 ${CONFIG_LIMITS.MAX_CONCURRENCY} 之间`
    );
  }
}

/**
 * 验证 maxFileSize 配置项
 * @param {number} maxFileSize - 最大文件大小
 * @param {string[]} errors - 错误信息数组
 */
function validateMaxFileSize(maxFileSize, errors) {
  if (maxFileSize === undefined) return;

  if (typeof maxFileSize !== 'number' || isNaN(maxFileSize)) {
    errors.push('maxFileSize: 必须是数字');
    return;
  }

  if (maxFileSize < CONFIG_LIMITS.MIN_FILE_SIZE || maxFileSize > CONFIG_LIMITS.MAX_FILE_SIZE_10MB) {
    errors.push(`maxFileSize: 必须在 ${CONFIG_LIMITS.MIN_FILE_SIZE} 到 10MB 之间`);
  }
}

/**
 * 验证配置对象
 * @param {Object} config - 配置对象
 * @throws {Error} 配置验证失败时抛出错误
 */
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('配置选项必须是一个对象');
  }

  const errors = [];

  validateSrcDir(config.srcDir, errors);
  validateExtensions(config.extensions, errors);
  validateConcurrency(config.concurrency, errors);
  validateMaxFileSize(config.maxFileSize, errors);

  if (config.ignoreDirs !== undefined && !Array.isArray(config.ignoreDirs)) {
    errors.push('ignoreDirs: 必须是数组');
  }

  if (config.mode && !['ast', 'regex'].includes(config.mode)) {
    errors.push(`mode: 必须是 "ast" 或 "regex"，当前值: "${config.mode}"`);
  }

  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n  - ${errors.join('\n  - ')}`);
  }
}

// 配置文件缓存
const configCache = new Map();
// 缓存大小限制（防止内存泄漏）
const MAX_CACHE_SIZE = 10;

/**
 * 尝试读取配置文件
 * @param {string} configPath - 配置文件路径（可选）
 * @returns {Object|null} 配置对象或 null
 */
function loadConfig(configPath) {
  const cwd = process.cwd();
  const possibleConfigPaths = [
    configPath,
    path.join(cwd, '.deadcoderc.json'),
    path.join(cwd, '.deadcoderc.js'),
    path.join(cwd, 'deadcode.config.js'),
  ].filter(Boolean);

  for (const filePath of possibleConfigPaths) {
    // 检查缓存
    if (configCache.has(filePath)) {
      return configCache.get(filePath);
    }

    if (fs.existsSync(filePath)) {
      try {
        let config;
        if (filePath.endsWith('.json')) {
          const result = readJsonFile(filePath);
          if (!result.success) {
            throw result.error;
          }
          config = result.data;
        } else {
          delete require.cache[require.resolve(filePath)];
          config = require(filePath);
        }

        // 更新缓存
        if (configCache.size >= MAX_CACHE_SIZE) {
          // 删除最早的缓存项
          const firstKey = configCache.keys().next().value;
          configCache.delete(firstKey);
        }
        configCache.set(filePath, config);

        return config;
      } catch (error) {
        console.warn(`⚠️  读取配置文件 ${filePath} 失败: ${error.message}`);
      }
    }
  }

  return null;
}

/**
 * 默认最大文件大小（1MB）
 * @constant {number}
 */
const DEFAULT_MAX_FILE_SIZE = 1000000;

/**
 * 默认最大并发数
 * @constant {number}
 */
const DEFAULT_CONCURRENCY = 50;

/**
 * 合并配置：命令行参数 > 配置文件 > 默认值
 * @param {Object} cliArgs - 命令行参数
 * @param {Object} configFile - 配置文件内容
 * @returns {Object} 合并后的配置
 */
function mergeConfig(cliArgs, configFile) {
  const defaults = {
    srcDir: path.join(process.cwd(), 'src'),
    extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
    ignoreDirs: ['node_modules', 'dist', '.git'],
    mode: DEFAULT_MODE,
    fix: false,
    verbose: false,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
  };

  const config = { ...defaults };

  if (configFile) {
    if (configFile.srcDir) config.srcDir = configFile.srcDir;
    if (configFile.extensions) {
      config.extensions = Array.isArray(configFile.extensions)
        ? configFile.extensions
        : configFile.extensions.split(',');
    }
    if (configFile.ignoreDirs) {
      config.ignoreDirs = Array.isArray(configFile.ignoreDirs)
        ? configFile.ignoreDirs
        : configFile.ignoreDirs.split(',');
    }
    if (configFile.mode) config.mode = configFile.mode;
    if (configFile.fix !== undefined) config.fix = configFile.fix;
    if (configFile.verbose !== undefined) config.verbose = configFile.verbose;
    if (configFile.maxFileSize !== undefined) config.maxFileSize = configFile.maxFileSize;
    if (configFile.concurrency !== undefined) config.concurrency = configFile.concurrency;
  }

  if (cliArgs) {
    if (cliArgs.src) config.srcDir = cliArgs.src;
    if (cliArgs.ext) {
      config.extensions = cliArgs.ext.split(',');
    }
    if (cliArgs.ignore) {
      config.ignoreDirs = cliArgs.ignore.split(',');
    }
    if (cliArgs.mode) config.mode = cliArgs.mode;
    if (cliArgs.fix !== undefined) config.fix = cliArgs.fix;
    if (cliArgs.verbose !== undefined) config.verbose = cliArgs.verbose;
    if (cliArgs.maxFileSize !== undefined) config.maxFileSize = cliArgs.maxFileSize;
    if (cliArgs.concurrency !== undefined) config.concurrency = cliArgs.concurrency;
  }

  // 验证合并后的配置
  validateConfig(config);

  return config;
}

module.exports = {
  loadConfig,
  mergeConfig,
  validateConfig,
  CONFIG_LIMITS,
};
