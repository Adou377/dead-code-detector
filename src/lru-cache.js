const { defaultLogger } = require('./logger');

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_MEMORY_MB = 50;
const DEFAULT_MEMORY_CHECK_INTERVAL = 100;

class LRUNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.size = 0;
    this.lastAccessedAt = Date.now();
  }
}

class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize !== undefined ? options.maxSize : DEFAULT_MAX_ENTRIES;
    this.maxMemoryBytes = (options.maxMemoryMB || DEFAULT_MAX_MEMORY_MB) * 1024 * 1024;
    this.memoryCheckInterval = options.memoryCheckInterval || DEFAULT_MEMORY_CHECK_INTERVAL;
    this.currentSize = 0;
    this.currentMemoryBytes = 0;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.evictions = 0;
    this.memoryEvictions = 0;
    this.accessCount = 0;
  }

  get(key) {
    const node = this.cache.get(key);
    if (!node) {
      return null;
    }
    this._moveToHead(node);
    node.lastAccessedAt = Date.now();
    this.accessCount++;
    if (this.accessCount % this.memoryCheckInterval === 0) {
      this._checkMemoryThreshold();
    }
    return node.value;
  }

  set(key, value, size = 0) {
    if (this.maxSize <= 0) {
      return;
    }

    let node = this.cache.get(key);
    const entrySize = this._calculateEntrySize(key, value, size);

    if (node) {
      this.currentMemoryBytes -= node.size;
      node.value = value;
      node.size = entrySize;
      node.lastAccessedAt = Date.now();
      this._moveToHead(node);
    } else {
      while (this.cache.size >= this.maxSize && this.cache.size > 0) {
        this._evictTail();
      }
      node = new LRUNode(key, value);
      node.size = entrySize;
      this.cache.set(key, node);
      this._addToHead(node);
      this.currentSize++;
    }

    this.currentMemoryBytes += entrySize;
    this._checkMemoryThreshold();
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }
    this._removeNode(node);
    this.cache.delete(key);
    this.currentMemoryBytes -= node.size;
    this.currentSize--;
    return true;
  }

  clear() {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
    this.currentMemoryBytes = 0;
    this.evictions = 0;
    this.memoryEvictions = 0;
  }

  keys() {
    const keys = [];
    let current = this.head;
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    return keys;
  }

  values() {
    const values = [];
    let current = this.head;
    while (current) {
      values.push(current.value);
      current = current.next;
    }
    return values;
  }

  entries() {
    const entries = [];
    let current = this.head;
    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }
    return entries;
  }

  forEach(callback) {
    let current = this.head;
    while (current) {
      callback(current.value, current.key, this);
      current = current.next;
    }
  }

  get size() {
    return this.cache.size;
  }

  getMemoryUsage() {
    return {
      currentBytes: this.currentMemoryBytes,
      currentMB: (this.currentMemoryBytes / (1024 * 1024)).toFixed(2),
      maxBytes: this.maxMemoryBytes,
      maxMB: this.maxMemoryBytes / (1024 * 1024),
      utilizationPercent: ((this.currentMemoryBytes / this.maxMemoryBytes) * 100).toFixed(2),
    };
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.getMemoryUsage(),
      evictions: this.evictions,
      memoryEvictions: this.memoryEvictions,
    };
  }

  resize(newMaxSize) {
    this.maxSize = newMaxSize;
    while (this.cache.size > this.maxSize && this.tail) {
      this._evictTail();
    }
  }

  setMaxMemory(maxMemoryMB) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this._checkMemoryThreshold();
  }

  _addToHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  _removeNode(node) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
  }

  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  _evictTail() {
    if (!this.tail) {
      return null;
    }
    const evictedNode = this.tail;
    this._removeNode(evictedNode);
    this.cache.delete(evictedNode.key);
    this.currentMemoryBytes -= evictedNode.size;
    this.currentSize--;
    this.evictions++;
    defaultLogger.debug(`LRU 淘汰缓存条目: ${evictedNode.key}`);
    return evictedNode;
  }

  _checkMemoryThreshold() {
    while (this.currentMemoryBytes > this.maxMemoryBytes && this.tail) {
      this._evictTail();
      this.memoryEvictions++;
    }
  }

  _calculateEntrySize(key, value, providedSize) {
    if (providedSize > 0) {
      return providedSize;
    }
    let size = 0;
    try {
      size = Buffer.byteLength(JSON.stringify(key), 'utf8');
      size += Buffer.byteLength(JSON.stringify(value), 'utf8');
      size += 200;
    } catch {
      size = 1024;
    }
    return size;
  }
}

module.exports = {
  LRUCache,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_MEMORY_MB,
  DEFAULT_MEMORY_CHECK_INTERVAL,
};
