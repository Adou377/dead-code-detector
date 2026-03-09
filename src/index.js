/**
 * 死代码检测器 - 主入口
 */

const { DeadCodeFinder } = require('./detector.js');
const { DeadCodeFinderAST } = require('./detector-ast.js');
const { parseArgs, validateOptions } = require('./utils.js');
const { loadConfig, mergeConfig } = require('./config.js');
const { DEFAULT_MODE } = require('./constants.js');
const {
  getChangedFiles,
  isIncrementalSupported,
  filterUnusedExports,
  filterUnusedComponents,
  filterUnusedToolFiles,
  getCurrentBranch,
  getLastCommitHash,
} = require('./incremental-analyzer.js');

/**
 * 运行死代码检测
 * @param {Object} options - 配置选项
 * @param {string} [options.srcDir] - 源代码目录 (默认: ./src)
 * @param {string[]} [options.extensions] - 文件扩展名
 * @param {string[]} [options.ignoreDirs] - 忽略的目录
 * @param {boolean} [options.verbose] - 详细日志
 * @param {string} [options.mode] - 检测模式: 'ast' (默认) 或 'regex'
 * @param {string} [options.config] - 配置文件路径
 * @param {number} [options.maxFileSize] - 最大文件大小（字节），超过此大小的文件将被跳过
 * @param {number} [options.concurrency] - 最大并发数
 * @returns {Promise<Object>} 分析结果
 */
async function detect(options = {}) {
  validateOptions(options);

  const configFile = loadConfig(options.config);
  const config = mergeConfig(options, configFile);

  const srcDir = config.srcDir;
  const mode = config.mode;

  if (mode === DEFAULT_MODE) {
    const finder = new DeadCodeFinderAST({
      srcDir,
      extensions: config.extensions,
      ignoreDirs: config.ignoreDirs,
      verbose: config.verbose,
      maxFileSize: config.maxFileSize,
      concurrency: config.concurrency,
    });

    await finder.analyze();
    return {
      finder,
      results: {
        unusedExports: finder.unusedExports,
        unusedComponents: finder.unusedComponents,
        unusedToolFiles: finder.unusedToolFiles,
      },
    };
  } else {
    // regex mode
    const finder = new DeadCodeFinder({
      srcDir,
      extensions: config.extensions,
      ignoreDirs: config.ignoreDirs,
      verbose: config.verbose,
      maxFileSize: config.maxFileSize,
      concurrency: config.concurrency,
    });

    await finder.analyze();
    return {
      finder,
      results: {
        unusedExports: finder.unusedExports,
        unusedComponents: finder.unusedComponents,
        unusedToolFiles: finder.unusedToolFiles,
      },
    };
  }
}

/**
 * 命令行运行器
 */
