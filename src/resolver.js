const fs = require('fs');
const path = require('path');

const { normalizePath, isSafePath } = require('./utils.js');
const { defaultLogger } = require('./logger.js');

/**
 * 默认路径别名配置
 */
const DEFAULT_ALIASES = {
  '@': null,
  '@@': null,
  '/@': null,
  '/src': null,
};

/**
 * 默认文件扩展名
 */
const DEFAULT_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.vue', ''];

/**
 * 配置缓存最大条目数
 */
const MAX_CACHE_SIZE = 100;

/**
 * 路径解析器类
 * 负责解析各种路径别名和相对路径
 */
class PathResolver {
  /**
   * 配置缓存（静态共享）
   * @type {Map<string, Object>}
   * @static
   */
  static configCache = new Map();

  /**
   * 创建路径解析器
   * @param {string} srcDir - 源代码目录
   */
  constructor(srcDir) {
    this.srcDir = srcDir;
    this.customAliases = this.loadAliasesFromConfig();
  }

  /**
   * 从项目配置文件中加载路径别名（带缓存）
   * @returns {Object} 路径别名映射
   */
  loadAliasesFromConfig() {
    const rootDir = path.dirname(this.srcDir);

    // 检查缓存
    if (PathResolver.configCache.has(rootDir)) {
      return { ...PathResolver.configCache.get(rootDir) };
    }

    const aliases = this._loadAliasesFromConfigFiles(rootDir);

    // 限制缓存大小
    if (PathResolver.configCache.size >= MAX_CACHE_SIZE) {
      const firstKey = PathResolver.configCache.keys().next().value;
      PathResolver.configCache.delete(firstKey);
    }

    PathResolver.configCache.set(rootDir, aliases);
    return { ...aliases };
  }

  /**
   * 从配置文件加载别名（内部方法）
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   * @private
   */
  _loadAliasesFromConfigFiles(rootDir) {
    const configFiles = [
      { name: 'tsconfig.json', type: 'tsconfig' },
      { name: 'jsconfig.json', type: 'tsconfig' },
      { name: 'vite.config.js', type: 'vite' },
      { name: 'vite.config.ts', type: 'vite' },
      { name: 'webpack.config.js', type: 'webpack' },
      { name: 'vue.config.js', type: 'vue' },
    ];

    for (const { name, type } of configFiles) {
      const configPath = path.join(rootDir, name);
      if (fs.existsSync(configPath)) {
        try {
          const config = require(configPath);
          return this.extractAliasesFromConfig(config, type, rootDir);
        } catch (error) {
          defaultLogger.warn(`配置文件加载失败: ${name}`, 'E002', {
            文件: configPath,
            错误信息: error.message,
          });
        }
      }
    }
    return {};
  }

  /**
   * 清除配置缓存
   * @static
   */
  static clearCache() {
    PathResolver.configCache.clear();
  }

  /**
   * 从配置对象中提取路径别名
   * @param {Object} config - 配置对象
   * @param {string} type - 配置类型
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   */
  extractAliasesFromConfig(config, type, rootDir) {
    const extractors = {
      tsconfig: () => this.extractTsConfigAliases(config, rootDir),
      vite: () => this.extractViteConfigAliases(config, rootDir),
      webpack: () => this.extractWebpackConfigAliases(config, rootDir),
      vue: () => this.extractVueConfigAliases(config, rootDir),
    };

    const extractor = extractors[type];
    return extractor ? extractor() : {};
  }

  /**
   * 从 tsconfig 或 jsconfig 中提取路径别名
   * @param {Object} config - 配置对象
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   */
  extractTsConfigAliases(config, rootDir) {
    const aliases = {};
    const compilerOptions = config.compilerOptions || {};
    const paths = compilerOptions.paths || {};

    for (const [alias, pathsArray] of Object.entries(paths)) {
      if (Array.isArray(pathsArray) && pathsArray.length > 0) {
        const resolvedPath = pathsArray[0].replace('*', '');
        aliases[alias.replace('*', '')] = path.resolve(rootDir, resolvedPath);
      }
    }
    return aliases;
  }

  /**
   * 从 Vite 配置中提取路径别名
   * @param {Object} config - 配置对象
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   */
  extractViteConfigAliases(config, rootDir) {
    const aliases = {};
    const resolve = config.resolve || {};
    const viteAliases = resolve.alias || {};

    for (const [alias, aliasPath] of Object.entries(viteAliases)) {
      if (typeof aliasPath === 'string') {
        aliases[alias] = path.resolve(rootDir, aliasPath);
      }
    }
    return aliases;
  }

