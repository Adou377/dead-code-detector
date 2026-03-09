/**
 * Dead Code Detector - TypeScript Type Definitions
 *
 * @version 1.0.0
 */

export interface ConfigFileOptions {
  /**
   * Source directory to scan
   * @default './src'
   */
  srcDir?: string;

  /**
   * File extensions to scan (comma-separated string or array)
   * @default '.js,.vue,.jsx,.ts,.tsx'
   */
  extensions?: string | string[];

  /**
   * Directories to ignore (comma-separated string or array)
   * @default 'node_modules,dist,.git'
   */
  ignoreDirs?: string | string[];

  /**
   * Detection mode
   * @default 'ast'
   */
  mode?: 'ast' | 'regex';

  /**
   * Enable auto-fix mode
   * @default false
   */
  fix?: boolean;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

export interface DeadCodeFinderOptions {
  /**
   * Source directory to scan
   * @default './src'
   */
  srcDir?: string;

  /**
   * File extensions to scan
   * @default ['.js', '.vue', '.jsx', '.ts', '.tsx']
   */
  extensions?: string[];

  /**
   * Directories to ignore
   * @default ['node_modules', 'dist', '.git']
   */
  ignoreDirs?: string[];

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

export interface DetectOptions extends ConfigFileOptions {
  /**
   * Path to config file
   */
  config?: string;
}

export interface ExportItem {
  name: string;
  type: string;
  line: number;
  code: string;
  source?: string;
}

export interface ComponentItem {
  file: string;
  name: string;
  used?: boolean;
  isGlobal?: boolean;
  isLocal?: boolean;
  isScriptSetup?: boolean;
  composables?: string[];
  exposed?: string[];
}

export interface AnalysisResults {
  unusedExports: Array<{
    file: string;
    name: string;
    type: string;
    line: number;
    code: string;
  }>;
  unusedComponents: ComponentItem[];
  unusedToolFiles: string[];
}

export interface FixOptions {
  dryRun?: boolean;
  confirm?: boolean;
}

export interface FixResult {
  unusedExports: number;
  unusedComponents: number;
  unusedToolFiles: number;
  cancelled?: boolean;
  preview?: any;
  dryRun?: boolean;
}

export interface DetectResult {
  finder: DeadCodeFinder | DeadCodeFinderAST;
  results: AnalysisResults;
}

/**
 * Dead Code Finder Base Class
 */
export class DeadCodeFinderBase {
  constructor(options?: DeadCodeFinderOptions);

  /**
   * Scan directory for source files
   * @param dir - Directory to scan
   */
  scanFiles(dir: string): Promise<string[]>;

  /**
   * Scan test files and collect imports
   */
  scanTestFiles(): Promise<Map<string, Set<string>>>;

  /**
   * Extract imports from content (to be overridden by subclasses)
   * @param content - File content
   */
  extractImportsFromContent(content: string): any[];

  /**
   * Count local usage of a name in a file
   * @param file - File path
   * @param name - Name to count
   */
  countLocalUsage(file: string, name: string): number;

  /**
   * Count usage of a name in content
   * @param content - Content
   * @param name - Name
   */
  countUsageInContent(content: string, name: string): number;

  /**
   * Convert string to PascalCase
   * @param str - String to convert
   */
  toPascalCase(str: string): string;

  /**
   * Convert string to kebab-case
   * @param str - String to convert
   */
  toKebabCase(str: string): string;

  /**
   * Get total export count
   */
  getExportCount(): number;

  /**
   * Group items by file
   * @param items - Items to group
   */
  groupByFile(items: Array<{ file: string }>): Record<string, any[]>;

  /**
   * Detect unused tool files
   */
  detectUnusedToolFiles(): string[];

  /**
   * Resolve import path (to be overridden by subclasses)
   * @param importPath - Import path
   * @param currentFile - Current file
   */
  resolveImportPath(importPath: string, currentFile: string): string | null;

  /**
   * Run full analysis (to be overridden by subclasses)
   */
  analyze(): Promise<AnalysisResults>;

  /**
   * Generate and print report (to be overridden by subclasses)
   */
  report(): AnalysisResults;

  /**
   * Auto-fix unused code (to be overridden by subclasses)
   * @param options - Fix options
   */
  fix(options?: FixOptions): Promise<FixResult>;

