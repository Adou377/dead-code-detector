/**
 * 文件解析 Worker
 *
 * 在 Worker 线程中执行文件解析任务
 */

const { parentPort } = require('worker_threads');
const path = require('path');
const { readFileContent } = require('../utils.js');

let parser = null;
let vueParser = null;
let walker = null;

/**
 * 初始化解析器模块
 */
function initializeParsers() {
  if (!parser) {
    parser = require('../parser/index.js');
  }
  if (!vueParser) {
    vueParser = require('../parser/vue.js');
  }
  if (!walker) {
    walker = require('../parser/walker.js');
  }
}

/**
 * 解析单个文件
 * @param {Object} options - 解析选项
 * @param {string} options.filePath - 文件路径
 * @param {string} options.srcDir - 源代码目录
 * @param {number} options.maxFileSize - 最大文件大小
 * @returns {Object} 解析结果
 */
function parseFile(options) {
  const { filePath, srcDir, maxFileSize = 1000000 } = options;

  initializeParsers();

  const result = {
    filePath,
    relativePath: path.relative(srcDir, filePath),
    success: false,
    exports: [],
    imports: [],
    jsxComponents: [],
    componentInfo: null,
    vueInfo: null,
    error: null,
  };

  try {
    const ext = path.extname(filePath);
    const readResult = readFileContent(filePath);

    if (!readResult.success) {
      result.error = readResult.error.message;
      return result;
    }

    const content = readResult.content;

    if (content.length > maxFileSize) {
      result.error = '文件过大，跳过解析';
      return result;
    }

    if (ext === '.vue') {
      return parseVueFile(filePath, content, srcDir, result);
    } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      return parseJsFile(filePath, content, srcDir, result);
    }

    result.error = `不支持的文件类型: ${ext}`;
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * 解析 Vue 文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {string} srcDir - 源代码目录
 * @param {Object} result - 结果对象
 * @returns {Object} 解析结果
 */
function parseVueFile(filePath, content, srcDir, result) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath, ext);

  const vueInfo = vueParser.parseVueComponent(content);
  result.vueInfo = {
    isComponent: vueInfo.isComponent,
    hasScriptSetup: vueInfo.hasScriptSetup,
    composables: vueInfo.composables,
    exposed: vueInfo.exposed,
  };

  if (vueInfo.isComponent && fileName !== 'index') {
    result.componentInfo = {
      name: fileName,
      isGlobal: fileName.startsWith('The') || fileName.startsWith('App'),
      isScriptSetup: vueInfo.hasScriptSetup,
      composables: vueInfo.composables,
      exposed: vueInfo.exposed,
    };
  }

  const parseResult = parser.parse(content, filePath);

  // 区分有脚本块和无脚本块的情况
  if (parseResult.success) {
    if (parseResult.ast) {
      // 有脚本块且解析成功
      result.success = true;
      extractFromAst(parseResult.ast, result);
    } else if (parseResult.hasScript === false) {
      // 纯模板组件（无脚本块），仍然标记为成功
      result.success = true;
    }
  } else {
    // 解析失败（有脚本块但语法错误）
    result.error = parseResult.error || '解析失败';
  }

  return result;
}

/**
 * 解析 JS/TS 文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {string} srcDir - 源代码目录
 * @param {Object} result - 结果对象
 * @returns {Object} 解析结果
 */
function parseJsFile(filePath, content, srcDir, result) {
  const ext = path.extname(filePath);
  const fileName = path.basename(filePath, ext);

  const parseResult = parser.parse(content, filePath);

  if (parseResult.success && parseResult.ast) {
    result.success = true;
    extractFromAst(parseResult.ast, result);

    const components = walker.walkComponents(parseResult.ast);

    if (components.functions.length > 0 || components.classes.length > 0) {
      const dirName = path.basename(path.dirname(filePath)).toLowerCase();
      const NON_COMPONENT_DIRS = [
        'utils',
        'tools',
        'helpers',
        'lib',
        'services',
        'api',
        'hooks',
        'store',
        'context',
      ];

      if (!NON_COMPONENT_DIRS.includes(dirName)) {
        const compName = components.functions[0]?.name || components.classes[0]?.name;
        if (compName && fileName !== 'index') {
          result.componentInfo = {
            name: compName,
            isGlobal: fileName.startsWith('The') || fileName.startsWith('App'),
          };
        }
      }
    }
  } else {
    result.error = parseResult.error || '解析失败';
  }

  return result;
}

/**
 * 从 AST 提取导出、导入和 JSX 组件
 * @param {Object} ast - AST 对象
 * @param {Object} result - 结果对象
 */
function extractFromAst(ast, result) {
  const IGNORE_EXPORTS = new Set([
    'computed',
    'watch',
    'watchEffect',
    'defineOptions',
    'defineProps',
    'defineEmits',
    'defineModel',
    'defineExpose',
  ]);

  const IGNORE_MACROS = ['defineOptions', 'defineProps', 'defineEmits', 'defineModel', 'defineExpose'];

  const exports = walker.walkExports(ast);

  const filteredExports = [];

  for (const exp of exports.named) {
    if (!IGNORE_EXPORTS.has(exp.name) && !IGNORE_MACROS.includes(exp.name)) {
      filteredExports.push(exp);
    }
  }

  if (exports.default && !IGNORE_EXPORTS.has(exports.default.name)) {
    filteredExports.push(exports.default);
  }

  for (const exp of exports.group) {
    if (!IGNORE_EXPORTS.has(exp.name)) {
      filteredExports.push(exp);
    }
  }

  for (const exp of exports.reexport) {
    if (!IGNORE_EXPORTS.has(exp.name)) {
      filteredExports.push(exp);
    }
  }

  result.exports = filteredExports;

  const imports = walker.walkImports(ast);
  result.imports = [
    ...imports.static,
    ...imports.default,
    ...imports.namespace,
    ...imports.dynamic,
  ];

  const jsxComponents = walker.walkJSX(ast);
  result.jsxComponents = [...new Set(jsxComponents)];
}

/**
 * 批量解析文件
 * @param {Object} options - 解析选项
 * @param {string[]} options.filePaths - 文件路径列表
 * @param {string} options.srcDir - 源代码目录
 * @param {number} options.maxFileSize - 最大文件大小
 * @returns {Object[]} 解析结果数组
 */
function parseFiles(options) {
  const { filePaths, srcDir, maxFileSize } = options;

  return filePaths.map(filePath =>
    parseFile({
      filePath,
      srcDir,
      maxFileSize,
    })
  );
}

if (parentPort) {
  parentPort.on('message', message => {
    const { type, taskId, task } = message;

    if (type === 'execute') {
      try {
        let result;

        if (task.type === 'parseFile') {
          result = parseFile(task.options);
        } else if (task.type === 'parseFiles') {
          result = parseFiles(task.options);
        } else {
          throw new Error(`未知任务类型: ${task.type}`);
        }

        parentPort.postMessage({
          type: 'task_complete',
          taskId,
          result,
        });
      } catch (error) {
        parentPort.postMessage({
          type: 'task_complete',
          taskId,
          error: error.message,
        });
      }
    }
  });
}

module.exports = {
  parseFile,
  parseFiles,
};
