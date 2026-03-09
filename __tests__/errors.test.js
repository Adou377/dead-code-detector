/**
 * 错误处理模块测试
 */

const {
  DeadCodeError,
  ConfigError,
  ParseError,
  FixError,
  PathError,
  GitError,
  formatError,
  createError,
  isErrorCode,
} = require('../src/errors');

const { ERROR_CODES } = require('../src/constants');
const { Logger, defaultLogger } = require('../src/logger');

describe('错误码常量', () => {
  test('应该定义所有必需的错误码', () => {
    expect(ERROR_CODES.E001).toBeDefined();
    expect(ERROR_CODES.E002).toBeDefined();
    expect(ERROR_CODES.E003).toBeDefined();
    expect(ERROR_CODES.E004).toBeDefined();
    expect(ERROR_CODES.E005).toBeDefined();
    expect(ERROR_CODES.E006).toBeDefined();
    expect(ERROR_CODES.E007).toBeDefined();
    expect(ERROR_CODES.E008).toBeDefined();
    expect(ERROR_CODES.E009).toBeDefined();
    expect(ERROR_CODES.E010).toBeDefined();
  });

  test('每个错误码应包含 code、message 和 solution 字段', () => {
    for (const [key, errorDef] of Object.entries(ERROR_CODES)) {
      expect(errorDef.code).toBe(key);
      expect(errorDef.message).toBeDefined();
      expect(errorDef.solution).toBeDefined();
      expect(typeof errorDef.message).toBe('string');
      expect(typeof errorDef.solution).toBe('string');
    }
  });
});

describe('DeadCodeError 基类', () => {
  test('应该正确创建错误实例', () => {
    const error = new DeadCodeError('E001');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error.code).toBe('E001');
    expect(error.message).toBe(ERROR_CODES.E001.message);
    expect(error.solution).toBe(ERROR_CODES.E001.solution);
  });

  test('应该支持自定义错误消息', () => {
    const customMessage = '自定义错误消息';
    const error = new DeadCodeError('E001', customMessage);
    expect(error.message).toBe(customMessage);
    expect(error.code).toBe('E001');
  });

  test('应该支持上下文信息', () => {
    const context = { file: 'test.js', line: 10 };
    const error = new DeadCodeError('E003', '解析失败', context);
    expect(error.context).toEqual(context);
  });

  test('应该对未知错误码抛出错误', () => {
    expect(() => new DeadCodeError('E999')).toThrow('未知的错误码: E999');
  });

  test('getFullMessage 应该返回格式化的错误信息', () => {
    const error = new DeadCodeError('E001', '无法访问目录', { path: '/src' });
    const fullMessage = error.getFullMessage();
    expect(fullMessage).toContain('[E001]');
    expect(fullMessage).toContain('无法访问目录');
    expect(fullMessage).toContain('解决方案');
    expect(fullMessage).toContain('path: /src');
  });
});

describe('错误子类', () => {
  test('ConfigError 应该正确继承', () => {
    const error = new ConfigError('E002', '配置错误');
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.code).toBe('E002');
  });

  test('ParseError 应该正确继承', () => {
    const error = new ParseError('E003', '解析错误');
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error).toBeInstanceOf(ParseError);
    expect(error.code).toBe('E003');
  });

  test('FixError 应该正确继承', () => {
    const error = new FixError('E004', '修复错误');
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error).toBeInstanceOf(FixError);
    expect(error.code).toBe('E004');
  });

  test('PathError 应该正确继承', () => {
    const error = new PathError('E005', '路径错误');
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error).toBeInstanceOf(PathError);
    expect(error.code).toBe('E005');
  });

  test('GitError 应该正确继承', () => {
    const error = new GitError('E006', 'Git错误');
    expect(error).toBeInstanceOf(DeadCodeError);
    expect(error).toBeInstanceOf(GitError);
    expect(error.code).toBe('E006');
  });
});

describe('formatError 函数', () => {
  test('应该格式化错误码字符串', () => {
    const formatted = formatError('E001');
    expect(formatted).toContain('[E001]');
    expect(formatted).toContain(ERROR_CODES.E001.message);
    expect(formatted).toContain(ERROR_CODES.E001.solution);
  });

  test('应该格式化错误实例', () => {
    const error = new DeadCodeError('E003', '解析失败', { file: 'test.js' });
    const formatted = formatError(error);
    expect(formatted).toContain('[E003]');
    expect(formatted).toContain('解析失败');
    expect(formatted).toContain('file: test.js');
  });

  test('应该合并额外的上下文信息', () => {
    const error = new DeadCodeError('E003', '解析失败', { file: 'test.js' });
    const formatted = formatError(error, { line: 10 });
    expect(formatted).toContain('file: test.js');
    expect(formatted).toContain('line: 10');
  });

  test('应该处理未知错误码', () => {
    const formatted = formatError('E999');
    expect(formatted).toContain('未知错误');
  });

  test('应该处理普通 Error 对象', () => {
    const error = new Error('普通错误');
    const formatted = formatError(error);
    expect(formatted).toBe('普通错误');
  });
});

