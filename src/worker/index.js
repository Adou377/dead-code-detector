/**
 * Worker 模块入口
 */

const { WorkerPool, createWorkerPool, DEFAULT_WORKER_COUNT } = require('./worker-pool.js');

module.exports = {
  WorkerPool,
  createWorkerPool,
  DEFAULT_WORKER_COUNT,
};
