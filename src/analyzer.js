/**
 * 导出分析工具
 *
 * 提供导出行分析功能，用于确定如何移除未使用的导出
 */

const {
  isGroupExport,
  isMultiLineExport,
  isTypeExport,
  isDefaultExport,
  isNamedExport,
  isStarExport,
  isReExport,
} = require('./export-types.js');

function groupItemsByLine(items) {
  const itemsByLine = new Map();
  for (const item of items) {
    if (!itemsByLine.has(item.line)) {
      itemsByLine.set(item.line, []);
    }
    itemsByLine.get(item.line).push(item);
  }
  return itemsByLine;
}

function analyzeLinesToRemove(content, items) {
  const itemsByLine = groupItemsByLine(items);
  const lines = content.split('\n');
  const linesToRemove = new Set();
  let modified = false;

  for (const [lineNum, lineItems] of itemsByLine.entries()) {
    const lineIndex = lineNum - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const result = analyzeExportLine(lines, lineIndex, lineItems);

    if (result.shouldRemove) {
      for (let i = result.startLine; i <= result.endLine; i++) {
        linesToRemove.add(i);
      }
      modified = true;
    } else if (result.partialRemove) {
      lines[lineIndex] = result.newLine;
      modified = true;
    }
  }

  return { lines, linesToRemove, modified };
}

function analyzeExportLine(lines, lineIndex, items) {
  const line = lines[lineIndex];
  const itemNames = items.map(item => item.name);

  if (!line) {
    return { shouldRemove: false };
  }

  if (isGroupExport(line)) {
    return analyzeGroupExport(lines, lineIndex, itemNames);
  }

  if (isMultiLineExport(lines, lineIndex)) {
    return analyzeMultiLineExport(lines, lineIndex, itemNames);
  }

  if (
    isTypeExport(line) ||
    isDefaultExport(line) ||
    isNamedExport(line) ||
    isStarExport(line) ||
    isReExport(line)
  ) {
    return {
      shouldRemove: true,
      startLine: lineIndex,
      endLine: lineIndex,
    };
  }

  for (const name of itemNames) {
    if (line.includes(name)) {
      return {
        shouldRemove: true,
        startLine: lineIndex,
        endLine: lineIndex,
      };
    }
  }

  return { shouldRemove: false };
}

function analyzeGroupExport(lines, lineIndex, itemNames) {
  const line = lines[lineIndex];

  const exportMatch = line.match(/export\s+(?:type\s+)?\{([^}]*)\}/);
  if (!exportMatch) {
    return { shouldRemove: false };
  }

  const exportsStr = exportMatch[1];
  const exports = exportsStr
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  const remainingExports = exports.filter(exp => {
    const name = exp.split(/\s+as\s+/)[0].trim();
    return !itemNames.includes(name);
  });

  if (remainingExports.length === 0) {
    return {
      shouldRemove: true,
      startLine: lineIndex,
      endLine: lineIndex,
    };
  } else {
    const newExportsStr = remainingExports.join(', ');
    const newLine = line.replace(/\{[^}]*\}/, `{ ${newExportsStr} }`);
    return {
      partialRemove: true,
      newLine,
    };
  }
}

function analyzeMultiLineExport(lines, lineIndex, _itemNames) {
  const line = lines[lineIndex];

  if (!line.includes('{') || line.includes('}')) {
    return { shouldRemove: false };
  }

  let endLine = lineIndex;
  let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

  while (endLine < lines.length - 1 && braceCount > 0) {
    endLine++;
    const nextLine = lines[endLine];
    braceCount += (nextLine.match(/\{/g) || []).length;
    braceCount -= (nextLine.match(/\}/g) || []).length;
  }

  return {
    shouldRemove: true,
    startLine: lineIndex,
    endLine,
  };
}

module.exports = {
  groupItemsByLine,
  analyzeLinesToRemove,
  analyzeExportLine,
  analyzeGroupExport,
  analyzeMultiLineExport,
};
