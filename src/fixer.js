/**
 * 代码修复工具
 *
 * 提供自动修复未使用代码的功能
 */

const fs = require('fs');
const path = require('path');
const { analyzeLinesToRemove } = require('./analyzer.js');
const { readFileContent } = require('./utils.js');

function createBackupDir(srcDir) {
  const backupDir = path.join(srcDir, '../backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

function backupFile(fullPath, backupDir, file) {
  const backupPath = path.join(backupDir, file.replace(/[\/\\]/g, '_'));
  fs.copyFileSync(fullPath, backupPath);
}

function writeFixedFile(fullPath, lines, linesToRemove) {
  const newLines = lines.filter((_, index) => !linesToRemove.has(index));
  fs.writeFileSync(fullPath, newLines.join('\n'));
}

function handleFixError(fullPath, originalContent, error) {
  console.warn(`⚠️  修复文件 ${fullPath} 时出错: ${error.message}`);
  console.warn('   已恢复原始文件内容');
  fs.writeFileSync(fullPath, originalContent);
}

function applyFixToFile(fullPath, originalContent, analysisResult) {
  const { lines, linesToRemove, modified } = analysisResult;

  if (modified) {
    writeFixedFile(fullPath, lines, linesToRemove);
  }
}

function removeUnusedExports(fullPath, items) {
  const result = readFileContent(fullPath);
  if (!result.success) {
    throw result.error;
  }

  const content = result.content;
  const originalContent = content;

  try {
    const analysisResult = analyzeLinesToRemove(content, items);
    applyFixToFile(fullPath, originalContent, analysisResult);
  } catch (error) {
    handleFixError(fullPath, originalContent, error);
    throw error;
  }
}

async function fixUnusedExports(unusedExports, srcDir, backupDir) {
  let fixedCount = 0;
  const exportsByFile = groupByFile(unusedExports);
  for (const [file, items] of Object.entries(exportsByFile)) {
    const fullPath = path.join(srcDir, file);
    if (!fs.existsSync(fullPath)) continue;

    backupFile(fullPath, backupDir, file);
    removeUnusedExports(fullPath, items);
    console.log(`✅ 已修复 ${file} 中的 ${items.length} 个未使用导出`);
    fixedCount += items.length;
  }
  return fixedCount;
}

async function fixUnusedComponents(unusedComponents, srcDir, backupDir) {
  let fixedCount = 0;
  for (const comp of unusedComponents) {
    const fullPath = path.join(srcDir, comp.file);
    if (!fs.existsSync(fullPath)) continue;

    backupFile(fullPath, backupDir, comp.file);
    fs.unlinkSync(fullPath);
    console.log(`✅ 已删除未使用的组件: ${comp.file}`);
    fixedCount++;
  }
  return fixedCount;
}

function deleteUnusedToolFiles(unusedToolFiles, srcDir, backupDir) {
  if (!unusedToolFiles) return 0;

  let deletedCount = 0;
  for (const file of unusedToolFiles) {
    const fullPath = path.join(srcDir, file);
    if (fs.existsSync(fullPath)) {
      backupFile(fullPath, backupDir, file);
      fs.unlinkSync(fullPath);
      console.log(`✅ 已删除未使用的工具文件: ${file}`);
      deletedCount++;
    }
  }
  return deletedCount;
}

function groupByFile(items) {
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.file]) {
      grouped[item.file] = [];
    }
    grouped[item.file].push(item);
  }
  return grouped;
}

function generateFixPreview(unusedExports, unusedComponents, unusedToolFiles) {
  return {
    unusedExports: unusedExports.length,
    unusedComponents: unusedComponents.length,
    unusedToolFiles: unusedToolFiles ? unusedToolFiles.length : 0,
    details: {
      unusedExports,
      unusedComponents,
      unusedToolFiles: unusedToolFiles || [],
    },
  };
}

function showFixPreview(preview, groupByFileFn) {
  console.log('📋 修复预览\n');
  console.log(`   - 未使用的导出: ${preview.unusedExports} 个`);
  console.log(`   - 未使用的组件: ${preview.unusedComponents} 个`);
  console.log(`   - 未使用的工具文件: ${preview.unusedToolFiles} 个`);
  console.log('');

  if (preview.details.unusedExports.length > 0) {
    console.log('   未使用的导出详情:');
    const groupedExports = groupByFileFn(preview.details.unusedExports);
    for (const [file, exports] of Object.entries(groupedExports)) {
      console.log(`     📄 ${file}`);
      for (const exp of exports.slice(0, 3)) {
        console.log(`       - ${exp.name} (第 ${exp.line} 行)`);
      }
      if (exports.length > 3) {
        console.log(`       - ... 还有 ${exports.length - 3} 个`);
      }
    }
    console.log('');
  }

  if (preview.details.unusedComponents.length > 0) {
    console.log('   未使用的组件详情:');
    for (const comp of preview.details.unusedComponents.slice(0, 5)) {
      console.log(`     📄 ${comp.file}`);
    }
    if (preview.details.unusedComponents.length > 5) {
      console.log(`     ... 还有 ${preview.details.unusedComponents.length - 5} 个`);
    }
    console.log('');
  }

  if (preview.details.unusedToolFiles.length > 0) {
    console.log('   未使用的工具文件详情:');
    for (const file of preview.details.unusedToolFiles.slice(0, 5)) {
      console.log(`     📄 ${file}`);
    }
    if (preview.details.unusedToolFiles.length > 5) {
      console.log(`     ... 还有 ${preview.details.unusedToolFiles.length - 5} 个`);
    }
    console.log('');
  }
}

function printFixSummary(backupDir, fixResult) {
  console.log('\n📋 修复完成！\n');
  console.log(`   - 已修复 ${fixResult.unusedExports} 个未使用的导出`);
  console.log(`   - 已删除 ${fixResult.unusedComponents} 个未使用的组件`);
  console.log(`   - 已删除 ${fixResult.unusedToolFiles} 个未使用的工具文件`);
  console.log(`   - 备份文件保存在 ${backupDir} 目录中`);
}

async function confirmFix(_preview) {
  return new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('是否确认执行修复操作？ (y/n): ', answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

module.exports = {
  createBackupDir,
  backupFile,
  writeFixedFile,
  handleFixError,
  applyFixToFile,
  removeUnusedExports,
  fixUnusedExports,
  fixUnusedComponents,
  deleteUnusedToolFiles,
  groupByFile,
  generateFixPreview,
  showFixPreview,
  printFixSummary,
  confirmFix,
};
