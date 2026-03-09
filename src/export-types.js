/**
 * 导出类型判断工具
 *
 * 提供各种导出类型的判断方法
 */

const EXPORT_PATTERNS = {
  group: /export\s+(?:type\s+)?\{[^}]*\}/,
  type: /export\s+(type|interface|enum|namespace)/,
  default: /export\s+default/,
  named: /export\s+(?:const|let|var|function|class)\s+\w+/,
  star: /export\s+\*/,
  reexport: /export\s*\{[^}]*\}\s*from/,
};

function isGroupExport(line) {
  return EXPORT_PATTERNS.group.test(line);
}

function isTypeExport(line) {
  return EXPORT_PATTERNS.type.test(line);
}

function isDefaultExport(line) {
  return EXPORT_PATTERNS.default.test(line);
}

function isNamedExport(line) {
  return EXPORT_PATTERNS.named.test(line);
}

function isStarExport(line) {
  return EXPORT_PATTERNS.star.test(line);
}

function isReExport(line) {
  return EXPORT_PATTERNS.reexport.test(line);
}

function isMultiLineExport(lines, lineIndex) {
  const line = lines[lineIndex];
  return line.includes('export') && line.includes('{') && !line.includes('}');
}

module.exports = {
  isGroupExport,
  isTypeExport,
  isDefaultExport,
  isNamedExport,
  isStarExport,
  isReExport,
  isMultiLineExport,
};
