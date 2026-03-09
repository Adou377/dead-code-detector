/**
 * 常量和配置
 */

/**
 * 默认扫描的文件扩展名
 * @constant {string[]}
 */
const DEFAULT_EXTENSIONS = ['.js', '.vue', '.jsx', '.ts', '.tsx'];

/**
 * 默认忽略的目录
 * @constant {string[]}
 */
const DEFAULT_IGNORE_DIRS = ['node_modules', 'dist', '.git', 'assets'];

/**
 * 测试目录名称
 * @constant {string[]}
 */
const TEST_DIRS = ['test', 'tests', '__tests__', 'spec', 'e2e'];

/**
 * 最大并发文件读取数
 * @constant {number}
 */
const MAX_CONCURRENCY = 50;

/**
 * 最大文件大小（字节），超过此大小将跳过解析
 * @constant {number}
 */
const MAX_FILE_SIZE = 1000000;

/**
 * 非组件目录列表
 * @constant {string[]}
 */
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

/**
 * 忽略的 Vue 宏名称
 * @constant {string[]}
 */
const IGNORE_MACROS = [
  'defineOptions',
  'defineProps',
  'defineEmits',
  'defineModel',
  'defineExpose',
];

/**
 * 检测未使用导出时忽略的名称
 * 这些通常是框架 API 或不应该被报告为未使用的通用名称
 * @constant {Set<string>}
 */