  // Properties
  sourceFiles: string[];
  fileContents: Map<string, string>;
  exports: Map<string, ExportItem[]>;
  imports: Map<string, any[]>;
  components: Map<string, ComponentItem>;
  unusedExports: ExportItem[];
  unusedComponents: ComponentItem[];
  unusedToolFiles: string[];
  localComponents: Map<string, string[]>;
  srcDir: string;
  extensions: string[];
  ignoreDirs: string[];
  verbose: boolean;
}

/**
 * Dead Code Finder Class (Regex Mode)
 */
export class DeadCodeFinder extends DeadCodeFinderBase {
  constructor(options?: DeadCodeFinderOptions);

  /**
   * Run full analysis
   */
  analyze(): Promise<AnalysisResults>;

  /**
   * Generate and print report
   */
  report(): AnalysisResults;

  /**
   * Auto-fix unused code
   */
  fix(): Promise<void>;

  /**
   * Parse single file
   * @param filePath - File path
   */
  parseFile(filePath: string): Promise<void>;

  /**
   * Extract imports from content
   * @param content - File content
   */
  extractImports(content: string): any[];

  /**
   * Extract Vue components from content
   * @param content - File content
   */
  extractVueComponents(content: string): string[];

  /**
   * Check if file is React component
   * @param filePath - File path
   * @param content - File content
   */
  isReactComponentFile(filePath: string, content: string): boolean;

  /**
   * Get line number
   * @param content - Content
   * @param matchIndex - Match index
   */
  getLineNumber(content: string, matchIndex: number): number;

  /**
   * Extract all exports from content
   * @param content - File content
   */
  extractExportsFromContent(content: string): ExportItem[];

  /**
   * Extract named exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractNamedExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract TypeScript type exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractTsTypeExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract TypeScript enum exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractTsEnumExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract TypeScript namespace exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractTsNamespaceExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract default exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractDefaultExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract group exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractGroupExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract star exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractStarExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract namespace reexports
   * @param content - File content
   * @param exports - Exports array
   */
  extractNamespaceReexports(content: string, exports: ExportItem[]): void;

  /**
   * Extract group reexports
   * @param content - File content
   * @param exports - Exports array
   */
  extractGroupReexports(content: string, exports: ExportItem[]): void;

  /**
   * Extract default reexports
   * @param content - File content
   * @param exports - Exports array
   */
  extractDefaultReexports(content: string, exports: ExportItem[]): void;

  /**
   * Extract TypeScript type group exports
   * @param content - File content
   * @param exports - Exports array
   */
  extractTsTypeGroupExports(content: string, exports: ExportItem[]): void;

  /**
   * Extract TypeScript type reexports
   * @param content - File content
   * @param exports - Exports array
   */
  extractTsTypeReexports(content: string, exports: ExportItem[]): void;

  /**
   * Extract all imports from content
   * @param content - File content
   */
  extractImportsFromContent(content: string): any[];

  /**
   * Extract static imports
   * @param content - File content
   * @param imports - Imports array
   */
  extractStaticImports(content: string, imports: any[]): void;

  /**
   * Extract dynamic imports
   * @param content - File content
   * @param imports - Imports array
   */
  extractDynamicImports(content: string, imports: any[]): void;

  /**
   * Extract side effect imports
   * @param content - File content
   * @param imports - Imports array
   */
  extractSideEffectImports(content: string, imports: any[]): void;

  /**
   * Parse JS/TS content to extract imports and exports
   * @param relativePath - Relative path
   * @param content - File content
   */
  parseJsContent(relativePath: string, content: string): void;

  /**
   * Detect unused components
   * @param testImports - Test imports
   */
  detectUnusedComponents(testImports?: Map<string, Set<string>>): Promise<void>;
}

/**
 * Dead Code Finder AST Class
 */
export class DeadCodeFinderAST extends DeadCodeFinderBase {
  constructor(options?: DeadCodeFinderOptions);

  /**
   * Run full analysis
   */
  analyze(): Promise<AnalysisResults>;

  /**
   * Generate and print report
   */
  report(): AnalysisResults;

  /**
   * Auto-fix unused code
   * @param options - Fix options
   */
  fix(options?: FixOptions): Promise<FixResult>;

  /**
   * Parse single file using AST
   * @param filePath - File path
   */
  parseFile(filePath: string): Promise<void>;

  /**
   * Process AST result
   * @param relativePath - Relative path
   * @param ast - AST object
   * @param content - File content
   */
  processAstResult(relativePath: string, ast: any, content: string): void;

  /**
   * Scan source files
   */
  scanSourceFiles(): Promise<void>;

  /**
   * Parse source files
   */
  parseSourceFiles(): Promise<void>;

