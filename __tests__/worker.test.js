/**
 * Worker 线程池测试
 */

const { WorkerPool, createWorkerPool, DEFAULT_WORKER_COUNT } = require('../src/worker/index.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Worker 模块', () => {
  describe('导出', () => {
    test('应该导出 WorkerPool 类', () => {
      expect(WorkerPool).toBeDefined();
      expect(typeof WorkerPool).toBe('function');
    });

    test('应该导出 createWorkerPool 函数', () => {
      expect(createWorkerPool).toBeDefined();
      expect(typeof createWorkerPool).toBe('function');
    });

    test('应该导出 DEFAULT_WORKER_COUNT 常量', () => {
      expect(DEFAULT_WORKER_COUNT).toBeDefined();
      expect(typeof DEFAULT_WORKER_COUNT).toBe('number');
      expect(DEFAULT_WORKER_COUNT).toBeGreaterThan(0);
    });
  });

  describe('createWorkerPool', () => {
    test('应该创建 WorkerPool 实例', () => {
      const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
      const pool = createWorkerPool({ workerPath });

      expect(pool).toBeInstanceOf(WorkerPool);
      expect(pool.workerCount).toBe(DEFAULT_WORKER_COUNT);
    });

    test('应该使用自定义 Worker 数量', () => {
      const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
      const pool = createWorkerPool({ workerPath, workerCount: 2 });

      expect(pool.workerCount).toBe(2);
    });
  });
});

describe('WorkerPool 构造函数', () => {
  test('应该正确设置默认参数', () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const testPool = new WorkerPool({ workerPath });

    expect(testPool.workerPath).toBe(workerPath);
    expect(testPool.workerCount).toBe(DEFAULT_WORKER_COUNT);
    expect(testPool.taskTimeout).toBe(60000);
    expect(testPool.workers).toEqual([]);
    expect(testPool.taskQueue).toEqual([]);
    expect(testPool.activeTasks).toBeInstanceOf(Map);
    expect(testPool.isShuttingDown).toBe(false);
  });

  test('应该正确设置自定义参数', () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const testPool = new WorkerPool({
      workerPath,
      workerCount: 4,
      taskTimeout: 5000,
    });

    expect(testPool.workerCount).toBe(4);
    expect(testPool.taskTimeout).toBe(5000);
  });
});

