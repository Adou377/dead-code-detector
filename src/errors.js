/**
 * 错误处理模块
 * 
 * 提供统一的错误类型定义和格式化输出
 */

const { ERROR_CODES } = require('./constants');

/**
 * 死代码检测错误基类
 * 继承自 Error，提供错误码和上下文信息
 */
class DeadCodeError extends Error {
  /**
   * 创建错误实例
   * @param {string} errorCode - 错误码（如 'E001'）
   * @param {string} [customMessage] - 自定义错误消息（覆盖默认消息）
   * @param {Object} [context] - 错误上下文信息
   */
  constructor(errorCode, customMessage, context = {}) {
    const errorDef = ERROR_CODES[errorCode];
    if (!errorDef) {
      throw new Error(`未知的错误码: ${errorCode}`);
    }

    super(customMessage || errorDef.message);
    this.name = this.constructor.name;
    this.code = errorCode;
    this.solution = errorDef.solution;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 获取完整的错误信息
   * @returns {string}
   */
  getFullMessage() {
    return formatError(this);
  }
}

/**
 * 配置错误类
 * 用于配置相关的错误（E001, E002, E009）
 */
class ConfigError extends DeadCodeError {
  constructor(errorCode, customMessage, context) {
    super(errorCode, customMessage, context);
  }
}

/**
 * 解析错误类
 * 用于文件解析相关的错误（E003, E010）
 */
class ParseError extends DeadCodeError {
  constructor(errorCode, customMessage, context) {
    super(errorCode, customMessage, context);
  }
}

/**
 * 修复错误类
 * 用于自动修复相关的错误（E004, E008）
 */
class FixError extends DeadCodeError {
  constructor(errorCode, customMessage, context) {
    super(errorCode, customMessage, context);
  }
}

/**
 * 路径解析错误类
 * 用于路径解析相关的错误（E005, E007）
 */
class PathError extends DeadCodeError {
  constructor(errorCode, customMessage, context) {
    super(errorCode, customMessage, context);
  }
}

/**
 * Git 操作错误类
 * 用于 Git 相关的错误（E006）
 */
class GitError extends DeadCodeError {
  constructor(errorCode, customMessage, context) {
    super(errorCode, customMessage, context);
  }
}

/**
 * 格式化错误输出
 * @param {DeadCodeError|string} error - 错误实例或错误码
 * @param {Object} [context] - 额外的上下文信息
 * @returns {string} 格式化后的错误信息
 */
function formatError(error, context = {}) {
  if (typeof error === 'string') {
    const errorDef = ERROR_CODES[error];
    if (!errorDef) {
      return `未知错误: ${error}`;
    }

    const lines = [
      `[${errorDef.code}] ${errorDef.message}`,
      `解决方案: ${errorDef.solution}`,
    ];

    if (Object.keys(context).length > 0) {
      lines.push('上下文信息:');
      for (const [key, value] of Object.entries(context)) {
        lines.push(`  - ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  if (error instanceof DeadCodeError) {
    const lines = [
      `[${error.code}] ${error.message}`,
      `解决方案: ${error.solution}`,
    ];

    const mergedContext = { ...error.context, ...context };
    if (Object.keys(mergedContext).length > 0) {
      lines.push('上下文信息:');
      for (const [key, value] of Object.entries(mergedContext)) {
        lines.push(`  - ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  return error.message || String(error);
}

/**
 * 创建错误实例的便捷方法
 * @param {string} errorCode - 错误码
 * @param {string} [customMessage] - 自定义消息
 * @param {Object} [context] - 上下文信息
 * @returns {DeadCodeError}
 */
function createError(errorCode, customMessage, context) {
  const errorClasses = {
    E001: ConfigError,
    E002: ConfigError,
    E003: ParseError,
    E004: FixError,
    E005: PathError,
    E006: GitError,
    E007: PathError,
    E008: FixError,
    E009: ConfigError,
    E010: ParseError,
  };

  const ErrorClass = errorClasses[errorCode] || DeadCodeError;
  return new ErrorClass(errorCode, customMessage, context);
}

/**
 * 判断是否为特定类型的错误
 * @param {Error} error - 错误实例
 * @param {string} errorCode - 错误码
 * @returns {boolean}
 */
function isErrorCode(error, errorCode) {
  return error instanceof DeadCodeError && error.code === errorCode;
}

module.exports = {
  DeadCodeError,
  ConfigError,
  ParseError,
  FixError,
  PathError,
  GitError,
  formatError,
  createError,
  isErrorCode,
};
