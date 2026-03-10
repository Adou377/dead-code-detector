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
 * 从模板中提取组件引用信息
 * @param {string} templateContent - 模板内容
 * @returns {Object} 模板分析结果
 */
function extractTemplateInfo(templateContent) {
  const info = {
    components: [],
    isSvgComponent: false,
    hasTemplate: false,
  };

  if (!templateContent) return info;

  info.hasTemplate = true;

  // 检测是否为 SVG 图标组件
  const svgMatch = templateContent.match(/<svg[\s>]/i);
  if (svgMatch) {
    // 检查 SVG 是否为主要内容（SVG 图标组件通常以 SVG 为根元素或主要内容）
    const svgContent = templateContent.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgContent && svgContent[0].length > templateContent.length * 0.5) {
      info.isSvgComponent = true;
    }
  }

  // 提取 PascalCase 组件标签（自定义组件）
  // 匹配 <ComponentName 或 <ComponentName:slot 等模式
  const componentTagRegex = /<([A-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*)/g;
  let match;
  while ((match = componentTagRegex.exec(templateContent)) !== null) {
    const componentName = match[1];
    // 排除 SVG 相关标签（如 Svg, Path 等虽然首字母大写但不是组件引用）
    const svgTags = ['Svg', 'Path', 'Circle', 'Rect', 'Line', 'Polygon', 'Polyline', 'Ellipse', 'G', 'Defs', 'Use', 'Symbol', 'Text', 'Tspan', 'LinearGradient', 'RadialGradient', 'Stop', 'ClipPath', 'Mask', 'Pattern', 'Image', 'ForeignObject'];
    if (!svgTags.includes(componentName)) {
      if (!info.components.includes(componentName)) {
        info.components.push(componentName);
      }
    }
  }

  // 提取 kebab-case 组件引用（通过组件名推断 PascalCase）
  // 例如 <my-component 可能对应 MyComponent
  const kebabComponentRegex = /<([a-z][a-z0-9]*-[a-z0-9-]+)/gi;
  while ((match = kebabComponentRegex.exec(templateContent)) !== null) {
    const kebabName = match[1];
    // 转换为 PascalCase
    const pascalName = kebabName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    if (!info.components.includes(pascalName)) {
      info.components.push(pascalName);
    }
  }

  return info;
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
    hasTemplate: false,
    isPureTemplateComponent: false,
    isSvgComponent: false,
    components: [],
    composables: [],
    props: null,
    emits: null,
    exposed: [],
    fileName: '',
  };

  // 检查是否有 script setup
  const scriptSetupMatch = content.match(/<script\s+setup/i);
  if (scriptSetupMatch) {
    result.hasScriptSetup = true;
  }

  // 检查并提取模板信息
  const templateMatch = content.match(/<template(?:\s[^>]*)?>([\s\S]*?)<\/template>/i);
  const templateContent = templateMatch ? templateMatch[1] : null;
  const templateInfo = extractTemplateInfo(templateContent);
  result.hasTemplate = templateInfo.hasTemplate;
  result.isSvgComponent = templateInfo.isSvgComponent;

  // 将模板中引用的组件添加到结果中
  if (templateInfo.components.length > 0) {
    templateInfo.components.forEach(comp => {
      if (!result.components.includes(comp)) {
        result.components.push(comp);
      }
    });
  }

  // 检查 script 块
  const scriptMatch = content.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);

  // 如果没有 script 块但有 template 块，识别为纯模板组件
  // 注意：纯模板组件是有效的 Vue 文件，但不追踪为组件（没有可追踪的导出）
  if (!scriptMatch) {
    if (result.hasTemplate) {
      result.isPureTemplateComponent = true;
      // 不设置 isComponent = true，因为纯模板组件没有可追踪的导出
    }
    return result;
  }

  const scriptContent = scriptMatch[1];
  const astResult = parseJs(scriptContent, 'temp.vue');

  if (!astResult.success || !astResult.ast) {
    // AST 解析失败，不追踪为组件
    return result;
  }

  // 提取 Vue 宏
  const macros = extractVueMacros(scriptContent, astResult.ast);
  result.props = macros.defineProps;
  result.emits = macros.defineEmits;
  result.exposed = macros.defineExpose;
  result.composables = macros.composables || [];

  // 通过以下方式判断是否为组件：
  // 1. 从 vue 导入的组件注册
  // 2. defineProps 的组件类型
  // 3. PascalCase 函数定义
  const componentVisitor = {
    ImportDeclaration(path) {
      const source = path.get('source').node.value;
      if (source === 'vue') {
        const specifiers = path.get('specifiers');
        specifiers.forEach(specifier => {
          if (specifier.isImportSpecifier()) {
            const imported = specifier.get('imported').node.name;
            if (imported.startsWith('on') || VUE3_MACROS.includes(imported)) {
              // Vue API，不是组件
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
        // PascalCase 变量可能是组件
        if (/^[A-Z]/.test(name) && !VUE3_MACROS.includes(name)) {
          result.components.push(name);
        }
        // 组合式函数模式
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

  // 判断是否为组件的条件：
  // 1. 有 script setup
  // 2. 有组件定义
  // 3. 有组合式函数
  // 4. 有 template 块（纯模板组件）
  if (result.hasScriptSetup || result.components.length > 0 || result.composables.length > 0 || result.hasTemplate) {
    result.isComponent = true;
  }

  return result;
}

module.exports = {
  parseVueComponent,
  extractVueMacros,
  extractTemplateInfo,
  VUE3_MACROS,
  COMPOSABLE_PATTERNS,
};
