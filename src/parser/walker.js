/**
 * AST 遍历工具
 *
 * 通用 AST 遍历工具函数
 */

const traverse = require('@babel/traverse').default;
const { isInternalImport } = require('../constants.js');

/**
 * 遍历 AST 并收集所有导出
 * @param {Object} ast - AST
 * @returns {Object} 收集的导出
 */
function walkExports(ast) {
  const exports = {
    named: [], // export const foo = ...
    default: null, // export default ...
    group: [], // export { foo, bar }
    reexport: [], // export { foo } from './module'
    star: [], // export * from './module'
    all: [], // 所有导出的组合
  };

  const visitor = {
    ExportNamedDeclaration(path) {
      const node = path.node;
      const loc = node.loc?.start.line || 0;

      // export const/let/var/function/class
      if (node.declaration) {
        const decl = node.declaration;
        let name = null;

        // FunctionDeclaration, ClassDeclaration
        if (decl.id && decl.id.name) {
          name = decl.id.name;
        } else if (decl.type === 'TSTypeAliasDeclaration') {
          name = decl.id.name;
        } else if (decl.type === 'TSInterfaceDeclaration') {
          name = decl.id.name;
        } else if (decl.type === 'VariableDeclaration') {
          // export const a = ..., export let b = ...
          // VariableDeclaration has declarations array
          decl.declarations.forEach(varDecl => {
            if (varDecl.id && varDecl.id.name) {
              exports.named.push({
                name: varDecl.id.name,
                type: 'named',
                line: loc,
              });
            }
          });
          return; // Skip other processing for variable declarations
        }

        if (name) {
          exports.named.push({
            name,
            type: 'named',
            line: loc,
          });
        }
      }

      // export { foo, bar }
      if (node.specifiers && node.specifiers.length > 0 && !node.source) {
        node.specifiers.forEach(spec => {
          const localName = spec.local.name;
          const exportedName = spec.exported?.name || localName;
          exports.group.push({
            name: exportedName,
            localName,
            type: 'group',
            line: loc,
          });
        });
      }

      // export { foo } from './module'
      if (node.specifiers && node.source) {
        const source = node.source.value;
        node.specifiers.forEach(spec => {
          const localName = spec.local.name;
          const exportedName = spec.exported?.name || localName;
          exports.reexport.push({
            name: exportedName,
            localName,
            source,
            type: 'reexport',
            line: loc,
          });
        });
      }
    },

    ExportDefaultDeclaration(path) {
      const node = path.node;
      const loc = node.loc?.start.line || 0;

      let name = 'default';

      if (node.declaration) {
        if (node.declaration.id && node.declaration.id.name) {
          name = node.declaration.id.name;
        } else if (node.declaration.type === 'ArrowFunctionExpression') {
          // 匿名默认导出
          name = 'anonymous';
        }
      }

      exports.default = {
        name,
        type: 'default',
        line: loc,
      };
    },

    ExportAllDeclaration(path) {
      const node = path.node;
      const loc = node.loc?.start.line || 0;
      const source = node.source?.value;

      if (source) {
        exports.star.push({
          source,
          type: 'star',
          line: loc,
        });
      }
    },
  };

  traverse(ast, visitor);

  // Combine all exports
  exports.all = [
    ...exports.named,
    exports.default ? exports.default : null,
    ...exports.group,
    ...exports.reexport,
    ...exports.star,
  ].filter(Boolean);

  return exports;
}

/**
 * 遍历 AST 并收集所有导入
 * @param {Object} ast - AST
 * @returns {Object} 收集的导入
 */
