/**
 * 性能基准测试
 * 
 * 测试内容：
 * - 文件扫描性能测试
 * - AST 解析性能测试
 * - 大项目模拟测试
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { DeadCodeFinderAST } = require('../src/detector-ast.js');
const { parse } = require('../src/parser/index.js');
const { walkExports, walkImports } = require('../src/parser/walker.js');
const { processParallel } = require('../src/utils.js');

// 性能阈值配置（单位：毫秒）
const THRESHOLDS = {
  SCAN_100_FILES: 5000,
  PARSE_LARGE_VUE: 1000,
  FULL_ANALYSIS_100_FILES: 10000,
  PARSE_SINGLE_JS: 50,
  PARSE_SINGLE_TS: 100,
  WALK_EXPORTS: 10,
  WALK_IMPORTS: 10,
};

// 生成测试文件内容的辅助函数
function generateJsContent(exportCount = 10, importCount = 5) {
  const lines = [];
  
  // 添加导入
  for (let i = 0; i < importCount; i++) {
    lines.push(`import { func${i} } from './module${i}.js';`);
  }
  
  lines.push('');
  
  // 添加导出
  for (let i = 0; i < exportCount; i++) {
    lines.push(`export const export${i} = () => { return ${i}; };`);
  }
  
  lines.push('export default function main() { return true; }');
  
  return lines.join('\n');
}

function generateVueContent(componentName = 'TestComponent', complexity = 'medium') {
  const templateLines = complexity === 'high' ? 50 : complexity === 'medium' ? 20 : 5;
  const scriptLines = complexity === 'high' ? 100 : complexity === 'medium' ? 30 : 10;
  
  let template = '<template>\n  <div class="container">\n';
  for (let i = 0; i < templateLines; i++) {
    template += `    <div class="item-${i}">{{ data${i} }}</div>\n`;
  }
  template += '  </div>\n</template>\n\n';
  
  let script = '<script setup>\n';
  script += "import { ref, computed, onMounted } from 'vue';\n\n";
  
  for (let i = 0; i < scriptLines; i++) {
    script += `const data${i} = ref(${i});\n`;
  }
  
  script += '\nconst computedValue = computed(() => {\n';
  script += '  let sum = 0;\n';
  for (let i = 0; i < scriptLines; i++) {
    script += `  sum += data${i}.value;\n`;
  }
  script += '  return sum;\n';
  script += '});\n\n';
  
  script += 'onMounted(() => {\n';
  script += "  console.log('Component mounted');\n";
  script += '});\n';
  
  script += '</script>\n';
  
  return template + script;
}

function generateTsContent(typeCount = 10, exportCount = 10) {
  const lines = [];
  
  // 添加类型定义
  for (let i = 0; i < typeCount; i++) {
    lines.push(`export interface Interface${i} {`);
    lines.push(`  prop${i}A: string;`);
    lines.push(`  prop${i}B: number;`);
    lines.push('}');
    lines.push('');
    
    lines.push(`export type Type${i} = {`);
    lines.push('  value: string;');
    lines.push('  count: number;');
    lines.push('};');
    lines.push('');
  }
  
  // 添加函数导出
  for (let i = 0; i < exportCount; i++) {
    lines.push(`export function func${i}(param: string): number {`);
    lines.push(`  return param.length + ${i};`);
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

describe('性能基准测试', () => {
  let testDir;
  
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-code-benchmark-'));
  });
  
  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('文件扫描性能测试', () => {
    test('扫描 100 个文件应在合理时间内完成', async () => {
      // 创建 100 个测试文件
      const fileCount = 100;
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testDir, `module${i}.js`);
        fs.writeFileSync(filePath, generateJsContent(5, 2));
      }
      
      const finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const startTime = Date.now();
      await finder.scanSourceFiles();
      const endTime = Date.now();
      
      consoleSpy.mockRestore();
      
      const duration = endTime - startTime;
      
      console.log(`   扫描 ${fileCount} 个文件耗时: ${duration}ms`);
      
      expect(finder.sourceFiles.length).toBe(fileCount);
      expect(duration).toBeLessThan(THRESHOLDS.SCAN_100_FILES);
    });
    
    test('扫描混合类型文件（JS/TS/Vue）应在合理时间内完成', async () => {
      const jsCount = 30;
      const tsCount = 30;
      const vueCount = 40;
      
      // 创建 JS 文件
      for (let i = 0; i < jsCount; i++) {
        fs.writeFileSync(path.join(testDir, `module${i}.js`), generateJsContent(5, 2));
      }
      
      // 创建 TS 文件
      for (let i = 0; i < tsCount; i++) {
        fs.writeFileSync(path.join(testDir, `types${i}.ts`), generateTsContent(3, 3));
      }
      
      // 创建 Vue 文件
      for (let i = 0; i < vueCount; i++) {
        fs.writeFileSync(path.join(testDir, `Component${i}.vue`), generateVueContent(`Comp${i}`, 'medium'));
      }
      
      const finder = new DeadCodeFinderAST({ srcDir: testDir });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const startTime = Date.now();
      await finder.scanSourceFiles();
      const endTime = Date.now();
      
      consoleSpy.mockRestore();
      
      const duration = endTime - startTime;
      const totalFiles = jsCount + tsCount + vueCount;
      
      console.log(`   扫描 ${totalFiles} 个混合类型文件耗时: ${duration}ms`);
      
      expect(finder.sourceFiles.length).toBe(totalFiles);
      expect(duration).toBeLessThan(THRESHOLDS.SCAN_100_FILES);
    });
  });
  
  describe('AST 解析性能测试', () => {
    test('解析单个 JS 文件应在合理时间内完成', () => {
      const content = generateJsContent(20, 10);
      
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        parse(content, 'test.js');
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      console.log(`   解析单个 JS 文件平均耗时: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(THRESHOLDS.PARSE_SINGLE_JS);
    });
    
    test('解析单个 TypeScript 文件应在合理时间内完成', () => {
      const content = generateTsContent(20, 20);
      
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        parse(content, 'test.ts');
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      console.log(`   解析单个 TS 文件平均耗时: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(THRESHOLDS.PARSE_SINGLE_TS);
    });
    
    test('解析大型 Vue 文件应在合理时间内完成', () => {
      const content = generateVueContent('LargeComponent', 'high');
      
      const startTime = Date.now();
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        parse(content, 'test.vue');
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      console.log(`   解析大型 Vue 文件平均耗时: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(THRESHOLDS.PARSE_LARGE_VUE / iterations);
    });
    
    test('遍历导出应在合理时间内完成', () => {
      const content = generateJsContent(100, 50);
      const result = parse(content, 'test.js');
      
      expect(result.success).toBe(true);
      
      const startTime = Date.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        walkExports(result.ast);
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      console.log(`   遍历导出平均耗时: ${avgDuration.toFixed(3)}ms`);
      
      expect(avgDuration).toBeLessThan(THRESHOLDS.WALK_EXPORTS);
    });
    
    test('遍历导入应在合理时间内完成', () => {
      const content = generateJsContent(50, 100);
      const result = parse(content, 'test.js');
      
      expect(result.success).toBe(true);
      
      const startTime = Date.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        walkImports(result.ast);
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;
      
      console.log(`   遍历导入平均耗时: ${avgDuration.toFixed(3)}ms`);
      
      expect(avgDuration).toBeLessThan(THRESHOLDS.WALK_IMPORTS);
    });
  });
  
  describe('大项目模拟测试', () => {
    test('完整分析流程（100 个文件）应在合理时间内完成', async () => {
      // 创建一个包含导入关系的项目结构
      const fileCount = 100;
      
      // 创建主入口文件
      const mainContent = `
${Array.from({ length: 10 }, (_, i) => `import { func${i} } from './utils/util${i}.js';`).join('\n')}
${Array.from({ length: 10 }, (_, i) => `import Component${i} from './components/Component${i}.vue';`).join('\n')}

export function main() {
  return true;
}
`;
      fs.writeFileSync(path.join(testDir, 'main.js'), mainContent);
      
      // 创建工具文件目录
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      
      for (let i = 0; i < 30; i++) {
        const content = generateJsContent(5, 2);
        fs.writeFileSync(path.join(utilsDir, `util${i}.js`), content);
      }
      
      // 创建组件目录
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir);
      
      for (let i = 0; i < 30; i++) {
        const content = generateVueContent(`Component${i}`, 'medium');
        fs.writeFileSync(path.join(componentsDir, `Component${i}.vue`), content);
      }
      
      // 创建类型文件目录
      const typesDir = path.join(testDir, 'types');
      fs.mkdirSync(typesDir);
      
      for (let i = 0; i < 20; i++) {
        const content = generateTsContent(5, 3);
        fs.writeFileSync(path.join(typesDir, `types${i}.ts`), content);
      }
      
      // 创建一些未使用的文件
      const unusedDir = path.join(testDir, 'unused');
      fs.mkdirSync(unusedDir);
      
      for (let i = 0; i < 19; i++) {
        const content = generateJsContent(3, 0);
        fs.writeFileSync(path.join(unusedDir, `unused${i}.js`), content);
      }
      
      const finder = new DeadCodeFinderAST({ srcDir: testDir });
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const startTime = Date.now();
      const results = await finder.analyze();
      const endTime = Date.now();
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      
      const duration = endTime - startTime;
      
      console.log(`   完整分析流程耗时: ${duration}ms`);
      console.log(`   发现未使用导出: ${results.unusedExports.length} 个`);
      console.log(`   发现未使用组件: ${results.unusedComponents.length} 个`);
      console.log(`   发现未使用工具文件: ${results.unusedToolFiles.length} 个`);
      
      expect(duration).toBeLessThan(THRESHOLDS.FULL_ANALYSIS_100_FILES);
      expect(results).toHaveProperty('unusedExports');
      expect(results).toHaveProperty('unusedComponents');
      expect(results).toHaveProperty('unusedToolFiles');
    });
    
    test('并发处理性能测试', async () => {
      // 创建测试项目
      const itemCount = 200;
      const items = [];
      
      for (let i = 0; i < itemCount; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, generateJsContent(3, 1));
        items.push(filePath);
      }
      
      // 测试并发读取和解析
      const processor = async (filePath) => {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return parse(content, filePath);
      };
      
      const startTime = Date.now();
      const results = await processParallel(items, processor, 50);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      console.log(`   并发处理 ${itemCount} 个文件耗时: ${duration}ms`);
      
      expect(results.length).toBe(itemCount);
      expect(duration).toBeLessThan(THRESHOLDS.SCAN_100_FILES * 2);
    });
  });
  
  describe('内存使用测试', () => {
    test('解析大量文件不应导致内存泄漏', () => {
      const content = generateJsContent(50, 25);
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 解析大量文件
      for (let i = 0; i < 1000; i++) {
        parse(content, `test${i}.js`);
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      console.log(`   内存增长: ${memoryIncrease.toFixed(2)}MB`);
      
      // 内存增长应该在合理范围内（小于 100MB）
      expect(memoryIncrease).toBeLessThan(100);
    });
  });
  
  describe('性能回归检测', () => {
    test('基准性能指标应在预期范围内', () => {
      const benchmarks = {
        'JS 解析': { threshold: THRESHOLDS.PARSE_SINGLE_JS, actual: 0 },
        'TS 解析': { threshold: THRESHOLDS.PARSE_SINGLE_TS, actual: 0 },
        '导出遍历': { threshold: THRESHOLDS.WALK_EXPORTS, actual: 0 },
        '导入遍历': { threshold: THRESHOLDS.WALK_IMPORTS, actual: 0 },
      };
      
      // 测试 JS 解析
      const jsContent = generateJsContent(20, 10);
      let start = Date.now();
      for (let i = 0; i < 100; i++) parse(jsContent, 'test.js');
      benchmarks['JS 解析'].actual = (Date.now() - start) / 100;
      
      // 测试 TS 解析
      const tsContent = generateTsContent(20, 20);
      start = Date.now();
      for (let i = 0; i < 100; i++) parse(tsContent, 'test.ts');
      benchmarks['TS 解析'].actual = (Date.now() - start) / 100;
      
      // 测试导出遍历
      const jsAst = parse(jsContent, 'test.js');
      start = Date.now();
      for (let i = 0; i < 1000; i++) walkExports(jsAst.ast);
      benchmarks['导出遍历'].actual = (Date.now() - start) / 1000;
      
      // 测试导入遍历
      start = Date.now();
      for (let i = 0; i < 1000; i++) walkImports(jsAst.ast);
      benchmarks['导入遍历'].actual = (Date.now() - start) / 1000;
      
      // 输出性能报告
      console.log('\n   性能基准报告:');
      console.log('   ─────────────────────────────────────────');
      console.log('   操作          阈值(ms)    实际(ms)    状态');
      console.log('   ─────────────────────────────────────────');
      
      for (const [name, data] of Object.entries(benchmarks)) {
        const status = data.actual < data.threshold ? '✓ 通过' : '✗ 失败';
        console.log(`   ${name.padEnd(12)} ${data.threshold.toString().padStart(8)} ${data.actual.toFixed(3).padStart(10)}    ${status}`);
        expect(data.actual).toBeLessThan(data.threshold);
      }
      
      console.log('   ─────────────────────────────────────────');
    });
  });
});
