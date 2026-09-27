function renderAll() {
    renderLibrary();
    renderWishlist();
    if (checkInput.value.trim()) checkInput.dispatchEvent(new Event('input'));
  }

  document.getElementById('ghConnectBtn').addEventListener('click', () => {
    cfg = {
      owner: document.getElementById('ghOwner').value.trim(),
      repo: document.getElementById('ghRepo').value.trim(),
      libraryPath: document.getElementById('ghPath').value.trim() || 'library.json',
      wishlistPath: document.getElementById('ghWishPath').value.trim() || 'wishlist.json',
      token: document.getElementById('ghToken').value.trim(),
      tmdbToken: document.getElementById('tmdbToken').value.trim()
    };
    if (!readConfigComplete(cfg)) { setStatus('Enter your GitHub username, repository and file paths first.', 'err'); return; }
    saveConfig(cfg);
    });
  document.getElementById('resyncBtn').addEventListener('click', fetchAll);

  if (cfg.owner) document.getElementById('ghOwner').value = cfg.owner;
  if (cfg.repo) document.getElementById('ghRepo').value = cfg.repo;
  if (cfg.libraryPath) document.getElementById('ghPath').value = cfg.libraryPath;
  if (cfg.wishlistPath) document.getElementById('ghWishPath').value = cfg.wishlistPath;
  if (cfg.token) document.getElementById('ghToken').value = cfg.token;
  if (cfg.tmdbToken) document.getElementById('tmdbToken').value = cfg.tmdbToken;