  /**
   * Collect all imports
   * @param testImports - Test imports
   */
  collectAllImports(testImports: Map<string, Set<string>>): Map<string, Set<string>>;

  /**
   * Detect unused code
   * @param allImports - All imports
   * @param testImports - Test imports
   */
  detectUnusedCode(
    allImports: Map<string, Set<string>>,
    testImports: Map<string, Set<string>>
  ): Promise<void>;

  /**
   * Detect unused exports
   * @param allImports - All imports
   */
  detectUnusedExports(allImports: Map<string, Set<string>>): void;

  /**
   * Detect unused components
   * @param testImports - Test imports
   */
  detectUnusedComponents(testImports?: Map<string, Set<string>>): Promise<void>;

  /**
   * Collect component usages
   * @param testImports - Test imports
   */
  collectComponentUsages(testImports: Map<string, Set<string>>): Map<string, Set<string>>;

  /**
   * Build component tag index
   */
  buildComponentTagIndex(): Map<string, Set<string>>;

  /**
   * Build JSX component tag index
   * @param componentTagIndex - Component tag index
   */
  buildJSXComponentTagIndex(componentTagIndex: Map<string, Set<string>>): void;

  /**
   * Build Vue component tag index
   * @param componentTagIndex - Component tag index
   */
  buildVueComponentTagIndex(componentTagIndex: Map<string, Set<string>>): void;

  /**
   * Analyze component usage
   * @param componentUsages - Component usages
   * @param componentTagIndex - Component tag index
   */
  analyzeComponentUsage(
    componentUsages: Map<string, Set<string>>,
    componentTagIndex: Map<string, Set<string>>
  ): void;

  /**
   * Check if component is used
   * @param componentName - Component name
   * @param pascalName - PascalCase name
   * @param kebabName - kebab-case name
   * @param file - File path
   * @param componentUsages - Component usages
   * @param componentTagIndex - Component tag index
   */
  isComponentUsed(
    componentName: string,
    pascalName: string,
    kebabName: string,
    file: string,
    componentUsages: Map<string, Set<string>>,
    componentTagIndex: Map<string, Set<string>>
  ): boolean;

  /**
   * Get path aliases from config
   */
  getPathAliases(): Record<string, string>;

  /**
   * Extract aliases from config
   * @param config - Config object
   * @param configFile - Config file name
   */
  extractAliasesFromConfig(config: any, configFile: string): Record<string, string>;

  /**
   * Generate fix preview
   */
  generateFixPreview(): any;

  /**
   * Show fix preview
   * @param preview - Preview object
   */
  showFixPreview(preview: any): void;

  /**
   * Confirm fix
   * @param preview - Preview object
   */
  confirmFix(preview: any): Promise<boolean>;

  /**
   * Create backup directory
   */
  createBackupDir(): string;

  /**
   * Fix unused exports
   * @param backupDir - Backup directory
   */
  fixUnusedExports(backupDir: string): Promise<number>;

  /**
   * Fix unused components
   * @param backupDir - Backup directory
   */
  fixUnusedComponents(backupDir: string): Promise<number>;

  /**
   * Delete unused tool files
   * @param backupDir - Backup directory
   */
  deleteUnusedToolFiles(backupDir: string): number;

  /**
   * Backup file
   * @param fullPath - Full path
   * @param backupDir - Backup directory
   * @param file - File path
   */
  backupFile(fullPath: string, backupDir: string, file: string): void;

  /**
   * Remove unused exports
   * @param fullPath - Full path
   * @param items - Items to remove
   */
  removeUnusedExports(fullPath: string, items: any[]): void;

  /**
   * Print fix summary
   * @param backupDir - Backup directory
   * @param fixResult - Fix result
   */
  printFixSummary(backupDir: string, fixResult: FixResult): void;

  // Additional properties for AST mode
  jsxUsage: Map<string, string[]>;
}

/**
 * Run dead code detection
 * @param options - Configuration options
 */
export function detect(options?: DetectOptions): Promise<DetectResult>;

/**
 * Load configuration file
 * @param configPath - Path to config file (optional)
 */
export function loadConfig(configPath?: string): ConfigFileOptions | null;

/**
 * Merge configuration: CLI args > config file > defaults
 * @param cliArgs - CLI arguments
 * @param configFile - Config file content
 */
export function mergeConfig(
  cliArgs?: Partial<ConfigFileOptions>,
  configFile?: ConfigFileOptions | null
): ConfigFileOptions;

/**
 * CLI runner
 */
export function run(): void;
