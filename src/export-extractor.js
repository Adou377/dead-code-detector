/**
 * 导出提取器模块
 * 负责从文件内容中提取各种类型的导出
 */

const {
  IGNORE_MACROS,
  IGNORE_EXPORTS,
  REGEX_NAMED_EXPORT,
  REGEX_TS_NAMED_EXPORT,
  REGEX_TS_ENUM_EXPORT,
  REGEX_TS_NAMESPACE_EXPORT,
  REGEX_DEFAULT_EXPORT,
  REGEX_GROUP_EXPORT,
  REGEX_GROUP_REEXPORT,
  REGEX_STAR_EXPORT,
  REGEX_STAR_AS_NAMESPACE_EXPORT,
  REGEX_DEFAULT_REEXPORT,
  REGEX_TS_TYPE_GROUP_EXPORT,
  REGEX_TS_TYPE_REEXPORT,
} = require('./constants.js');

const { ExportItem } = require('./models.js');

/**
 * 获取匹配位置在内容中的行号
 * @param {string} content - 内容
 * @param {number} matchIndex - 匹配索引
 * @returns {number} 行号
 */
function getLineNumber(content, matchIndex) {
  return content.substring(0, matchIndex).split('\n').length;
}

/**
 * 从名称列表中提取别名并添加到导出数组
 * @param {string[]} names - 名称列表
 * @param {number} line - 行号
 * @param {string} type - 导出类型
 * @param {string} code - 代码
 * @param {string|null} source - 源路径
 * @param {ExportItem[]} exports - 导出数组
 */
function addNamesToExports(names, line, type, code, source, exports) {
  for (const name of names) {
    const alias = name.split(' as ').pop().trim();
    if (!IGNORE_EXPORTS.has(alias)) {
      exports.push(new ExportItem(alias, type, line, code, source));
    }
  }
}

