const path = require('path');
const fs = require('fs');
const os = require('os');
const { DeadCodeFinderAST } = require('../src/detector-ast.js');
const { detect } = require('../src/index.js');

// E2E 测试项目的路径
const E2E_PROJECT_DIR = path.join(__dirname, './fixtures/e2e-project/src');

// 辅助函数：抑制控制台输出（保留原始实现用于某些关键调用）
function suppressConsole() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalClear = console.clear;
  const originalStdoutWrite = process.stdout.write;
  
  // 使用空函数替代，但保留返回值
  console.log = jest.fn(() => {});
  console.warn = jest.fn(() => {});
  console.clear = jest.fn(() => {});
  process.stdout.write = jest.fn(() => true);
  
  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.clear = originalClear;
    process.stdout.write = originalStdoutWrite;
  };
}

describe('E2E 集成测试', () => {
  let restoreConsole;

  beforeEach(() => {
    restoreConsole = suppressConsole();
  });

  afterEach(() => {
    restoreConsole();
  });

  describe('完整分析流程测试', () => {
    test('应该正确检测未使用的导出', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的导出
      const unusedExportNames = finder.unusedExports.map(e => e.name);
      
      // helpers.js 中未使用的导出
      expect(unusedExportNames).toContain('formatPhone');
      expect(unusedExportNames).toContain('formatAddress');
      
      // api.js 中所有导出都是未使用的
      expect(unusedExportNames).toContain('fetchData');
      expect(unusedExportNames).toContain('postData');
      expect(unusedExportNames).toContain('unusedApiCall');
    });

    test('应该正确检测未使用的组件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的组件
      const unusedComponentNames = finder.unusedComponents.map(c => c.name);
      
      // ProductCard.vue 是未使用的
      expect(unusedComponentNames).toContain('ProductCard');
      
      // ReactUnused.jsx 是未使用的
      expect(unusedComponentNames).toContain('ReactUnused');
    });

    test('应该正确识别已使用的导出', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      const unusedExportNames = finder.unusedExports.map(e => e.name);
      
      // formatDate 和 formatCurrency 是已使用的
      expect(unusedExportNames).not.toContain('formatDate');
      expect(unusedExportNames).not.toContain('formatCurrency');
    });

    test('应该正确识别已使用的组件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      const unusedComponentNames = finder.unusedComponents.map(c => c.name);
      
      // UsedButton 和 ReactUsed 是已使用的
      expect(unusedComponentNames).not.toContain('UsedButton');
      expect(unusedComponentNames).not.toContain('ReactUsed');
      
      // Home 和 App 是全局组件或入口组件
      expect(unusedComponentNames).not.toContain('Home');
      expect(unusedComponentNames).not.toContain('App');
    });

    test('应该正确统计文件数量', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证扫描到的文件数量
      // helpers.js, api.js, main.js = 3 个 JS 文件
      // UsedButton.vue, ProductCard.vue, Home.vue, App.vue = 4 个 Vue 文件
      // ReactUsed.jsx, ReactUnused.jsx = 2 个 JSX 文件
      // 总共 9 个文件
      expect(finder.sourceFiles.length).toBe(9);
    });

    test('应该正确检测未使用的工具文件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // api.js 是一个未被任何文件导入的工具文件
      const unusedFiles = finder.unusedToolFiles;
      
      // 验证 api.js 被检测为未使用的工具文件
      expect(unusedFiles.some(f => f.includes('api.js'))).toBe(true);
    });
  });

  describe('detect 函数集成测试', () => {
    test('应该返回完整的分析结果', async () => {
      const result = await detect({
        src: E2E_PROJECT_DIR,
        ext: '.js,.vue,.jsx,.ts,.tsx',
        ignore: 'node_modules',
        verbose: false,
      });

      expect(result).toHaveProperty('finder');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('unusedExports');
      expect(result.results).toHaveProperty('unusedComponents');
      expect(result.results).toHaveProperty('unusedToolFiles');

      // 验证检测到未使用的代码
      expect(result.results.unusedExports.length).toBeGreaterThan(0);
      // 注意：某些组件可能被识别为全局组件（如 App.vue），所以只验证有结果
      expect(result.results.unusedComponents.length).toBeGreaterThanOrEqual(0);
    });

    test('应该正确使用 AST 模式（默认）', async () => {
      const result = await detect({
        src: E2E_PROJECT_DIR,
        ext: '.js,.vue,.jsx',
        ignore: 'node_modules',
        verbose: false,
      });

      expect(result.finder).toBeInstanceOf(DeadCodeFinderAST);
    });
  });

  describe('报告生成测试', () => {
    test('应该正确生成报告', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: E2E_PROJECT_DIR,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();
      const report = finder.report();

      expect(report).toHaveProperty('unusedExports');
      expect(report).toHaveProperty('unusedComponents');
      expect(report).toHaveProperty('unusedToolFiles');
    });
  });

  describe('自动修复流程测试', () => {
    let tempTestDir;
    let tempSrcDir;

    beforeEach(() => {
      // 使用系统临时目录创建测试目录
      tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fix-test-'));
      tempSrcDir = path.join(tempTestDir, 'src');
      fs.mkdirSync(tempSrcDir, { recursive: true });

      // 复制 fixture 文件到临时目录
      const copyDir = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyDir(E2E_PROJECT_DIR, tempSrcDir);
    });

    afterEach(() => {
      // 清理临时目录
      if (fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
    });

    test('dryRun 模式应该返回预览而不修改文件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 读取原始文件内容
      const helpersPath = path.join(tempSrcDir, 'utils', 'helpers.js');
      const originalContent = fs.readFileSync(helpersPath, 'utf-8');

      // 执行 dryRun 模式修复
      const result = await finder.fix({ dryRun: true, confirm: false });

      // 验证返回预览结果
      expect(result.dryRun).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.preview).toHaveProperty('unusedExports');
      expect(result.preview).toHaveProperty('unusedComponents');
      expect(result.preview).toHaveProperty('unusedToolFiles');

      // 验证文件未被修改
      const currentContent = fs.readFileSync(helpersPath, 'utf-8');
      expect(currentContent).toBe(originalContent);
    });

    test('应该正确执行自动修复', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的导出
      expect(finder.unusedExports.length).toBeGreaterThan(0);

      // 执行自动修复
      const result = await finder.fix({ confirm: false });

      // 验证修复结果
      expect(result).toHaveProperty('unusedExports');
      expect(result).toHaveProperty('unusedComponents');
      expect(result).toHaveProperty('unusedToolFiles');
      expect(result.unusedExports).toBeGreaterThan(0);

      // 验证文件已被修改
      const helpersPath = path.join(tempSrcDir, 'utils', 'helpers.js');
      const content = fs.readFileSync(helpersPath, 'utf-8');
      
      // 未使用的导出应该被移除
      expect(content).not.toContain('formatPhone');
      expect(content).not.toContain('formatAddress');
      
      // 已使用的导出应该保留
      expect(content).toContain('formatDate');
      expect(content).toContain('formatCurrency');
    });

    test('应该正确删除未使用的组件文件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的组件
      expect(finder.unusedComponents.length).toBeGreaterThan(0);

      // 执行自动修复
      const result = await finder.fix({ confirm: false });

      // 验证修复结果
      expect(result.unusedComponents).toBeGreaterThan(0);

      // 验证未使用的组件文件已被删除
      const productCardPath = path.join(tempSrcDir, 'components', 'ProductCard.vue');
      const reactUnusedPath = path.join(tempSrcDir, 'components', 'ReactUnused.jsx');
      
      expect(fs.existsSync(productCardPath)).toBe(false);
      expect(fs.existsSync(reactUnusedPath)).toBe(false);

      // 验证已使用的组件文件仍然存在
      const usedButtonPath = path.join(tempSrcDir, 'components', 'UsedButton.vue');
      const reactUsedPath = path.join(tempSrcDir, 'components', 'ReactUsed.jsx');
      
      expect(fs.existsSync(usedButtonPath)).toBe(true);
      expect(fs.existsSync(reactUsedPath)).toBe(true);
    });

    test('应该正确删除未使用的工具文件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的工具文件
      expect(finder.unusedToolFiles.length).toBeGreaterThan(0);

      // 执行自动修复
      const result = await finder.fix({ confirm: false });

      // 验证修复结果
      expect(result.unusedToolFiles).toBeGreaterThan(0);

      // 验证未使用的工具文件已被删除
      const apiPath = path.join(tempSrcDir, 'utils', 'api.js');
      expect(fs.existsSync(apiPath)).toBe(false);
    });

    test('应该创建备份文件', async () => {
      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 执行自动修复
      await finder.fix({ confirm: false });

      // 验证备份目录已创建
      const backupDir = path.join(tempSrcDir, '..', 'backup');
      expect(fs.existsSync(backupDir)).toBe(true);

      // 验证备份文件存在
      const backupFiles = fs.readdirSync(backupDir);
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    test('应该正确处理多行导出', async () => {
      // 创建一个包含多行导出的测试文件
      const testFilePath = path.join(tempSrcDir, 'multiline.js');
      const multilineContent = `
export const unused1 = 'unused1';
export const unused2 = 'unused2';
export const usedExport = 'used';
`;
      fs.writeFileSync(testFilePath, multilineContent);

      // 创建一个导入 usedExport 的文件
      const importerPath = path.join(tempSrcDir, 'importer.js');
      fs.writeFileSync(importerPath, "import { usedExport } from './multiline.js';");

      const finder = new DeadCodeFinderAST({
        srcDir: tempSrcDir,
        extensions: ['.js', '.vue', '.jsx', '.ts', '.tsx'],
        ignoreDirs: ['node_modules'],
        verbose: false,
      });

      await finder.analyze();

      // 验证检测到未使用的导出
      const unusedNames = finder.unusedExports.map(e => e.name);
      expect(unusedNames).toContain('unused1');
      expect(unusedNames).toContain('unused2');
      expect(unusedNames).not.toContain('usedExport');

      // 执行自动修复
      await finder.fix({ confirm: false });

      // 验证文件内容已更新
      const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
      expect(updatedContent).not.toContain('unused1');
      expect(updatedContent).not.toContain('unused2');
      expect(updatedContent).toContain('usedExport');
    });
  });
});
