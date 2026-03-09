const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  CacheManager,
  createCacheManager,
  DEFAULT_CACHE_DIR,
  DEFAULT_CACHE_FILE,
  DEFAULT_MAX_AGE,
  DEFAULT_MAX_ENTRIES,
} = require('../src/cache');

describe('CacheManager', () => {
  let tempDir;
  let cacheManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    cacheManager = new CacheManager({
      projectRoot: tempDir,
      maxAge: 1000,
    });
  });

  afterEach(() => {
    cacheManager.clear();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('构造函数', () => {
    test('应使用默认配置', () => {
      const cm = new CacheManager();
      expect(cm.cacheDir).toBe(DEFAULT_CACHE_DIR);
      expect(cm.cacheFile).toBe(DEFAULT_CACHE_FILE);
      expect(cm.maxAge).toBe(DEFAULT_MAX_AGE);
    });

    test('应使用自定义配置', () => {
      const cm = new CacheManager({
        cacheDir: '.custom-cache',
        cacheFile: 'custom-cache.json',
        maxAge: 5000,
        projectRoot: tempDir,
      });
      expect(cm.cacheDir).toBe('.custom-cache');
      expect(cm.cacheFile).toBe('custom-cache.json');
      expect(cm.maxAge).toBe(5000);
    });
  });

  describe('load', () => {
    test('首次加载应创建空缓存', () => {
      const cache = cacheManager.load();

      expect(cache).toBeDefined();
      expect(cache.version).toBe('1.0.0');
      expect(cache.meta.totalFiles).toBe(0);
      expect(cache.files).toEqual({});
    });

    test('重复加载应返回相同缓存', () => {
      const cache1 = cacheManager.load();
      const cache2 = cacheManager.load();

      expect(cache1).toBe(cache2);
    });

    test('应正确加载已存在的缓存文件', () => {
      const cacheData = {
        version: '1.0.0',
        meta: {
          created: Date.now(),
          lastSaved: Date.now(),
          totalFiles: 1,
        },
        files: {
          '/test/file.js': {
            data: { exports: ['foo'] },
            mtime: Date.now(),
            size: 100,
            hash: 'abc123',
            timestamp: Date.now(),
          },
        },
      };

      const cachePath = path.join(tempDir, DEFAULT_CACHE_DIR, DEFAULT_CACHE_FILE);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cacheData));

      const newManager = new CacheManager({ projectRoot: tempDir });
      const cache = newManager.load();

      expect(cache.files['/test/file.js']).toBeDefined();
      expect(cache.files['/test/file.js'].data.exports).toContain('foo');
    });

    test('应处理无效的缓存文件格式', () => {
      const cachePath = path.join(tempDir, DEFAULT_CACHE_DIR, DEFAULT_CACHE_FILE);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, 'invalid json');

      const newManager = new CacheManager({ projectRoot: tempDir });
      const cache = newManager.load();

      expect(cache.version).toBe('1.0.0');
      expect(cache.files).toEqual({});
    });

    test('应处理格式错误的缓存数据', () => {
      const cachePath = path.join(tempDir, DEFAULT_CACHE_DIR, DEFAULT_CACHE_FILE);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify({ invalid: 'format' }));

      const newManager = new CacheManager({ projectRoot: tempDir });
      const cache = newManager.load();

      expect(cache.version).toBe('1.0.0');
      expect(cache.files).toEqual({});
    });
  });

  describe('save', () => {
    test('应成功保存缓存', () => {
      cacheManager.load();
      const result = cacheManager.save();

      expect(result).toBe(true);
      expect(fs.existsSync(cacheManager.cachePath)).toBe(true);
    });

    test('保存的缓存应包含正确的元数据', () => {
      cacheManager.load();
      cacheManager.save();

      const content = fs.readFileSync(cacheManager.cachePath, 'utf-8');
      const saved = JSON.parse(content);

      expect(saved.version).toBe('1.0.0');
      expect(saved.meta.lastSaved).toBeDefined();
    });

    test('应创建缓存目录', () => {
      cacheManager.load();
      cacheManager.save();

      const cacheDirPath = path.dirname(cacheManager.cachePath);
      expect(fs.existsSync(cacheDirPath)).toBe(true);
    });
  });

  describe('get 和 set', () => {
    test('应正确设置和获取缓存', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      const data = { exports: ['foo'], imports: [] };
      cacheManager.set(testFile, data);

      const cached = cacheManager.get(testFile);
      expect(cached).toEqual(data);
    });

    test('文件不存在应返回 null', () => {
      cacheManager.load();
      const cached = cacheManager.get('/nonexistent/file.js');
      expect(cached).toBeNull();
    });

    test('文件修改后缓存应失效', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(testFile, 'export const bar = 2;');

      const cached = cacheManager.get(testFile);
      expect(cached).toBeNull();
    });

    test('应规范化路径', () => {
      if (process.platform !== 'win32') {
        return;
      }
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      const cached = cacheManager.get(testFile.replace(/\//g, '\\'));
      expect(cached).toEqual({ exports: ['foo'] });
    });
  });

  describe('invalidate', () => {
    test('应正确使缓存失效', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.invalidate(testFile);

      const cached = cacheManager.get(testFile);
      expect(cached).toBeNull();
    });

    test('使不存在的缓存失效不应报错', () => {
      cacheManager.load();
      expect(() => cacheManager.invalidate('/nonexistent/file.js')).not.toThrow();
    });
  });

  describe('clear', () => {
    test('应正确清空缓存', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.save();
      cacheManager.clear();

      expect(cacheManager.cache.files).toEqual({});
    });

    test('应删除缓存文件', () => {
      cacheManager.load();
      cacheManager.save();
      cacheManager.clear();

      expect(fs.existsSync(cacheManager.cachePath)).toBe(false);
    });
  });

  describe('getStats', () => {
    test('应返回正确的统计信息', () => {
      const testFile1 = path.join(tempDir, 'test1.js');
      const testFile2 = path.join(tempDir, 'test2.js');
      fs.writeFileSync(testFile1, 'export const foo = 1;');
      fs.writeFileSync(testFile2, 'export const bar = 2;');

      cacheManager.load();
      cacheManager.set(testFile1, { exports: ['foo'] });
      cacheManager.set(testFile2, { exports: ['bar'] });

      const stats = cacheManager.getStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    test('空缓存应返回零统计', () => {
      cacheManager.load();
      const stats = cacheManager.getStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('getValidFiles', () => {
    test('应正确区分有效和无效文件', () => {
      const validFile = path.join(tempDir, 'valid.js');
      const invalidFile = path.join(tempDir, 'invalid.js');
      fs.writeFileSync(validFile, 'export const foo = 1;');
      fs.writeFileSync(invalidFile, 'export const bar = 2;');

      cacheManager.load();
      cacheManager.set(validFile, { exports: ['foo'] });

      const { validFiles, invalidFiles } = cacheManager.getValidFiles([validFile, invalidFile]);

      expect(validFiles).toContain(validFile);
      expect(invalidFiles).toContain(invalidFile);
    });

    test('修改后的文件应视为无效', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      await new Promise(resolve => setTimeout(resolve, 100));
      fs.writeFileSync(testFile, 'export const bar = 2;');

      const { validFiles, invalidFiles } = cacheManager.getValidFiles([testFile]);

      expect(validFiles).toHaveLength(0);
      expect(invalidFiles).toContain(testFile);
    });
  });

  describe('缓存过期', () => {
    test('过期缓存应自动失效', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const cached = cacheManager.get(testFile);
      expect(cached).toBeNull();
    });

    test('加载时应清理过期条目', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.save();

      await new Promise(resolve => setTimeout(resolve, 1100));

      const newManager = new CacheManager({ projectRoot: tempDir, maxAge: 1000 });
      newManager.load();

      expect(newManager.cache.files[testFile.replace(/\\/g, '/')]).toBeUndefined();
    });
  });

  describe('createCacheManager', () => {
    test('应创建 CacheManager 实例', () => {
      const manager = createCacheManager({ projectRoot: tempDir });
      expect(manager).toBeInstanceOf(CacheManager);
    });
  });

  describe('常量导出', () => {
    test('应导出默认常量', () => {
      expect(DEFAULT_CACHE_DIR).toBe('.dead-code-cache');
      expect(DEFAULT_CACHE_FILE).toBe('analysis-cache.json');
      expect(DEFAULT_MAX_AGE).toBe(7 * 24 * 60 * 60 * 1000);
      expect(DEFAULT_MAX_ENTRIES).toBe(100);
    });
  });

  describe('边界条件', () => {
    test('应处理空数据', () => {
      cacheManager.load();
      cacheManager.set(path.join(tempDir, 'empty.js'), null);

      const stats = cacheManager.getStats();
      expect(stats.totalFiles).toBe(1);
    });

    test('应处理特殊字符路径', () => {
      const specialFile = path.join(tempDir, 'test-special_文件.js');
      fs.writeFileSync(specialFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(specialFile, { exports: ['foo'] });

      const cached = cacheManager.get(specialFile);
      expect(cached).toEqual({ exports: ['foo'] });
    });

    test('应处理多次保存', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.save();
      cacheManager.save();

      expect(fs.existsSync(cacheManager.cachePath)).toBe(true);
    });
  });

  describe('缓存大小限制', () => {
    test('应使用默认最大条目数', () => {
      expect(DEFAULT_MAX_ENTRIES).toBe(100);
    });

    test('应使用自定义最大条目数', () => {
      const cm = new CacheManager({
        projectRoot: tempDir,
        maxEntries: 5,
      });
      expect(cm.maxEntries).toBe(5);
    });

    test('缓存满时应淘汰最旧的条目', () => {
      const smallCacheManager = new CacheManager({
        projectRoot: tempDir,
        maxEntries: 3,
        maxAge: 10000,
      });

      const files = [];
      for (let i = 0; i < 5; i++) {
        const file = path.join(tempDir, `file${i}.js`);
        fs.writeFileSync(file, `export const foo${i} = ${i};`);
        files.push(file);
      }

      smallCacheManager.load();

      for (let i = 0; i < 5; i++) {
        smallCacheManager.set(files[i], { exports: [`foo${i}`] });
      }

      const stats = smallCacheManager.getStats();
      expect(stats.totalFiles).toBe(3);

      expect(smallCacheManager.get(files[0])).toBeNull();
      expect(smallCacheManager.get(files[1])).toBeNull();
      expect(smallCacheManager.get(files[4])).not.toBeNull();
    });
  });

  describe('缓存命中率统计', () => {
    test('初始命中率应为 0', () => {
      cacheManager.load();
      expect(cacheManager.getHitRate()).toBe(0);
    });

    test('应正确统计命中和未命中', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      cacheManager.get(testFile);
      cacheManager.get(testFile);
      cacheManager.get(path.join(tempDir, 'nonexistent.js'));

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    test('getHitRate 应返回正确的命中率', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      cacheManager.get(testFile);
      cacheManager.get(path.join(tempDir, 'nonexistent.js'));

      expect(cacheManager.getHitRate()).toBe(0.5);
    });

    test('resetStats 应重置统计', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.get(testFile);
      cacheManager.get(path.join(tempDir, 'nonexistent.js'));

      cacheManager.resetStats();
      expect(cacheManager.hits).toBe(0);
      expect(cacheManager.misses).toBe(0);
      expect(cacheManager.getHitRate()).toBe(0);
    });

    test('getStats 应包含命中率信息', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });
      cacheManager.get(testFile);

      const stats = cacheManager.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('缓存年龄和过期检查', () => {
    test('getAge 应返回缓存年龄', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      const age = cacheManager.getAge(testFile);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(1000);
    });

    test('getAge 对不存在的缓存应返回 null', () => {
      cacheManager.load();
      const age = cacheManager.getAge(path.join(tempDir, 'nonexistent.js'));
      expect(age).toBeNull();
    });

    test('isExpired 应正确判断过期状态', async () => {
      const shortCacheManager = new CacheManager({
        projectRoot: tempDir,
        maxAge: 100,
      });

      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      shortCacheManager.load();
      shortCacheManager.set(testFile, { exports: ['foo'] });

      expect(shortCacheManager.isExpired(testFile)).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortCacheManager.isExpired(testFile)).toBe(true);
    });

    test('isExpired 对不存在的缓存应返回 true', () => {
      cacheManager.load();
      const expired = cacheManager.isExpired(path.join(tempDir, 'nonexistent.js'));
      expect(expired).toBe(true);
    });
  });

  describe('LRU 访问时间更新', () => {
    test('访问缓存应更新 lastAccessedAt', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      const normalizedPath = testFile.replace(/\\/g, '/');
      const originalAccessTime = cacheManager.cache.files[normalizedPath].lastAccessedAt;

      await new Promise(resolve => setTimeout(resolve, 50));

      cacheManager.get(testFile);

      const newAccessTime = cacheManager.cache.files[normalizedPath].lastAccessedAt;
      expect(newAccessTime).toBeGreaterThan(originalAccessTime);
    });
  });

  describe('未加载时的自动加载', () => {
    test('get 应在未加载时自动加载', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      const result = newManager.get(testFile);
      expect(newManager.loaded).toBe(true);
      expect(result).toBeNull();
    });

    test('set 应在未加载时自动加载', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.set(testFile, { exports: ['foo'] });
      expect(newManager.loaded).toBe(true);
    });

    test('invalidate 应在未加载时自动加载', () => {
      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.invalidate('/nonexistent/file.js');
      expect(newManager.loaded).toBe(true);
    });

    test('getStats 应在未加载时自动加载', () => {
      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.getStats();
      expect(newManager.loaded).toBe(true);
    });

    test('getAge 应在未加载时自动加载', () => {
      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.getAge('/nonexistent/file.js');
      expect(newManager.loaded).toBe(true);
    });

    test('getValidFiles 应在未加载时自动加载', () => {
      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.getValidFiles(['/test.js']);
      expect(newManager.loaded).toBe(true);
    });
  });

  describe('set 更新现有条目', () => {
    test('应正确更新已存在的缓存条目', async () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      const normalizedPath = testFile.replace(/\\/g, '/');
      const originalCreatedAt = cacheManager.cache.files[normalizedPath].createdAt;

      await new Promise(resolve => setTimeout(resolve, 50));

      fs.writeFileSync(testFile, 'export const bar = 2;');
      cacheManager.set(testFile, { exports: ['bar'] });

      expect(cacheManager.cache.files[normalizedPath].data.exports).toContain('bar');
      expect(cacheManager.cache.files[normalizedPath].createdAt).toBe(originalCreatedAt);
    });
  });

  describe('clear 错误处理', () => {
    test('应处理清空缓存文件失败的情况', () => {
      cacheManager.load();
      cacheManager.save();

      const cachePath = cacheManager.cachePath;
      const cacheDir = path.dirname(cachePath);

      fs.mkdirSync(path.join(cacheDir, 'subdir'), { recursive: true });

      const originalUnlink = fs.unlinkSync;
      fs.unlinkSync = jest.fn(() => {
        throw new Error('Permission denied');
      });

      const result = cacheManager.clear();

      fs.unlinkSync = originalUnlink;

      expect(result).toBe(false);
    });
  });

  describe('依赖图功能', () => {
    test('setDependency 应正确设置依赖关系', () => {
      cacheManager.load();

      const result = cacheManager.setDependency('/src/main.js', ['/src/utils.js', '/src/helpers.js']);

      expect(result).toBe(true);
      expect(cacheManager.getDependencies('/src/main.js')).toBeInstanceOf(Set);
      expect(cacheManager.getDependencies('/src/main.js').size).toBe(2);
    });

    test('getDependencies 应返回空 Set 对于不存在的文件', () => {
      cacheManager.load();

      const deps = cacheManager.getDependencies('/nonexistent/file.js');

      expect(deps).toBeInstanceOf(Set);
      expect(deps.size).toBe(0);
    });

    test('addDependency 应正确添加单个依赖', () => {
      cacheManager.load();

      cacheManager.addDependency('/src/main.js', '/src/utils.js');
      cacheManager.addDependency('/src/main.js', '/src/helpers.js');

      const deps = cacheManager.getDependencies('/src/main.js');
      expect(deps.size).toBe(2);
    });

    test('getAffectedFiles 应正确获取受影响的文件', () => {
      cacheManager.load();

      const utilsPath = path.join(tempDir, 'utils.js');
      const aPath = path.join(tempDir, 'a.js');
      const bPath = path.join(tempDir, 'b.js');
      const cPath = path.join(tempDir, 'c.js');

      cacheManager.addDependency(aPath, utilsPath);
      cacheManager.addDependency(bPath, utilsPath);
      cacheManager.addDependency(cPath, bPath);

      const affected = cacheManager.getAffectedFiles(utilsPath);

      const normalizedUtils = utilsPath.replace(/\\/g, '/');
      const normalizedA = aPath.replace(/\\/g, '/');
      const normalizedB = bPath.replace(/\\/g, '/');

      expect(affected.has(normalizedUtils)).toBe(true);
      expect(affected.has(normalizedA)).toBe(true);
      expect(affected.has(normalizedB)).toBe(true);
    });

    test('依赖图方法应在未加载时自动加载', () => {
      const newManager = new CacheManager({ projectRoot: tempDir });
      expect(newManager.loaded).toBe(false);

      newManager.setDependency('/test.js', ['/dep.js']);
      expect(newManager.loaded).toBe(true);
    });
  });

  describe('_validateCacheFormat 边界情况', () => {
    test('应拒绝 null 缓存', () => {
      const result = cacheManager._validateCacheFormat(null);
      expect(result).toBe(false);
    });

    test('应拒绝非对象缓存', () => {
      const result = cacheManager._validateCacheFormat('invalid');
      expect(result).toBe(false);
    });

    test('应拒绝缺少必要字段的缓存', () => {
      expect(cacheManager._validateCacheFormat({})).toBe(false);
      expect(cacheManager._validateCacheFormat({ version: '1.0.0' })).toBe(false);
      expect(cacheManager._validateCacheFormat({ version: '1.0.0', meta: {} })).toBe(false);
    });

    test('应拒绝 files 不是对象的缓存', () => {
      const result = cacheManager._validateCacheFormat({
        version: '1.0.0',
        meta: {},
        files: 'invalid',
      });
      expect(result).toBe(false);
    });
  });

  describe('_isEntryValid 边界情况', () => {
    test('应拒绝 null entry', () => {
      cacheManager.load();
      const result = cacheManager._isEntryValid('/test.js', null);
      expect(result).toBe(false);
    });

    test('应拒绝没有 data 的 entry', () => {
      cacheManager.load();
      const result = cacheManager._isEntryValid('/test.js', { mtime: Date.now() });
      expect(result).toBe(false);
    });

    test('应检测 size 不匹配', () => {
      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      cacheManager.load();
      cacheManager.set(testFile, { exports: ['foo'] });

      const normalizedPath = testFile.replace(/\\/g, '/');
      const entry = cacheManager.cache.files[normalizedPath];
      entry.size = 999999;

      const result = cacheManager._isEntryValid(testFile, entry);
      expect(result).toBe(false);
    });
  });

  describe('_cleanExpiredEntries 边界情况', () => {
    test('maxAge <= 0 时不应清理', () => {
      const noExpiryManager = new CacheManager({
        projectRoot: tempDir,
        maxAge: 0,
      });

      const testFile = path.join(tempDir, 'test.js');
      fs.writeFileSync(testFile, 'export const foo = 1;');

      noExpiryManager.load();
      noExpiryManager.set(testFile, { exports: ['foo'] });

      noExpiryManager._cleanExpiredEntries();

      expect(noExpiryManager.cache.files[testFile.replace(/\\/g, '/')]).toBeDefined();
    });
  });

  describe('_evictOldest 边界情况', () => {
    test('空缓存时不应崩溃', () => {
      cacheManager.load();
      expect(() => cacheManager._evictOldest()).not.toThrow();
    });
  });

  describe('_getFileStats 错误处理', () => {
    test('文件不存在时应返回默认值', () => {
      const stats = cacheManager._getFileStats('/nonexistent/file.js');
      expect(stats).toHaveProperty('mtime');
      expect(stats).toHaveProperty('size');
      expect(stats.size).toBe(0);
    });
  });

  describe('_computeFileHash 错误处理', () => {
    test('文件不存在时应返回 null', () => {
      const hash = cacheManager._computeFileHash('/nonexistent/file.js');
      expect(hash).toBeNull();
    });
  });

  describe('save 错误处理', () => {
    test('应处理保存失败的情况', () => {
      cacheManager.load();

      const originalWrite = fs.writeFileSync;
      fs.writeFileSync = jest.fn(() => {
        throw new Error('Write failed');
      });

      const result = cacheManager.save();

      fs.writeFileSync = originalWrite;

      expect(result).toBe(false);
    });

    test('cache 为 null 时应返回 false', () => {
      cacheManager.cache = null;
      const result = cacheManager.save();
      expect(result).toBe(false);
    });
  });
});
