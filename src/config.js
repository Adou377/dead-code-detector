/**
 * 配置文件读取模块
 * 支持读取 .deadcoderc.json 配置文件
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE } = require('./constants.js');

/**
 * 验证配置对象
 * @param {Object} config - 配置对象
 * @throws {Error} 配置验证失败时抛出错误
 */
function validateConfig(config) {
  const errors = [];

  // 验证 srcDir: 检查目录是否存在
  if (config.srcDir && !fs.existsSync(config.srcDir)) {
    errors.push(`srcDir: 目录不存在 "${config.srcDir}"`);
  }

  // 验证 extensions: 检查是否为数组，且每个元素是有效的文件扩展名
  if (config.extensions) {
    if (!Array.isArray(config.extensions)) {
      errors.push('extensions: 必须是数组');
    } else {
      const invalidExts = config.extensions.filter(ext => typeof ext !== 'string' || !ext.startsWith('.'));
      if (invalidExts.length > 0) {
        errors.push(`extensions: 扩展名必须以 "." 开头，无效项: ${invalidExts.join(', ')}`);
      }
    }
  }

  // 验证 ignoreDirs: 检查是否为数组
  if (config.ignoreDirs !== undefined && !Array.isArray(config.ignoreDirs)) {
    errors.push('ignoreDirs: 必须是数组');
  }

  // 验证 mode: 检查值是否为 'ast' 或 'regex'
  if (config.mode && !['ast', 'regex'].includes(config.mode)) {
    errors.push(`mode: 必须是 "ast" 或 "regex"，当前值: "${config.mode}"`);
  }

  // 验证 maxFileSize: 检查是否为正整数
  if (config.maxFileSize !== undefined) {
    if (!Number.isInteger(config.maxFileSize) || config.maxFileSize <= 0) {
      errors.push(`maxFileSize: 必须是正整数，当前值: ${config.maxFileSize}`);
    }
  }

  // 验证 concurrency: 检查是否为正整数
  if (config.concurrency !== undefined) {
    if (!Number.isInteger(config.concurrency) || config.concurrency <= 0) {
      errors.push(`concurrency: 必须是正整数，当前值: ${config.concurrency}`);
    }
  }

  // 如果有错误，抛出合并后的错误信息
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
          const content = fs.readFileSync(filePath, 'utf-8');
          config = JSON.parse(content);
        } else {
          // 对于 JS 配置文件，清除缓存后重新 require
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
};