describe('createError 函数', () => {
  test('应该根据错误码创建正确的错误类型', () => {
    expect(createError('E001')).toBeInstanceOf(ConfigError);
    expect(createError('E002')).toBeInstanceOf(ConfigError);
    expect(createError('E003')).toBeInstanceOf(ParseError);
    expect(createError('E004')).toBeInstanceOf(FixError);
    expect(createError('E005')).toBeInstanceOf(PathError);
    expect(createError('E006')).toBeInstanceOf(GitError);
    expect(createError('E007')).toBeInstanceOf(PathError);
    expect(createError('E008')).toBeInstanceOf(FixError);
    expect(createError('E009')).toBeInstanceOf(ConfigError);
    expect(createError('E010')).toBeInstanceOf(ParseError);
  });

  test('应该支持自定义消息和上下文', () => {
    const error = createError('E003', '自定义消息', { file: 'test.js' });
    expect(error.message).toBe('自定义消息');
    expect(error.context).toEqual({ file: 'test.js' });
  });
});

describe('isErrorCode 函数', () => {
  test('应该正确识别错误码', () => {
    const error = new DeadCodeError('E001');
    expect(isErrorCode(error, 'E001')).toBe(true);
    expect(isErrorCode(error, 'E002')).toBe(false);
  });

  test('应该对非 DeadCodeError 返回 false', () => {
    const error = new Error('普通错误');
    expect(isErrorCode(error, 'E001')).toBe(false);
  });
});

describe('Logger 错误码支持', () => {
  let logger;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    logger = new Logger({ level: 'debug' });
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('warn 方法应该支持错误码', () => {
    logger.warn('文件解析失败', 'E003', { file: 'test.js' });
    expect(consoleWarnSpy).toHaveBeenCalled();
    const output = consoleWarnSpy.mock.calls[0][0];
    expect(output).toContain('[E003]');
    expect(output).toContain('文件解析失败');
    expect(output).toContain('解决方案');
  });

  test('error 方法应该支持错误码', () => {
    logger.error('无法访问目录', 'E001', { path: '/src' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toContain('[E001]');
    expect(output).toContain('无法访问目录');
    expect(output).toContain('解决方案');
  });

  test('warn 方法应该支持 DeadCodeError 实例', () => {
    const error = new ParseError('E003', '解析失败', { file: 'test.js' });
    logger.warn(error);
    expect(consoleWarnSpy).toHaveBeenCalled();
    const output = consoleWarnSpy.mock.calls[0][0];
    expect(output).toContain('[E003]');
    expect(output).toContain('解析失败');
  });

  test('error 方法应该支持 DeadCodeError 实例', () => {
    const error = new ConfigError('E002', '配置错误', { file: 'config.json' });
    logger.error(error);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0][0];
    expect(output).toContain('[E002]');
    expect(output).toContain('配置错误');
  });

  test('应该保持向后兼容（无错误码参数）', () => {
    logger.warn('普通警告消息');
    expect(consoleWarnSpy).toHaveBeenCalled();
    const output = consoleWarnSpy.mock.calls[0][0];
    expect(output).toContain('普通警告消息');
    expect(output).not.toContain('[E00');
  });

  test('应该支持上下文对象参数', () => {
    logger.warn('警告消息', { file: 'test.js', line: 10 });
    expect(consoleWarnSpy).toHaveBeenCalled();
    const output = consoleWarnSpy.mock.calls[0][0];
    expect(output).toContain('警告消息');
    expect(output).toContain('file');
    expect(output).toContain('test.js');
  });
});

describe('错误码使用场景', () => {
  test('E001 - 无法访问源目录', () => {
    const error = createError('E001', '无法访问目录 /src/app', {
      path: '/src/app',
      原因: '目录不存在',
    });
    expect(error.code).toBe('E001');
    expect(error.message).toBe('无法访问目录 /src/app');
    expect(error.context.path).toBe('/src/app');
  });

  test('E003 - 文件解析失败', () => {
    const error = createError('E003', '解析文件失败', {
      文件: 'broken.js',
      错误信息: 'Unexpected token',
    });
    expect(error.code).toBe('E003');
    expect(error).toBeInstanceOf(ParseError);
  });

  test('E006 - Git 操作失败', () => {
    const error = createError('E006', '获取 Git 变更失败', {
      目录: '/project/src',
      命令: 'git diff',
    });
    expect(error.code).toBe('E006');
    expect(error).toBeInstanceOf(GitError);
  });
});
