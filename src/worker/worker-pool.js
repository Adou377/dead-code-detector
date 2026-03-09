/**
 * Worker 线程池管理
 *
 * 使用 Node.js worker_threads 实现并行处理
 */

const { Worker, isMainThread } = require('worker_threads');
const os = require('os');
const path = require('path');

const DEFAULT_WORKER_COUNT = Math.max(1, os.cpus().length - 1);
const TASK_TIMEOUT = 60000;

/**
 * Worker 线程池类
 */
class WorkerPool {
  /**
   * 创建 Worker 线程池
   * @param {Object} options - 配置选项
   * @param {string} options.workerPath - Worker 脚本路径
   * @param {number} [options.workerCount] - Worker 数量，默认 CPU 核心数 - 1
   * @param {number} [options.taskTimeout] - 任务超时时间（毫秒）
   */
  constructor(options) {
    const { workerPath, workerCount = DEFAULT_WORKER_COUNT, taskTimeout = TASK_TIMEOUT } = options;

    if (!isMainThread) {
      throw new Error('WorkerPool 只能在主线程中使用');
    }

    this.workerPath = workerPath;
    this.workerCount = workerCount;
    this.taskTimeout = taskTimeout;
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.taskIdCounter = 0;
    this.isShuttingDown = false;
  }

  /**
   * 初始化线程池
   * @returns {Promise<void>}
   */
  async initialize() {
    const initPromises = [];

    for (let i = 0; i < this.workerCount; i++) {
      initPromises.push(this.createWorker());
    }

    await Promise.all(initPromises);
  }

  /**
   * 创建单个 Worker
   * @returns {Promise<Object>} Worker 实例
   */
  createWorker() {
    return new Promise(resolve => {
      const worker = new Worker(this.workerPath);

      const workerInfo = {
        worker,
        isBusy: false,
        currentTaskId: null,
      };

      worker.on('message', message => {
        this.handleWorkerMessage(workerInfo, message);
      });

      worker.on('error', error => {
        this.handleWorkerError(workerInfo, error);
      });

      worker.on('exit', code => {
        this.handleWorkerExit(workerInfo, code);
      });

      worker.once('online', () => {
        this.workers.push(workerInfo);
        resolve(workerInfo);
      });
    });
  }

  /**
   * 处理 Worker 消息
   * @param {Object} workerInfo - Worker 信息
   * @param {Object} message - 消息内容
   */
  handleWorkerMessage(workerInfo, message) {
    const { type, taskId, result, error } = message;

    if (type === 'task_complete') {
      const task = this.activeTasks.get(taskId);
      if (task) {
        this.activeTasks.delete(taskId);

        if (error) {
          task.reject(new Error(error));
        } else {
          task.resolve(result);
        }

        workerInfo.isBusy = false;
        workerInfo.currentTaskId = null;

        this.processNextTask(workerInfo);
      }
    }
  }

  /**
   * 处理 Worker 错误
   * @param {Object} workerInfo - Worker 信息
   * @param {Error} error - 错误对象
   */
  handleWorkerError(workerInfo, error) {
    const taskId = workerInfo.currentTaskId;

    if (taskId) {
      const task = this.activeTasks.get(taskId);
      if (task) {
        this.activeTasks.delete(taskId);
        task.reject(error);
      }
    }

    workerInfo.isBusy = false;
    workerInfo.currentTaskId = null;

    const workerIndex = this.workers.indexOf(workerInfo);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }

    if (!this.isShuttingDown && this.workers.length < this.workerCount) {
      this.createWorker().then(() => {
        this.processQueue();
      });
    }
  }

  /**
   * 处理 Worker 退出
   * @param {Object} workerInfo - Worker 信息
   * @param {number} code - 退出码
   */
  handleWorkerExit(workerInfo, code) {
    const taskId = workerInfo.currentTaskId;

    if (taskId) {
      const task = this.activeTasks.get(taskId);
      if (task) {
        this.activeTasks.delete(taskId);
        task.reject(new Error(`Worker 意外退出，退出码: ${code}`));
      }
    }

    const workerIndex = this.workers.indexOf(workerInfo);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }
  }

  /**
   * 执行任务
   * @param {Object} task - 任务数据
   * @returns {Promise<any>} 任务结果
   */
  execute(task) {
    return new Promise((resolve, reject) => {
      if (this.isShuttingDown) {
        reject(new Error('线程池正在关闭'));
        return;
      }

      const taskId = ++this.taskIdCounter;

      const taskInfo = {
        taskId,
        task,
        resolve,
        reject,
        timeoutId: null,
      };

      if (this.taskTimeout > 0) {
        taskInfo.timeoutId = setTimeout(() => {
          this.activeTasks.delete(taskId);
          reject(new Error(`任务执行超时 (${this.taskTimeout}ms)`));
        }, this.taskTimeout);
      }

      this.taskQueue.push(taskInfo);
      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  processQueue() {
    if (this.taskQueue.length === 0) {
      return;
    }

    const availableWorker = this.workers.find(w => !w.isBusy);

    if (availableWorker) {
      this.processNextTask(availableWorker);
    }
  }

  /**
   * 为指定 Worker 处理下一个任务
   * @param {Object} workerInfo - Worker 信息
   */
  processNextTask(workerInfo) {
    if (this.taskQueue.length === 0 || workerInfo.isBusy) {
      return;
    }

    const taskInfo = this.taskQueue.shift();

    workerInfo.isBusy = true;
    workerInfo.currentTaskId = taskInfo.taskId;

    this.activeTasks.set(taskInfo.taskId, taskInfo);

    workerInfo.worker.postMessage({
      type: 'execute',
      taskId: taskInfo.taskId,
      task: taskInfo.task,
    });
  }

  /**
   * 关闭线程池
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.isShuttingDown = true;

    for (const taskInfo of this.activeTasks.values()) {
      if (taskInfo.timeoutId) {
        clearTimeout(taskInfo.timeoutId);
      }
      taskInfo.reject(new Error('线程池正在关闭'));
    }
    this.activeTasks.clear();
    this.taskQueue = [];

    const terminatePromises = this.workers.map(workerInfo => {
      return workerInfo.worker.terminate();
    });

    await Promise.all(terminatePromises);
    this.workers = [];
  }

  /**
   * 获取线程池状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      workerCount: this.workers.length,
      busyWorkers: this.workers.filter(w => w.isBusy).length,
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
    };
  }
}

/**
 * 创建 Worker 线程池
 * @param {Object} options - 配置选项
 * @returns {WorkerPool} 线程池实例
 */
function createWorkerPool(options) {
  const workerPath = options.workerPath || path.join(__dirname, 'parse-worker.js');

  return new WorkerPool({
    ...options,
    workerPath,
  });
}

module.exports = {
  WorkerPool,
  createWorkerPool,
  DEFAULT_WORKER_COUNT,
};