/**
 * 提取命名导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractNamedExports(content, exports) {
  for (const match of content.matchAll(REGEX_NAMED_EXPORT)) {
    const name = match[1];
    if (!IGNORE_EXPORTS.has(name) && !IGNORE_MACROS.includes(name)) {
      const line = getLineNumber(content, match.index);
      exports.push(new ExportItem(name, 'named', line, match[0].trim()));
    }
  }
}

/**
 * 提取 TypeScript 类型导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractTsTypeExports(content, exports) {
  for (const match of content.matchAll(REGEX_TS_NAMED_EXPORT)) {
    const name = match[1];
    if (!IGNORE_EXPORTS.has(name) && !IGNORE_MACROS.includes(name)) {
      const line = getLineNumber(content, match.index);
      exports.push(new ExportItem(name, 'ts-type', line, match[0].trim()));
    }
  }
}

/**
 * 提取 TypeScript 枚举导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractTsEnumExports(content, exports) {
  for (const match of content.matchAll(REGEX_TS_ENUM_EXPORT)) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    exports.push(new ExportItem(name, 'enum', line, match[0].trim()));
  }
}

/**
 * 提取 TypeScript 命名空间导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractTsNamespaceExports(content, exports) {
  for (const match of content.matchAll(REGEX_TS_NAMESPACE_EXPORT)) {
    const name = match[1];
    const line = getLineNumber(content, match.index);
    exports.push(new ExportItem(name, 'namespace', line, match[0].trim()));
  }
}

/**
 * 提取默认导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractDefaultExports(content, exports) {
  for (const match of content.matchAll(REGEX_DEFAULT_EXPORT)) {
    const name = match[1] || match[2] || match[3] || 'default';
    if (!IGNORE_EXPORTS.has(name)) {
      const line = getLineNumber(content, match.index);
      exports.push(new ExportItem(name, 'default', line, match[0].trim()));
    }
  }
}

/**
 * 提取分组导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractGroupExports(content, exports) {
  for (const match of content.matchAll(REGEX_GROUP_EXPORT)) {
    const names = match[1].split(',').map(n => n.trim());
    const line = getLineNumber(content, match.index);
    addNamesToExports(names, line, 'named', match[0].trim(), null, exports);
  }
}

/**
 * 提取星号导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractStarExports(content, exports) {
  for (const match of content.matchAll(REGEX_STAR_EXPORT)) {
    const line = getLineNumber(content, match.index);
    exports.push(new ExportItem('*', 'star', line, match[0].trim(), match[1]));
  }
}

/**
 * 提取命名空间重新导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractNamespaceReexports(content, exports) {
  for (const match of content.matchAll(REGEX_STAR_AS_NAMESPACE_EXPORT)) {
    const name = match[1];
    const source = match[2];
    const line = getLineNumber(content, match.index);
    exports.push(new ExportItem(name, 'namespace-reexport', line, match[0].trim(), source));
  }
}

/**
 * 提取分组重新导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractGroupReexports(content, exports) {
  for (const match of content.matchAll(REGEX_GROUP_REEXPORT)) {
    const names = match[1].split(',').map(n => n.trim());
    const source = match[2];
    const line = getLineNumber(content, match.index);
    addNamesToExports(names, line, 'reexport', match[0].trim(), source, exports);
  }
}

/**
 * 提取默认重新导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractDefaultReexports(content, exports) {
  for (const match of content.matchAll(REGEX_DEFAULT_REEXPORT)) {
    const name = match[1];
    const source = match[2];
    const line = getLineNumber(content, match.index);
    exports.push(new ExportItem(name, 'default-reexport', line, match[0].trim(), source));
  }
}

/**
 * 提取 TypeScript 类型分组导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractTsTypeGroupExports(content, exports) {
  for (const match of content.matchAll(REGEX_TS_TYPE_GROUP_EXPORT)) {
    const names = match[1].split(',').map(n => n.trim());
    const line = getLineNumber(content, match.index);
    for (const name of names) {
      const alias = name.split(' as ').pop().trim();
      exports.push(new ExportItem(alias, 'ts-type-group', line, match[0].trim()));
    }
  }
}

/**
 * 提取 TypeScript 类型重新导出
 * @param {string} content - 文件内容
 * @param {ExportItem[]} exports - 导出数组
 */
function extractTsTypeReexports(content, exports) {
  for (const match of content.matchAll(REGEX_TS_TYPE_REEXPORT)) {
    const names = match[1].split(',').map(n => n.trim());
    const source = match[2];
    const line = getLineNumber(content, match.index);
    for (const name of names) {
      const alias = name.split(' as ').pop().trim();
      exports.push(new ExportItem(alias, 'ts-type-reexport', line, match[0].trim(), source));
    }
  }
}

/**
 * 导出提取器类
 * 提供统一的导出提取接口
 */
class ExportExtractor {
  /**
   * 从内容中提取所有导出
   * @param {string} content - 文件内容
   * @returns {ExportItem[]} 导出数组
   */
  static extractAll(content) {
    const exports = [];

    extractNamedExports(content, exports);
    extractTsTypeExports(content, exports);
    extractTsEnumExports(content, exports);
    extractTsNamespaceExports(content, exports);
    extractDefaultExports(content, exports);
    extractGroupExports(content, exports);
    extractStarExports(content, exports);
    extractNamespaceReexports(content, exports);
    extractGroupReexports(content, exports);
    extractDefaultReexports(content, exports);
    extractTsTypeGroupExports(content, exports);
    extractTsTypeReexports(content, exports);

    return exports;
  }
}

module.exports = {
  ExportExtractor,
  getLineNumber,
  extractNamedExports,
  extractTsTypeExports,
  extractTsEnumExports,
  extractTsNamespaceExports,
  extractDefaultExports,
  extractGroupExports,
  extractStarExports,
  extractNamespaceReexports,
  extractGroupReexports,
  extractDefaultReexports,
  extractTsTypeGroupExports,
  extractTsTypeReexports,
};