describe('WorkerPool', () => {
  let pool;
  let testDir;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-test-'));

    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 2,
      taskTimeout: 30000,
    });

    await pool.initialize();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('初始化', () => {
    test('应该正确初始化 Worker 线程池', () => {
      const status = pool.getStatus();

      expect(status.workerCount).toBe(2);
      expect(status.busyWorkers).toBe(0);
      expect(status.queueLength).toBe(0);
      expect(status.activeTasks).toBe(0);
    });
  });

  describe('任务执行', () => {
    test('应该执行单个解析任务', async () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const result = await pool.execute({
        type: 'parseFile',
        options: {
          filePath: testFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe('foo');
    });

    test('应该执行批量解析任务', async () => {
      const files = [];
      for (let i = 0; i < 5; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
        files.push(filePath);
      }

      const results = await pool.execute({
        type: 'parseFiles',
        options: {
          filePaths: files,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(results).toBeDefined();
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.exports).toHaveLength(1);
        expect(result.exports[0].name).toBe(`value${index}`);
      });
    });

    test('应该正确解析 Vue 文件', async () => {
      const vueFile = path.join(testDir, 'TestComponent.vue');
      fs.writeFileSync(
        vueFile,
        `<script setup>
export const testProp = 'value';
</script>
<template>
  <div>Test</div>
</template>`
      );

      const result = await pool.execute({
        type: 'parseFile',
        options: {
          filePath: vueFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.vueInfo).toBeDefined();
    });

    test('应该正确解析 TypeScript 文件', async () => {
      const tsFile = path.join(testDir, 'types.ts');
      fs.writeFileSync(
        tsFile,
        `export interface User {
  name: string;
  age: number;
}

export const getUser = (): User => ({ name: 'test', age: 20 });`
      );

      const result = await pool.execute({
        type: 'parseFile',
        options: {
          filePath: tsFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('应该处理解析错误', async () => {
      const invalidFile = path.join(testDir, 'invalid.js');
      fs.writeFileSync(invalidFile, 'this is not valid javascript {{{');

      const result = await pool.execute({
        type: 'parseFile',
        options: {
          filePath: invalidFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('应该处理不存在的文件', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.js');

      const result = await pool.execute({
        type: 'parseFile',
        options: {
          filePath: nonExistentFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('并发处理', () => {
    test('应该并发处理多个任务', async () => {
      const files = [];
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `concurrent${i}.js`);
        fs.writeFileSync(filePath, `export const concurrent${i} = ${i};`);
        files.push(filePath);
      }

      const promises = files.map(filePath =>
        pool.execute({
          type: 'parseFile',
          options: {
            filePath,
            srcDir: testDir,
            maxFileSize: 1000000,
          },
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.exports[0].name).toBe(`concurrent${index}`);
      });
    });
  });

  describe('状态管理', () => {
    test('应该正确报告线程池状态', async () => {
      const status = pool.getStatus();

      expect(status).toHaveProperty('workerCount');
      expect(status).toHaveProperty('busyWorkers');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('activeTasks');
    });
  });

  describe('关闭', () => {
    test('应该优雅关闭线程池', async () => {
      const localPool = createWorkerPool({
        workerPath: path.join(__dirname, '../src/worker/parse-worker.js'),
        workerCount: 2,
      });

      await localPool.initialize();
      await localPool.shutdown();

      const status = localPool.getStatus();
      expect(status.workerCount).toBe(0);
    });
  });
});

describe('Worker 模式集成测试', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-integration-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该正确检测 Worker 模式是否应该启用', () => {
    const { DeadCodeFinderAST } = require('../src/detector-ast.js');

    const finderAuto = new DeadCodeFinderAST({
      srcDir: testDir,
      workerThreshold: 100,
    });

    finderAuto.sourceFiles = Array(150).fill('file.js');
    expect(finderAuto.shouldUseWorkerMode()).toBe(true);

    finderAuto.sourceFiles = Array(50).fill('file.js');
    expect(finderAuto.shouldUseWorkerMode()).toBe(false);
  });

  test('应该支持强制启用 Worker 模式', () => {
    const { DeadCodeFinderAST } = require('../src/detector-ast.js');

    const finder = new DeadCodeFinderAST({
      srcDir: testDir,
      useWorker: true,
    });

    finder.sourceFiles = ['single.js'];
    expect(finder.shouldUseWorkerMode()).toBe(true);
  });

  test('应该支持强制禁用 Worker 模式', () => {
    const { DeadCodeFinderAST } = require('../src/detector-ast.js');

    const finder = new DeadCodeFinderAST({
      srcDir: testDir,
      useWorker: false,
      workerThreshold: 0,
    });

    finder.sourceFiles = Array(1000).fill('file.js');
    expect(finder.shouldUseWorkerMode()).toBe(false);
  });

  test('应该正确创建文件批次', () => {
    const { DeadCodeFinderAST } = require('../src/detector-ast.js');

    const finder = new DeadCodeFinderAST({ srcDir: testDir });
    const files = Array(125).fill('file.js');

    const batches = finder.createBatches(files, 50);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(50);
    expect(batches[2]).toHaveLength(25);
  });
});

describe('WorkerPool 错误恢复测试', () => {
  let pool;
  let testDir;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-error-test-'));

    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 2,
      taskTimeout: 30000,
    });

    await pool.initialize();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该在 Worker 崩溃后自动恢复并继续处理任务', async () => {
    const testFile = path.join(testDir, 'test.js');
    fs.writeFileSync(testFile, 'export const recovered = true;');

    const initialWorkerCount = pool.getStatus().workerCount;

    const workerInfo = pool.workers[0];
    await workerInfo.worker.terminate();

    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await pool.execute({
      type: 'parseFile',
      options: {
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.exports[0].name).toBe('recovered');
  });

  test('应该在 Worker 意外退出时正确处理当前任务', async () => {
    const testFile = path.join(testDir, 'exit-test.js');
    fs.writeFileSync(testFile, 'export const exitTest = 1;');

    const workerInfo = pool.workers[0];
    workerInfo.isBusy = true;
    workerInfo.currentTaskId = 999;

    const taskPromise = pool.execute({
      type: 'parseFile',
      options: {
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    await workerInfo.worker.terminate();
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = await taskPromise;
    expect(result.success).toBe(true);
  });
});

describe('WorkerPool 超时处理测试', () => {
  let pool;
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-timeout-test-'));
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该在任务超时后拒绝 Promise', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 1,
    });

    await pool.initialize();

    const testFile = path.join(testDir, 'timeout-test.js');
    fs.writeFileSync(testFile, 'export const timeout = 1;');

    await expect(
      pool.execute({
        type: 'parseFile',
        options: {
          filePath: testFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    ).rejects.toThrow('任务执行超时');
  });

  test('应该正确设置超时定时器', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 1000,
    });

    await pool.initialize();

    const testFile = path.join(testDir, 'timer-test.js');
    fs.writeFileSync(testFile, 'export const timer = 1;');

    const executePromise = pool.execute({
      type: 'parseFile',
      options: {
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    await executePromise;

    const status = pool.getStatus();
    expect(status.activeTasks).toBe(0);
  });
});

describe('WorkerPool 任务队列管理测试', () => {
  let pool;
  let testDir;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-queue-test-'));

    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该正确排队处理任务', async () => {
    const files = [];
    for (let i = 0; i < 5; i++) {
      const filePath = path.join(testDir, `queue${i}.js`);
      fs.writeFileSync(filePath, `export const queue${i} = ${i};`);
      files.push(filePath);
    }

    const promises = files.map(filePath =>
      pool.execute({
        type: 'parseFile',
        options: {
          filePath,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    const statusDuringExecution = pool.getStatus();
    expect(statusDuringExecution.queueLength + statusDuringExecution.activeTasks).toBeGreaterThan(0);

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.exports[0].name).toBe(`queue${index}`);
    });
  });

  test('应该正确报告队列长度', async () => {
    const files = [];
    for (let i = 0; i < 10; i++) {
      const filePath = path.join(testDir, `length${i}.js`);
      fs.writeFileSync(filePath, `export const length${i} = ${i};`);
      files.push(filePath);
    }

    const slowPromises = files.map(filePath =>
      pool.execute({
        type: 'parseFile',
        options: {
          filePath,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    );

    await new Promise(resolve => setTimeout(resolve, 20));

    const status = pool.getStatus();
    expect(status.queueLength + status.activeTasks).toBe(10);

    await Promise.all(slowPromises);

    const finalStatus = pool.getStatus();
    expect(finalStatus.queueLength).toBe(0);
    expect(finalStatus.activeTasks).toBe(0);
  });

  test('应该在关闭时清空队列', async () => {
    const localPool = createWorkerPool({
      workerPath: path.join(__dirname, '../src/worker/parse-worker.js'),
      workerCount: 1,
    });

    await localPool.initialize();

    const testFile = path.join(testDir, 'shutdown.js');
    fs.writeFileSync(testFile, 'export const shutdown = 1;');

    const taskPromises = [];
    for (let i = 0; i < 5; i++) {
      taskPromises.push(
        localPool.execute({
          type: 'parseFile',
          options: {
            filePath: testFile,
            srcDir: testDir,
            maxFileSize: 1000000,
          },
        }).catch(() => {})
      );
    }

    await new Promise(resolve => setTimeout(resolve, 10));

    await localPool.shutdown();

    const status = localPool.getStatus();
    expect(status.queueLength).toBe(0);
    expect(status.activeTasks).toBe(0);
    expect(status.workerCount).toBe(0);
  });
});

describe('WorkerPool 关闭测试', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-shutdown-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该在关闭时拒绝新任务', async () => {
    const localPool = createWorkerPool({
      workerPath: path.join(__dirname, '../src/worker/parse-worker.js'),
      workerCount: 1,
    });

    await localPool.initialize();

    const shutdownPromise = localPool.shutdown();

    const testFile = path.join(testDir, 'reject.js');
    fs.writeFileSync(testFile, 'export const reject = 1;');

    await expect(
      localPool.execute({
        type: 'parseFile',
        options: {
          filePath: testFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    ).rejects.toThrow('线程池正在关闭');

    await shutdownPromise;
  });

  test('应该在关闭时取消活动任务', async () => {
    const localPool = createWorkerPool({
      workerPath: path.join(__dirname, '../src/worker/parse-worker.js'),
      workerCount: 1,
    });

    await localPool.initialize();

    const testFile = path.join(testDir, 'cancel.js');
    fs.writeFileSync(testFile, 'export const cancel = 1;');

    const taskPromise = localPool
      .execute({
        type: 'parseFile',
        options: {
          filePath: testFile,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
      .catch(() => {});

    await new Promise(resolve => setTimeout(resolve, 5));

    await localPool.shutdown();

    expect(localPool.isShuttingDown).toBe(true);
    expect(localPool.workers).toEqual([]);
  });

  test('应该正确清理超时定时器', async () => {
    const localPool = createWorkerPool({
      workerPath: path.join(__dirname, '../src/worker/parse-worker.js'),
      workerCount: 1,
      taskTimeout: 10000,
    });

    await localPool.initialize();

    const testFile = path.join(testDir, 'cleanup.js');
    fs.writeFileSync(testFile, 'export const cleanup = 1;');

    const taskPromise = localPool.execute({
      type: 'parseFile',
      options: {
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    await taskPromise;

    await localPool.shutdown();

    expect(localPool.activeTasks.size).toBe(0);
  });
});

describe('WorkerPool 边界情况测试', () => {
  let pool;
  let testDir;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-edge-test-'));

    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    pool = createWorkerPool({
      workerPath,
      workerCount: 2,
      taskTimeout: 30000,
    });

    await pool.initialize();
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该正确处理空文件', async () => {
    const emptyFile = path.join(testDir, 'empty.js');
    fs.writeFileSync(emptyFile, '');

    const result = await pool.execute({
      type: 'parseFile',
      options: {
        filePath: emptyFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.exports).toEqual([]);
  });

  test('应该正确处理大文件', async () => {
    const largeFile = path.join(testDir, 'large.js');
    const largeContent = Array(1000)
      .fill(null)
      .map((_, i) => `export const item${i} = ${i};`)
      .join('\n');
    fs.writeFileSync(largeFile, largeContent);

    const result = await pool.execute({
      type: 'parseFile',
      options: {
        filePath: largeFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('应该正确处理特殊字符文件名', async () => {
    const specialFile = path.join(testDir, 'special-file_测试.js');
    fs.writeFileSync(specialFile, 'export const special = "测试";');

    const result = await pool.execute({
      type: 'parseFile',
      options: {
        filePath: specialFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('应该正确处理多个 Worker 同时空闲', async () => {
    const files = [];
    for (let i = 0; i < 4; i++) {
      const filePath = path.join(testDir, `multi${i}.js`);
      fs.writeFileSync(filePath, `export const multi${i} = ${i};`);
      files.push(filePath);
    }

    const promises = files.map(filePath =>
      pool.execute({
        type: 'parseFile',
        options: {
          filePath,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  test('应该正确报告忙碌 Worker 数量', async () => {
    const files = [];
    for (let i = 0; i < 3; i++) {
      const filePath = path.join(testDir, `busy${i}.js`);
      fs.writeFileSync(filePath, `export const busy${i} = ${i};`);
      files.push(filePath);
    }

    const promises = files.map(filePath =>
      pool.execute({
        type: 'parseFile',
        options: {
          filePath,
          srcDir: testDir,
          maxFileSize: 1000000,
        },
      })
    );

    await new Promise(resolve => setTimeout(resolve, 10));

    const status = pool.getStatus();
    expect(status.busyWorkers).toBeGreaterThanOrEqual(0);
    expect(status.busyWorkers).toBeLessThanOrEqual(2);

    await Promise.all(promises);
  });
});

describe('createWorkerPool 默认路径测试', () => {
  test('应该使用默认 worker 路径', () => {
    const testPool = createWorkerPool({});

    expect(testPool.workerPath).toContain('parse-worker.js');
  });
});

describe('WorkerPool 分支覆盖测试', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-branch-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('应该在 Worker error 事件时拒绝当前任务', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];
    workerInfo.isBusy = true;
    workerInfo.currentTaskId = 999;

    const testTask = {
      taskId: 999,
      task: { type: 'test' },
      resolve: jest.fn(),
      reject: jest.fn(),
      timeoutId: null,
    };
    pool.activeTasks.set(999, testTask);

    const testError = new Error('Worker error test');
    pool.handleWorkerError(workerInfo, testError);

    expect(testTask.reject).toHaveBeenCalledWith(testError);
    expect(pool.activeTasks.has(999)).toBe(false);

    await pool.shutdown();
  });

  test('应该在 Worker error 事件时没有当前任务也能正常处理', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    const testError = new Error('Worker error without task');
    pool.handleWorkerError(workerInfo, testError);

    expect(pool.workers.length).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(pool.workers.length).toBe(1);

    await pool.shutdown();
  });

  test('应该在 Worker exit 事件时拒绝当前任务', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];
    workerInfo.currentTaskId = 888;

    const testTask = {
      taskId: 888,
      task: { type: 'test' },
      resolve: jest.fn(),
      reject: jest.fn(),
      timeoutId: null,
    };
    pool.activeTasks.set(888, testTask);

    pool.handleWorkerExit(workerInfo, 1);

    expect(testTask.reject).toHaveBeenCalled();
    expect(pool.activeTasks.has(888)).toBe(false);

    await pool.shutdown();
  });

  test('应该在 Worker exit 事件时没有当前任务也能正常处理', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    pool.handleWorkerExit(workerInfo, 0);

    expect(pool.workers.length).toBe(0);

    await pool.shutdown();
  });

  test('应该在 handleWorkerMessage 时处理 error 分支', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    const testTask = {
      taskId: 777,
      task: { type: 'test' },
      resolve: jest.fn(),
      reject: jest.fn(),
      timeoutId: null,
    };
    pool.activeTasks.set(777, testTask);

    pool.handleWorkerMessage(workerInfo, {
      type: 'task_complete',
      taskId: 777,
      error: '任务执行失败',
    });

    expect(testTask.reject).toHaveBeenCalledWith(new Error('任务执行失败'));
    expect(pool.activeTasks.has(777)).toBe(false);

    await pool.shutdown();
  });

  test('应该在 handleWorkerMessage 时忽略未知 taskId', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    pool.handleWorkerMessage(workerInfo, {
      type: 'task_complete',
      taskId: 99999,
      result: { success: true },
    });

    expect(pool.activeTasks.size).toBe(0);

    await pool.shutdown();
  });

  test('应该在 handleWorkerMessage 时忽略非 task_complete 消息', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    pool.handleWorkerMessage(workerInfo, {
      type: 'unknown_type',
      taskId: 1,
    });

    expect(pool.activeTasks.size).toBe(0);

    await pool.shutdown();
  });

  test('应该在 processNextTask 时跳过忙碌的 Worker', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];
    workerInfo.isBusy = true;

    const testTask = {
      taskId: 666,
      task: { type: 'test' },
      resolve: jest.fn(),
      reject: jest.fn(),
      timeoutId: null,
    };
    pool.taskQueue.push(testTask);

    pool.processNextTask(workerInfo);

    expect(pool.taskQueue.length).toBe(1);

    await pool.shutdown();
  });

  test('应该在 processNextTask 时跳过空队列', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 30000,
    });

    await pool.initialize();

    const workerInfo = pool.workers[0];

    pool.processNextTask(workerInfo);

    expect(pool.activeTasks.size).toBe(0);

    await pool.shutdown();
  });

  test('应该支持 taskTimeout 为 0 时不设置超时', async () => {
    const workerPath = path.join(__dirname, '../src/worker/parse-worker.js');
    const pool = createWorkerPool({
      workerPath,
      workerCount: 1,
      taskTimeout: 0,
    });

    await pool.initialize();

    const testFile = path.join(testDir, 'no-timeout.js');
    fs.writeFileSync(testFile, 'export const noTimeout = 1;');

    const result = await pool.execute({
      type: 'parseFile',
      options: {
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      },
    });

    expect(result.success).toBe(true);

    await pool.shutdown();
  });
});