function walkImports(ast) {
  const imports = {
    static: [], // import { foo } from './module'
    default: [], // import foo from './module'
    namespace: [], // import * as ns from './module'
    dynamic: [], // import('./module')
    sideEffect: [], // import './module'
  };

  const visitor = {
    ImportDeclaration(path) {
      const node = path.node;
      const source = node.source.value;
      const loc = node.loc?.start.line || 0;
      const isInternal = isInternalImport(source);

      if (!isInternal) {
        return; // Skip external imports
      }

      node.specifiers.forEach(spec => {
        if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported.name;
          const local = spec.local.name;
          imports.static.push({
            name: local,
            imported,
            source,
            isDefault: false,
            isInternal,
            line: loc,
          });
        } else if (spec.type === 'ImportDefaultSpecifier') {
          imports.default.push({
            name: spec.local.name,
            source,
            isDefault: true,
            isInternal,
            line: loc,
          });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          imports.namespace.push({
            name: spec.local.name,
            source,
            isNamespace: true,
            isInternal,
            line: loc,
          });
        }
      });
    },

    CallExpression(path) {
      const node = path.node;
      // Check for dynamic import: import(...)
      if (node.callee.type === 'Import') {
        const arg = node.arguments[0];
        if (arg) {
          if (arg.type === 'StringLiteral') {
            // 简单字符串字面量: import('./module')
            const source = arg.value;
            if (source && isInternalImport(source)) {
              imports.dynamic.push({
                name: source,
                source,
                isDynamic: true,
                isInternal: true,
                line: node.loc?.start.line || 0,
              });
            }
          } else if (arg.type === 'TemplateLiteral') {
            // 模板字面量: import(`./module/${name}`)
            // 尝试提取基础路径
            const quasis = arg.quasis;
            if (quasis.length > 0) {
              const basePath = quasis[0].value.raw;
              if (basePath && isInternalImport(basePath)) {
                imports.dynamic.push({
                  name: basePath,
                  source: basePath,
                  isDynamic: true,
                  isInternal: true,
                  line: node.loc?.start.line || 0,
                });
              }
            }
          }
        }
      }
    },
  };

  traverse(ast, visitor);

  return imports;
}

/**
 * 遍历 AST 并查找 JSX 元素（React 组件）
 * @param {Object} ast - AST
 * @returns {string[]} 使用的组件名称
 */
function walkJSX(ast) {
  const components = [];

  const visitor = {
    JSXElement(path) {
      const openingElement = path.get('openingElement');
      const name = openingElement.get('name');

      if (name.isJSXIdentifier()) {
        const tagName = name.node.name;
        // 只收集 PascalCase（React 组件）
        if (/^[A-Z]/.test(tagName)) {
          components.push(tagName);
        }
      }
    },

    JSXMemberExpression(path) {
      // React.Fragment 等
      const object = path.get('object');
      const property = path.get('property');
      if (object.isJSXIdentifier() && property.isJSXIdentifier()) {
        components.push(`${object.node.name}.${property.node.name}`);
      }
    },
  };

  traverse(ast, visitor);

  return [...new Set(components)];
}

/**
 * 遍历 AST 并查找组件/类声明
 * @param {Object} ast - AST
 * @returns {Object} 组件信息
 */
function walkComponents(ast) {
  const components = {
    functions: [], // 函数组件
    classes: [], // 类组件
    hooks: [], // React hooks
  };

  const visitor = {
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (name && /^[A-Z]/.test(name)) {
        components.functions.push({
          name,
          type: 'function',
          line: path.node.loc?.start.line || 0,
        });
      }
    },

    VariableDeclarator(path) {
      const id = path.get('id');
      const init = path.get('init');

      if (id.isIdentifier()) {
        const name = id.node.name;

        // 函数组件: const Foo = () => ...
        if (init.isArrowFunctionExpression() || init.isFunctionExpression()) {
          if (/^[A-Z]/.test(name)) {
            components.functions.push({
              name,
              type: 'function',
              line: path.node.loc?.start.line || 0,
            });
          } else if (name.startsWith('use') && /^[a-z]/.test(name)) {
            components.hooks.push({
              name,
              type: 'hook',
              line: path.node.loc?.start.line || 0,
            });
          }
        }
      }
    },

    ClassDeclaration(path) {
      const name = path.node.id?.name;
      if (name && /^[A-Z]/.test(name)) {
        // 检查是否继承自 React.Component 或 React.PureComponent
        const superClass = path.node.superClass;
        let isReactComponent = false;

        if (superClass) {
          if (superClass.type === 'MemberExpression') {
            // React.Component 或 React.PureComponent
            const object = superClass.object?.name;
            const property = superClass.property?.name;
            if (
              (object === 'React' && (property === 'Component' || property === 'PureComponent')) ||
              property === 'Component' ||
              property === 'PureComponent'
            ) {
              isReactComponent = true;
            }
          } else if (superClass.type === 'Identifier') {
            // Component 或 PureComponent
            const name = superClass.name;
            if (name === 'Component' || name === 'PureComponent') {
              isReactComponent = true;
            }
          }
        }

        if (isReactComponent) {
          components.classes.push({
            name,
            type: 'class',
            line: path.node.loc?.start.line || 0,
          });
        }
      }
    },
  };

  traverse(ast, visitor);

  return components;
}

module.exports = {
  walkExports,
  walkImports,
  walkJSX,
  walkComponents,
};
