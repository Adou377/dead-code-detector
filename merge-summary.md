此次合并主要进行了代码模块化重构，将缓存相关功能从主文件中分离到独立模块，同时更新了版本号。这些变更提高了代码的可维护性和可读性，便于后续的功能扩展和维护。
| 文件 | 变更 |
|------|---------|
| package-lock.json | - 版本号从 1.0.0 升级到 1.1.2<br>- 移除了多个依赖项的 "peer": true 标记 |
| src/cache.js | - 移除了 LRUNode 和 LRUCache 类的内部实现<br>- 从 './lru-cache.js' 导入 LRUCache 类和相关常量 |
| src/detector-base.js | - 移除了 RegexCache 类的内部实现和相关常量定义<br>- 从 './regex-cache.js' 导入 RegexCache 类、globalRegexCache 和 PRECOMPILED_REGEX 常量 |
| src/lru-cache.js | - 新增文件，包含 LRUNode 和 LRUCache 类的完整实现<br>- 导出 LRUCache 类和相关常量 |
| src/regex-cache.js | - 新增文件，包含 RegexCache 类的完整实现<br>- 导出 RegexCache 类、globalRegexCache 和 PRECOMPILED_REGEX 常量 |