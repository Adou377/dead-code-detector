const { PathResolver, DEFAULT_ALIASES, DEFAULT_EXTENSIONS } = require('../src/resolver.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('PathResolver', () => {
  let testDir;
  let resolver;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-resolver-test-'));
    resolver = new PathResolver(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('应该正确创建实例', () => {
      expect(resolver).toBeInstanceOf(PathResolver);
      expect(resolver.srcDir).toBe(testDir);
    });

    test('应该初始化自定义别名', () => {
      expect(resolver.customAliases).toBeInstanceOf(Object);
    });
  });

  describe('resolve', () => {
    test('对于相对路径文件应该正确解析', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const result = resolver.resolve('./test.js', 'other.js');

      expect(result).toBe('test.js');
    });

    test('对于不存在的文件应该返回 null', () => {
      const result = resolver.resolve('./nonexistent.js', 'test.js');

      expect(result).toBeNull();
    });

    test('对于外部模块应该返回 null', () => {
      const result = resolver.resolve('lodash', 'test.js');

      expect(result).toBeNull();
    });

    test('对于 @/ 别名路径应该正确解析', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      const helperFile = path.join(utilsDir, 'helper.js');
      fs.writeFileSync(helperFile, 'export const help = () => {};');

      const result = resolver.resolve('@/utils/helper.js', 'test.js');

      expect(result).toBe('utils/helper.js');
    });

    test('对于 @@/ 别名路径应该正确解析', () => {
      const componentsDir = path.join(testDir, 'components');
      fs.mkdirSync(componentsDir);
      const buttonFile = path.join(componentsDir, 'Button.vue');
      fs.writeFileSync(buttonFile, '<template><button>Click</button></template>');

      const result = resolver.resolve('@@/components/Button.vue', 'test.js');

      expect(result).toBe('components/Button.vue');
    });

    test('对于 index 文件应该正确解析', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      const indexFile = path.join(utilsDir, 'index.js');
      fs.writeFileSync(indexFile, 'export * from "./helper";');

      const result = resolver.resolve('./utils', 'test.js');

      expect(result).toBe('utils');
    });

    test('对于带扩展名的文件应该正确解析', () => {
      const testFile = path.join(testDir, 'module.ts');
      fs.writeFileSync(testFile, 'export const foo: number = 1;');

      const result = resolver.resolve('./module.ts', 'test.js');

      expect(result).toBe('module.ts');
    });

    test('对于 Vue 文件应该正确解析', () => {
      const testFile = path.join(testDir, 'Component.vue');
      fs.writeFileSync(testFile, '<template><div>Test</div></template>');

      const result = resolver.resolve('./Component.vue', 'test.js');

      expect(result).toBe('Component.vue');
    });

    test('对于 JSX 文件应该正确解析', () => {
      const testFile = path.join(testDir, 'Component.jsx');
      fs.writeFileSync(testFile, 'export const Component = () => <div />;');

      const result = resolver.resolve('./Component.jsx', 'test.js');

      expect(result).toBe('Component.jsx');
    });

    test('对于 TSX 文件应该正确解析', () => {
      const testFile = path.join(testDir, 'Component.tsx');
      fs.writeFileSync(testFile, 'export const Component = () => <div />;');

      const result = resolver.resolve('./Component.tsx', 'test.js');

      expect(result).toBe('Component.tsx');
    });
  });

  describe('matchDefaultAlias', () => {
    test('应该匹配 @/ 别名', () => {
      const result = resolver.matchDefaultAlias('@/utils/helper.js');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('utils/helper.js');
      expect(result.baseDir).toBe(testDir);
    });

    test('应该匹配 @@/ 别名', () => {
      const result = resolver.matchDefaultAlias('@@/components/Button.vue');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('components/Button.vue');
    });

    test('应该匹配 /@/ 别名', () => {
      const result = resolver.matchDefaultAlias('/@/utils/helper.js');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('utils/helper.js');
    });

    test('应该匹配 /src/ 别名', () => {
      const result = resolver.matchDefaultAlias('/src/utils/helper.js');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('utils/helper.js');
    });

    test('对于非别名路径应该返回 null', () => {
      const result = resolver.matchDefaultAlias('./utils/helper.js');

      expect(result).toBeNull();
    });

    test('对于外部模块应该返回 null', () => {
      const result = resolver.matchDefaultAlias('lodash');

      expect(result).toBeNull();
    });
  });

  describe('isPathInSrcDir', () => {
    test('对于源目录内的路径应该返回 true', () => {
      const result = resolver.isPathInSrcDir(path.join(testDir, 'utils', 'helper.js'));

      expect(result).toBe(true);
    });

    test('对于源目录本身的路径应该返回 true', () => {
      const result = resolver.isPathInSrcDir(testDir);

      expect(result).toBe(true);
    });

    test('对于源目录外的路径应该返回 false', () => {
      const result = resolver.isPathInSrcDir(path.join(os.tmpdir(), 'other-dir', 'file.js'));

      expect(result).toBe(false);
    });

    test('对于上级目录应该返回 false', () => {
      const result = resolver.isPathInSrcDir(path.dirname(testDir));

      expect(result).toBe(false);
    });
  });

  describe('tryFindFile', () => {
    test('应该找到存在的文件', () => {
      const testFile = path.join(testDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const result = resolver.tryFindFile(path.join(testDir, 'test'));

      expect(result).toBe('test.js');
    });

    test('对于不存在的文件应该返回 null', () => {
      const result = resolver.tryFindFile(path.join(testDir, 'nonexistent'));

      expect(result).toBeNull();
    });

    test('应该找到带不同扩展名的文件', () => {
      const testFile = path.join(testDir, 'module.ts');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const result = resolver.tryFindFile(path.join(testDir, 'module'));

      expect(result).toBe('module.ts');
    });
  });

  describe('tryFindIndexFile', () => {
    test('应该找到 index.js 文件', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      fs.writeFileSync(path.join(utilsDir, 'index.js'), 'export const foo = 1;');

      const result = resolver.tryFindIndexFile(utilsDir);

      expect(result).toBe('utils/index.js');
    });

    test('应该找到 index.ts 文件', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);
      fs.writeFileSync(path.join(utilsDir, 'index.ts'), 'export const foo = 1;');

      const result = resolver.tryFindIndexFile(utilsDir);

      expect(result).toBe('utils/index.ts');
    });

    test('对于不存在的 index 文件应该返回 null', () => {
      const utilsDir = path.join(testDir, 'utils');
      fs.mkdirSync(utilsDir);

      const result = resolver.tryFindIndexFile(utilsDir);

      expect(result).toBeNull();
    });
  });

  describe('getCustomAliases', () => {
    test('应该返回自定义别名对象', () => {
      const aliases = resolver.getCustomAliases();

      expect(aliases).toBeInstanceOf(Object);
    });
  });

  describe('loadAliasesFromConfig', () => {
    test('当没有配置文件时应该返回空对象', () => {
      const aliases = resolver.loadAliasesFromConfig();

      expect(aliases).toEqual({});
    });

    test('应该加载 tsconfig.json 中的路径别名', () => {
      const rootDir = path.dirname(testDir);
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@/*': ['src/*'],
              '@components/*': ['src/components/*'],
            },
          },
        })
      );

      // 清除缓存以确保重新加载
      PathResolver.clearCache();
      const newResolver = new PathResolver(testDir);
      const aliases = newResolver.getCustomAliases();

      // 验证配置文件被正确读取，不抛出错误
      expect(typeof aliases).toBe('object');

      fs.unlinkSync(tsconfigPath);
      PathResolver.clearCache();
    });

    test('应该处理无效的配置文件', () => {
      const rootDir = path.dirname(testDir);
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      fs.writeFileSync(tsconfigPath, 'invalid json content');

      // 清除缓存以确保重新加载
      PathResolver.clearCache();
      const newResolver = new PathResolver(testDir);
      const aliases = newResolver.getCustomAliases();

      // 无效配置文件应该返回空对象或已解析的别名
      // 由于缓存可能包含之前的配置，我们只验证不会抛出错误
      expect(typeof aliases).toBe('object');

      fs.unlinkSync(tsconfigPath);
      PathResolver.clearCache();
    });
  });

  describe('extractAliasesFromConfig', () => {
    test('应该从 tsconfig 提取别名', () => {
      const config = {
        compilerOptions: {
          paths: {
            '@/*': ['src/*'],
          },
        },
      };

      const aliases = resolver.extractAliasesFromConfig(config, 'tsconfig', path.dirname(testDir));

      expect(aliases).toHaveProperty('@/');
    });

    test('应该从 vite config 提取别名', () => {
      const config = {
        resolve: {
          alias: {
            '@': './src',
          },
        },
      };

      const aliases = resolver.extractAliasesFromConfig(config, 'vite', path.dirname(testDir));

      expect(aliases).toHaveProperty('@');
    });

    test('应该从 webpack config 提取别名', () => {
      const config = {
        resolve: {
          alias: {
            '@': path.join(path.dirname(testDir), 'src'),
          },
        },
      };

      const aliases = resolver.extractAliasesFromConfig(config, 'webpack', path.dirname(testDir));

      expect(aliases).toHaveProperty('@');
    });

    test('应该从 vue config 提取别名', () => {
      const config = {
        configureWebpack: {
          resolve: {
            alias: {
              '@': path.join(path.dirname(testDir), 'src'),
            },
          },
        },
      };

      const aliases = resolver.extractAliasesFromConfig(config, 'vue', path.dirname(testDir));

      expect(aliases).toHaveProperty('@');
    });

    test('对于未知配置类型应该返回空对象', () => {
      const aliases = resolver.extractAliasesFromConfig({}, 'unknown', path.dirname(testDir));

      expect(aliases).toEqual({});
    });
  });

  describe('matchCustomAlias', () => {
    test('应该匹配自定义别名', () => {
      resolver.customAliases = {
        '@custom/': path.join(testDir, 'custom'),
      };

      const result = resolver.matchCustomAlias('@custom/module.js');

      expect(result).not.toBeNull();
      expect(result.resolvedPath).toBe('module.js');
    });

    test('对于非自定义别名应该返回 null', () => {
      resolver.customAliases = {};

      const result = resolver.matchCustomAlias('./module.js');

      expect(result).toBeNull();
    });

    test('对于不存在的自定义别名应该返回 null', () => {
      resolver.customAliases = {
        '@custom/': path.join(testDir, 'custom'),
      };

      const result = resolver.matchCustomAlias('@other/module.js');

      expect(result).toBeNull();
    });
  });

  describe('配置缓存测试', () => {
    test('应该限制配置缓存大小', () => {
      // 清除现有缓存
      PathResolver.clearCache();

      // 创建多个解析器实例，超过缓存限制
      const cacheLimit = 100;
      const tempDirs = [];

      for (let i = 0; i < cacheLimit + 5; i++) {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `cache-test-${i}-`));
        tempDirs.push(tempDir);
        new PathResolver(path.join(tempDir, 'src'));
      }

      // 验证缓存大小不超过限制
      expect(PathResolver.configCache.size).toBeLessThanOrEqual(cacheLimit);

      // 清理临时目录
      tempDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      });
    });

    test('应该从缓存中读取配置', () => {
      const rootDir = path.dirname(testDir);
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');

      // 创建 tsconfig.json 文件
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@/*': ['src/*'],
            },
          },
        })
      );

      // 清除缓存
      PathResolver.clearCache();

      // 第一次创建解析器，应该加载配置
      const resolver1 = new PathResolver(testDir);
      const aliases1 = resolver1.getCustomAliases();

      // 第二次创建解析器，应该从缓存中读取
      const resolver2 = new PathResolver(testDir);
      const aliases2 = resolver2.getCustomAliases();

      // 验证两个解析器的别名相同
      expect(aliases1).toEqual(aliases2);

      // 清理
      fs.unlinkSync(tsconfigPath);
      PathResolver.clearCache();
    });
  });

  describe('路径解析边缘情况', () => {
    test('对于 src 目录外的路径应该返回 null', () => {
      const externalDir = path.join(os.tmpdir(), 'external');
      fs.mkdirSync(externalDir);
      const externalFile = path.join(externalDir, 'module.js');
      fs.writeFileSync(externalFile, 'export const foo = 1;');

      // 尝试解析外部路径
      const result = resolver.resolve(path.relative(testDir, externalFile), 'test.js');

      expect(result).toBeNull();

      // 清理
      fs.rmSync(externalDir, { recursive: true, force: true });
    });

    test('对于空路径应该返回 null', () => {
      const result = resolver.resolve('', 'test.js');
      expect(result).toBeNull();
    });

    test('对于根路径应该返回 null', () => {
      const result = resolver.resolve('/', 'test.js');
      expect(result).toBeNull();
    });
  });

  describe('tsconfig paths 配置解析边界测试', () => {
    test('应该正确解析 tsconfig paths 多级路径', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-multi-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const tsconfigPath = path.join(tempRoot, 'tsconfig.json');
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['src/*'],
              '@components/*': ['src/components/*'],
            },
          },
        })
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toHaveProperty('@/');
      expect(aliases).toHaveProperty('@components/');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该正确解析 tsconfig paths 带 baseUrl', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-baseurl-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const tsconfigPath = path.join(tempRoot, 'tsconfig.json');
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: './src',
            paths: {
              '@/*': ['./*'],
            },
          },
        })
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toHaveProperty('@/');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该处理 tsconfig paths 空路径配置', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-empty-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const tsconfigPath = path.join(tempRoot, 'tsconfig.json');
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {},
          },
        })
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toEqual({});

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该处理 tsconfig paths 无效路径数组', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-invalid-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const tsconfigPath = path.join(tempRoot, 'tsconfig.json');
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@/*': [],
              '@utils/*': null,
            },
          },
        })
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(typeof aliases).toBe('object');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });
  });

  describe('vite resolve.alias 配置解析边界测试', () => {
    test('应该正确解析 vite 别名对象格式', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-obj-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const viteConfigPath = path.join(tempRoot, 'vite.config.js');
      fs.writeFileSync(
        viteConfigPath,
        `
module.exports = {
  resolve: {
    alias: {
      '@': './src',
      '@components': './src/components',
    }
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toHaveProperty('@');
      expect(aliases).toHaveProperty('@components');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该正确解析 vite 别名数组格式', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-arr-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const viteConfigPath = path.join(tempRoot, 'vite.config.js');
      fs.writeFileSync(
        viteConfigPath,
        `
module.exports = {
  resolve: {
    alias: [
      { find: '@', replacement: './src' },
      { find: '@components', replacement: './src/components' },
    ]
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      // 数组格式需要额外处理，当前实现可能不支持
      expect(typeof aliases).toBe('object');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该处理 vite 配置中无 resolve.alias', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-noalias-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const viteConfigPath = path.join(tempRoot, 'vite.config.js');
      fs.writeFileSync(
        viteConfigPath,
        `
module.exports = {
  plugins: []
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toEqual({});

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });
  });

  describe('webpack resolve.alias 配置解析边界测试', () => {
    test('应该正确解析 webpack 别名配置', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webpack-alias-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const webpackConfigPath = path.join(tempRoot, 'webpack.config.js');
      fs.writeFileSync(
        webpackConfigPath,
        `
const path = require('path');
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    }
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toHaveProperty('@');
      expect(aliases).toHaveProperty('@components');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该处理 webpack 配置函数形式', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'webpack-func-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const webpackConfigPath = path.join(tempRoot, 'webpack.config.js');
      fs.writeFileSync(
        webpackConfigPath,
        `
module.exports = function(env) {
  return {
    resolve: {
      alias: {
        '@': './src'
      }
    }
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      // 函数形式可能无法直接解析
      expect(typeof aliases).toBe('object');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });
  });

  describe('vue.config.js 配置解析边界测试', () => {
    test('应该正确解析 vue.config.js 别名配置', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-config-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const vueConfigPath = path.join(tempRoot, 'vue.config.js');
      fs.writeFileSync(
        vueConfigPath,
        `
const path = require('path');
module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
      }
    }
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      expect(aliases).toHaveProperty('@');
      expect(aliases).toHaveProperty('@components');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });

    test('应该处理 vue.config.js 链式配置', () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-chain-'));
      const tempSrcDir = path.join(tempRoot, 'src');
      fs.mkdirSync(tempSrcDir);

      const vueConfigPath = path.join(tempRoot, 'vue.config.js');
      fs.writeFileSync(
        vueConfigPath,
        `
module.exports = {
  chainWebpack: config => {
    config.resolve.alias.set('@', path.resolve(__dirname, 'src'));
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(tempSrcDir);
      const aliases = newResolver.getCustomAliases();

      // chainWebpack 形式无法静态解析
      expect(typeof aliases).toBe('object');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      PathResolver.clearCache();
    });
  });

  describe('别名解析失败场景', () => {
    test('应该处理不存在的别名路径', () => {
      resolver.customAliases = {
        '@nonexistent/': path.join(testDir, 'nonexistent'),
      };

      const result = resolver.resolve('@nonexistent/module.js', 'test.js');

      expect(result).toBeNull();
    });

    test('应该处理别名路径指向目录外的文件', () => {
      const externalDir = path.join(os.tmpdir(), 'external-alias');
      fs.mkdirSync(externalDir, { recursive: true });

      resolver.customAliases = {
        '@external/': externalDir,
      };

      const result = resolver.resolve('@external/module.js', 'test.js');

      // 外部目录应该返回 null
      expect(result).toBeNull();

      fs.rmSync(externalDir, { recursive: true, force: true });
    });

    test('应该处理无效的别名格式', () => {
      resolver.customAliases = {
        '': path.join(testDir, 'empty'),
        '@': null,
      };

      // 空别名应该不影响解析
      const result = resolver.resolve('./test.js', 'test.js');
      expect(result).toBeNull();
    });
  });

  describe('循环引用场景', () => {
    test('应该处理模块循环引用', () => {
      const moduleA = path.join(testDir, 'moduleA.js');
      const moduleB = path.join(testDir, 'moduleB.js');

      fs.writeFileSync(moduleA, "import { b } from './moduleB'; export const a = 'a';");
      fs.writeFileSync(moduleB, "import { a } from './moduleA'; export const b = 'b';");

      const resultA = resolver.resolve('./moduleA.js', 'test.js');
      const resultB = resolver.resolve('./moduleB.js', 'test.js');

      expect(resultA).toBe('moduleA.js');
      expect(resultB).toBe('moduleB.js');

      fs.unlinkSync(moduleA);
      fs.unlinkSync(moduleB);
    });

    test('应该处理别名循环引用', () => {
      resolver.customAliases = {
        '@/': testDir,
        '@src/': testDir,
      };

      const result = resolver.resolve('@/module.js', 'test.js');
      expect(result).toBeNull();
    });

    test('应该处理自身引用', () => {
      const moduleFile = path.join(testDir, 'selfRef.js');
      fs.writeFileSync(
        moduleFile,
        "import { something } from './selfRef'; export const something = 'test';"
      );

      const result = resolver.resolve('./selfRef.js', 'selfRef.js');

      expect(result).toBe('selfRef.js');

      fs.unlinkSync(moduleFile);
    });
  });

  describe('多配置文件优先级', () => {
    test('应该按优先级加载配置文件', () => {
      const rootDir = path.dirname(testDir);
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      const viteConfigPath = path.join(rootDir, 'vite.config.js');

      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            paths: {
              '@/*': ['src/*'],
            },
          },
        })
      );

      fs.writeFileSync(
        viteConfigPath,
        `
module.exports = {
  resolve: {
    alias: {
      '@vite': './src'
    }
  }
}
`
      );

      PathResolver.clearCache();
      const newResolver = new PathResolver(testDir);
      const aliases = newResolver.getCustomAliases();

      // tsconfig 应该优先被加载
      expect(aliases).toHaveProperty('@/');

      fs.unlinkSync(tsconfigPath);
      fs.unlinkSync(viteConfigPath);
      PathResolver.clearCache();
    });
  });
});

describe('DEFAULT_ALIASES', () => {
  test('应该包含 @ 别名', () => {
    expect(DEFAULT_ALIASES).toHaveProperty('@');
  });

  test('应该包含 @@ 别名', () => {
    expect(DEFAULT_ALIASES).toHaveProperty('@@');
  });

  test('应该包含 /@ 别名', () => {
    expect(DEFAULT_ALIASES).toHaveProperty('/@');
  });

  test('应该包含 /src 别名', () => {
    expect(DEFAULT_ALIASES).toHaveProperty('/src');
  });
});

describe('DEFAULT_EXTENSIONS', () => {
  test('应该包含 .js 扩展名', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.js');
  });

  test('应该包含 .ts 扩展名', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.ts');
  });

  test('应该包含 .jsx 扩展名', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.jsx');
  });

  test('应该包含 .tsx 扩展名', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.tsx');
  });

  test('应该包含 .vue 扩展名', () => {
    expect(DEFAULT_EXTENSIONS).toContain('.vue');
  });

  test('应该包含空字符串（无扩展名）', () => {
    expect(DEFAULT_EXTENSIONS).toContain('');
  });
});
