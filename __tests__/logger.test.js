const { Logger, LogLevel } = require('../src/logger.js');
const { DeadCodeError } = require('../src/errors.js');

describe('Logger', () => {
  describe('constructor', () => {
    test('应该正确创建实例', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    test('应该使用默认配置', () => {
      const logger = new Logger();
      expect(logger.level).toBe('info');
      expect(logger.colorize).toBe(true);
      expect(logger.timestamp).toBe(true);
      expect(logger.prefix).toBe('');
    });

    test('应该接受自定义配置', () => {
      const customLogger = new Logger({
        level: 'debug',
        colorize: false,
        timestamp: false,
        prefix: 'TestPrefix',
      });

      expect(customLogger.level).toBe('debug');
      expect(customLogger.colorize).toBe(false);
      expect(customLogger.timestamp).toBe(false);
      expect(customLogger.prefix).toBe('TestPrefix');
    });
  });

  describe('shouldLog', () => {
    test('应该根据日志级别判断是否输出', () => {
      const logger = new Logger({ level: 'warn' });

      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('error')).toBe(true);
    });

    test('silent 级别应该阻止所有日志', () => {
      const logger = new Logger({ level: 'silent' });

      expect(logger.shouldLog('debug')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('warn')).toBe(false);
      expect(logger.shouldLog('error')).toBe(false);
    });

    test('debug 级别应该允许所有日志', () => {
      const logger = new Logger({ level: 'debug' });

      expect(logger.shouldLog('debug')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('error')).toBe(true);
    });
  });

  describe('formatTimestamp', () => {
    test('应该返回格式化的时间戳', () => {
      const logger = new Logger();
      const result = logger.formatTimestamp();

      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('formatMessage', () => {
    test('应该格式化日志消息', () => {
      const logger = new Logger({ timestamp: false, prefix: '', colorize: false });

      const result = logger.formatMessage('info', 'Test message');

      expect(result).toBe('[INFO] Test message');
    });

    test('应该包含时间戳', () => {
      const logger = new Logger({ timestamp: true, prefix: '', colorize: false });

      const result = logger.formatMessage('info', 'Test message');

      expect(result).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
      expect(result).toContain('[INFO]');
      expect(result).toContain('Test message');
    });

    test('应该包含前缀', () => {
      const logger = new Logger({ timestamp: false, prefix: 'MyModule', colorize: false });

      const result = logger.formatMessage('warn', 'Warning message');

      expect(result).toBe('[WARN] [MyModule] Warning message');
    });

    test('应该添加颜色', () => {
      const logger = new Logger({ timestamp: false, prefix: '', colorize: true });

      const result = logger.formatMessage('error', 'Error message');

      expect(result).toContain('\x1b[31m');
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('child', () => {
    test('应该创建子日志器', () => {
      const logger = new Logger();
      const childLogger = logger.child('SubModule');

      expect(childLogger).toBeInstanceOf(Logger);
      expect(childLogger.prefix).toBe('SubModule');
    });

    test('子日志器应该继承父日志器配置', () => {
      const logger = new Logger({ level: 'debug', colorize: false, timestamp: false });
      const childLogger = logger.child('SubModule');

      expect(childLogger.level).toBe('debug');
      expect(childLogger.colorize).toBe(false);
      expect(childLogger.timestamp).toBe(false);
    });

    test('子日志器应该追加前缀', () => {
      const logger = new Logger({ prefix: 'Parent' });
      const childLogger = logger.child('Child');

      expect(childLogger.prefix).toBe('Parent:Child');
    });
  });

  describe('setLevel', () => {
    test('应该设置日志级别', () => {
      const logger = new Logger();

      logger.setLevel('debug');
      expect(logger.level).toBe('debug');

      logger.setLevel('error');
      expect(logger.level).toBe('error');
    });

    test('应该忽略无效的日志级别', () => {
      const logger = new Logger({ level: 'info' });

      logger.setLevel('invalid');
      expect(logger.level).toBe('info');
    });
  });

  describe('getLevel', () => {
    test('应该返回当前日志级别', () => {
      const logger = new Logger({ level: 'warn' });
      expect(logger.getLevel()).toBe('warn');
    });
  });

  describe('warn', () => {
    test('应该在 warn 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'error' });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning');

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('应该正确输出警告消息', () => {
      const logger = new Logger({ level: 'warn', timestamp: false, colorize: false });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning');

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('应该正确处理错误码', () => {
      const logger = new Logger({ level: 'warn', timestamp: false, colorize: false });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning', 'E001', { 目录: '/test' });

      expect(warnSpy).toHaveBeenCalled();
      const callArgs = warnSpy.mock.calls[0][0];
      expect(callArgs).toContain('E001');
      expect(callArgs).toContain('无法访问源目录');
      warnSpy.mockRestore();
    });

    test('应该正确处理上下文对象', () => {
      const logger = new Logger({ level: 'warn', timestamp: false, colorize: false });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning', { key: 'value' });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    test('应该正确处理 DeadCodeError 实例', () => {
      const logger = new Logger({ level: 'warn', timestamp: false, colorize: false });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const error = new DeadCodeError('E001', 'Custom message', { path: '/test' });
      logger.warn(error);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('error', () => {
    test('应该在 error 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'silent' });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      logger.error('Test error');

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    test('应该正确输出错误消息', () => {
      const logger = new Logger({ level: 'error', timestamp: false, colorize: false });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      logger.error('Test error');

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    test('应该正确处理 DeadCodeError 实例作为第二个参数', () => {
      const logger = new Logger({ level: 'error', timestamp: false, colorize: false });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new DeadCodeError('E002', 'Config error');
      logger.error('Message', error, { extra: 'info' });

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('debug', () => {
    test('应该在 debug 级别被禁用时不输出', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = new Logger({ level: 'error' });

      logger.debug('Test debug');

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    test('应该正确输出调试消息', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = new Logger({ level: 'debug', timestamp: false, colorize: false });

      logger.debug('Test debug', 'extra', 'args');

      expect(logSpy).toHaveBeenCalledWith('[DEBUG] Test debug', 'extra', 'args');
      logSpy.mockRestore();
    });
  });

  describe('info', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test info');

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    test('应该正确输出信息消息', () => {
      const logger = new Logger({ level: 'info', timestamp: false, colorize: false });
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test info', 'extra', 'args');

      expect(logSpy).toHaveBeenCalledWith('[INFO] Test info', 'extra', 'args');
      logSpy.mockRestore();
    });
  });

  describe('progress', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      logger.progress(50, 100);

      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });

    test('应该正确显示进度条', () => {
      const logger = new Logger({ level: 'info' });
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      logger.progress(50, 100, 'Processing');

      expect(writeSpy).toHaveBeenCalled();
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('Processing');
      expect(output).toContain('50%');
      expect(output).toContain('50/100');
      writeSpy.mockRestore();
    });

    test('应该在完成时输出换行', () => {
      const logger = new Logger({ level: 'info' });
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      logger.progress(100, 100, 'Done');

      const calls = writeSpy.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toContain('\n');
      writeSpy.mockRestore();
    });

    test('应该正确处理无前缀的进度', () => {
      const logger = new Logger({ level: 'info' });
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      logger.progress(1, 10);

      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  describe('table', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const tableSpy = jest.spyOn(console, 'table').mockImplementation();

      logger.table([{ a: 1 }]);

      expect(tableSpy).not.toHaveBeenCalled();
      tableSpy.mockRestore();
    });

    test('应该正确输出表格', () => {
      const logger = new Logger({ level: 'info' });
      const tableSpy = jest.spyOn(console, 'table').mockImplementation();

      const data = [{ name: 'test', value: 1 }];
      logger.table(data, ['name']);

      expect(tableSpy).toHaveBeenCalledWith(data, ['name']);
      tableSpy.mockRestore();
    });
  });

  describe('group', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const groupSpy = jest.spyOn(console, 'group').mockImplementation();

      logger.group('Test Group');

      expect(groupSpy).not.toHaveBeenCalled();
      groupSpy.mockRestore();
    });

    test('应该正确输出分组', () => {
      const logger = new Logger({ level: 'info' });
      const groupSpy = jest.spyOn(console, 'group').mockImplementation();

      logger.group('Test Group');

      expect(groupSpy).toHaveBeenCalledWith('Test Group');
      groupSpy.mockRestore();
    });
  });

  describe('groupEnd', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      logger.groupEnd();

      expect(groupEndSpy).not.toHaveBeenCalled();
      groupEndSpy.mockRestore();
    });

    test('应该正确结束分组', () => {
      const logger = new Logger({ level: 'info' });
      const groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation();

      logger.groupEnd();

      expect(groupEndSpy).toHaveBeenCalled();
      groupEndSpy.mockRestore();
    });
  });

  describe('separator', () => {
    test('应该在 info 级别被禁用时不输出', () => {
      const logger = new Logger({ level: 'warn' });
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.separator();

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    test('应该正确输出默认分隔线', () => {
      const logger = new Logger({ level: 'info' });
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.separator();

      expect(logSpy).toHaveBeenCalledWith('='.repeat(70));
      logSpy.mockRestore();
    });

    test('应该正确输出自定义分隔线', () => {
      const logger = new Logger({ level: 'info' });
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.separator('-', 50);

      expect(logSpy).toHaveBeenCalledWith('-'.repeat(50));
      logSpy.mockRestore();
    });
  });

  describe('formatErrorMessage', () => {
    test('应该正确处理 DeadCodeError 作为第一个参数', () => {
      const logger = new Logger({ level: 'info' });
      const error = new DeadCodeError('E001', 'Custom message', { path: '/test' });

      const result = logger.formatErrorMessage(error);

      expect(result).toContain('E001');
      expect(result).toContain('Custom message');
    });

    test('应该正确处理无效的错误码', () => {
      const logger = new Logger({ level: 'info' });

      const result = logger.formatErrorMessage('Test message', 'UNKNOWN_CODE');

      expect(result).toBe('Test message');
    });

    test('应该正确处理上下文对象作为第二个参数', () => {
      const logger = new Logger({ level: 'info' });

      const result = logger.formatErrorMessage('Test message', { key: 'value' });

      expect(result).toContain('Test message');
      expect(result).toContain('上下文');
      expect(result).toContain('key');
      expect(result).toContain('value');
    });

    test('应该正确处理普通字符串消息', () => {
      const logger = new Logger({ level: 'info' });

      const result = logger.formatErrorMessage('Simple message');

      expect(result).toBe('Simple message');
    });
  });
});

describe('LogLevel', () => {
  test('应该定义所有日志级别', () => {
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.ERROR).toBe('error');
    expect(LogLevel.SILENT).toBe('silent');
  });
});