// ---- Backup export / restore (covers both files) ----
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'do-i-have-it-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFile').click());
  document.getElementById('restoreFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const msg = document.getElementById('backupMsg');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incomingItems = normalizeItems(parsed);
        const incomingWishlist = normalizeWishlist(parsed);
        const existing = new Set(data.items.map(i => i.title.toLowerCase()));
        let added = 0;
        incomingItems.forEach(i => {
          if (i && i.title && !existing.has(i.title.toLowerCase())) {
            data.items.push({ ...i, id: i.id || Date.now().toString(36) + Math.random().toString(36).slice(2,6), title: i.title, format: i.format || 'Unknown', barcode: i.barcode || '', cover: i.cover || null, added: i.added || new Date().toISOString() });
            existing.add(i.title.toLowerCase());
            added++;
          }
        });
        const wExisting = new Set(data.wishlist.map(i => i.title.toLowerCase()));
        let addedWish = 0;
        incomingWishlist.forEach(i => { if (i && i.title && !wExisting.has(i.title.toLowerCase())) { data.wishlist.push(i); wExisting.add(i.title.toLowerCase()); addedWish++; } });
        renderAll();
        msg.style.color = 'var(--ink-dim)'; msg.textContent = 'Saving to GitHub…';
        const okItems = await pushFile('items');
        const okWish = addedWish ? await pushFile('wishlist') : true;
        const ok = okItems && okWish;
        msg.style.color = ok ? 'var(--teal)' : 'var(--rust)';
        msg.textContent = ok ? `Restored ${added} title${added===1?'':'s'} and ${addedWish} wishlist item${addedWish===1?'':'s'}.` : 'Merged locally, but could not save everything to GitHub. Try again.';
      } catch (err) {
        msg.style.color = 'var(--rust)'; msg.textContent = "That file didn't look like a valid backup.";
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---- Wishlist tab ----
  function renderWishlist() {
    const wishList = document.getElementById('wishList');
    const items = [...data.wishlist].sort((a,b) => a.title.localeCompare(b.title));
    if (!items.length) { wishList.innerHTML = `<div class="empty">${!ready ? 'Open Admin to configure GitHub saving.' : 'Nothing on your wishlist yet.'}</div>`; return; }
    wishList.innerHTML = items.map(i => `
      <div class="libitem">
        <div class="meta"><div class="title">${escapeHtml(i.title)}</div></div>
        <button data-id="${i.id}" class="delw">Remove</button>
      </div>`).join('');
    wishList.querySelectorAll('.delw').forEach(b => b.addEventListener('click', async () => {
      const prev = data.wishlist;
      data.wishlist = data.wishlist.filter(i => i.id !== b.dataset.id);
      renderWishlist();
      if (!(await pushFile('wishlist'))) { data.wishlist = prev; renderWishlist(); }
    }));
  }
  document.getElementById('wishAddBtn').addEventListener('click', async () => {
    const title = document.getElementById('wishTitle').value.trim();
    const msg = document.getElementById('wishMsg');
    if (!configComplete(cfg)) { msg.style.color = 'var(--rust)'; msg.textContent = 'Open Admin to configure GitHub saving.'; return; }
    if (!title) { msg.style.color = 'var(--rust)'; msg.textContent = 'Enter a title first.'; return; }
    data.wishlist.push({ id: Date.now().toString(36), title, added: new Date().toISOString() });
    msg.style.color = 'var(--ink-dim)'; msg.textContent = 'Saving to GitHub…';
    const ok = await pushFile('wishlist');
    msg.style.color = ok ? 'var(--teal)' : 'var(--rust)';
    msg.textContent = ok ? `Added "${title}" to your wishlist.` : (lastGitHubError || 'Could not save to GitHub. Try again.');
    if (ok) document.getElementById('wishTitle').value = '';
    renderWishlist();
  });

  // ---- Add tab ----
  const addTitle = document.getElementById('addTitle');
  const dupWarn = document.getElementById('dupWarn');
  addTitle.addEventListener('input', () => {
    const q = addTitle.value.trim().toLowerCase();
    if (q.length < 3) { dupWarn.style.display = 'none'; return; }
    const match = data.items.find(i => i.title.toLowerCase().includes(q) || q.includes(i.title.toLowerCase()));
    if (match) { dupWarn.style.display = 'block'; dupWarn.textContent = `⚠ You might already have "${match.title}".`; }
    else dupWarn.style.display = 'none';
  });

  document.getElementById('addScanBtn').addEventListener('click', () => {
    const host = document.getElementById('addScanHost');
    const btn = document.getElementById('addScanBtn');
    if (scanning) { stopScan(); host.innerHTML=''; return; }
    host.innerHTML = '<div id="scanBoxAdd" class="scanner-viewport" style="display:block;"><div class="scanline"></div></div><p id="addScanMsg" style="color:var(--ink-dim);font-size:12px;margin-top:8px;">Point the camera at the barcode.</p>';
    startScan(document.getElementById('scanBoxAdd'), btn, async code => {
      document.getElementById('addBarcode').value = code;
      const msg = document.getElementById('addScanMsg');
      msg.textContent = 'Looking up title…';
      const product = await lookupBarcode(code);
      if (product.title) {
        const libraryMatch = findLibraryTitle(product.title);
        const title = libraryMatch ? libraryMatch.title : product.title;
        document.getElementById('addTitle').value = title;
        document.getElementById('addTitle').dispatchEvent(new Event('input'));
        msg.style.color = libraryMatch ? 'var(--teal)' : 'var(--ink-dim)';
        msg.textContent = libraryMatch ? `Already in your library: ${title}` : `Found: ${title}`;
      } else {
        msg.style.color = 'var(--rust)';
        msg.textContent = product.message;
      }
    });
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const title = addTitle.value.trim();
    const format = document.getElementById('addFormat').value;
    const barcode = document.getElementById('addBarcode').value.trim();
    const msg = document.getElementById('saveMsg');
    if (!configComplete(cfg)) { msg.style.color = 'var(--rust)'; msg.textContent = 'Open Admin to configure GitHub saving.'; return; }
    if (!title) { msg.style.color = 'var(--rust)'; msg.textContent = 'Enter a title first.'; return; }
    msg.style.color = 'var(--ink-dim)'; msg.textContent = 'Fetching cover…';
    const cover = await fetchCover(title, format);
    data.items.push({ id: Date.now().toString(36), title, format, barcode, cover, added: new Date().toISOString(), productionYear: null, premiereDate: null, officialRating: null, communityRating: null, criticRating: null, runtimeMinutes: null, container: null, fileSize: null, videoLabel: null, videoWidth: null, videoHeight: null, videoCodec: null, audioLabel: null, audioCodec: null, hasSubtitles: false, played: false, playCount: 0, lastPlayed: null, mediaType: 'Movie', status: null, unplayedCount: null, providerIds: {}, collectionId: null, jellyfinId: null, jellyfinCollectionIds: [], jellyfinCollectionNames: [] });
    msg.textContent = 'Saving to GitHub…';
    const ok = await pushFile('items');
    msg.style.color = ok ? 'var(--teal)' : 'var(--rust)';
    msg.textContent = ok ? `Added "${title}" to your library.` : (lastGitHubError || 'Could not save to GitHub. Try again.');
    if (ok) { addTitle.value = ''; document.getElementById('addBarcode').value = ''; dupWarn.style.display = 'none'; }
    renderLibrary();
  });

  // ---- Import tab ----
  document.getElementById('importBtn').addEventListener('click', async () => {
    const raw = document.getElementById('importText').value;
    const msg = document.getElementById('importMsg');
    if (!configComplete(cfg)) { msg.style.color = 'var(--rust)'; msg.textContent = 'Set up your GitHub repository above first.'; return; }
    const incoming = extractItems(raw);
    if (incoming.jsonError) { msg.style.color = 'var(--rust)'; msg.textContent = "That looked like Jellyfin JSON but wasn't complete — copy the entire response, starting from the very first { and ending at the final }."; return; }
    const list = incoming.items;
    if (!list.length) { msg.style.color = 'var(--rust)'; msg.textContent = 'Could not find any titles in that text.'; return; }
    // Jellyfin may return a Movie and a BoxSet with the same title (for
    // example, Dune). Include type and year in the identity so the collection
    // record cannot overwrite the movie that the Library displays.
    const importKey = i => `${i.mediaType || 'Movie'}|${String(i.title || '').trim().toLowerCase()}|${i.productionYear || ''}`;
    const existing = new Map(data.items.map(i => [importKey(i), i]));
    const fresh = [];
    let updated = 0;
    list.forEach(t => {
      const key = importKey(t);
      const existingItem = existing.get(key);
      if (existingItem) {
        Object.keys(t).forEach(k => {
          if (k !== 'title' && k !== 'format' && t[k] !== null && t[k] !== '' && t[k] !== undefined) existingItem[k] = t[k];
        });
        if ((!existingItem.format || existingItem.format === 'Unknown') && t.format) existingItem.format = t.format;
        updated++;
      } else {
        fresh.push({ ...t, id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), title: t.title, format: t.format || 'Unknown', barcode: '', cover: null, added: new Date().toISOString() });
        existing.set(key, fresh[fresh.length - 1]);
      }
    });
    for (let i = 0; i < fresh.length; i++) {
      msg.style.color = 'var(--ink-dim)';
      msg.textContent = `Fetching covers… (${i+1}/${fresh.length})`;
      fresh[i].cover = await fetchCover(fresh[i].title, fresh[i].format, fresh[i].productionYear || fresh[i].premiereDate);
    }
    data.items.push(...fresh);
    msg.textContent = 'Saving to GitHub…';
    const ok = await pushFile('items');
    msg.style.color = ok ? 'var(--teal)' : 'var(--rust)';
    msg.textContent = ok ? `Updated ${updated} existing item${updated===1?'':'s'} and added ${fresh.length} new item${fresh.length===1?'':'s'} (movies, series and collections).` : (lastGitHubError || 'Could not save to GitHub. Try again.');
    if (ok) document.getElementById('importText').value = '';
    renderLibrary();
  });

fetchAll();
