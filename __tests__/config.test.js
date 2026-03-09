/**
 * 配置文件功能测试
 */

const fs = require('fs');
const path = require('path');
const { loadConfig, mergeConfig, validateConfig } = require('../src/config.js');

describe('Config Module', () => {
  describe('loadConfig', () => {
    test('应该返回 null 当没有配置文件时', () => {
      const result = loadConfig();
      expect(result).toBeNull();
    });

    test('应该读取 JSON 配置文件', () => {
      const testConfigPath = path.join(__dirname, '.test-deadcoder.json');
      const testConfig = {
        srcDir: './custom-src',
        mode: 'regex',
        verbose: true,
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig), 'utf-8');

      try {
        const result = loadConfig(testConfigPath);
        expect(result).toEqual(testConfig);
      } finally {
        fs.unlinkSync(testConfigPath);
      }
    });

    test('应该读取 JavaScript 配置文件', () => {
      const testConfigPath = path.join(__dirname, '.test-deadcoder.js');
      const testConfig = {
        srcDir: './js-config-src',
        mode: 'ast',
        fix: true,
      };

      fs.writeFileSync(testConfigPath, `module.exports = ${JSON.stringify(testConfig)};`, 'utf-8');

      try {
        const result = loadConfig(testConfigPath);
        expect(result).toEqual(testConfig);
      } finally {
        fs.unlinkSync(testConfigPath);
        delete require.cache[require.resolve(testConfigPath)];
      }
    });

    test('应该处理损坏的配置文件', () => {
      const testConfigPath = path.join(__dirname, '.test-broken-config.json');

      // 写入损坏的 JSON
      fs.writeFileSync(testConfigPath, '{invalid json}', 'utf-8');

      // 保存原始 console.warn
      const originalWarn = console.warn;
      let warnCalled = false;

      console.warn = () => {
        warnCalled = true;
      };

      try {
        const result = loadConfig(testConfigPath);
        expect(result).toBeNull();
        expect(warnCalled).toBe(true);
      } finally {
        console.warn = originalWarn;
        fs.unlinkSync(testConfigPath);
      }
    });
  });

  describe('mergeConfig', () => {
    test('应该使用默认值当没有参数时', () => {
      const result = mergeConfig(null, null);
      expect(result.srcDir).toContain('src');
      expect(result.mode).toBe('ast');
      expect(result.fix).toBe(false);
      expect(result.verbose).toBe(false);
    });

    test('应该合并配置文件和命令行参数', () => {
      const configFile = {
        srcDir: process.cwd(),
        mode: 'regex',
        verbose: true,
      };
      const cliArgs = {
        src: process.cwd(),
        fix: true,
      };

      const result = mergeConfig(cliArgs, configFile);
      expect(result.srcDir).toBe(process.cwd());
      expect(result.mode).toBe('regex');
      expect(result.fix).toBe(true);
      expect(result.verbose).toBe(true);
    });

    test('应该正确处理字符串扩展名和忽略目录', () => {
      const configFile = {
        extensions: '.js,.ts',
        ignoreDirs: 'node_modules,build',
      };

      const result = mergeConfig(null, configFile);
      expect(result.extensions).toEqual(['.js', '.ts']);
      expect(result.ignoreDirs).toEqual(['node_modules', 'build']);
    });

    test('应该正确处理数组扩展名和忽略目录', () => {
      const configFile = {
        extensions: ['.js', '.ts', '.jsx'],
        ignoreDirs: ['node_modules', 'dist', 'coverage'],
      };

      const result = mergeConfig(null, configFile);
      expect(result.extensions).toEqual(['.js', '.ts', '.jsx']);
      expect(result.ignoreDirs).toEqual(['node_modules', 'dist', 'coverage']);
    });

    test('应该正确处理命令行的 ext 参数', () => {
      const cliArgs = {
        ext: '.js,.jsx,.ts',
      };

      const result = mergeConfig(cliArgs, null);
      expect(result.extensions).toEqual(['.js', '.jsx', '.ts']);
    });

    test('应该正确处理命令行的 ignore 参数', () => {
      const cliArgs = {
        ignore: 'node_modules,dist,build',
      };

      const result = mergeConfig(cliArgs, null);
      expect(result.ignoreDirs).toEqual(['node_modules', 'dist', 'build']);
    });
  });

  describe('validateConfig', () => {
    test('应该通过有效配置', () => {
      const config = {
        srcDir: process.cwd(),
        extensions: ['.js', '.ts'],
        ignoreDirs: ['node_modules'],
        mode: 'ast',
        maxFileSize: 1000,
        concurrency: 10,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    test('应该在 srcDir 不存在时抛出错误', () => {
      const config = {
        srcDir: '/non/existent/directory',
      };

      expect(() => validateConfig(config)).toThrow('srcDir: 目录不存在');
    });

    test('应该在 extensions 不是数组时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        extensions: 'not-an-array',
      };

      expect(() => validateConfig(config)).toThrow('extensions: 必须是数组');
    });

    test('应该在扩展名不以点开头时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        extensions: ['js', '.ts'],
      };

      expect(() => validateConfig(config)).toThrow('extensions: 扩展名必须以 "." 开头');
    });

    test('应该在 ignoreDirs 不是数组时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        ignoreDirs: 'node_modules',
      };

      expect(() => validateConfig(config)).toThrow('ignoreDirs: 必须是数组');
    });

    test('应该在 mode 无效时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        mode: 'invalid-mode',
      };

      expect(() => validateConfig(config)).toThrow('mode: 必须是 "ast" 或 "regex"');
    });

    test('应该在 maxFileSize 不是正整数时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        maxFileSize: -100,
      };

      expect(() => validateConfig(config)).toThrow('maxFileSize: 必须是正整数');
    });

    test('应该在 maxFileSize 不是整数时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        maxFileSize: 1.5,
      };

      expect(() => validateConfig(config)).toThrow('maxFileSize: 必须是正整数');
    });

    test('应该在 concurrency 不是正整数时抛出错误', () => {
      const config = {
        srcDir: process.cwd(),
        concurrency: 0,
      };

      expect(() => validateConfig(config)).toThrow('concurrency: 必须是正整数');
    });

    test('应该收集多个验证错误', () => {
      const config = {
        srcDir: '/non/existent/directory',
        extensions: ['invalid'],
        mode: 'invalid',
        maxFileSize: -1,
        concurrency: 0,
      };

      try {
        validateConfig(config);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toContain('srcDir: 目录不存在');
        expect(error.message).toContain('extensions: 扩展名必须以 "." 开头');
        expect(error.message).toContain('mode: 必须是 "ast" 或 "regex"');
        expect(error.message).toContain('maxFileSize: 必须是正整数');
        expect(error.message).toContain('concurrency: 必须是正整数');
      }
    });
  });
});
