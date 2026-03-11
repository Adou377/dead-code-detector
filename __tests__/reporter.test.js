const { Reporter } = require('../src/reporter.js');

describe('Reporter', () => {
  describe('generate', () => {
    test('应该生成完整报告', () => {
      const data = {
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = Reporter.generate(data);

      expect(result).toBe(data);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该支持 AST 模式', () => {
      const data = {
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const consoleClearSpy = jest.spyOn(console, 'clear').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = Reporter.generate(data, { mode: 'ast' });

      expect(result).toBe(data);
      expect(consoleClearSpy).toHaveBeenCalled();

      consoleClearSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('应该显示统计信息', () => {
      const data = {
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const stats = {
        fileCount: 10,
        exportCount: 50,
        componentCount: 20,
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.generate(data, { stats });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('统计信息'));

      consoleSpy.mockRestore();
    });

    test('应该正确显示未使用的导出', () => {
      const data = {
        unusedExports: [
          { file: 'test.js', name: 'unusedFunc', line: 10 },
          { file: 'test.js', name: 'unusedVar', line: 15 },
        ],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.generate(data);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的导出'));

      consoleSpy.mockRestore();
    });

    test('应该正确显示未使用的组件', () => {
      const data = {
        unusedExports: [],
        unusedComponents: [{ file: 'UnusedComponent.vue', name: 'UnusedComponent' }],
        unusedToolFiles: [],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.generate(data);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的组件'));

      consoleSpy.mockRestore();
    });

    test('应该正确显示未使用的工具文件', () => {
      const data = {
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: ['utils/unused.js'],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.generate(data);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的工具文件'));

      consoleSpy.mockRestore();
    });
  });

  describe('printStats', () => {
    test('应该打印统计信息', () => {
      const stats = {
        fileCount: 10,
        exportCount: 50,
        componentCount: 20,
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printStats(stats);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('统计信息'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('10'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('50'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('20'));

      consoleSpy.mockRestore();
    });
  });

  describe('printUnusedExports', () => {
    test('应该打印未使用的导出', () => {
      const unusedExports = [
        { file: 'test.js', name: 'unusedFunc', line: 10 },
        { file: 'test.js', name: 'unusedVar', line: 15 },
        { file: 'other.js', name: 'unusedClass', line: 5 },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedExports(unusedExports);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的导出'));

      consoleSpy.mockRestore();
    });

    test('当没有未使用的导出时应该显示成功消息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedExports([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('没有发现未使用的导出'));

      consoleSpy.mockRestore();
    });

    test('应该限制显示的项目数量', () => {
      const unusedExports = Array.from({ length: 10 }, (_, i) => ({
        file: 'test.js',
        name: `unused${i}`,
        line: i + 1,
      }));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedExports(unusedExports);

      const calls = consoleSpy.mock.calls;
      const hasMoreMessage = calls.some(call => call[0] && call[0].includes('还有'));

      expect(hasMoreMessage).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('printUnusedComponents', () => {
    test('应该打印未使用的组件', () => {
      const unusedComponents = [
        { file: 'UnusedComponent.vue', name: 'UnusedComponent' },
        { file: 'OldButton.vue', name: 'OldButton' },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedComponents(unusedComponents);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的组件'));

      consoleSpy.mockRestore();
    });

    test('当没有未使用的组件时应该显示成功消息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedComponents([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('没有发现未使用的组件'));

      consoleSpy.mockRestore();
    });
  });

  describe('printUnusedToolFiles', () => {
    test('应该打印未使用的工具文件', () => {
      const unusedToolFiles = ['utils/unused.js', 'helpers/old.js'];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedToolFiles(unusedToolFiles);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的工具文件'));

      consoleSpy.mockRestore();
    });

    test('当没有未使用的工具文件时应该显示成功消息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedToolFiles([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('没有发现未使用的工具文件'));

      consoleSpy.mockRestore();
    });

    test('应该处理 null 值', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedToolFiles(null);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('没有发现未使用的工具文件'));

      consoleSpy.mockRestore();
    });

    test('应该处理 undefined 值', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printUnusedToolFiles(undefined);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('没有发现未使用的工具文件'));

      consoleSpy.mockRestore();
    });
  });

  describe('printSummary', () => {
    test('应该打印摘要', () => {
      const data = {
        unusedExports: [{ file: 'test.js', name: 'foo', line: 1 }],
        unusedComponents: [{ file: 'Test.vue', name: 'Test' }],
        unusedToolFiles: ['utils/old.js'],
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printSummary(data);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('总计'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 个未使用的导出'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 个未使用的组件'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 个未使用的工具文件'));

      consoleSpy.mockRestore();
    });
  });

  describe('groupByFile', () => {
    test('应该按文件分组项目', () => {
      const items = [
        { file: 'a.js', name: 'foo' },
        { file: 'a.js', name: 'bar' },
        { file: 'b.js', name: 'baz' },
      ];

      const result = Reporter.groupByFile(items);

      expect(result).toEqual({
        'a.js': [
          { file: 'a.js', name: 'foo' },
          { file: 'a.js', name: 'bar' },
        ],
        'b.js': [{ file: 'b.js', name: 'baz' }],
      });
    });

    test('应该处理空数组', () => {
      const result = Reporter.groupByFile([]);

      expect(result).toEqual({});
    });
  });

  describe('printProgress', () => {
    test('应该打印进度条', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      Reporter.printProgress(50, 100, '测试进度');

      expect(writeSpy).toHaveBeenCalled();

      writeSpy.mockRestore();
    });

    test('完成时应该打印换行', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      Reporter.printProgress(100, 100, '测试进度');

      const calls = writeSpy.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('\n');

      writeSpy.mockRestore();
    });
  });

  describe('printAnalysisStart', () => {
    test('应该打印分析开始信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printAnalysisStart();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('开始分析'));

      consoleSpy.mockRestore();
    });
  });

  describe('printAnalysisComplete', () => {
    test('应该打印分析完成信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printAnalysisComplete(5.5);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('分析完成'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('5.5'));

      consoleSpy.mockRestore();
    });
  });

  describe('printDetectionStage', () => {
    test('应该打印检测阶段信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      Reporter.printDetectionStage('未使用的导出');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('检测'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未使用的导出'));

      consoleSpy.mockRestore();
    });
  });
});
