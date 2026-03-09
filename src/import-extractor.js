/**
 * 导入提取器模块
 * 负责从文件内容中提取各种类型的导入
 */

const {
  REGEX_STATIC_IMPORT,
  REGEX_DYNAMIC_IMPORT,
  REGEX_SIDE_EFFECT_IMPORT,
  isInternalImport,
} = require('./constants.js');

const { ImportItem } = require('./models.js');

/**
 * 提取静态导入
 * @param {string} content - 文件内容
 * @param {ImportItem[]} imports - 导入数组
 */
function extractStaticImports(content, imports) {
  for (const match of content.matchAll(REGEX_STATIC_IMPORT)) {
    const importPath = match[4];
    const isInternal = isInternalImport(importPath);

    if (match[1]) {
      const names = match[1].split(',').map(n => n.trim());
      for (const name of names) {
        const alias = name.split(' as ').pop().trim();
        imports.push(new ImportItem(alias, importPath, false, isInternal));
      }
    } else if (match[2]) {
      imports.push(new ImportItem(match[2], importPath, true, isInternal));
    } else if (match[3]) {
      imports.push(new ImportItem(match[3], importPath, false, isInternal));
    }
  }
}

/**
 * 提取动态导入
 * @param {string} content - 文件内容
 * @param {ImportItem[]} imports - 导入数组
 */
function extractDynamicImports(content, imports) {
  for (const match of content.matchAll(REGEX_DYNAMIC_IMPORT)) {
    const importPath = match[1] || match[2] || match[3];
    if (importPath) {
      const isInternal = !!(match[3] || isInternalImport(importPath));
      imports.push(new ImportItem(importPath, importPath, false, isInternal, true));
    }
  }
}

/**
 * 提取副作用导入
 * @param {string} content - 文件内容
 * @param {ImportItem[]} imports - 导入数组
 */
function extractSideEffectImports(content, imports) {
  for (const match of content.matchAll(REGEX_SIDE_EFFECT_IMPORT)) {
    const fullMatch = match[0];
    if (!fullMatch.includes('from') && !fullMatch.includes('{') && !fullMatch.includes('*')) {
      const importPath = fullMatch.replace(/import\s+/, '').replace(/['"]/g, '');
      const isInternal = isInternalImport(importPath);
      if (isInternal) {
        imports.push(new ImportItem('', importPath, false, isInternal, false, true));
      }
    }
  }
}

/**
 * 导入提取器类
 * 提供统一的导入提取接口
 */
class ImportExtractor {
  /**
   * 从内容中提取所有导入
   * @param {string} content - 文件内容
   * @returns {ImportItem[]} 导入数组
   */
  static extractAll(content) {
    const imports = [];

    extractStaticImports(content, imports);
    extractDynamicImports(content, imports);
    extractSideEffectImports(content, imports);

    return imports;
  }
}

module.exports = {
  ImportExtractor,
  extractStaticImports,
  extractDynamicImports,
  extractSideEffectImports,
};
