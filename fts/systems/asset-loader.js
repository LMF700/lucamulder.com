/* Asset loader with pixel-art-safe rendering. Missing artwork falls back gracefully. */
(() => {
  'use strict';
  class AssetLoader {
    constructor(registry) {
      this.registry = registry;
      this.cache = new Map();
      this.failed = new Set();
    }
    load(path) {
      if (!path) return null;
      if (this.cache.has(path)) return this.cache.get(path);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => { image.dataset.loaded = '1'; };
      image.onerror = () => { this.failed.add(path); };
      image.src = path;
      this.cache.set(path, image);
      return image;
    }
    get(path) {
      const image = this.cache.get(path) || this.load(path);
      return image && image.complete && image.naturalWidth > 0 ? image : null;
    }
    itemIconHTML(id, className = 'item-icon') {
      const def = this.registry.items[id];
      if (!def?.image) return `<span class="${className}">${def?.glyph || '?'}</span>`;
      const fallback = String(def.glyph || '?').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      return `<span class="${className}-wrap"><img class="${className}" src="${def.image}" alt="${def.name}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${className} item-fallback',textContent:'${fallback}'}))"></span>`;
    }
    preloadAll() {
      for (const def of Object.values(this.registry.items)) this.load(def.image);
      for (const def of Object.values(this.registry.machines)) this.load(def.sprite);
      for (const group of Object.values(this.registry.worldAssets || {})) for (const path of Object.values(group)) this.load(path);
    }
  }
  window.FTSAssets = new AssetLoader(window.FTSRegistry);
})();
