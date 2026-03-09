/**
 * Vue 单文件组件解析器
 *
 * 处理 Vue 单文件组件解析，支持 script setup
 */

const { parseJs } = require('./index.js');

/**
 * Vue 3 宏名称
 */
const VUE3_MACROS = [
  'defineProps',
  'defineEmits',
  'defineExpose',
  'defineOptions',
  'defineModel',
  'defineSlots',
  'withDefaults',
];

/**
 * Vue 3 组合式函数模式
 */
const COMPOSABLE_PATTERNS = [
  /^use[A-Z]/, // useXxx
  /^fetch[A-Z]/, // fetchXxx
  /^get[A-Z]/, // getXxx
  /^load[A-Z]/, // loadXxx
];

/**
 * 从 script setup 中提取 Vue 宏
 * @param {string} scriptContent - 脚本内容
 * @param {Object} ast - 解析后的 AST
 * @returns {Object} 宏信息
 */
function extractVueMacros(scriptContent, ast) {
  const macros = {
    defineProps: null,
    defineEmits: null,
    defineExpose: [],
    defineOptions: null,
    defineModel: null,
    defineSlots: null,
  };

  if (!ast) return macros;

  // Find macro calls
  const visitor = {
    CallExpression(path) {
      const callee = path.get('callee');
      const name = callee.node.name;

      if (VUE3_MACROS.includes(name)) {
        if (name === 'defineExpose') {
          // Collect expose arguments
          const args = path.get('arguments');
          args.forEach(arg => {
            if (arg.isObjectExpression()) {
              const properties = arg.get('properties');
              properties.forEach(prop => {
                if (prop.isObjectProperty()) {
                  const key = prop.get('key');
                  macros.defineExpose.push(key.node.name);
                }
              });
            }
          });
        } else {
          macros[name] = {
            line: path.node.loc?.start.line,
            code: scriptContent.substring(path.node.start, path.node.end),
          };
        }
      }

      // Check for composable pattern
      if (COMPOSABLE_PATTERNS.some(p => p.test(name))) {
        if (!macros.composables) macros.composables = [];
        macros.composables.push(name);
      }
    },
  };

  const traverse = require('@babel/traverse').default;
  traverse(ast, visitor);

  return macros;
}

/**
 * 检查文件是否为 Vue 组件
 * @param {string} content - Vue 文件内容
 * @returns {Object} 组件信息
 */
function parseVueComponent(content) {
  const result = {
    isComponent: false,
    hasScriptSetup: false,
    components: [],
    composables: [],
    props: null,
    emits: null,
    exposed: [],
    fileName: '',
  };

  // Check for script setup
  const scriptSetupMatch = content.match(/<script\s+setup/i);
  if (scriptSetupMatch) {
    result.hasScriptSetup = true;
  }

  // Check for script
  const scriptMatch = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  if (!scriptMatch) {
    return result;
  }

  const scriptContent = scriptMatch[1];
  const astResult = parseJs(scriptContent, 'temp.vue');

  if (!astResult.success || !astResult.ast) {
    return result;
  }

  // Extract Vue macros
  const macros = extractVueMacros(scriptContent, astResult.ast);
  result.props = macros.defineProps;
  result.emits = macros.defineEmits;
  result.exposed = macros.defineExpose;
  result.composables = macros.composables || [];

  // Determine if it's a component by looking at:
  // 1. Components registered with import { ... } from 'vue'
  // 2. defineProps with component type
  // 3. PascalCase function definitions
  const componentVisitor = {
    ImportDeclaration(path) {
      const source = path.get('source').node.value;
      if (source === 'vue') {
        const specifiers = path.get('specifiers');
        specifiers.forEach(specifier => {
          if (specifier.isImportSpecifier()) {
            const imported = specifier.get('imported').node.name;
            // Check for common component imports or composables
            if (imported.startsWith('on') || VUE3_MACROS.includes(imported)) {
              // It's a Vue API, not a component
            } else if (COMPOSABLE_PATTERNS.some(p => p.test(imported))) {
              result.composables.push(imported);
            }
          }
        });
      }
    },
    VariableDeclarator(path) {
      const id = path.get('id');
      if (id.isIdentifier()) {
        const name = id.node.name;
        // PascalCase variable might be a component
        if (/^[A-Z]/.test(name) && !VUE3_MACROS.includes(name)) {
          result.components.push(name);
        }
        // Composable pattern
        if (COMPOSABLE_PATTERNS.some(p => p.test(name))) {
          result.composables.push(name);
        }
      }
    },
    FunctionDeclaration(path) {
      const name = path.get('id').node?.name;
      if (name && /^[A-Z]/.test(name)) {
        result.components.push(name);
      }
    },
    ExportDefaultDeclaration() {
      result.isComponent = true;
    },
  };

  const traverse = require('@babel/traverse').default;
  traverse(astResult.ast, componentVisitor);

  // If it has script setup or exports, consider it a component
  if (result.hasScriptSetup || result.components.length > 0 || result.composables.length > 0) {
    result.isComponent = true;
  }

  return result;
}

module.exports = {
  parseVueComponent,
  extractVueMacros,
  VUE3_MACROS,
  COMPOSABLE_PATTERNS,
};
