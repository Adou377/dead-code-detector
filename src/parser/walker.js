/**
 * AST 遍历工具
 *
 * 通用 AST 遍历工具函数
 */

const traverse = require('@babel/traverse').default;
const { isInternalImport } = require('../constants.js');

/**
 * 预编译的正则表达式
 */
const COMPILED_REGEX = {
  pascalCase: /^[A-Z]/,
  hookName: /^use[A-Z]/,
};

// ==================== 通用辅助函数 ====================

/**
 * 获取节点的起始行号
 */
function getLine(node) {
  return node?.loc?.start?.line || 0;
}

/**
 * 检测是否为帕斯卡命名（React组件）
 */
function isPascalCase(name) {
  COMPILED_REGEX.pascalCase.lastIndex = 0;
  return COMPILED_REGEX.pascalCase.test(name);
}

/**
 * 检测是否为 hook 名称
 */
function isHookName(name) {
  COMPILED_REGEX.hookName.lastIndex = 0;
  return COMPILED_REGEX.hookName.test(name);
}

// ==================== 导出相关辅助函数 ====================

/**
 * 创建命名导出项
 */
function createNamedExport(name, line) {
  return { name, type: 'named', line };
}

/**
 * 创建分组导出项
 */
function createGroupExport(exportedName, localName, line) {
  return { name: exportedName, localName, type: 'group', line };
}

/**
 * 创建重导出项
 */
function createReexport(exportedName, localName, source, line) {
  return { name: exportedName, localName, source, type: 'reexport', line };
}

/**
 * 从声明节点提取名称
 */
function extractDeclarationName(decl) {
  if (!decl) return null;

  // FunctionDeclaration, ClassDeclaration, TSInterfaceDeclaration, TSTypeAliasDeclaration
  if (decl.id?.name) {
    return decl.id.name;
  }

  return null;
}

/**
 * 处理变量声明导出
 */
function processVariableDeclarations(decl, exports, line) {
  if (decl.type !== 'VariableDeclaration') return false;

  decl.declarations.forEach(varDecl => {
    if (varDecl.id?.name) {
      exports.named.push(createNamedExport(varDecl.id.name, line));
    }
  });

  return true;
}

/**
 * 处理导出说明符（export { foo, bar }）
 */
function processExportSpecifiers(specifiers, exports, line) {
  specifiers.forEach(spec => {
    const localName = spec.local.name;
    const exportedName = spec.exported?.name || localName;
    exports.group.push(createGroupExport(exportedName, localName, line));
  });
}

/**
 * 处理重导出说明符（export { foo } from './module'）
 */
function processReexportSpecifiers(specifiers, source, exports, line) {
  specifiers.forEach(spec => {
    const localName = spec.local.name;
    const exportedName = spec.exported?.name || localName;
    exports.reexport.push(createReexport(exportedName, localName, source, line));
  });
}

/**
 * 创建默认导出项
 */
function createDefaultExport(declaration, line) {
  let name = 'default';

  if (declaration?.id?.name) {
    name = declaration.id.name;
  } else if (declaration?.type === 'ArrowFunctionExpression') {
    name = 'anonymous';
  }

  return { name, type: 'default', line };
}

/**
 * 创建导出集合对象
 */
function createExportsCollection() {
  return {
    named: [],
    default: null,
    group: [],
    reexport: [],
    star: [],
    all: [],
  };
}

/**
 * 合并所有导出
 */
function mergeAllExports(exports) {
  exports.all = [
    ...exports.named,
    exports.default,
    ...exports.group,
    ...exports.reexport,
    ...exports.star,
  ].filter(Boolean);

  return exports;
}

// ==================== 导入相关辅助函数 ====================

/**
 * 创建静态导入项
 */
function createStaticImport(local, imported, source, isInternal, line) {
  return {
    name: local,
    imported,
    source,
    isDefault: false,
    isInternal,
    line,
  };
}

/**
 * 创建默认导入项
 */
function createDefaultImport(name, source, isInternal, line) {
  return {
    name,
    source,
    isDefault: true,
    isInternal,
    line,
  };
}

/**
 * 创建命名空间导入项
 */
