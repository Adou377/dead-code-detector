const { parseFile, parseFiles } = require('../src/worker/parse-worker.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('parse-worker', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-worker-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseFile', () => {
    test('应该正确解析 JS 文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1; export default function App() {}');

      const result = parseFile({
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(testFile);
      expect(result.exports).toHaveLength(2);
      expect(result.exports.find(e => e.name === 'foo')).toBeDefined();
      expect(result.exports.find(e => e.name === 'App')).toBeDefined();
    });

    test('应该正确解析 Vue 文件', () => {
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

      const result = parseFile({
        filePath: vueFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.vueInfo).toBeDefined();
      expect(result.vueInfo.isComponent).toBe(true);
    });

    test('应该正确解析纯模板 Vue 组件（无脚本块）', () => {
      const vueFile = path.join(testDir, 'SvgIcon.vue');
      fs.writeFileSync(
        vueFile,
        `<template>
  <svg viewBox="0 0 24 24">
    <path d="M12 2L2 22h20L12 2z"/>
  </svg>
</template>`
      );

      const result = parseFile({
        filePath: vueFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      // 纯模板组件是合法的 Vue 3 组件，应该返回成功
      expect(result.success).toBe(true);
      expect(result.vueInfo).toBeDefined();
      expect(result.vueInfo.isComponent).toBe(true);
    });

    test('应该正确解析 TypeScript 文件', () => {
      const tsFile = path.join(testDir, 'types.ts');
      fs.writeFileSync(
        tsFile,
        `export interface User { name: string; }
export const getUser = (): User => ({ name: 'test' });`
      );

      const result = parseFile({
        filePath: tsFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.exports.length).toBeGreaterThan(0);
    });

    test('应该正确解析 JSX 文件', () => {
      const jsxFile = path.join(testDir, 'Button.jsx');
      fs.writeFileSync(
        jsxFile,
        `import React from 'react';
export function Button({ children }) {
  return <button>{children}</button>;
}
export default Button;`
      );

      const result = parseFile({
        filePath: jsxFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.exports.length).toBeGreaterThan(0);
    });

    test('应该正确解析 TSX 文件', () => {
      const tsxFile = path.join(testDir, 'Card.tsx');
      fs.writeFileSync(
        tsxFile,
        'export const Card = ({ title }: { title: string }) => <div>{title}</div>;'
      );

      const result = parseFile({
        filePath: tsxFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
    });

    test('应该处理超大文件', () => {
      const largeFile = path.join(testDir, 'large.js');
      const largeContent = 'x'.repeat(2000000);
      fs.writeFileSync(largeFile, largeContent);

      const result = parseFile({
        filePath: largeFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('文件过大');
    });

    test('应该处理不支持的文件类型', () => {
      const unsupportedFile = path.join(testDir, 'style.css');
      fs.writeFileSync(unsupportedFile, '.class { color: red; }');

      const result = parseFile({
        filePath: unsupportedFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的文件类型');
    });

    test('应该处理解析错误', () => {
      const invalidFile = path.join(testDir, 'invalid.js');
      fs.writeFileSync(invalidFile, 'this is not valid javascript {{{');

      const result = parseFile({
        filePath: invalidFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('应该处理不存在的文件', () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.js');

      const result = parseFile({
        filePath: nonExistentFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('应该正确提取导入信息', () => {
      const testFile = path.join(testDir, 'imports.js');
      fs.writeFileSync(
        testFile,
        `import { foo } from './utils';
import bar from './helpers';
import * as lib from './lib';`
      );

      const result = parseFile({
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.imports.length).toBeGreaterThan(0);
    });

    test('应该正确处理 Vue 组件信息', () => {
      const vueFile = path.join(testDir, 'TheHeader.vue');
      fs.writeFileSync(
        vueFile,
        `<script setup>
import { ref } from 'vue';
const count = ref(0);
defineExpose({ count });
</script>
<template>
  <header>Header</header>
</template>`
      );

      const result = parseFile({
        filePath: vueFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.componentInfo).toBeDefined();
      expect(result.componentInfo.isGlobal).toBe(true);
    });

    test('应该正确处理 index 文件（不作为组件）', () => {
      const indexFile = path.join(testDir, 'index.js');
      fs.writeFileSync(indexFile, 'export const foo = 1;');

      const result = parseFile({
        filePath: indexFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.componentInfo).toBeNull();
    });

    test('应该正确处理 utils 目录下的文件（不作为组件）', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      const utilFile = path.join(utilsDir, 'helpers.js');
      fs.writeFileSync(utilFile, 'export function helper() {}');

      const result = parseFile({
        filePath: utilFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.componentInfo).toBeNull();
    });

    test('应该正确处理组件目录下的文件', () => {
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir);
      const compFile = path.join(componentsDir, 'Button.jsx');
      fs.writeFileSync(compFile, 'export function Button() { return <button/>; }');

      const result = parseFile({
        filePath: compFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.componentInfo).toBeDefined();
      expect(result.componentInfo.name).toBe('Button');
    });

    test('应该过滤掉 Vue 宏导出', () => {
      const vueFile = path.join(testDir, 'Component.vue');
      fs.writeFileSync(
        vueFile,
        `<script setup>
const props = defineProps({ msg: String });
const emit = defineEmits(['update']);
defineExpose({ props });
export const regularExport = true;
</script>`
      );

      const result = parseFile({
        filePath: vueFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      const exportNames = result.exports.map(e => e.name);
      expect(exportNames).not.toContain('defineProps');
      expect(exportNames).not.toContain('defineEmits');
      expect(exportNames).not.toContain('defineExpose');
    });
  });

  describe('parseFiles', () => {
    test('应该批量解析多个文件', () => {
      const files = [];
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(testDir, `file${i}.js`);
        fs.writeFileSync(filePath, `export const value${i} = ${i};`);
        files.push(filePath);
      }

      const results = parseFiles({
        filePaths: files,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.exports[0].name).toBe(`value${index}`);
      });
    });

    test('应该处理混合类型的文件', () => {
      const jsFile = path.join(testDir, 'test.js');
      const vueFile = path.join(testDir, 'test.vue');
      const tsFile = path.join(testDir, 'test.ts');

      fs.writeFileSync(jsFile, 'export const js = true;');
      fs.writeFileSync(vueFile, '<script setup>export const vue = true;</script>');
      fs.writeFileSync(tsFile, 'export const ts: boolean = true;');

      const results = parseFiles({
        filePaths: [jsFile, vueFile, tsFile],
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });
  });

  describe('边界情况', () => {
    test('应该处理空文件', () => {
      const emptyFile = path.join(testDir, 'empty.js');
      fs.writeFileSync(emptyFile, '');

      const result = parseFile({
        filePath: emptyFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
      expect(result.exports).toEqual([]);
    });

    test('应该处理只有注释的文件', () => {
      const commentFile = path.join(testDir, 'comment.js');
      fs.writeFileSync(commentFile, '// This is a comment\n/* Multi-line */');

      const result = parseFile({
        filePath: commentFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
    });

    test('应该处理 Vue 文件解析失败', () => {
      const invalidVue = path.join(testDir, 'invalid.vue');
      fs.writeFileSync(invalidVue, '<script>invalid js {{{</script>');

      const result = parseFile({
        filePath: invalidVue,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('应该正确计算相对路径', () => {
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir);
      const testFile = path.join(subDir, 'nested.js');
      fs.writeFileSync(testFile, 'export const nested = true;');

      const result = parseFile({
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.relativePath).toContain('subdir');
      expect(result.relativePath).toContain('nested.js');
    });

    test('应该处理动态导入', () => {
      const testFile = path.join(testDir, 'dynamic.js');
      fs.writeFileSync(testFile, 'const mod = import(\'./other\'); export { mod };');

      const result = parseFile({
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
    });

    test('应该处理重新导出', () => {
      const testFile = path.join(testDir, 'reexport.js');
      fs.writeFileSync(testFile, 'export { foo } from \'./utils\'; export * from \'./lib\';');

      const result = parseFile({
        filePath: testFile,
        srcDir: testDir,
        maxFileSize: 1000000,
      });

      expect(result.success).toBe(true);
    });
  });
});