async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      `
🛠️  死代码检测工具

用法:
  dead-code [选项]

选项:
  --src, -s          源代码目录 (默认: ./src)
  --ext, -e          扫描的文件扩展名 (默认: .js,.vue,.jsx,.ts,.tsx)
  --ignore, -i       忽略的目录 (默认: node_modules,dist,.git)
  --mode             检测模式: ast (默认) 或 regex
  --maxFileSize      最大文件大小（字节），超过此大小的文件将被跳过 (默认: 1000000)
  --concurrency      最大并发数 (默认: 50)
  --incremental      增量分析模式，仅分析 Git 变更相关的文件
  --base-branch      增量分析的基准分支 (默认: main)
  --fix              自动删除未使用代码
  --verbose          显示详细日志
  --help, -h         显示帮助信息

配置文件:
  支持以下配置文件格式（优先级从高到低）:
  - .deadcoderc.json
  - .deadcoderc.js
  - deadcode.config.js

示例:
  dead-code                              # 检测当前目录的 src 文件夹 (AST 模式)
  dead-code --src ./src                  # 指定源代码目录
  dead-code --mode ast                   # 使用 AST 模式 (默认)
  dead-code --mode regex                 # 使用正则模式 (兼容旧版)
  dead-code --verbose                    # 显示详细日志
  dead-code --fix                        # 自动删除未使用代码
  dead-code --maxFileSize 2000000        # 设置最大文件大小为 2MB
  dead-code --concurrency 100            # 设置最大并发数为 100
  dead-code --incremental                # 增量分析模式
  dead-code --incremental --base-branch develop  # 以 develop 为基准分支

`.trim()
    );
    process.exit(0);
  }

  const configFile = loadConfig(args.config);
  const config = mergeConfig(args, configFile);

  const srcDir = config.srcDir;
  const extensions = config.extensions;
  const ignoreDirs = config.ignoreDirs;
  const isFixMode = config.fix;
  const verbose = config.verbose;
  const mode = config.mode;
  const maxFileSize = config.maxFileSize;
  const concurrency = config.concurrency;
  const incremental = config.incremental;
  const baseBranch = config['base-branch'] || 'main';

  const modeLabel = mode === DEFAULT_MODE ? 'AST 模式' : '正则模式';

  console.log('\n🛠️  死代码检测工具 (支持 Vue + React)\n');
  if (configFile) {
    console.log('   使用配置文件');
  }
  console.log(`   源代码目录: ${srcDir}`);
  console.log(`   文件扩展名: ${extensions.join(', ')}`);
  console.log(`   忽略目录: ${ignoreDirs.join(', ')}`);
  console.log(`   检测模式: ${modeLabel}`);
  console.log(`   最大文件大小: ${(maxFileSize / 1000000).toFixed(1)}MB`);
  console.log(`   并行读取: 最多 ${concurrency} 个文件同时处理`);

  // 增量分析模式
  if (incremental) {
    if (!isIncrementalSupported(srcDir)) {
      console.log('\n⚠️  当前目录不是 Git 仓库，将使用全量分析模式\n');
    } else {
      const currentBranch = getCurrentBranch(srcDir);
      const lastCommit = getLastCommitHash(srcDir);
      console.log('   增量分析: 启用');
      console.log(`   当前分支: ${currentBranch || '未知'}`);
      console.log(`   基准分支: ${baseBranch}`);
      console.log(`   最近提交: ${lastCommit || '未知'}\n`);
    }
  } else {
    console.log('');
  }

  let finder;

  if (mode === DEFAULT_MODE) {
    finder = new DeadCodeFinderAST({
      srcDir,
      extensions,
      ignoreDirs,
      verbose,
      maxFileSize,
      concurrency,
    });
  } else {
    finder = new DeadCodeFinder({
      srcDir,
      extensions,
      ignoreDirs,
      verbose,
      maxFileSize,
      concurrency,
    });
  }

  await finder.analyze();

  // 如果启用增量分析，过滤结果
  if (incremental && isIncrementalSupported(srcDir)) {
    const changedFiles = getChangedFiles(srcDir, baseBranch);
    if (changedFiles && changedFiles.length > 0) {
      console.log(`\n📊 增量分析: 检测到 ${changedFiles.length} 个变更文件\n`);
      finder.unusedExports = filterUnusedExports(finder.unusedExports, new Set(changedFiles));
      finder.unusedComponents = filterUnusedComponents(finder.unusedComponents, new Set(changedFiles));
      finder.unusedToolFiles = filterUnusedToolFiles(finder.unusedToolFiles, new Set(changedFiles));
    } else if (changedFiles && changedFiles.length === 0) {
      console.log('\n📊 增量分析: 没有检测到变更文件\n');
      finder.unusedExports = [];
      finder.unusedComponents = [];
      finder.unusedToolFiles = [];
    }
  }

  finder.report();

  if (isFixMode) {
    await finder.fix();
  }

  if (!isFixMode) {
    console.log('💡 提示:');
    console.log('   - 使用 --fix 参数自动删除未使用代码');
    console.log('   - 使用 --incremental 参数进行增量分析');
    console.log('   - 手动确认后，删除对应的 export 语句');
  }
}

module.exports = {
  DeadCodeFinder,
  DeadCodeFinderAST,
  detect,
  run,
  loadConfig,
  mergeConfig,
};