const IGNORE_EXPORTS = new Set([
  // Vue 响应式 API
  'computed',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
  'onMounted',
  'onUnmounted',
  'onBeforeMount',
  'onBeforeUnmount',
  'onUpdated',
  'onBeforeUpdate',
  'onErrorCaptured',
  'onRenderTracked',
  'onRenderTriggered',
  'onActivated',
  'onDeactivated',
  'provide',
  'inject',
  'reactive',
  'ref',
  'readonly',
  'toRefs',
  'toRef',
  'isRef',
  'isReactive',
  'isProxy',
  'isReadonly',
  'isShallow',
  'unref',
  'proxyRefs',
  'customRef',
  'triggerRef',
  'shallowRef',
  'shallowReactive',
  'shallowReadonly',
  'markRaw',
  'toRaw',
  'isRaw',
  'useAttrs',
  'useSlots',
  'useCssModule',
  'useCssVars',
  // Vue Router
  'useRoute',
  'useRouter',
  'createRouter',
  'createWebHistory',
  'createWebHashHistory',
  'createMemoryHistory',
  'createURLSearchParams',
  'RouterLink',
  'RouterView',
  // Pinia
  'defineStore',
  'createPinia',
  'storeToRefs',
  // React Hooks
  'useState',
  'useEffect',
  'useCallback',
  'useMemo',
  'useRef',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useImperativeHandle',
  'useDebugValue',
  'useTransition',
  'useDeferredValue',
  'useId',
  'useSyncExternalStore',
  'useInsertionEffect',
  // React API
  'use',
  'useMemo',
  'useCallback',
  'forwardRef',
  'memo',
  'lazy',
  'Suspense',
  'startTransition',
  'Component',
  'PureComponent',
  'Fragment',
  'createElement',
  'createRef',
  'createContext',
  'createPortal',
  'createFactory',
  'isValidElement',
  // React Class 组件生命周期
  'componentDidMount',
  'componentDidUpdate',
  'componentWillMount',
  'componentWillUpdate',
  'componentWillReceiveProps',
  'componentWillUnmount',
  'shouldComponentUpdate',
  'getDerivedStateFromProps',
  'getDerivedStateFromError',
  'getSnapshotBeforeUpdate',
  'componentDidCatch',
  'render',
  // React DOM
  'createRoot',
  'hydrateRoot',
  'render',
  'findDOMNode',
  'unmountComponentAtNode',
  'createPortal',
  'flushSync',
  'unstable_batchedUpdates',
  // React Router (React)
  'BrowserRouter',
  'HashRouter',
  'Router',
  'Routes',
  'Route',
  'Navigate',
  'Link',
  'NavLink',
  'Outlet',
  'useNavigate',
  'useLocation',
  'useParams',
  'useSearchParams',
  'useRouteMatch',
  'useRoutes',
  'createBrowserRouter',
  'createHashRouter',
  // Redux / State Management
  'createStore',
  'applyMiddleware',
  'combineReducers',
  'bindActionCreators',
  'compose',
  'useStore',
  'useDispatch',
  'useSelector',
  'connect',
  'mapStateToProps',
  'mapDispatchToProps',
  'Provider',
  'createProvider',
  // Ant Design / UI 组件库
  'Button',
  'Input',
  'Select',
  'Form',
  'Table',
  'Modal',
  'Message',
  'Notification',
  // HOC
  'withRouter',
  'withStyles',
  'withTranslation',
  'connect',
  'observer',
  // 通用
  'default',
  'index',
  'types',
  'constants',
  'config',
  'utils',
  'PropTypes',
  // Babel helpers
  '__esModule',
  '__awaiter',
  // Element Plus / UI 库
  'ElMessage',
  'ElMessageBox',
  'ElNotification',
  'ElLoading',
  'ElDrawer',
  'ElDialog',
  // 公共工具
  'index',
  'default',
  'types',
  'constants',
  'config',
  'utils',
  // 业务相关（根据项目调整）
  'getToken',
  'setToken',
  'removeToken',
  // TypeScript 常用类型
  'type',
  'interface',
  'enum',
  'namespace',
  'declare',
  // 常见类型名称后缀
  'Props',
  'Options',
  'Config',
  'Params',
  'Response',
  'Result',
  'Data',
  'Item',
  'Model',
  // 常见类型名称前缀
  'I',
  'T',
  'E', // 如 IUser, TOptions, EStatus
  // TypeScript 装饰器（vue-property-decorator, typeorm, class-validator 等）
  'Component',
  'Prop',
  'Inject',
  'Provide',
  'Watch',
  'Model',
  'Emit',
  'Ref',
  'VModel',
  'Mixins',
  'Hooks',
  'Entity',
  'Column',
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'OneToMany',
  'ManyToOne',
  'ManyToMany',
  'OneToOne',
  'Table',
  'ViewEntity',
  'Index',
  'Unique',
  'Check',
  'Exclude',
  'IsEmail',
  'IsString',
  'IsNumber',
  'IsDate',
  'Min',
  'Max',
  'Length',
  'Matches',
  'Validate',
  'ValidateNested',
  'IsOptional',
  'IsNotEmpty',
  // NestJS 装饰器
  'Controller',
  'Get',
  'Post',
  'Put',
  'Delete',
  'Patch',
  'Options',
  'Head',
  'Param',
  'Body',
  'Query',
  'Headers',
  'Req',
  'Res',
  'Next',
  'Injectable',
  'Module',
  'Global',
  'Catch',
  'UseGuards',
  'UseFilters',
  'SetMetadata',
  'VERSION_NEUTRAL',
  // Angular 装饰器
  'Input',
  'Output',
  'ViewChild',
  'ViewChildren',
  'ContentChild',
  'ContentChildren',
  'HostBinding',
  'HostListener',
  'NgModule',
]);

// ==================== 错误码常量 ====================

/**
 * 错误码定义
 * @constant {Object}
 */
const ERROR_CODES = {
  E001: { code: 'E001', message: '无法访问源目录', solution: '检查目录路径是否正确' },
  E002: { code: 'E002', message: '配置文件格式错误', solution: '检查 JSON 语法' },
  E003: { code: 'E003', message: '文件解析失败', solution: '检查文件语法是否正确' },
  E004: { code: 'E004', message: '自动修复失败', solution: '手动备份后重试' },
  E005: { code: 'E005', message: '路径别名解析失败', solution: '检查项目配置中的路径别名设置' },
  E006: { code: 'E006', message: 'Git 操作失败', solution: '确保当前目录是 Git 仓库' },
  E007: { code: 'E007', message: '文件读取失败', solution: '检查文件是否存在及权限' },
  E008: { code: 'E008', message: '文件写入失败', solution: '检查文件权限及磁盘空间' },
  E009: { code: 'E009', message: '无效的配置选项', solution: '检查配置参数是否正确' },
  E010: { code: 'E010', message: '依赖分析失败', solution: '检查模块导入语句是否正确' },
};

// ==================== 执行模式常量 ====================

/**
 * 检测模式类型
 * @constant {Object}
 */
