/**
 * 数据结构模型
 * 包含死代码检测器中使用的各种数据结构
 */

/**
 * 导入数据结构
 */
class ImportItem {
  /**
   * 创建导入项
   * @param {string} name - 导入名称
   * @param {string} source - 导入源
   * @param {boolean} isDefault - 是否为默认导入
   * @param {boolean} isInternal - 是否为内部导入
   * @param {boolean} isDynamic - 是否为动态导入
   * @param {boolean} isSideEffect - 是否为副作用导入
   */
  constructor(
    name,
    source,
    isDefault = false,
    isInternal = false,
    isDynamic = false,
    isSideEffect = false
  ) {
    this.name = name;
    this.source = source;
    this.isDefault = isDefault;
    this.isInternal = isInternal;
    this.isDynamic = isDynamic;
    this.isSideEffect = isSideEffect;
  }
}

/**
 * 导出数据结构
 */
class ExportItem {
  /**
   * 创建导出项
   * @param {string} name - 导出名称
   * @param {string} type - 导出类型
   * @param {number} line - 行号
   * @param {string} code - 代码
   * @param {string} source - 源（用于重新导出）
   */
  constructor(name, type, line, code, source = null) {
    this.name = name;
    this.type = type;
    this.line = line;
    this.code = code;
    this.source = source;
  }

  /**
   * 创建命名导出
   * @param {string} name - 导出名称
   * @param {number} line - 行号
   * @param {string} code - 代码
   * @returns {ExportItem} 导出项实例
   */
  static createNamed(name, line, code) {
    return new ExportItem(name, 'named', line, code);
  }

  /**
   * 创建默认导出
   * @param {string} name - 导出名称
   * @param {number} line - 行号
   * @param {string} code - 代码
   * @returns {ExportItem} 导出项实例
   */
  static createDefault(name, line, code) {
    return new ExportItem(name, 'default', line, code);
  }

  /**
   * 创建重新导出
   * @param {string} name - 导出名称
   * @param {number} line - 行号
   * @param {string} code - 代码
   * @param {string} source - 源路径
   * @returns {ExportItem} 导出项实例
   */
  static createReexport(name, line, code, source) {
    return new ExportItem(name, 'reexport', line, code, source);
  }
}

/**
 * 组件数据结构
 */
class ComponentItem {
  /**
   * 创建组件项
   * @param {string} name - 组件名称
   * @param {boolean} used - 是否被使用
   * @param {boolean} isGlobal - 是否为全局组件
   */
  constructor(name, used = false, isGlobal = false) {
    this.name = name;
    this.used = used;
    this.isGlobal = isGlobal;
  }
}

/**
 * 未使用的导出数据结构
 */
class UnusedExportItem extends ExportItem {
  /**
   * 创建未使用的导出项
   * @param {string} file - 文件路径
   * @param {string} name - 导出名称
   * @param {string} type - 导出类型
   * @param {number} line - 行号
   * @param {string} code - 代码
   * @param {string} source - 源（用于重新导出）
   */
  constructor(file, name, type, line, code, source = null) {
    super(name, type, line, code, source);
    this.file = file;
  }
}

/**
 * 分析结果数据结构
 */
class AnalysisResult {
  /**
   * 创建分析结果
   * @param {Array<UnusedExportItem>} unusedExports - 未使用的导出
   * @param {Array<Object>} unusedComponents - 未使用的组件
   * @param {Array<string>} unusedToolFiles - 未使用的工具文件
   */
  constructor(unusedExports = [], unusedComponents = [], unusedToolFiles = []) {
    this.unusedExports = unusedExports;
    this.unusedComponents = unusedComponents;
    this.unusedToolFiles = unusedToolFiles;
  }
}

/**
 * 修复结果数据结构
 */
class FixResult {
  /**
   * 创建修复结果
   * @param {boolean} cancelled - 是否取消
   * @param {number} fixedExports - 修复的导出数量
   * @param {number} deletedComponents - 删除的组件数量
   * @param {number} deletedToolFiles - 删除的工具文件数量
   * @param {string} backupDir - 备份目录
   */
  constructor(
    cancelled = false,
    fixedExports = 0,
    deletedComponents = 0,
    deletedToolFiles = 0,
    backupDir = null
  ) {
    this.cancelled = cancelled;
    this.fixedExports = fixedExports;
    this.deletedComponents = deletedComponents;
    this.deletedToolFiles = deletedToolFiles;
    this.backupDir = backupDir;
  }
}

module.exports = {
  ImportItem,
  ExportItem,
  ComponentItem,
  UnusedExportItem,
  AnalysisResult,
  FixResult,
};
