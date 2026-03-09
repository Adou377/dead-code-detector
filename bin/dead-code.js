#!/usr/bin/env node

/**
 * 死代码检测工具 CLI 入口点
 *
 * @author Adou
 * @version 1.0.0
 */

const { run } = require('../src/index.js');

run().catch(console.error);
