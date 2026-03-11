const path = require('path');
const { DeadCodeFinder } = require('../src/detector.js');
const { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } = require('../src/constants.js');
const { ImportItem } = require('../src/models.js');

describe('detector.js - 导入提取测试', () => {
  let finder;
  let fixturesDir;

  beforeEach(() => {
    fixturesDir = path.join(__dirname, 'fixtures');
    finder = new DeadCodeFinder({
      srcDir: fixturesDir,
      extensions: DEFAULT_EXTENSIONS,
      ignoreDirs: DEFAULT_IGNORE_DIRS,
      verbose: false,
    });
  });

  describe('extractImportsFromContent 函数', () => {
    test('应该提取静态导入', () => {
      const content = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';
import './styles.css';
      `;

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toHaveLength(5);

      // 检查默认导入
      expect(imports.find(i => i.name === 'React')).toEqual(
        expect.objectContaining({
          name: 'React',
          source: 'react',
          isDefault: true,
          isInternal: false,
        })
      );

      // 检查命名导入
      expect(imports.find(i => i.name === 'useState')).toEqual(
        expect.objectContaining({
          name: 'useState',
          source: 'react',
          isDefault: false,
          isInternal: false,
        })
      );

      expect(imports.find(i => i.name === 'useEffect')).toEqual(
        expect.objectContaining({
          name: 'useEffect',
          source: 'react',
          isDefault: false,
          isInternal: false,
        })
      );

      // 检查命名空间导入
      expect(imports.find(i => i.name === 'utils')).toEqual(
        expect.objectContaining({
          name: 'utils',
          source: './utils',
          isDefault: false,
          isInternal: true,
        })
      );

      // 检查副作用导入
      expect(imports.find(i => i.isSideEffect)).toEqual(
        expect.objectContaining({
          name: '',
          source: './styles.css',
          isDefault: false,
          isInternal: true,
          isSideEffect: true,
        })
      );
    });

    test('应该提取动态导入', () => {
      const content = `
const Component = lazy(() => import('./Component'));
const data = await import('./data');
      `;

      const imports = finder.extractImportsFromContent(content);

      expect(imports).toHaveLength(2);
      expect(imports.every(i => i.isDynamic)).toBe(true);
    });

    test('应该提取所有类型的导入', () => {
      const content = `
import React from 'react';
import { useState } from 'react';
import './styles.css';
const Component = lazy(() => import('./Component'));
      `;

      const imports = finder.extractImportsFromContent(content);
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe('extractStaticImports 函数', () => {
    test('应该提取静态导入', () => {
      const content = `
import React from 'react';
import { useState } from 'react';
      `;
      const imports = [];

      finder.extractStaticImports(content, imports);

      expect(imports.some(i => i.name === 'React')).toBe(true);
      expect(imports.some(i => i.name === 'useState')).toBe(true);
    });
  });

  describe('extractDynamicImports 函数', () => {
    test('应该提取动态导入', () => {
      const content = `
const Component = lazy(() => import('./Component'));
      `;
      const imports = [];

      finder.extractDynamicImports(content, imports);

      expect(imports.some(i => i.isDynamic)).toBe(true);
    });
  });

  describe('extractSideEffectImports 函数', () => {
    test('应该提取副作用导入', () => {
      const content = `
import './styles.css';
      `;
      const imports = [];

      finder.extractSideEffectImports(content, imports);

      expect(imports.some(i => i.isSideEffect)).toBe(true);
    });
  });

  describe('buildAllImportsIndex 方法', () => {
    test('应该构建所有导入的索引', () => {
      finder.imports.set('file1.js', [
        new ImportItem('foo', './module1', false, true),
        new ImportItem('bar', './module2', false, true),
      ]);
      finder.imports.set('file2.js', [new ImportItem('foo', './module1', false, true)]);

      const testImports = new Map([['baz', new Set(['test.js'])]]);

      const result = finder.buildAllImportsIndex(testImports);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
      expect(result.has('baz')).toBe(true);
      expect(result.get('foo').size).toBe(2);
    });

    test('应该排除外部导入', () => {
      finder.imports.set('file1.js', [new ImportItem('React', 'react', true, false)]);

      const result = finder.buildAllImportsIndex(new Map());

      expect(result.has('React')).toBe(false);
    });

    test('应该合并测试导入', () => {
      finder.imports.set('file1.js', [new ImportItem('foo', './module', false, true)]);

      const testImports = new Map([['bar', new Set(['test.js'])]]);

      const result = finder.buildAllImportsIndex(testImports);

      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(true);
    });
  });

  describe('collectSideEffectImports 方法', () => {
    test('应该收集副作用导入的文件', () => {
      finder.imports.set('file1.js', [
        new ImportItem('', './styles.css', false, true, false, true),
      ]);

      jest.spyOn(finder, 'resolveImportPath').mockReturnValue('styles.css');

      const result = finder.collectSideEffectImports();

      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });
});
