/**
 * 报告生成器类
 * 负责生成和打印死代码分析报告
 */
class Reporter {
  /**
   * 生成并打印完整报告
   * @param {Object} data - 报告数据
   * @param {Object} options - 报告选项
   * @returns {Object} 报告数据
   */
  static generate(data, options = {}) {
    const { mode = 'normal', stats = null } = options;

    if (mode === 'ast') {
      console.clear();
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📋 死代码分析报告${mode === 'ast' ? ' (AST 模式)' : ''}`);
    console.log('='.repeat(70));

    if (stats) {
      Reporter.printStats(stats);
    }

    Reporter.printUnusedExports(data.unusedExports);
    Reporter.printUnusedComponents(data.unusedComponents);
    Reporter.printUnusedToolFiles(data.unusedToolFiles);

    Reporter.printSummary(data);

    return data;
  }

  /**
   * 打印统计信息
   * @param {Object} stats - 统计数据
   */
  static printStats(stats) {
    console.log('\n📊 统计信息\n');
    console.log(`   📁 扫描文件数: ${stats.fileCount || 0}`);
    console.log(`   📦 导出总数: ${stats.exportCount || 0}`);
    console.log(`   🧩 组件总数: ${stats.componentCount || 0}`);
  }

  /**
   * 打印未使用的导出
   * @param {Array} unusedExports - 未使用的导出列表
   */
  static printUnusedExports(unusedExports) {
    console.log('\n📦 未使用的导出 (' + unusedExports.length + ' 个)\n');

    if (unusedExports.length === 0) {
      console.log('   ✅ 没有发现未使用的导出！');
      return;
    }

    const grouped = Reporter.groupByFile(unusedExports);
    for (const [file, items] of Object.entries(grouped)) {
      console.log(`📄 ${file}`);
      for (const item of items.slice(0, 5)) {
        console.log(`   ├─ ${item.name} (第 ${item.line} 行)`);
      }
      if (items.length > 5) {
        console.log(`   └─ ... 还有 ${items.length - 5} 个`);
      }
      console.log('');
    }
  }

  /**
   * 打印未使用的组件
   * @param {Array} unusedComponents - 未使用的组件列表
   */
  static printUnusedComponents(unusedComponents) {
    console.log('\n🧩 未使用的组件 (' + unusedComponents.length + ' 个)\n');

    if (unusedComponents.length === 0) {
      console.log('   ✅ 没有发现未使用的组件！');
      return;
    }

    for (const comp of unusedComponents) {
      console.log(`   📄 ${comp.file}`);
    }
  }

  /**
   * 打印未使用的工具文件
   * @param {Array} unusedToolFiles - 未使用的工具文件列表
   */
  static printUnusedToolFiles(unusedToolFiles) {
    const count = unusedToolFiles ? unusedToolFiles.length : 0;
    console.log('\n🛠️  未使用的工具文件 (' + count + ' 个)\n');

    if (!unusedToolFiles || unusedToolFiles.length === 0) {
      console.log('   ✅ 没有发现未使用的工具文件！');
      return;
    }

    for (const file of unusedToolFiles) {
      console.log(`   📄 ${file}`);
    }
  }

  /**
   * 打印摘要
   * @param {Object} data - 报告数据
   */
  static printSummary(data) {
    console.log('\n' + '='.repeat(70));
    console.log(
      `总计: ${data.unusedExports.length} 个未使用的导出, ` +
        `${data.unusedComponents.length} 个未使用的组件, ` +
        `${data.unusedToolFiles ? data.unusedToolFiles.length : 0} 个未使用的工具文件\n`
    );
  }

  /**
   * 按文件分组项目
   * @param {Array} items - 项目列表
   * @returns {Object} 分组结果
   */
  static groupByFile(items) {
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.file]) grouped[item.file] = [];
      grouped[item.file].push(item);
    }
    return grouped;
  }

  /**
   * 打印进度
   * @param {number} current - 当前进度
   * @param {number} total - 总数
   * @param {string} prefix - 前缀文本
   */
  static printProgress(current, total, prefix) {
    const percent = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    process.stdout.write(`\r${prefix} [${bar}] ${percent}% (${current}/${total})`);
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  /**
   * 打印分析开始信息
   */
  static printAnalysisStart() {
    console.log('\n🔍 开始分析源代码...\n');
  }

  /**
   * 打印分析完成信息
   * @param {number|string} elapsedSeconds - 耗时（秒或格式化字符串）
   */
  static printAnalysisComplete(elapsedSeconds) {
    const timeStr = typeof elapsedSeconds === 'string' 
      ? elapsedSeconds 
      : `${elapsedSeconds.toFixed(1)}s`;
    console.log(`\n⏱️  分析完成，耗时 ${timeStr}\n`);
  }

  /**
   * 打印检测阶段信息
   * @param {string} stage - 阶段名称
   */
  static printDetectionStage(stage) {
    console.log(`\n🔎 检测${stage}...`);
  }
}

module.exports = { Reporter };
