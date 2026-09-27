// ---- Check tab ----
  const checkInput = document.getElementById('checkInput');
  const checkResults = document.getElementById('checkResults');
  checkInput.addEventListener('input', () => {
    const q = checkInput.value.trim().toLowerCase();
    if (!q) { checkResults.innerHTML = ''; return; }
    const matches = data.items.filter(i => i.title.toLowerCase().includes(q));
    const wishMatch = data.wishlist.filter(i => i.title.toLowerCase().includes(q));
    let html = '';
    if (matches.length) {
      html += matches.map(m => `<div class="result own"><strong>✓ You own this</strong>${escapeHtml(m.title)} — ${m.format}</div>`).join('');
    } else {
      html += `<div class="result missing"><strong>Not in your library</strong>No match for "${escapeHtml(checkInput.value.trim())}" — safe to buy!</div>`;
    }
    if (wishMatch.length) {
      html += wishMatch.map(w => `<div class="result wish"><strong>📌 On your wishlist</strong>${escapeHtml(w.title)}</div>`).join('');
    }
    checkResults.innerHTML = html;
  });

  // ---- Barcode scanning ----
  let scanning = false;
  let scannerButton = null;
  let scannerBox = null;
  let scannerOnCode = null;
  const scanBox = document.getElementById('scanBox');
  const scanResult = document.getElementById('scanResult');

  async function lookupBarcode(code) {
    const clean = String(code || '').replace(/\D/g, '');
    if (!clean) return null;
    try {
      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(clean)}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store'
      });
      if (!res.ok) return null;
      const d = await res.json();
      const item = d && Array.isArray(d.items) ? d.items[0] : null;
      if (!item || !item.title) return null;
      return { title: item.title, ean: item.ean || clean, upc: item.upc || '', gtin: item.gtin || '', description: item.description || '' };
    } catch (e) { return null; }
  }

  async function handleCheckBarcode(code) {
    const clean = String(code || '').replace(/\D/g, '');
    const match = data.items.find(i => String(i.barcode || '').replace(/\D/g, '') === clean);
    if (match) {
      scanResult.innerHTML = `<div class="result own"><strong>✓ You own this</strong>${escapeHtml(match.title)} — ${escapeHtml(match.format || 'Unknown')}</div>`;
      return;
    }
    scanResult.innerHTML = `<div class="result" style="background:var(--panel);border:1px solid var(--line);"><strong>Looking up barcode…</strong>${escapeHtml(clean)}</div>`;
    const product = await lookupBarcode(clean);
    if (product) {
      scanResult.innerHTML = `<div class="result missing"><strong>Not in your library</strong>${escapeHtml(product.title)}<div style="margin-top:5px;font-size:12px;color:var(--ink-dim);">Barcode ${escapeHtml(clean)} — safe to buy, or add it in the Add tab.</div></div>`;
    } else {
      scanResult.innerHTML = `<div class="result missing"><strong>Not in your library</strong>Barcode ${escapeHtml(clean)} — no title was found in the barcode database. You can add it in the Add tab.</div>`;
    }
  }

  document.getElementById('scanBtn').addEventListener('click', () => {
    if (scanning) { stopScan(); return; }
    startScan(scanBox, document.getElementById('scanBtn'), code => handleCheckBarcode(code));
  });

  let scannerInitializing = false;
  function scannerMessage(boxEl, message, isError) {
    const addMode = boxEl && boxEl.id === 'scanBoxAdd';
    if (addMode) {
      const status = document.getElementById('addScanMsg');
      if (status) { status.style.color = isError ? 'var(--rust)' : 'var(--ink-dim)'; status.textContent = message; }
    } else {
      scanResult.innerHTML = `<div class="result ${isError ? 'missing' : ''}"><strong>${isError ? 'Scanner unavailable' : 'Scanner'}</strong>${escapeHtml(message)}</div>`;
    }
  }

  function startScan(boxEl, buttonEl, onCode) {
    if (scanning) stopScan();
    if (scannerInitializing) {
      scannerMessage(boxEl, 'The camera is still starting. Wait a moment, then try again.', true);
      return;
    }
    if (!window.Quagga) {
      scannerMessage(boxEl, 'The barcode scanner could not load. Check your internet connection and reload the app.', true);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      scannerMessage(boxEl, 'Camera access requires a secure page (HTTPS) and a browser that supports camera access.', true);
      return;
    }

    scannerButton = buttonEl; scannerBox = boxEl; scannerOnCode = onCode;
    scanning = true;
    scannerInitializing = true;
    boxEl.style.display = 'block';
    buttonEl.textContent = '✕ Stop scanning';
    try {
      Quagga.offDetected();
      Quagga.onDetected(d => {
        const code = d && d.codeResult && d.codeResult.code;
        if (!code || !scanning || scannerBox !== boxEl) return;
        const cb = scannerOnCode;
        stopScan();
        if (cb) cb(code);
      });
      Quagga.init({
        inputStream: { type: 'LiveStream', target: boxEl, constraints: { facingMode: { ideal: 'environment' } } },
        decoder: { readers: ['ean_reader', 'upc_reader', 'upc_e_reader', 'ean_8_reader'] }, locate: true
      }, err => {
        scannerInitializing = false;
        if (!scanning || scannerBox !== boxEl) { if (!scanning) Quagga.stop(); return; }
        if (err) {
          scannerMessage(boxEl, err.message || 'Camera unavailable — check camera permission and browser settings.', true);
          stopScan();
          return;
        }
        try { Quagga.start(); } catch (startError) {
          scannerMessage(boxEl, startError && startError.message ? startError.message : 'Could not start the camera stream.', true);
          stopScan();
        }
      });
    } catch (err) {
      scannerInitializing = false;
      scannerMessage(boxEl, err && err.message ? err.message : 'Could not start the camera scanner.', true);
      stopScan();
    }
  }

  function stopScan() {
    if (!scanning) return;
    scanning = false;
    try { if (window.Quagga) Quagga.stop(); } catch (e) {}
    if (scannerBox) scannerBox.querySelectorAll('video, canvas').forEach(el => el.remove());
    if (scannerButton) {
      scannerButton.textContent = scannerButton.id === 'addScanBtn' ? '📷 Scan barcode' : '📷 Scan a barcode instead';
    }
    if (scannerBox) scannerBox.style.display = 'none';
    scannerButton = scannerBox = scannerOnCode = null;
  }
