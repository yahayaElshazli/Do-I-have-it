function markPending(kind) {
    cacheState = { cfg, items: data.items, wishlist: data.wishlist, timestamp: Date.now(),
      itemsPending: kind === 'items' ? true : cacheState.itemsPending,
      wishlistPending: kind === 'wishlist' ? true : cacheState.wishlistPending };
    persistCache();
  }
  function markSynced(kind) {
    cacheState = { cfg, items: data.items, wishlist: data.wishlist, timestamp: Date.now(),
      itemsPending: kind === 'items' ? false : cacheState.itemsPending,
      wishlistPending: kind === 'wishlist' ? false : cacheState.wishlistPending };
    persistCache();
  }

  async function fetchFile(kind) {
    // Read the library directly from the same GitHub Pages site as index.html.
    // This avoids the GitHub API and therefore avoids any sync/token step for reading.
    const path = pathFor(kind);
    const res = await fetch(localFileUrl(path), { cache: 'no-store' });
    if (res.ok) {
      try { return { ok: true, raw: await res.json() }; }
      catch (e) { return { ok: false, status: 'invalid-json' }; }
    }
    if (res.status === 404) return { ok: true, raw: null };
    return { ok: false, status: res.status };
  }

  // GitHub errors are surfaced in the relevant Admin/action message.
  let lastGitHubError = '';

  async function describeGitHubResponse(res) {
    let detail = '';
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          detail = json.message || (json.error && json.error.message) || text;
        } catch (_) { detail = text; }
      }
    } catch (_) {}
    const suffix = detail ? ` — ${detail}` : '';
    lastGitHubError = `GitHub ${res.status}${res.statusText ? ` ${res.statusText}` : ''}${suffix}`;
    return lastGitHubError;
  }

  async function pushFile(kind, retry) {
    if (!configComplete(cfg)) { lastGitHubError = 'GitHub settings are incomplete. Check Admin → GitHub settings.'; return false; }
    lastGitHubError = '';
    try {
      const payload = kind === 'items' ? data.items : data.wishlist;
      const url = apiUrlFor(pathFor(kind));

      // GitHub requires the current file SHA when updating an existing file.
      // The app reads library.json/wishlist.json directly from GitHub Pages, so
      // we cannot rely on the Contents API SHA having been populated already.
      if (!sha[kind]) {
        const current = await fetch(url, { headers: ghHeaders() });
        if (current.ok) {
          const currentData = await current.json();
          sha[kind] = currentData.sha || null;
        } else if (current.status !== 404) {
          await describeGitHubResponse(current);
          markPending(kind);
          return false;
        }
      }

      const body = {
        message: `Update ${kind === 'items' ? 'library' : 'wishlist'} via Do I Have It`,
        content: b64Encode(JSON.stringify(payload, null, 2))
      };
      if (sha[kind]) body.sha = sha[kind];

      const res = await fetch(url, {
        method: 'PUT',
        headers: { ...ghHeaders(true), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const d = await res.json();
        sha[kind] = d.content.sha;
        markSynced(kind);
        return true;
      }

      if ((res.status === 409 || res.status === 422) && !retry) {
        // Refresh the SHA and retry once if GitHub reports a stale/missing SHA.
        const r2 = await fetch(url, { headers: ghHeaders() });
        if (r2.ok) {
          const d2 = await r2.json();
          sha[kind] = d2.sha || null;
          return pushFile(kind, true);
        }
        await describeGitHubResponse(r2);
      } else {
        await describeGitHubResponse(res);
      }

      markPending(kind);
      return false;
    } catch (e) {
      lastGitHubError = e && e.message
        ? `Network/browser error — ${e.message}`
        : 'Network/browser error while contacting GitHub. Check your connection and repository settings.';
      markPending(kind);
      return false;
    }
  }

  async function fetchAll() {
    if (!cfg.libraryPath) cfg.libraryPath = 'library.json';
    if (!cfg.wishlistPath) cfg.wishlistPath = 'wishlist.json';
    setStatus('Loading library.json…', null);
    const cacheValid = cacheState && sameRepo(cacheState.cfg, cfg);
    try {
      const libRes = await fetchFile('items');
      if (!libRes.ok) throw new Error('lib ' + libRes.status);
      const wishRes = await fetchFile('wishlist');
      if (!wishRes.ok) throw new Error('wish ' + wishRes.status);

      let items = normalizeItems(libRes.raw);
      let wishlist = normalizeWishlist(wishRes.raw);
      // migrate a wishlist that used to live embedded inside the old combined library file
      const legacyWishlist = (libRes.raw && !Array.isArray(libRes.raw) && Array.isArray(libRes.raw.wishlist)) ? libRes.raw.wishlist : null;
      let migrated = false;
      if (legacyWishlist && legacyWishlist.length && wishlist.length === 0) { wishlist = legacyWishlist; migrated = true; }

      data = { items, wishlist };
      ready = true;

      let resynced = false;
      if (cacheValid && cacheState.itemsPending) { data.items = cacheState.items; if (await pushFile('items')) resynced = true; }
      if (cacheValid && cacheState.wishlistPending) { data.wishlist = cacheState.wishlist; if (await pushFile('wishlist')) resynced = true; }
      if (migrated) { await pushFile('wishlist'); await pushFile('items'); }

      cacheState = { cfg, items: data.items, wishlist: data.wishlist, itemsPending: false, wishlistPending: false, timestamp: Date.now() };
      persistCache();
      setStatus(`Library loaded — ${data.items.filter(i => (i.mediaType || 'Movie') === 'Movie').length} movies, ${data.items.filter(i => i.mediaType === 'Series').length} series, ${data.items.filter(i => i.mediaType === 'BoxSet').length} collections, ${data.wishlist.length} on wishlist.${resynced ? ' Offline changes synced.' : ''}${migrated ? ' Wishlist moved to its own file.' : ''}`, 'ok');
    } catch (e) {
      if (cacheValid) {
        data = { items: cacheState.items, wishlist: cacheState.wishlist };
        ready = true;
        const when = cacheState.timestamp ? new Date(cacheState.timestamp).toLocaleString() : 'earlier';
        setStatus(`Offline — showing cached data from ${when}.${(cacheState.itemsPending || cacheState.wishlistPending) ? ' You have unsynced changes.' : ''}`, 'warn');
      } else {
        setStatus('Could not reach GitHub and no offline copy is saved yet.', 'err');
      }
    }
    renderAll();
  }
