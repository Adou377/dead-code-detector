/**
 * 组件检测器类
 * 负责检测和分析组件使用情况
 */
class ComponentDetector {
  /**
   * 创建组件检测器
   * @param {Object} options - 配置选项
   * @param {Function} options.toPascalCase - 转换为 PascalCase 的函数
   * @param {Function} options.toKebabCase - 转换为 kebab-case 的函数
   */
  constructor(options = {}) {
    this.toPascalCase = options.toPascalCase || this.defaultToPascalCase;
    this.toKebabCase = options.toKebabCase || this.defaultToKebabCase;
  }

  /**
   * 默认转换为 PascalCase
   * @param {string} str - 字符串
   * @returns {string}
   */
  defaultToPascalCase(str) {
    return str
      .replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(\w)/, (_, c) => c.toUpperCase());
  }

  /**
   * 默认转换为 kebab-case
   * @param {string} str - 字符串
   * @returns {string}
   */
  defaultToKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 收集组件使用情况
   * @param {Map} imports - 导入映射
   * @param {Map} testImports - 测试导入
   * @returns {Map} 组件使用情况映射
   */
  collectComponentUsages(imports, testImports = new Map()) {
    const componentUsages = new Map();

    for (const [file, fileImports] of imports) {
      for (const imp of fileImports) {
        if (imp.isInternal !== false) {
          const name = imp.name;
          if (!componentUsages.has(name)) {
            componentUsages.set(name, new Set());
          }
          componentUsages.get(name).add(file);
        }
      }
    }

    for (const [name, files] of testImports) {
      if (!componentUsages.has(name)) {
        componentUsages.set(name, new Set());
      }
      for (const file of files) {
        componentUsages.get(name).add(file);
      }
    }

    return componentUsages;
  }

  /**
   * 从文件内容构建组件标签索引
   * @param {Map} fileContents - 文件内容映射
   * @returns {Map} 组件标签索引
   */
  buildComponentTagIndexFromFileContents(fileContents) {
    const componentTagIndex = new Map();

    for (const [relativePath, content] of fileContents) {
      const tagMatches = content.matchAll(
        /<([A-Z][a-zA-Z0-9]*)|<([a-z][a-zA-Z0-9]*(?:-[a-z][a-zA-Z0-9]*)*)/g
      );
      for (const match of tagMatches) {
        const tag = match[1] || match[2];
        if (tag) {
          if (!componentTagIndex.has(tag)) {
            componentTagIndex.set(tag, new Set());
          }
          componentTagIndex.get(tag).add(relativePath);
        }
      }
    }

    return componentTagIndex;
  }

  /**
   * 从 JSX 使用映射构建组件标签索引
   * @param {Map} jsxUsage - JSX 使用映射
   * @returns {Map} 组件标签索引
   */
  buildComponentTagIndexFromJSX(jsxUsage) {
    const componentTagIndex = new Map();

    for (const [relativePath, components] of jsxUsage) {
      for (const tag of components) {
        if (!componentTagIndex.has(tag)) {
          componentTagIndex.set(tag, new Set());
        }
        componentTagIndex.get(tag).add(relativePath);
      }
    }

    return componentTagIndex;
  }

  /**
   * 合并组件标签索引
   * @param {Map} target - 目标索引
   * @param {Map} source - 源索引
   */
  mergeComponentTagIndex(target, source) {
    for (const [tag, files] of source) {
      if (!target.has(tag)) {
        target.set(tag, new Set());
      }
      for (const file of files) {
        target.get(tag).add(file);
      }
    }
  }

  /**
   * 检查组件是否被使用
   * @param {string} componentName - 组件名称
   * @param {string} filePath - 组件文件路径
   * @param {Map} componentUsages - 组件使用情况
   * @param {Map} componentTagIndex - 组件标签索引
   * @returns {boolean} 是否被使用
   */
  isComponentUsed(componentName, filePath, componentUsages, componentTagIndex) {
    const pascalName = this.toPascalCase(componentName);
    const kebabName = this.toKebabCase(componentName);

    if (componentUsages.has(pascalName) || componentUsages.has(kebabName)) {
      return true;
    }

    const pascalFiles = componentTagIndex.get(pascalName);
    if (pascalFiles && !pascalFiles.has(filePath)) {
      return true;
    }

    const kebabFiles = componentTagIndex.get(kebabName);
    if (kebabFiles && !kebabFiles.has(filePath)) {
      return true;
    }

    return false;
  }

  /**
   * 检测未使用的组件
   * @param {Map} components - 组件映射
   * @param {Map} componentUsages - 组件使用情况
   * @param {Map} componentTagIndex - 组件标签索引
   * @param {Map} localComponents - 局部组件映射
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Array} 未使用的组件列表
   */
  detectUnusedComponents(
    components,
    componentUsages,
    componentTagIndex,
    localComponents = new Map(),
    progressCallback = null
  ) {
    const unusedComponents = [];
    const componentArray = Array.from(components.entries());
    const total = componentArray.length;
    let processed = 0;

    for (const [file, comp] of componentArray) {
      if (comp.isGlobal) {
        processed++;
        if (progressCallback && processed % 100 === 0) {
          progressCallback(processed, total);
        }
        continue;
      }

      const isUsed = this.isComponentUsed(
        comp.name,
        file,
        componentUsages,
        componentTagIndex
      );

      if (!isUsed) {
        unusedComponents.push({ file, name: comp.name });
      }

      processed++;
      if (progressCallback && processed % 100 === 0) {
        progressCallback(processed, total);
      }
    }

    if (progressCallback) {
      progressCallback(total, total);
    }

    this.detectUnusedLocalComponents(
      localComponents,
      componentUsages,
      componentTagIndex,
      unusedComponents
    );

    return unusedComponents;
  }

  /**
   * 检测未使用的局部组件
   * @param {Map} localComponents - 局部组件映射
   * @param {Map} componentUsages - 组件使用情况
   * @param {Map} componentTagIndex - 组件标签索引
   * @param {Array} unusedComponents - 未使用的组件列表（会被修改）
   */
  detectUnusedLocalComponents(
    localComponents,
    componentUsages,
    componentTagIndex,
    unusedComponents
  ) {
    for (const [file, components] of localComponents) {
      for (const componentName of components) {
        const isUsed = this.isComponentUsed(
          componentName,
          file,
          componentUsages,
          componentTagIndex
        );

        if (!isUsed) {
          const exists = unusedComponents.some(
            u => u.file === file && u.name === componentName
          );
          if (!exists) {
            unusedComponents.push({
              file,
              name: componentName,
              isLocal: true,
            });
          }
        }
      }
    }
  }
}

module.exports = { ComponentDetector };