const DETECTION_MODES = {
  AST: 'ast',
  REGEX: 'regex',
};

/**
 * 默认检测模式
 * @constant {string}
 */
const DEFAULT_MODE = DETECTION_MODES.AST;

// ==================== 正则表达式常量 ====================

// 导出相关
const REGEX_NAMED_EXPORT = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
// TypeScript 类型导出（排除 declare 声明，因为这些是类型定义，不会产生运行时代码）
const REGEX_TS_NAMED_EXPORT =
  /export\s+(?:const|let|var|function|class|interface|type)\s+(?!declare\s+)(\w+)/g;
const REGEX_TS_ENUM_EXPORT = /export\s+enum\s+(\w+)/g;
const REGEX_TS_NAMESPACE_EXPORT = /export\s+namespace\s+(\w+)/g;
const REGEX_DEFAULT_EXPORT = /export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|(\w+))/g;
const REGEX_GROUP_EXPORT = /export\s+\{([^}]+)\}/g;
// 带 from 的重新导出：export { foo } from './module.js'
const REGEX_GROUP_REEXPORT = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
// 命名空间重新导出：export * as namespace from './module.js'
const REGEX_STAR_EXPORT = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
const REGEX_STAR_AS_NAMESPACE_EXPORT = /export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
// 将默认导出重新导出为命名导出：export { default as named } from './module.js'
const REGEX_DEFAULT_REEXPORT = /export\s+\{\s*default\s+as\s+(\w+)\s*\}\s+from\s+['"]([^'"]+)['"]/g;
// TypeScript 类型导出组：export type { ... }
const REGEX_TS_TYPE_GROUP_EXPORT = /export\s+type\s+\{([^}]+)\}/g;
// TypeScript 带 from 的类型导出：export type { Type } from './types.js'
const REGEX_TS_TYPE_REEXPORT = /export\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

// 导入相关
const REGEX_STATIC_IMPORT =
  /import\s+(?:\{([^}]+)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
// 支持单引号、双引号、模板字符串的动态导入
const REGEX_DYNAMIC_IMPORT = /import\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)\s*\)/g;
// 副作用导入（没有导入任何内容，只为执行代码）
const REGEX_SIDE_EFFECT_IMPORT = /import\s+['"][^'"]+['"]/g;

// 组件检测
const REGEX_COMPONENTS_OBJECT = /components\s*:\s*\{([^}]+)\}/g;
const REGEX_COMPONENT_NAME = /(['"]?)([\w-]+)\1(?:\s*:\s*[\w]+)?/g;
const REGEX_JSX_TAG = /<[A-Z]\w*/;
const REGEX_HOC_PATTERN = /\.(displayName|mixins|propTypes|defaultProps)/;
const REGEX_REDUX_CONNECT = /\b(connect|mapStateToProps|mapDispatchToProps)\b/;
const REGEX_REDUX_HOOKS = /\b(useSelector|useDispatch)\b/;

/**
 * 检查导入路径是否为内部路径（项目模块）
 * @param {string} importPath - 导入路径
 * @returns {boolean}
 */
function isInternalImport(importPath) {
  if (!importPath) return false;

  // 相对路径导入
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return true;
  }

  // 路径别名
  if (importPath.startsWith('@/') || importPath.startsWith('@@/')) {
    return true;
  }

  // 根路径别名
  if (importPath.startsWith('/src/') || importPath.startsWith('/@/')) {
    return true;
  }

  return false;
}

module.exports = {
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_DIRS,
  TEST_DIRS,
  MAX_CONCURRENCY,
  MAX_FILE_SIZE,
  NON_COMPONENT_DIRS,
  IGNORE_MACROS,
  IGNORE_EXPORTS,
  ERROR_CODES,
  DETECTION_MODES,
  DEFAULT_MODE,
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
  REGEX_STATIC_IMPORT,
  REGEX_DYNAMIC_IMPORT,
  REGEX_SIDE_EFFECT_IMPORT,
  REGEX_COMPONENTS_OBJECT,
  REGEX_COMPONENT_NAME,
  REGEX_JSX_TAG,
  REGEX_HOC_PATTERN,
  REGEX_REDUX_CONNECT,
  REGEX_REDUX_HOOKS,
  isInternalImport,
};
