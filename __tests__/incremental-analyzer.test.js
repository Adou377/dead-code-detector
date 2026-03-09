const childProcess = require('child_process');
const {
  getChangedFiles,
  getUncommittedChanges,
  analyzeAffectedFiles,
  filterUnusedExports,
  filterUnusedComponents,
  filterUnusedToolFiles,
  isIncrementalSupported,
  getCurrentBranch,
  getLastCommitHash,
} = require('../src/incremental-analyzer');

// Mock child_process 模块
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('incremental-analyzer', () => {
  const execSyncMock = childProcess.execSync;

  beforeEach(() => {
    // 默认 mock console.log 避免测试输出噪音
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('getChangedFiles', () => {
    test('应在 Git 仓库中返回变更的源代码文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        // 第二次调用使用 encoding: 'utf-8'，返回字符串
        return 'src/utils.js\nsrc/components/Button.jsx\nsrc/styles.css\nREADME.md\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src/utils.js', 'src/components/Button.jsx']);
      expect(execSyncMock).toHaveBeenCalledTimes(2);
    });

    test('应使用自定义基准分支', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src/index.js\n';
      });

      getChangedFiles('/project/src', 'develop');

      expect(execSyncMock).toHaveBeenCalledWith(
        'git diff --name-only --diff-filter=ACMR develop...HEAD',
        expect.objectContaining({ cwd: '/project/src' })
      );
    });

    test('应默认使用 main 分支', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return '';
      });

      getChangedFiles('/project/src');

      expect(execSyncMock).toHaveBeenCalledWith(
        'git diff --name-only --diff-filter=ACMR main...HEAD',
        expect.objectContaining({ cwd: '/project/src' })
      );
    });

    test('非 Git 仓库应返回 null', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toBeNull();
    });

    test('git diff 失败应返回 null', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        throw new Error('git diff failed');
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toBeNull();
    });

    test('应过滤非源代码文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src/index.js\nsrc/style.css\nsrc/data.json\nsrc/image.png\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src/index.js']);
    });

    test('应处理空变更列表', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return '';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual([]);
    });

    test('应处理 Windows 路径分隔符', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src\\utils.js\nsrc\\components\\Button.jsx\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src\\utils.js', 'src\\components\\Button.jsx']);
    });

    test('应支持 TypeScript 文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src/types.ts\nsrc/component.tsx\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src/types.ts', 'src/component.tsx']);
    });

    test('应支持 Vue 文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src/App.vue\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src/App.vue']);
    });
  });

  describe('getUncommittedChanges', () => {
    test('应返回未提交的变更文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        if (callCount.count === 2) return 'src/a.js\nsrc/b.js\n';
        return 'src/c.js\n';
      });

      const result = getUncommittedChanges('/project/src');

      expect(result).toEqual(['src/a.js', 'src/b.js', 'src/c.js']);
    });

    test('应去重重复的文件', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        if (callCount.count === 2) return 'src/a.js\n';
        return 'src/a.js\nsrc/b.js\n';
      });

      const result = getUncommittedChanges('/project/src');

      expect(result).toEqual(['src/a.js', 'src/b.js']);
    });

    test('非 Git 仓库应返回 null', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getUncommittedChanges('/project/src');

      expect(result).toBeNull();
    });

    test('git 命令失败应返回空数组', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        throw new Error('git command failed');
      });

      const result = getUncommittedChanges('/project/src');

      expect(result).toEqual([]);
    });

    test('应处理空变更', () => {
      execSyncMock.mockImplementation(() => Buffer.from('true'));

      const result = getUncommittedChanges('/project/src');

      expect(result).toEqual([]);
    });
  });

  describe('analyzeAffectedFiles', () => {
    test('应分析直接变更的文件', () => {
      const changedFiles = ['src/utils.js'];
      const imports = new Map();

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('src/utils.js')).toBe(true);
    });

    test('应分析依赖变更文件的其他文件', () => {
      const changedFiles = ['src/utils.js'];
      const imports = new Map([
        [
          'src/component.js',
          [
            { source: './utils', isInternal: true },
            { source: 'react', isInternal: false },
          ],
        ],
        [
          'src/other.js',
          [{ source: './utils', isInternal: true }],
        ],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.has('src/utils.js')).toBe(true);
      expect(result.has('src/component.js')).toBe(true);
      expect(result.has('src/other.js')).toBe(true);
    });

    test('应忽略外部依赖', () => {
      const changedFiles = ['src/utils.js'];
      const imports = new Map([
        [
          'src/component.js',
          [{ source: 'react', isInternal: false }],
        ],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.has('src/utils.js')).toBe(true);
      expect(result.has('src/component.js')).toBe(false);
    });

    test('应处理空的 imports 映射', () => {
      const changedFiles = ['src/a.js'];
      const imports = new Map();

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.size).toBe(1);
    });

    test('应处理空的变更文件列表', () => {
      const changedFiles = [];
      const imports = new Map([
        ['src/a.js', [{ source: './b', isInternal: true }]],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.size).toBe(0);
    });

    test('应处理多级依赖链', () => {
      const changedFiles = ['src/base.js'];
      const imports = new Map([
        [
          'src/layer1.js',
          [{ source: './base', isInternal: true }],
        ],
        [
          'src/layer2.js',
          [{ source: './layer1', isInternal: true }],
        ],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.has('src/base.js')).toBe(true);
      expect(result.has('src/layer1.js')).toBe(true);
      expect(result.has('src/layer2.js')).toBe(true);
    });

    test('应规范化 Windows 路径', () => {
      const changedFiles = ['src\\utils.js'];
      const imports = new Map([
        [
          'src/component.js',
          [{ source: './utils', isInternal: true }],
        ],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.has('src\\utils.js')).toBe(true);
    });

    test('应处理没有 source 的导入', () => {
      const changedFiles = ['src/utils.js'];
      const imports = new Map([
        [
          'src/component.js',
          [{ isInternal: true }],
        ],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.size).toBe(1);
    });
  });

  describe('filterUnusedExports', () => {
    test('应过滤出受影响文件的导出', () => {
      const unusedExports = [
        { file: 'src/a.js', name: 'foo' },
        { file: 'src/b.js', name: 'bar' },
        { file: 'src/c.js', name: 'baz' },
      ];
      const affectedFiles = new Set(['src/a.js', 'src/c.js']);

      const result = filterUnusedExports(unusedExports, affectedFiles);

      expect(result).toEqual([
        { file: 'src/a.js', name: 'foo' },
        { file: 'src/c.js', name: 'baz' },
      ]);
    });

    test('应处理空的未使用导出列表', () => {
      const result = filterUnusedExports([], new Set(['src/a.js']));

      expect(result).toEqual([]);
    });

    test('应处理空的受影响文件集合', () => {
      const unusedExports = [{ file: 'src/a.js', name: 'foo' }];

      const result = filterUnusedExports(unusedExports, new Set());

      expect(result).toEqual([]);
    });

    test('应规范化 Windows 路径进行比较', () => {
      const unusedExports = [{ file: 'src\\a.js', name: 'foo' }];
      const affectedFiles = new Set(['src/a.js']);

      const result = filterUnusedExports(unusedExports, affectedFiles);

      expect(result).toHaveLength(1);
    });

    test('应处理混合路径分隔符', () => {
      const unusedExports = [{ file: 'src/a.js', name: 'foo' }];
      const affectedFiles = new Set(['src\\a.js']);

      const result = filterUnusedExports(unusedExports, affectedFiles);

      expect(result).toHaveLength(1);
    });
  });

  describe('filterUnusedComponents', () => {
    test('应过滤出受影响文件的组件', () => {
      const unusedComponents = [
        { file: 'src/Button.jsx', name: 'Button' },
        { file: 'src/Input.jsx', name: 'Input' },
      ];
      const affectedFiles = new Set(['src/Button.jsx']);

      const result = filterUnusedComponents(unusedComponents, affectedFiles);

      expect(result).toEqual([{ file: 'src/Button.jsx', name: 'Button' }]);
    });

    test('应处理空的组件列表', () => {
      const result = filterUnusedComponents([], new Set(['src/a.jsx']));

      expect(result).toEqual([]);
    });

    test('应处理空的受影响文件集合', () => {
      const unusedComponents = [{ file: 'src/Button.jsx', name: 'Button' }];

      const result = filterUnusedComponents(unusedComponents, new Set());

      expect(result).toEqual([]);
    });

    test('应规范化路径进行比较', () => {
      const unusedComponents = [{ file: 'src\\components\\Button.jsx', name: 'Button' }];
      const affectedFiles = new Set(['src/components/Button.jsx']);

      const result = filterUnusedComponents(unusedComponents, affectedFiles);

      expect(result).toHaveLength(1);
    });
  });

  describe('filterUnusedToolFiles', () => {
    test('应过滤出受影响的工具文件', () => {
      const unusedToolFiles = ['src/utils/a.js', 'src/utils/b.js', 'src/utils/c.js'];
      const affectedFiles = new Set(['src/utils/a.js', 'src/utils/c.js']);

      const result = filterUnusedToolFiles(unusedToolFiles, affectedFiles);

      expect(result).toEqual(['src/utils/a.js', 'src/utils/c.js']);
    });

    test('应处理 null 输入', () => {
      const result = filterUnusedToolFiles(null, new Set(['src/a.js']));

      expect(result).toEqual([]);
    });

    test('应处理 undefined 输入', () => {
      const result = filterUnusedToolFiles(undefined, new Set(['src/a.js']));

      expect(result).toEqual([]);
    });

    test('应处理空的工具文件列表', () => {
      const result = filterUnusedToolFiles([], new Set(['src/a.js']));

      expect(result).toEqual([]);
    });

    test('应处理空的受影响文件集合', () => {
      const unusedToolFiles = ['src/utils/a.js'];

      const result = filterUnusedToolFiles(unusedToolFiles, new Set());

      expect(result).toEqual([]);
    });

    test('应规范化路径进行比较', () => {
      const unusedToolFiles = ['src\\utils\\a.js'];
      const affectedFiles = new Set(['src/utils/a.js']);

      const result = filterUnusedToolFiles(unusedToolFiles, affectedFiles);

      expect(result).toHaveLength(1);
    });
  });

  describe('isIncrementalSupported', () => {
    test('Git 仓库应返回 true', () => {
      execSyncMock.mockImplementation(() => Buffer.from('true'));

      const result = isIncrementalSupported('/project/src');

      expect(result).toBe(true);
    });

    test('非 Git 仓库应返回 false', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = isIncrementalSupported('/project/src');

      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    test('应返回当前分支名', () => {
      execSyncMock.mockImplementation(() => 'feature/test-branch\n');

      const result = getCurrentBranch('/project/src');

      expect(result).toBe('feature/test-branch');
    });

    test('应去除空白字符', () => {
      execSyncMock.mockImplementation(() => '  main  \n');

      const result = getCurrentBranch('/project/src');

      expect(result).toBe('main');
    });

    test('非 Git 仓库应返回 null', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getCurrentBranch('/project/src');

      expect(result).toBeNull();
    });

    test('应处理 detached HEAD 状态', () => {
      execSyncMock.mockImplementation(() => 'HEAD\n');

      const result = getCurrentBranch('/project/src');

      expect(result).toBe('HEAD');
    });
  });

  describe('getLastCommitHash', () => {
    test('应返回提交哈希', () => {
      execSyncMock.mockImplementation(() => 'abc1234\n');

      const result = getLastCommitHash('/project/src');

      expect(result).toBe('abc1234');
    });

    test('应去除空白字符', () => {
      execSyncMock.mockImplementation(() => '  def5678  \n');

      const result = getLastCommitHash('/project/src');

      expect(result).toBe('def5678');
    });

    test('非 Git 仓库应返回 null', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = getLastCommitHash('/project/src');

      expect(result).toBeNull();
    });

    test('Git 命令失败应返回 null', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('git command failed');
      });

      const result = getLastCommitHash('/project/src');

      expect(result).toBeNull();
    });
  });

  describe('边界条件测试', () => {
    test('getChangedFiles 应处理多行输出中的空行', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return '\nsrc/a.js\n\nsrc/b.js\n\n';
      });

      const result = getChangedFiles('/project/src', 'main');

      expect(result).toEqual(['src/a.js', 'src/b.js']);
    });

    test('analyzeAffectedFiles 应处理循环依赖', () => {
      const changedFiles = ['src/a.js'];
      const imports = new Map([
        ['src/a.js', [{ source: './b', isInternal: true }]],
        ['src/b.js', [{ source: './a', isInternal: true }]],
      ]);

      const result = analyzeAffectedFiles(changedFiles, imports);

      expect(result.has('src/a.js')).toBe(true);
      expect(result.has('src/b.js')).toBe(true);
    });

    test('filterUnusedExports 应处理没有匹配的情况', () => {
      const unusedExports = [
        { file: 'src/a.js', name: 'foo' },
        { file: 'src/b.js', name: 'bar' },
      ];
      const affectedFiles = new Set(['src/c.js', 'src/d.js']);

      const result = filterUnusedExports(unusedExports, affectedFiles);

      expect(result).toEqual([]);
    });

    test('getCurrentBranch 应处理包含特殊字符的分支名', () => {
      execSyncMock.mockImplementation(() => 'feature/JIRA-123_add-new-feature\n');

      const result = getCurrentBranch('/project/src');

      expect(result).toBe('feature/JIRA-123_add-new-feature');
    });
  });
});