function createNamespaceImport(name, source, isInternal, line) {
  return {
    name,
    source,
    isNamespace: true,
    isInternal,
    line,
  };
}

/**
 * 创建动态导入项
 */
function createDynamicImport(source, line) {
  return {
    name: source,
    source,
    isDynamic: true,
    isInternal: true,
    line,
  };
}

/**
 * 处理导入说明符
 */
function processImportSpecifier(spec, source, isInternal, line, imports) {
  const specType = spec.type;

  if (specType === 'ImportSpecifier') {
    imports.static.push(
      createStaticImport(spec.local.name, spec.imported.name, source, isInternal, line)
    );
  } else if (specType === 'ImportDefaultSpecifier') {
    imports.default.push(createDefaultImport(spec.local.name, source, isInternal, line));
  } else if (specType === 'ImportNamespaceSpecifier') {
    imports.namespace.push(createNamespaceImport(spec.local.name, source, isInternal, line));
  }
}

/**
 * 从模板字面量提取基础路径
 */
function extractTemplateLiteralBase(arg) {
  if (arg.type !== 'TemplateLiteral' || !arg.quasis.length) {
    return null;
  }

  return arg.quasis[0].value.raw;
}

/**
 * 处理动态导入参数
 */
function processDynamicImportArg(arg, line, imports) {
  if (!arg) return;

  // 处理字符串字面量
  if (arg.type === 'StringLiteral') {
    const source = arg.value;
    if (source && isInternalImport(source)) {
      imports.dynamic.push(createDynamicImport(source, line));
    }
    return;
  }

  // 处理模板字面量
  if (arg.type === 'TemplateLiteral') {
    const basePath = extractTemplateLiteralBase(arg);
    if (basePath && isInternalImport(basePath)) {
      imports.dynamic.push(createDynamicImport(basePath, line));
    }
  }
}

/**
 * 创建导入集合对象
 */
function createImportsCollection() {
  return {
    static: [],
    default: [],
    namespace: [],
    dynamic: [],
    sideEffect: [],
  };
}

// ==================== 组件检测辅助函数 ====================

/**
 * 检测是否为 React 组件类
 */
function isReactComponentClass(superClass) {
  if (!superClass) return false;

  // 处理 MemberExpression: React.Component, React.PureComponent
  if (superClass.type === 'MemberExpression') {
    const object = superClass.object?.name;
    const property = superClass.property?.name;

    return (
      (object === 'React' && (property === 'Component' || property === 'PureComponent')) ||
      property === 'Component' ||
      property === 'PureComponent'
    );
  }

  // 处理 Identifier: Component, PureComponent
  if (superClass.type === 'Identifier') {
    const name = superClass.name;
    return name === 'Component' || name === 'PureComponent';
  }

  return false;
}

/**
 * 创建组件信息
 */
function createComponentInfo(name, type, line) {
  return { name, type, line };
}

/**
 * 创建组件集合对象
 */
function createComponentsCollection() {
  return {
    functions: [],
    classes: [],
    hooks: [],
  };
}

// ==================== 主要遍历函数 ====================

/**
 * 遍历 AST 并收集所有导出
 * @param {Object} ast - Babel AST 对象
 * @returns {Object} 导出集合对象，包含 named、default、group、reexport、star、all 数组
 * @example
 * const exports = walkExports(ast);
 * // exports.named - 命名导出数组
 * // exports.default - 默认导出对象
 * // exports.group - 分组导出数组
 * // exports.reexport - 重导出数组
 * // exports.star - 星号导出数组
 */
function walkExports(ast) {
  const exports = createExportsCollection();

  traverse(ast, {
    ExportNamedDeclaration(path) {
      const node = path.node;
      const line = getLine(node);

      // 处理声明式导出: export const/let/var/function/class
      if (node.declaration) {
        const decl = node.declaration;

        // 变量声明特殊处理
        if (processVariableDeclarations(decl, exports, line)) {
          return;
        }

        // 其他声明类型
        const name = extractDeclarationName(decl);
        if (name) {
          exports.named.push(createNamedExport(name, line));
        }
        return;
      }

      // 处理分组导出: export { foo, bar }
      if (node.specifiers?.length > 0 && !node.source) {
        processExportSpecifiers(node.specifiers, exports, line);
        return;
      }

      // 处理重导出: export { foo } from './module'
      if (node.specifiers?.length > 0 && node.source) {
        processReexportSpecifiers(node.specifiers, node.source.value, exports, line);
      }
    },

    ExportDefaultDeclaration(path) {
      const node = path.node;
      exports.default = createDefaultExport(node.declaration, getLine(node));
    },

    ExportAllDeclaration(path) {
      const node = path.node;
      const source = node.source?.value;

      if (source) {
        exports.star.push({
          source,
          type: 'star',
          line: getLine(node),
        });
      }
    },
  });

  return mergeAllExports(exports);
}

