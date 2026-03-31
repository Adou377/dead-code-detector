class RegexCache {
  constructor() {
    this.cache = new Map();
  }

  get(pattern, flags = 'g') {
    const key = `${pattern.toString()}:${flags}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new RegExp(pattern, flags));
    }
    const regex = this.cache.get(key);
    regex.lastIndex = 0;
    return regex;
  }

  getForName(name, type) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const key = `${type}:${escapedName}`;
    if (!this.cache.has(key)) {
      switch (type) {
        case 'export-group':
          this.cache.set(key, new RegExp(`export\\s+\\{[^}]*\\b${escapedName}\\b[^}]*\\}`, 'g'));
          break;
        case 'export-decl':
          this.cache.set(
            key,
            new RegExp(
              `export\\s+(?:const|let|var|function|class)\\s+${escapedName}\\b[^;]*;?`,
              'g'
            )
          );
          break;
        case 'var-decl':
          this.cache.set(
            key,
            new RegExp(`\\b(?:const|let|var|function|class)\\s+${escapedName}\\b`, 'g')
          );
          break;
        case 'decorator':
          this.cache.set(key, new RegExp(`^\\s*@${escapedName}(?:\\s*\\([^)]*\\))?`, 'gm'));
          break;
        case 'name':
          this.cache.set(key, new RegExp(`\\b${escapedName}\\b`, 'g'));
          break;
        default:
          this.cache.set(key, new RegExp(escapedName, flags));
      }
    }
    const regex = this.cache.get(key);
    regex.lastIndex = 0;
    return regex;
  }

  clear() {
    this.cache.clear();
  }
}

const globalRegexCache = new RegexCache();

const PRECOMPILED_REGEX = {
  cleanImportStatements: /import\s+.*from\s+['"][^'"]+['"]/g,
  cleanStringLiterals: /(['"`])(?:\\.|(?!\1)[^\\])*\1/g,
  cleanRegex: /\/(?:[^\/\\]|\\.)*\/[gimsuvy]*/g,
  cleanCommentsBlock: /\/\*[\s\S]*?\*\//g,
  cleanCommentsLine: /\/\/.*$/gm,
};

module.exports = { RegexCache, globalRegexCache, PRECOMPILED_REGEX };
