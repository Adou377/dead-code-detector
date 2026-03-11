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
 * Vue 3 组合式函数模式（预编译正则）
 */
const COMPOSABLE_PATTERNS = [/^use[A-Z]/, /^fetch[A-Z]/, /^get[A-Z]/, /^load[A-Z]/];

/**
 * 预编译的 Vue 模板解析正则表达式
 * 避免在每次调用函数时重复创建
 */
const VUE_TEMPLATE_REGEX = {
  scriptSetup: /<script\s+setup/i,
  template: /<template(?:\s[^>]*)?>([\s\S]*?)<\/template>/i,
  script: /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i,
  svgTag: /<svg[\s>]/i,
  svgContent: /<svg[\s\S]*?<\/svg>/i,
  pascalComponent: /<([A-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*)/g,
  kebabComponent: /<([a-z][a-z0-9]*-[a-z0-9-]+)/gi,
  pascalCaseTest: /^[A-Z]/,
};

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

  VUE_TEMPLATE_REGEX.svgTag.lastIndex = 0;
  const svgMatch = templateContent.match(VUE_TEMPLATE_REGEX.svgTag);
  if (svgMatch) {
    VUE_TEMPLATE_REGEX.svgContent.lastIndex = 0;
    const svgContent = templateContent.match(VUE_TEMPLATE_REGEX.svgContent);
    if (svgContent && svgContent[0].length > templateContent.length * 0.5) {
      info.isSvgComponent = true;
    }
  }

  VUE_TEMPLATE_REGEX.pascalComponent.lastIndex = 0;
  let match;
  while ((match = VUE_TEMPLATE_REGEX.pascalComponent.exec(templateContent)) !== null) {
    const componentName = match[1];
    const svgTags = [
      'Svg',
      'Path',
      'Circle',
      'Rect',
      'Line',
      'Polygon',
      'Polyline',
      'Ellipse',
      'G',
      'Defs',
      'Use',
      'Symbol',
      'Text',
      'Tspan',
      'LinearGradient',
      'RadialGradient',
      'Stop',
      'ClipPath',
      'Mask',
      'Pattern',
      'Image',
      'ForeignObject',
    ];
    if (!svgTags.includes(componentName)) {
      if (!info.components.includes(componentName)) {
        info.components.push(componentName);
      }
    }
  }

  VUE_TEMPLATE_REGEX.kebabComponent.lastIndex = 0;
  while ((match = VUE_TEMPLATE_REGEX.kebabComponent.exec(templateContent)) !== null) {
    const kebabName = match[1];
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

  VUE_TEMPLATE_REGEX.scriptSetup.lastIndex = 0;
  const scriptSetupMatch = content.match(VUE_TEMPLATE_REGEX.scriptSetup);
  if (scriptSetupMatch) {
    result.hasScriptSetup = true;
  }

  VUE_TEMPLATE_REGEX.template.lastIndex = 0;
  const templateMatch = content.match(VUE_TEMPLATE_REGEX.template);
  const templateContent = templateMatch ? templateMatch[1] : null;
  const templateInfo = extractTemplateInfo(templateContent);
  result.hasTemplate = templateInfo.hasTemplate;
  result.isSvgComponent = templateInfo.isSvgComponent;

  if (templateInfo.components.length > 0) {
    templateInfo.components.forEach(comp => {
      if (!result.components.includes(comp)) {
        result.components.push(comp);
      }
    });
  }

  VUE_TEMPLATE_REGEX.script.lastIndex = 0;
  const scriptMatch = content.match(VUE_TEMPLATE_REGEX.script);

  if (!scriptMatch) {
    if (result.hasTemplate) {
      result.isPureTemplateComponent = true;
      // 纯模板组件是合法的 Vue 组件，但没有可追踪的导出，不需要作为组件追踪
    }
    return result;
  }

  const scriptContent = scriptMatch[1];
  const astResult = parseJs(scriptContent, 'temp.vue');

  if (!astResult.success || !astResult.ast) {
    return result;
  }

  const macros = extractVueMacros(scriptContent, astResult.ast);
  result.props = macros.defineProps;
  result.emits = macros.defineEmits;
  result.exposed = macros.defineExpose;
  result.composables = macros.composables || [];

  const componentVisitor = {
    ImportDeclaration(path) {
      const source = path.get('source').node.value;
      if (source === 'vue') {
        const specifiers = path.get('specifiers');
        specifiers.forEach(specifier => {
          if (specifier.isImportSpecifier()) {
            const imported = specifier.get('imported').node.name;
            if (imported.startsWith('on') || VUE3_MACROS.includes(imported)) {
            } else if (
              COMPOSABLE_PATTERNS.some(p => {
                p.lastIndex = 0;
                return p.test(imported);
              })
            ) {
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
        VUE_TEMPLATE_REGEX.pascalCaseTest.lastIndex = 0;
        if (VUE_TEMPLATE_REGEX.pascalCaseTest.test(name) && !VUE3_MACROS.includes(name)) {
          result.components.push(name);
        }
        if (
          COMPOSABLE_PATTERNS.some(p => {
            p.lastIndex = 0;
            return p.test(name);
          })
        ) {
          result.composables.push(name);
        }
      }
    },
    FunctionDeclaration(path) {
      const name = path.get('id').node?.name;
      if (name) {
        VUE_TEMPLATE_REGEX.pascalCaseTest.lastIndex = 0;
        if (VUE_TEMPLATE_REGEX.pascalCaseTest.test(name)) {
          result.components.push(name);
        }
      }
    },
    ExportDefaultDeclaration() {
      result.isComponent = true;
    },
  };

  const traverse = require('@babel/traverse').default;
  traverse(astResult.ast, componentVisitor);

  if (
    result.hasScriptSetup ||
    result.components.length > 0 ||
    result.composables.length > 0 ||
    result.hasTemplate
  ) {
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
