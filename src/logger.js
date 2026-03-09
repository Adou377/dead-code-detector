/**
 * 日志级别枚举
 * @enum {string}
 */
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent',
};

/**
 * 日志级别优先级
 * @type {Object.<string, number>}
 */
const LOG_LEVEL_PRIORITY = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.SILENT]: 4,
};

/**
 * 日志颜色配置
 * @type {Object.<string, string>}
 */
const LOG_COLORS = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m',
};

const { ERROR_CODES } = require('./constants');
const { formatError, DeadCodeError } = require('./errors');

/**
 * 日志器类
 * 提供统一的日志输出接口，支持不同日志级别和格式化
 */
class Logger {
  /**
   * 创建日志器实例
   * @param {Object} options - 配置选项
   * @param {string} [options.level='info'] - 日志级别
   * @param {boolean} [options.colorize=true] - 是否启用颜色输出
   * @param {boolean} [options.timestamp=true] - 是否显示时间戳
   * @param {string} [options.prefix=''] - 日志前缀
   */
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.colorize = options.colorize !== false;
    this.timestamp = options.timestamp !== false;
    this.prefix = options.prefix || '';
  }

  /**
   * 检查是否应该输出指定级别的日志
   * @param {string} level - 日志级别
   * @returns {boolean}
   * @private
   */
  shouldLog(level) {
    const currentPriority = LOG_LEVEL_PRIORITY[this.level] || 1;
    const messagePriority = LOG_LEVEL_PRIORITY[level] || 1;
    return messagePriority >= currentPriority;
  }

  /**
   * 格式化时间戳
   * @returns {string}
   * @private
   */
  formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * 格式化日志消息
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @returns {string}
   * @private
   */
  formatMessage(level, message) {
    const parts = [];

    if (this.timestamp) {
      parts.push(`[${this.formatTimestamp()}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(message);

    let formatted = parts.join(' ');

    if (this.colorize) {
      const color = LOG_COLORS[level] || LOG_COLORS.reset;
      formatted = `${color}${formatted}${LOG_COLORS.reset}`;
    }

    return formatted;
  }

  /**
   * 输出调试级别日志
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  debug(message, ...args) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message), ...args);
    }
  }

  /**
   * 输出信息级别日志
   * @param {string} message - 日志消息
   * @param {...any} args - 额外参数
   */
  info(message, ...args) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message), ...args);
    }
  }

  /**
   * 输出警告级别日志
   * @param {string} message - 日志消息
   * @param {string|Object} [errorCodeOrContext] - 错误码或上下文对象
   * @param {Object} [context] - 上下文信息（当第二个参数为错误码时使用）
   */
  warn(message, errorCodeOrContext, context) {
    if (!this.shouldLog(LogLevel.WARN)) {
      return;
    }

    const formattedMessage = this.formatErrorMessage(message, errorCodeOrContext, context);
    console.warn(this.formatMessage(LogLevel.WARN, formattedMessage));
  }

  /**
   * 输出错误级别日志
   * @param {string} message - 日志消息
   * @param {string|Object} [errorCodeOrContext] - 错误码或上下文对象
   * @param {Object} [context] - 上下文信息（当第二个参数为错误码时使用）
   */
  error(message, errorCodeOrContext, context) {
    if (!this.shouldLog(LogLevel.ERROR)) {
      return;
    }

    const formattedMessage = this.formatErrorMessage(message, errorCodeOrContext, context);
    console.error(this.formatMessage(LogLevel.ERROR, formattedMessage));
  }

  /**
   * 格式化错误消息（支持错误码）
   * @param {string} message - 原始消息
   * @param {string|Object|DeadCodeError} [errorCodeOrContext] - 错误码、上下文对象或错误实例
   * @param {Object} [context] - 上下文信息
   * @returns {string} 格式化后的消息
   * @private
   */
  formatErrorMessage(message, errorCodeOrContext, context) {
    if (message instanceof DeadCodeError) {
      return '\n' + formatError(message);
    }

    if (typeof errorCodeOrContext === 'string' && ERROR_CODES[errorCodeOrContext]) {
      const errorDef = ERROR_CODES[errorCodeOrContext];
      const mergedContext = context || {};
      const lines = [
        `${message}`,
        `  错误码: [${errorDef.code}] ${errorDef.message}`,
        `  解决方案: ${errorDef.solution}`,
      ];

      if (Object.keys(mergedContext).length > 0) {
        lines.push('  上下文信息:');
        for (const [key, value] of Object.entries(mergedContext)) {
          lines.push(`    - ${key}: ${value}`);
        }
      }

      return '\n' + lines.join('\n');
    }

    if (errorCodeOrContext instanceof DeadCodeError) {
      return '\n' + formatError(errorCodeOrContext, context);
    }

    if (typeof errorCodeOrContext === 'object' && errorCodeOrContext !== null) {
      return `${message}\n  上下文: ${JSON.stringify(errorCodeOrContext)}`;
    }

    return message;
  }

  /**
   * 输出进度信息
   * @param {number} current - 当前进度
   * @param {number} total - 总数
   * @param {string} [prefix=''] - 前缀文本
   */
  progress(current, total, prefix = '') {
    if (!this.shouldLog(LogLevel.INFO)) {
      return;
    }

    const percent = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    process.stdout.write(`\r${prefix} [${bar}] ${percent}% (${current}/${total})`);

    if (current === total) {
      process.stdout.write('\n');
    }
  }

  /**
   * 输出表格数据
   * @param {Array<Object>} data - 表格数据
   * @param {Array<string>} [columns] - 要显示的列
   */
  table(data, columns) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.table(data, columns);
    }
  }

  /**
   * 输出分组标题
   * @param {string} title - 分组标题
   */
  group(title) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.group(title);
    }
  }

  /**
   * 结束分组
   */
  groupEnd() {
    if (this.shouldLog(LogLevel.INFO)) {
      console.groupEnd();
    }
  }

  /**
   * 输出分隔线
   * @param {string} [char='='] - 分隔字符
   * @param {number} [length=70] - 分隔线长度
   */
  separator(char = '=', length = 70) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(char.repeat(length));
    }
  }

  /**
   * 创建子日志器
   * @param {string} prefix - 子日志器前缀
   * @returns {Logger}
   */
  child(prefix) {
    return new Logger({
      level: this.level,
      colorize: this.colorize,
      timestamp: this.timestamp,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
    });
  }

  /**
   * 设置日志级别
   * @param {string} level - 日志级别
   */
  setLevel(level) {
    if (LOG_LEVEL_PRIORITY[level] !== undefined) {
      this.level = level;
    }
  }

  /**
   * 获取当前日志级别
   * @returns {string}
   */
  getLevel() {
    return this.level;
  }
}

/**
 * 默认日志器实例
 * @type {Logger}
 */
const defaultLogger = new Logger();

module.exports = {
  Logger,
  LogLevel,
  defaultLogger,
};