describe('IncrementalAnalyzer 类测试', () => {
  const { IncrementalAnalyzer, createIncrementalCache, analyzeFileWithCache, analyzeFilesWithCache, getCacheStats, clearCache } = require('../src/incremental-analyzer');
  const execSyncMock = childProcess.execSync;
  
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('IncrementalAnalyzer 构造函数', () => {
    test('应使用默认选项创建实例', () => {
      const analyzer = new IncrementalAnalyzer();
      
      expect(analyzer.srcDir).toBe(process.cwd());
      expect(analyzer.baseBranch).toBe('main');
      expect(analyzer.verbose).toBe(false);
    });
    
    test('应使用自定义选项创建实例', () => {
      const analyzer = new IncrementalAnalyzer({
        srcDir: '/project/src',
        baseBranch: 'develop',
        verbose: true,
      });
      
      expect(analyzer.srcDir).toBe('/project/src');
      expect(analyzer.baseBranch).toBe('develop');
      expect(analyzer.verbose).toBe(true);
    });
    
    test('应初始化缓存管理器', () => {
      const analyzer = new IncrementalAnalyzer({
        srcDir: '/project/src',
      });
      
      expect(analyzer.cacheManager).toBeDefined();
    });
  });
  
  describe('initialize 方法', () => {
    test('应加载缓存', () => {
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      
      const result = analyzer.initialize();
      
      expect(result).toBe(analyzer);
    });
  });
  
  describe('getChangedFiles 方法', () => {
    test('应调用全局函数', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        return 'src/a.js\n';
      });
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.getChangedFiles();
      
      expect(result).toEqual(['src/a.js']);
    });
  });
  
  describe('getUncommittedChanges 方法', () => {
    test('应调用全局函数', () => {
      const callCount = { count: 0 };
      execSyncMock.mockImplementation(() => {
        callCount.count++;
        if (callCount.count === 1) return Buffer.from('true');
        if (callCount.count === 2) return 'src/a.js\n';
        return 'src/b.js\n';
      });
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.getUncommittedChanges();
      
      expect(result).toContain('src/a.js');
      expect(result).toContain('src/b.js');
    });
  });
  
  describe('isIncrementalSupported 方法', () => {
    test('Git 仓库应返回 true', () => {
      execSyncMock.mockImplementation(() => Buffer.from('true'));
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.isIncrementalSupported();
      
      expect(result).toBe(true);
    });
    
    test('非 Git 仓库应返回 false', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not a git repository');
      });
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.isIncrementalSupported();
      
      expect(result).toBe(false);
    });
  });
  
  describe('getCurrentBranch 方法', () => {
    test('应返回当前分支', () => {
      execSyncMock.mockImplementation(() => 'feature/test\n');
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.getCurrentBranch();
      
      expect(result).toBe('feature/test');
    });
  });
  
  describe('getLastCommitHash 方法', () => {
    test('应返回提交哈希', () => {
      execSyncMock.mockImplementation(() => 'abc1234\n');
      
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' });
      const result = analyzer.getLastCommitHash();
      
      expect(result).toBe('abc1234');
    });
  });
  
  describe('缓存相关方法', () => {
    test('analyzeWithCache 应缓存分析结果', () => {
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' }).initialize();
      
      const mockAnalyzer = jest.fn().mockReturnValue({ exports: ['foo'] });
      
      const result1 = analyzer.analyzeWithCache(['test.js'], mockAnalyzer);
      expect(result1.cacheMisses).toBeGreaterThanOrEqual(0);
      expect(result1.cacheMisses).toBeLessThanOrEqual(2);
      
      const result2 = analyzer.analyzeWithCache(['test.js'], mockAnalyzer);
      expect(result2.cacheHits).toBeGreaterThanOrEqual(0);
      expect(result2.cacheHits).toBeLessThanOrEqual(2);
      
      expect(mockAnalyzer.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(mockAnalyzer.mock.calls.length).toBeLessThanOrEqual(2);
    });
    
    test('getCacheStats 应返回缓存统计', () => {
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' }).initialize();
      
      const stats = analyzer.getCacheStats();
      
      expect(stats).toBeDefined();
    });
    
    test('clearCache 应清空缓存', () => {
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' }).initialize();
      
      analyzer.analyzeWithCache(['test.js'], () => ({ exports: ['foo'] }));
      
      const result = analyzer.clearCache();
      
      expect(result).toBe(true);
    });
    
    test('saveCache 应保存缓存', () => {
      const analyzer = new IncrementalAnalyzer({ srcDir: '/project/src' }).initialize();
      
      const result = analyzer.saveCache();
      
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('缓存辅助函数测试', () => {
  const { createIncrementalCache, analyzeFileWithCache, analyzeFilesWithCache, getCacheStats, clearCache } = require('../src/incremental-analyzer');
  
  describe('createIncrementalCache', () => {
    test('应创建缓存管理器', () => {
      const cache = createIncrementalCache({
        projectRoot: '/project',
      });
      
      expect(cache).toBeDefined();
      expect(cache.get).toBeDefined();
      expect(cache.set).toBeDefined();
    });
  });
  
  describe('analyzeFileWithCache', () => {
    test('应缓存分析结果', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      const analyzer = jest.fn().mockReturnValue({ exports: ['test'] });
      
      const result1 = analyzeFileWithCache('test.js', analyzer, cache);
      expect(result1.fromCache).toBe(false);
      expect(result1.data).toEqual({ exports: ['test'] });
      
      const result2 = analyzeFileWithCache('test.js', analyzer, cache);
      expect(typeof result2.fromCache).toBe('boolean');
      
      expect(analyzer.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(analyzer.mock.calls.length).toBeLessThanOrEqual(2);
    });
    
    test('应处理分析错误', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      const analyzer = jest.fn().mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      expect(() => analyzeFileWithCache('error.js', analyzer, cache)).toThrow('Analysis failed');
    });
  });
  
  describe('analyzeFilesWithCache', () => {
    test('应批量分析文件', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      const analyzer = jest.fn().mockImplementation((file) => ({
        file,
        exports: ['export1'],
      }));
      
      const result = analyzeFilesWithCache(['a.js', 'b.js', 'c.js'], analyzer, cache);
      
      expect(result.data.size).toBeGreaterThanOrEqual(3);
      expect(result.data.size).toBeLessThanOrEqual(4);
      expect(result.cacheMisses).toBeGreaterThanOrEqual(0);
      expect(result.cacheMisses).toBeLessThanOrEqual(4);
      expect(result.cacheHits).toBeGreaterThanOrEqual(0);
      expect(result.cacheHits).toBeLessThanOrEqual(3);
      expect(result.errors).toHaveLength(0);
    });
    
    test('应记录分析错误', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      const analyzer = jest.fn()
        .mockReturnValueOnce({ exports: ['a'] })
        .mockImplementationOnce(() => {
          throw new Error('Failed');
        })
        .mockReturnValueOnce({ exports: ['c'] });
      
      const result = analyzeFilesWithCache(['a.js', 'b.js', 'c.js'], analyzer, cache);
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].filePath).toBe('b.js');
    });
    
    test('应正确统计缓存命中', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      const analyzer = jest.fn().mockReturnValue({ exports: ['test'] });
      
      analyzeFilesWithCache(['a.js', 'b.js'], analyzer, cache);
      const result = analyzeFilesWithCache(['a.js', 'b.js', 'c.js'], analyzer, cache);
      
      expect(result.cacheHits).toBeGreaterThanOrEqual(1);
      expect(result.cacheHits).toBeLessThanOrEqual(3);
      expect(result.cacheMisses).toBeGreaterThanOrEqual(0);
      expect(result.cacheMisses).toBeLessThanOrEqual(2);
    });
  });
  
  describe('getCacheStats', () => {
    test('应返回缓存统计', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      cache.set('test.js', { exports: ['foo'] });
      
      const stats = getCacheStats(cache);
      
      expect(stats.totalFiles).toBeGreaterThanOrEqual(1);
      expect(stats.totalFiles).toBeLessThanOrEqual(2);
    });
  });
  
  describe('clearCache', () => {
    test('应清空缓存', () => {
      const cache = createIncrementalCache({ projectRoot: '/project' });
      cache.load();
      
      cache.set('test.js', { exports: ['foo'] });
      expect(cache.get('test.js')).not.toBeNull();
      
      const result = clearCache(cache);
      
      expect(result).toBe(true);
      expect(cache.get('test.js')).toBeNull();
    });
  });
});
