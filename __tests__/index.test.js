const path = require('path');
const fs = require('fs');
const {
  detect,
  DeadCodeFinder,
  DeadCodeFinderAST,
  loadConfig,
  mergeConfig,
} = require('../src/index.js');
const { DEFAULT_MODE } = require('../src/constants.js');

// 模拟依赖
jest.mock('../src/detector.js');
jest.mock('../src/detector-ast.js');
jest.mock('../src/config.js');
jest.mock('../src/utils.js');
jest.mock('../src/incremental-analyzer.js');

describe('index.js - 主入口模块', () => {
  // 重置模拟
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detect 函数', () => {
    test('应该使用 AST 模式（默认模式）', async () => {
      // 准备测试数据
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 设置模拟返回值
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      // 执行测试
      const result = await detect({ mode: DEFAULT_MODE });

      // 验证结果
      expect(loadConfig).toHaveBeenCalled();
      expect(mergeConfig).toHaveBeenCalled();
      expect(DeadCodeFinderAST).toHaveBeenCalledWith({
        srcDir: mockConfig.srcDir,
        extensions: mockConfig.extensions,
        ignoreDirs: mockConfig.ignoreDirs,
        verbose: mockConfig.verbose,
      });
      expect(mockFinder.analyze).toHaveBeenCalled();
      expect(result.finder).toBe(mockFinder);
      expect(result.results).toEqual({
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      });
    });

    test('应该使用 regex 模式', async () => {
      // 准备测试数据
      const mockConfig = {
        srcDir: './src',
        mode: 'regex',
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 设置模拟返回值
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinder } = require('../src/detector.js');

      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinder.mockImplementation(() => mockFinder);

      // 执行测试
      const result = await detect({ mode: 'regex' });

      // 验证结果
      expect(DeadCodeFinder).toHaveBeenCalledWith({
        srcDir: mockConfig.srcDir,
        extensions: mockConfig.extensions,
        ignoreDirs: mockConfig.ignoreDirs,
        verbose: mockConfig.verbose,
      });
    });

    test('应该使用默认参数', async () => {
      // 准备测试数据
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 设置模拟返回值
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      // 执行测试 - 不传参数
      const result = await detect();

      // 验证结果
      expect(loadConfig).toHaveBeenCalledWith(undefined);
    });
  });

  describe('导出', () => {
    test('应该导出所有必要的模块', () => {
      expect(typeof DeadCodeFinder).toBe('function');
      expect(typeof DeadCodeFinderAST).toBe('function');
      expect(typeof detect).toBe('function');
      expect(typeof loadConfig).toBe('function');
      expect(typeof mergeConfig).toBe('function');
    });
  });

  describe('detect 函数配置合并', () => {
    test('应该正确合并配置文件和命令行参数', async () => {
      const configFileConfig = {
        srcDir: './src',
        extensions: ['.js', '.ts'],
        ignoreDirs: ['node_modules', 'dist'],
        mode: 'ast',
      };
      const cliOptions = {
        srcDir: './lib',
        verbose: true,
      };
      const mergedConfig = {
        srcDir: './lib',
        extensions: ['.js', '.ts'],
        ignoreDirs: ['node_modules', 'dist'],
        mode: 'ast',
        verbose: true,
        fix: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      loadConfig.mockReturnValue(configFileConfig);
      mergeConfig.mockReturnValue(mergedConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      await detect(cliOptions);

      expect(mergeConfig).toHaveBeenCalledWith(cliOptions, configFileConfig);
    });

    test('应该使用配置文件中的自定义配置', async () => {
      const configFileConfig = {
        srcDir: './custom-src',
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules', 'dist', 'build'],
        mode: 'regex',
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [{ file: 'a.js', name: 'unused', type: 'named', line: 1 }],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinder } = require('../src/detector.js');

      loadConfig.mockReturnValue(configFileConfig);
      mergeConfig.mockReturnValue({ ...configFileConfig, fix: false, verbose: false });
      DeadCodeFinder.mockImplementation(() => mockFinder);

      const result = await detect({ mode: 'regex' });

      expect(result.results.unusedExports).toHaveLength(1);
    });
  });

  describe('detect 函数返回值', () => {
    test('应该返回完整的分析结果', async () => {
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        unusedExports: [{ file: 'utils.js', name: 'unusedFunc', type: 'named', line: 10 }],
        unusedComponents: [{ file: 'OldComponent.vue', name: 'OldComponent' }],
        unusedToolFiles: ['helpers/deprecated.js'],
      };

      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      const result = await detect({});

      expect(result).toHaveProperty('finder');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('unusedExports');
      expect(result.results).toHaveProperty('unusedComponents');
      expect(result.results).toHaveProperty('unusedToolFiles');
      expect(result.results.unusedExports).toHaveLength(1);
      expect(result.results.unusedComponents).toHaveLength(1);
      expect(result.results.unusedToolFiles).toHaveLength(1);
    });
  });

  describe('run 函数', () => {
    test('应该显示帮助信息并退出', async () => {
      // 模拟 process.argv 和 console.log
      const originalArgv = process.argv;
      const originalExit = process.exit;
      const logs = [];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args);
      });

      try {
        // 设置模拟参数
        process.argv = ['node', 'dead-code', '--help'];
        process.exit = jest.fn(() => {
          // 抛出错误以阻止后续代码执行
          throw new Error('Process exited');
        });

        // 模拟 parseArgs
        const { parseArgs } = require('../src/utils.js');
        parseArgs.mockReturnValue({ help: true });

        // 执行 run 函数
        const { run } = require('../src/index.js');
        await expect(run()).rejects.toThrow('Process exited');

        // 验证结果
        expect(consoleSpy).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(0);
      } finally {
        // 恢复原始值
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleSpy.mockRestore();
      }
    });

    test('应该使用 AST 模式运行', async () => {
      // 模拟依赖
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: false,
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 模拟函数
      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      parseArgs.mockReturnValue({});
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      // 执行测试
      const { run } = require('../src/index.js');
      await run();

      // 验证结果
      expect(DeadCodeFinderAST).toHaveBeenCalled();
      expect(mockFinder.analyze).toHaveBeenCalled();
      expect(mockFinder.report).toHaveBeenCalled();
    });

    test('应该使用 regex 模式运行', async () => {
      // 模拟依赖
      const mockConfig = {
        srcDir: './src',
        mode: 'regex',
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: false,
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 模拟函数
      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinder } = require('../src/detector.js');

      parseArgs.mockReturnValue({ mode: 'regex' });
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinder.mockImplementation(() => mockFinder);

      // 执行测试
      const { run } = require('../src/index.js');
      await run();

      // 验证结果
      expect(DeadCodeFinder).toHaveBeenCalled();
      expect(mockFinder.analyze).toHaveBeenCalled();
      expect(mockFinder.report).toHaveBeenCalled();
    });

    test('应该在 fix 模式下执行修复', async () => {
      // 模拟依赖
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: true,
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        fix: jest.fn().mockResolvedValue({}),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 模拟函数
      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      parseArgs.mockReturnValue({ fix: true });
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      // 执行测试
      const { run } = require('../src/index.js');
      await run();

      // 验证结果
      expect(mockFinder.fix).toHaveBeenCalled();
    });

    test('应该使用配置文件', async () => {
      // 模拟依赖
      const configFileConfig = {
        srcDir: './custom-src',
        extensions: ['.js', '.ts'],
        ignoreDirs: ['node_modules', 'dist'],
        mode: 'ast',
      };
      const mockConfig = {
        ...configFileConfig,
        fix: false,
        verbose: false,
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      // 模拟函数
      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');

      parseArgs.mockReturnValue({});
      loadConfig.mockReturnValue(configFileConfig);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);

      // 执行测试
      const { run } = require('../src/index.js');
      await run();

      // 验证结果
      expect(loadConfig).toHaveBeenCalled();
      expect(mergeConfig).toHaveBeenCalledWith({}, configFileConfig);
    });
  });

  describe('run 函数增量分析', () => {
    test('应该在非 Git 仓库时显示警告', async () => {
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: false,
        verbose: false,
        incremental: true,
        'base-branch': 'main',
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [],
        unusedComponents: [],
        unusedToolFiles: [],
      };

      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');
      const incrementalAnalyzer = require('../src/incremental-analyzer.js');

      parseArgs.mockReturnValue({ incremental: true });
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);
      incrementalAnalyzer.isIncrementalSupported.mockReturnValue(false);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const { run } = require('../src/index.js');
      await run();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('当前目录不是 Git 仓库'));

      consoleSpy.mockRestore();
    });

    test('应该在增量分析模式下过滤结果', async () => {
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: false,
        verbose: false,
        incremental: true,
        'base-branch': 'main',
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [
          { file: 'src/changed.js', name: 'unused1', type: 'named', line: 1 },
          { file: 'src/unchanged.js', name: 'unused2', type: 'named', line: 2 },
        ],
        unusedComponents: [
          { file: 'src/changed.js', name: 'Component1' },
          { file: 'src/unchanged.js', name: 'Component2' },
        ],
        unusedToolFiles: ['src/changed-utils.js', 'src/unchanged-utils.js'],
      };

      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');
      const incrementalAnalyzer = require('../src/incremental-analyzer.js');

      parseArgs.mockReturnValue({ incremental: true });
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);
      incrementalAnalyzer.isIncrementalSupported.mockReturnValue(true);
      incrementalAnalyzer.getChangedFiles.mockReturnValue({
        files: ['src/changed.js', 'src/changed-utils.js'],
        branch: 'main',
        autoDetected: true,
        fallback: false,
        reason: '自动检测到基准分支: main',
      });
      incrementalAnalyzer.filterUnusedExports.mockImplementation(exports =>
        exports.filter(e => e.file.includes('changed'))
      );
      incrementalAnalyzer.filterUnusedComponents.mockImplementation(comps =>
        comps.filter(c => c.file.includes('changed'))
      );
      incrementalAnalyzer.filterUnusedToolFiles.mockImplementation(files =>
        files.filter(f => f.includes('changed'))
      );
      incrementalAnalyzer.getCurrentBranch.mockReturnValue('feature');
      incrementalAnalyzer.getLastCommitHash.mockReturnValue('abc123');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const { run } = require('../src/index.js');
      await run();

      expect(incrementalAnalyzer.filterUnusedExports).toHaveBeenCalled();
      expect(incrementalAnalyzer.filterUnusedComponents).toHaveBeenCalled();
      expect(incrementalAnalyzer.filterUnusedToolFiles).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('应该在增量分析没有变更文件时清空结果', async () => {
      const mockConfig = {
        srcDir: './src',
        mode: DEFAULT_MODE,
        extensions: ['.js'],
        ignoreDirs: ['node_modules'],
        fix: false,
        verbose: false,
        incremental: true,
        'base-branch': 'main',
      };
      const mockFinder = {
        analyze: jest.fn().mockResolvedValue(true),
        report: jest.fn(),
        unusedExports: [{ file: 'src/test.js', name: 'unused', type: 'named', line: 1 }],
        unusedComponents: [{ file: 'src/test.js', name: 'Component' }],
        unusedToolFiles: ['src/utils.js'],
      };

      const { parseArgs } = require('../src/utils.js');
      const { loadConfig, mergeConfig } = require('../src/config.js');
      const { DeadCodeFinderAST } = require('../src/detector-ast.js');
      const incrementalAnalyzer = require('../src/incremental-analyzer.js');

      parseArgs.mockReturnValue({ incremental: true });
      loadConfig.mockReturnValue(null);
      mergeConfig.mockReturnValue(mockConfig);
      DeadCodeFinderAST.mockImplementation(() => mockFinder);
      incrementalAnalyzer.isIncrementalSupported.mockReturnValue(true);
      incrementalAnalyzer.getChangedFiles.mockReturnValue({
        files: [],
        branch: 'main',
        autoDetected: true,
        fallback: false,
        reason: '自动检测到基准分支: main',
      });
      incrementalAnalyzer.getCurrentBranch.mockReturnValue('main');
      incrementalAnalyzer.getLastCommitHash.mockReturnValue('def456');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const { run } = require('../src/index.js');
      await run();

      expect(mockFinder.unusedExports).toEqual([]);
      expect(mockFinder.unusedComponents).toEqual([]);
      expect(mockFinder.unusedToolFiles).toEqual([]);

      consoleSpy.mockRestore();
    });
  });
});
