/**
 * 统一错误处理模块
 *
 * 提供统一的错误处理、警告输出和错误创建功能
 * 消除项目中重复的错误处理逻辑
 */

const { createError, ConfigError, ParseError, FixError, PathError } = require('./errors');
const { defaultLogger } = require('./logger');

const WarningType = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PARSE_FAILED: 'PARSE_FAILED',
  PATH_UNSAFE: 'PATH_UNSAFE',
  ACCESS_DENIED: 'ACCESS_DENIED',
  PROCESS_FAILED: 'PROCESS_FAILED',
  FIX_ERROR: 'FIX_ERROR',
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
};

const WarningTemplates = {
  [WarningType.FILE_TOO_LARGE]: filePath => `文件过大，跳过解析: ${filePath}`,
  [WarningType.PARSE_FAILED]: (filePath, errorMsg) =>
    `解析文件失败: ${filePath}\n   错误信息: ${errorMsg}`,
  [WarningType.PATH_UNSAFE]: (reason, path) => `路径安全警告: ${reason}，已跳过: ${path}`,
  [WarningType.ACCESS_DENIED]: (target, errorMsg) =>
    `无法访问: ${target}\n   错误信息: ${errorMsg}`,
  [WarningType.PROCESS_FAILED]: (item, errorMsg, stack) => {
    let msg = `处理失败: ${item}\n   错误信息: ${errorMsg}`;
    if (stack) {
      msg += `\n   错误堆栈: ${stack}`;
    }
    return msg;
  },
  [WarningType.FIX_ERROR]: (filePath, errorMsg) => `修复文件 ${filePath} 时出错: ${errorMsg}`,
  [WarningType.CONFIG_LOAD_FAILED]: (filePath, errorMsg) =>
    `读取配置文件 ${filePath} 失败: ${errorMsg}`,
};

let logger = defaultLogger;

function setLogger(newLogger) {
  logger = newLogger;
}

function warn(type, ...args) {
  const template = WarningTemplates[type];
  if (!template) {
    logger.warn(`未知警告类型: ${type}`);
    return;
  }

  const message = template(...args);
  logger.warn(`⚠️  ${message}`);
}

function warnFileTooLarge(filePath) {
  warn(WarningType.FILE_TOO_LARGE, filePath);
}

function warnParseFailed(filePath, errorMsg) {
  warn(WarningType.PARSE_FAILED, filePath, errorMsg);
}

function warnPathUnsafe(reason, path) {
  warn(WarningType.PATH_UNSAFE, reason, path);
}

function warnAccessDenied(target, errorMsg) {
  warn(WarningType.ACCESS_DENIED, target, errorMsg);
}

function warnProcessFailed(item, errorMsg, stack) {
  warn(WarningType.PROCESS_FAILED, item, errorMsg, stack);
}

function warnFixError(filePath, errorMsg) {
  warn(WarningType.FIX_ERROR, filePath, errorMsg);
}

function warnConfigLoadFailed(filePath, errorMsg) {
  warn(WarningType.CONFIG_LOAD_FAILED, filePath, errorMsg);
}

const ValidationErrorType = {
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  INVALID_SRC_DIR: 'INVALID_SRC_DIR',
  INVALID_SRC_DIR_CHARS: 'INVALID_SRC_DIR_CHARS',
  INVALID_SRC_DIR_FORMAT: 'INVALID_SRC_DIR_FORMAT',
  INVALID_CONCURRENCY_TYPE: 'INVALID_CONCURRENCY_TYPE',
  INVALID_CONCURRENCY_RANGE: 'INVALID_CONCURRENCY_RANGE',
  INVALID_MAX_FILE_SIZE_TYPE: 'INVALID_MAX_FILE_SIZE_TYPE',
  INVALID_MAX_FILE_SIZE_RANGE: 'INVALID_MAX_FILE_SIZE_RANGE',
  CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  WORKER_POOL_THREAD: 'WORKER_POOL_THREAD',
  UNKNOWN_TASK_TYPE: 'UNKNOWN_TASK_TYPE',
};

const ValidationErrorMessages = {
  [ValidationErrorType.INVALID_OPTIONS]: '配置选项必须是一个对象',
  [ValidationErrorType.INVALID_SRC_DIR]: 'srcDir 必须是非空字符串',
  [ValidationErrorType.INVALID_SRC_DIR_CHARS]: 'srcDir 包含非法字符',
  [ValidationErrorType.INVALID_SRC_DIR_FORMAT]: srcDir => `srcDir 路径格式无效: ${srcDir}`,
  [ValidationErrorType.INVALID_CONCURRENCY_TYPE]: 'concurrency 必须是整数',
  [ValidationErrorType.INVALID_CONCURRENCY_RANGE]: 'concurrency 必须在 1 到 1000 之间',
  [ValidationErrorType.INVALID_MAX_FILE_SIZE_TYPE]: 'maxFileSize 必须是数字',
  [ValidationErrorType.INVALID_MAX_FILE_SIZE_RANGE]: 'maxFileSize 必须在 0 到 10MB 之间',
  [ValidationErrorType.CONFIG_VALIDATION_FAILED]: errors =>
    `配置验证失败:\n  - ${errors.join('\n  - ')}`,
  [ValidationErrorType.WORKER_POOL_THREAD]: 'WorkerPool 只能在主线程中使用',
  [ValidationErrorType.UNKNOWN_TASK_TYPE]: taskType => `未知任务类型: ${taskType}`,
};

function throwValidationError(errorType, ...args) {
  const messageTemplate = ValidationErrorMessages[errorType];
  if (!messageTemplate) {
    throw new Error(`未知的验证错误类型: ${errorType}`);
  }

  const message =
    typeof messageTemplate === 'function' ? messageTemplate(...args) : messageTemplate;
  throw new Error(message);
}

function throwConfigError(errorCode, customMessage, context) {
  throw new ConfigError(errorCode, customMessage, context);
}

function throwParseError(errorCode, customMessage, context) {
  throw new ParseError(errorCode, customMessage, context);
}

function throwFixError(errorCode, customMessage, context) {
  throw new FixError(errorCode, customMessage, context);
}

function throwPathError(errorCode, customMessage, context) {
  throw new PathError(errorCode, customMessage, context);
}

function handleFileOperation(operation, filePath, options = {}) {
  const { errorCode = 'E007', silent = false } = options;

  try {
    return operation();
  } catch (error) {
    if (!silent) {
      warnAccessDenied(filePath, error.message);
    }
    throw createError(errorCode, error.message, { filePath });
  }
}

async function handleAsyncFileOperation(operation, filePath, options = {}) {
  const { errorCode = 'E007', silent = false } = options;

  try {
    return await operation();
  } catch (error) {
    if (!silent) {
      warnAccessDenied(filePath, error.message);
    }
    throw createError(errorCode, error.message, { filePath });
  }
}

module.exports = {
  WarningType,
  warn,
  warnFileTooLarge,
  warnParseFailed,
  warnPathUnsafe,
  warnAccessDenied,
  warnProcessFailed,
  warnFixError,
  warnConfigLoadFailed,
  ValidationErrorType,
  throwValidationError,
  throwConfigError,
  throwParseError,
  throwFixError,
  throwPathError,
  handleFileOperation,
  handleAsyncFileOperation,
  setLogger,
};