  /**
   * 从 Webpack 配置中提取路径别名
   * @param {Object} config - 配置对象
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   */
  extractWebpackConfigAliases(config, rootDir) {
    const aliases = {};
    const resolve = config.resolve || {};
    const webpackAliases = resolve.alias || {};

    for (const [alias, aliasPath] of Object.entries(webpackAliases)) {
      if (typeof aliasPath === 'string') {
        aliases[alias] = path.resolve(rootDir, aliasPath);
      }
    }
    return aliases;
  }

  /**
   * 从 Vue 配置中提取路径别名
   * @param {Object} config - 配置对象
   * @param {string} rootDir - 项目根目录
   * @returns {Object} 路径别名映射
   */
  extractVueConfigAliases(config, rootDir) {
    const aliases = {};
    const configureWebpack = config.configureWebpack || {};

    if (configureWebpack.resolve) {
      const vueAliases = configureWebpack.resolve.alias || {};
      for (const [alias, aliasPath] of Object.entries(vueAliases)) {
        if (typeof aliasPath === 'string') {
          aliases[alias] = path.resolve(rootDir, aliasPath);
        }
      }
    }
    return aliases;
  }

  /**
   * 解析导入路径为相对路径
   * @param {string} importPath - 导入路径
   * @param {string} currentFile - 当前文件路径（相对于 srcDir）
   * @returns {string|null} 解析后的相对路径，如果无法解析则返回 null
   */
  resolve(importPath, currentFile) {
    let resolvedPath = importPath;
    let baseDir;

    const defaultMatch = this.matchDefaultAlias(importPath);
    if (defaultMatch) {
      resolvedPath = defaultMatch.resolvedPath;
      baseDir = defaultMatch.baseDir;
    } else if (resolvedPath.startsWith('./') || resolvedPath.startsWith('../')) {
      baseDir = path.dirname(path.join(this.srcDir, currentFile));
    } else {
      const customMatch = this.matchCustomAlias(resolvedPath);
      if (!customMatch) {
        return null;
      }
      resolvedPath = customMatch.resolvedPath;
      baseDir = customMatch.baseDir;
    }

    const absolutePath = path.resolve(baseDir, resolvedPath);
    if (!this.isPathInSrcDir(absolutePath)) {
      return null;
    }

    const foundFile = this.tryFindFile(absolutePath);
    if (foundFile) {
      return foundFile;
    }

    return this.tryFindIndexFile(absolutePath);
  }

  /**
   * 匹配默认路径别名
   * @param {string} importPath - 导入路径
   * @returns {Object|null} 匹配结果 { resolvedPath, baseDir }
   */
  matchDefaultAlias(importPath) {
    for (const alias of Object.keys(DEFAULT_ALIASES)) {
      if (importPath.startsWith(alias + '/')) {
        return {
          resolvedPath: importPath.slice(alias.length + 1),
          baseDir: this.srcDir,
        };
      }
    }
    return null;
  }

  /**
   * 匹配自定义路径别名
   * @param {string} importPath - 导入路径
   * @returns {Object|null} 匹配结果 { resolvedPath, baseDir }
   */
  matchCustomAlias(importPath) {
    for (const [alias, aliasPath] of Object.entries(this.customAliases)) {
      if (importPath.startsWith(alias)) {
        const remaining = importPath.slice(alias.length);
        return {
          resolvedPath: remaining,
          baseDir: aliasPath,
        };
      }
    }
    return null;
  }

  /**
   * 检查路径是否在源代码目录内
   * @param {string} absolutePath - 绝对路径
   * @returns {boolean}
   */
  isPathInSrcDir(absolutePath) {
    return isSafePath(this.srcDir, absolutePath);
  }

  /**
   * 尝试查找文件（带扩展名）
   * @param {string} absolutePath - 绝对路径（不含扩展名）
   * @returns {string|null} 相对路径
   */
  tryFindFile(absolutePath) {
    for (const ext of DEFAULT_EXTENSIONS) {
      const fullPath = absolutePath + ext;
      if (fs.existsSync(fullPath)) {
        return normalizePath(path.relative(this.srcDir, fullPath));
      }
    }
    return null;
  }

  /**
   * 尝试查找 index 文件
   * @param {string} absolutePath - 目录绝对路径
   * @returns {string|null} 相对路径
   */
  tryFindIndexFile(absolutePath) {
    for (const ext of DEFAULT_EXTENSIONS) {
      if (ext === '') continue;
      const indexPath = path.join(absolutePath, 'index' + ext);
      if (fs.existsSync(indexPath)) {
        return normalizePath(path.relative(this.srcDir, indexPath));
      }
    }
    return null;
  }

  /**
   * 获取自定义别名列表
   * @returns {Object}
   */
  getCustomAliases() {
    return { ...this.customAliases };
  }
}

module.exports = { PathResolver, DEFAULT_ALIASES, DEFAULT_EXTENSIONS };
