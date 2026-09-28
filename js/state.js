const CONFIG_KEY = 'reelcheck-config';
  const CACHE_KEY = 'reelcheck-cache';
  const VIEW_KEY = 'reelcheck-view';

  function loadConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
      if (c.path && !c.libraryPath) c.libraryPath = c.path; // migrate old field name
      return c;
    } catch (e) { return {}; }
  }
  function saveConfig(c) { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); } catch (e) {} }
  function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; } }
  function persistCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cacheState)); } catch (e) {} }

  let cfg = loadConfig();
  if (cfg.jfUrl || cfg.jfUserId || cfg.jfApiKey) { delete cfg.jfUrl; delete cfg.jfUserId; delete cfg.jfApiKey; saveConfig(cfg); }
  let data = { items: [], wishlist: [] };
  let sha = { items: null, wishlist: null };
  let ready = false;
  let view = localStorage.getItem(VIEW_KEY) || 'grid';
  let activeFormat = 'all';
  let activeType = 'all';
  let cacheState = loadCache() || { cfg: null, items: [], wishlist: [], itemsPending: false, wishlistPending: false, timestamp: null };

  function configComplete(c) { return !!(c.owner && c.repo && c.libraryPath && c.wishlistPath && c.token && c.tmdbToken); }
  function readConfigComplete(c) { return !!(c.owner && c.repo && c.libraryPath && c.wishlistPath); }
  function localFileUrl(path) { return new URL(path || 'library.json', document.baseURI).href; }
  function sameRepo(c1, c2) { return c1 && c2 && c1.owner === c2.owner && c1.repo === c2.repo && c1.libraryPath === c2.libraryPath && c1.wishlistPath === c2.wishlistPath; }
  function pathFor(kind) { return kind === 'items' ? cfg.libraryPath : cfg.wishlistPath; }
  function apiUrlFor(path) { return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURIComponent(path)}`; }
  function ghHeaders(includeAuth = true) {
    const h = { Accept: 'application/vnd.github+json' };
    if (includeAuth && cfg.token) h.Authorization = `token ${cfg.token}`;
    return h;
  }
  function b64Encode(str) { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m,p)=>String.fromCharCode('0x'+p))); }
  function b64Decode(str) { return decodeURIComponent(atob(str.replace(/\n/g,'')).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')); }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // Search helper: lowercases, strips accents, and drops every character that
  // isn't a letter or number (hyphens, colons, apostrophes, spaces, etc.), so
  // "spiderman", "spider man" and "Spider-Man: Homecoming" all line up.
  function normalizeSearch(s) {
    return String(s || '')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }
  function titleMatches(title, normalizedQuery) {
    return !normalizedQuery || normalizeSearch(title).includes(normalizedQuery);
  }
  function normalizeItems(raw) { return Array.isArray(raw) ? raw : (raw && Array.isArray(raw.items) ? raw.items : []); }
  function normalizeWishlist(raw) { return Array.isArray(raw) ? raw : (raw && Array.isArray(raw.wishlist) ? raw.wishlist : []); }

  const statusEl = document.getElementById('syncStatus');
  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.style.borderColor = kind === 'ok' ? 'var(--teal)' : kind === 'err' ? 'var(--rust)' : kind === 'warn' ? 'var(--amber)' : 'var(--line)';
    statusEl.style.color = kind === 'ok' ? 'var(--teal)' : kind === 'err' ? 'var(--rust)' : kind === 'warn' ? 'var(--amber)' : 'var(--ink-dim)';
  }