/**
 * 遍历 AST 并收集所有导入
 * @param {Object} ast - Babel AST 对象
 * @returns {Object} 导入集合对象，包含 static、default、namespace、dynamic、sideEffect 数组
 * @example
 * const imports = walkImports(ast);
 * // imports.static - 静态导入数组
 * // imports.default - 默认导入数组
 * // imports.namespace - 命名空间导入数组
 * // imports.dynamic - 动态导入数组
 */
function walkImports(ast) {
  const imports = createImportsCollection();

  traverse(ast, {
    ImportDeclaration(path) {
      const node = path.node;
      const source = node.source.value;
      const line = getLine(node);
      const isInternal = isInternalImport(source);

      if (!isInternal) return;

      node.specifiers.forEach(spec => {
        processImportSpecifier(spec, source, isInternal, line, imports);
      });
    },

    CallExpression(path) {
      const node = path.node;

      // 检测动态导入: import(...)
      if (node.callee.type === 'Import') {
        processDynamicImportArg(node.arguments[0], getLine(node), imports);
      }
    },
  });

  return imports;
}

/**
 * 遍历 AST 并查找 JSX 元素（React 组件）
 * @param {Object} ast - Babel AST 对象
 * @returns {string[]} 去重后的 React 组件名称数组（仅包含 PascalCase 组件）
 * @example
 * const components = walkJSX(ast);
 * // ['Button', 'Modal', 'React.Fragment']
 */
function walkJSX(ast) {
  const components = [];

  traverse(ast, {
    JSXElement(path) {
      const name = path.get('openingElement').get('name');

      if (name.isJSXIdentifier()) {
        const tagName = name.node.name;
        // 只收集 PascalCase（React 组件）
        if (isPascalCase(tagName)) {
          components.push(tagName);
        }
      }
    },

    JSXMemberExpression(path) {
      const object = path.get('object');
      const property = path.get('property');

      // React.Fragment 等
      if (object.isJSXIdentifier() && property.isJSXIdentifier()) {
        components.push(`${object.node.name}.${property.node.name}`);
      }
    },
  });

  return [...new Set(components)];
}

/**
 * 遍历 AST 并查找组件/类声明
 * @param {Object} ast - Babel AST 对象
 * @returns {Object} 组件集合对象，包含 functions、classes、hooks 数组
 * @example
 * const components = walkComponents(ast);
 * // components.functions - 函数组件数组
 * // components.classes - 类组件数组
 * // components.hooks - 自定义 Hook 数组
 */
function walkComponents(ast) {
  const components = createComponentsCollection();

  traverse(ast, {
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (name && isPascalCase(name)) {
        components.functions.push(createComponentInfo(name, 'function', getLine(path.node)));
      }
    },

    VariableDeclarator(path) {
      const id = path.get('id');
      const init = path.get('init');

      if (!id.isIdentifier()) return;

      const name = id.node.name;

      // 函数组件: const Foo = () => ...
      if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
        if (isPascalCase(name)) {
          components.functions.push(createComponentInfo(name, 'function', getLine(path.node)));
        } else if (isHookName(name)) {
          components.hooks.push(createComponentInfo(name, 'hook', getLine(path.node)));
        }
      }
    },

    ClassDeclaration(path) {
      const name = path.node.id?.name;

      if (name && isPascalCase(name) && isReactComponentClass(path.node.superClass)) {
        components.classes.push(createComponentInfo(name, 'class', getLine(path.node)));
      }
    },
  });

  return components;
}

module.exports = {
  walkExports,
  walkImports,
  walkJSX,
  walkComponents,
};
