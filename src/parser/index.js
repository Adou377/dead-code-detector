/**
 * AST 解析器入口
 *
 * 解析 JS/TS/Vue 文件为 AST 的统一入口点
 */

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');
const { createError } = require('../errors');
const { defaultLogger } = require('../logger');

/**
 * 预编译的 Vue 文件解析正则表达式
 */
const VUE_SCRIPT_REGEX = {
  script: /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i,
  scriptSetup: /<script\s+setup(?:\s[^>]*)?>([\s\S]*?)<\/script>/i,
};

/**
 * 解析 JS/TS/JSX 内容为 AST
 * @param {string} content - 文件内容
 * @param {string} filePath - 文件路径（用于扩展名检测）
 * @returns {Object} AST 和元数据
 */
function parseJs(content, filePath) {
  const ext = path.extname(filePath);
  const plugins = ['jsx'];

  if (ext === '.ts' || ext === '.tsx') {
    plugins.push('typescript');
  }

  plugins.push('classProperties');
  plugins.push('decorators-legacy');

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins,
    });

    return { ast, success: true };
  } catch (error) {
    const parseError = createError('E003', `解析文件失败: ${filePath}`, {
      文件: filePath,
      错误信息: error.message,
      错误位置: error.loc ? `行 ${error.loc.line}, 列 ${error.loc.column}` : '未知',
    });

    defaultLogger.warn('文件解析失败', 'E003', {
      文件: filePath,
      错误信息: error.message,
    });

    return {
      ast: null,
      success: false,
      error: error.message,
      errorCode: 'E003',
      errorInstance: parseError,
    };
  }
}

/**
 * 解析 Vue 单文件组件 (SFC)
 * @param {string} content - Vue 文件内容
 * @param {string} filePath - 文件路径
 * @returns {Object} 带有脚本 AST 的解析结果
 */
function parseVue(content, filePath) {
  VUE_SCRIPT_REGEX.script.lastIndex = 0;
  VUE_SCRIPT_REGEX.scriptSetup.lastIndex = 0;
  
  const scriptMatch = content.match(VUE_SCRIPT_REGEX.script);
  const scriptSetupMatch = content.match(VUE_SCRIPT_REGEX.scriptSetup);

  let scriptContent = '';
  let isScriptSetup = false;

  if (scriptSetupMatch) {
    scriptContent = scriptSetupMatch[1];
    isScriptSetup = true;
  } else if (scriptMatch) {
    scriptContent = scriptMatch[1];
  }

  if (!scriptContent || scriptContent.trim() === '') {
    return {
      ast: null,
      success: true,
      hasScript: false,
    };
  }

  const result = parseJs(scriptContent, filePath);

  if (result.success) {
    result.isScriptSetup = isScriptSetup;
    result.scriptContent = scriptContent;
    result.hasScript = true;
  }

  return result;
}

/**
 * 根据文件扩展名解析文件内容为 AST
 * @param {string} content - 文件内容
 * @param {string} filePath - 文件路径
 * @returns {Object} 解析结果
 */
function parse(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.vue') {
    return parseVue(content, filePath);
  }

  return parseJs(content, filePath);
}

/**
 * 使用访问者模式遍历 AST
 * @param {Object} ast - AST
 * @param {Object} visitor - 访问者对象
 */
function traverseAst(ast, visitor) {
  traverse(ast, visitor);
}

/**
 * 获取节点位置信息
 * @param {Object} node - AST 节点
 * @returns {Object} 位置信息
 */
function getLocation(node) {
  if (node.loc) {
    return {
      start: node.loc.start.line,
      end: node.loc.end.line,
      columnStart: node.loc.start.column,
      columnEnd: node.loc.end.column,
    };
  }
  return null;
}

module.exports = {
  parse,
  parseJs,
  parseVue,
  traverseAst,
  getLocation,
};
