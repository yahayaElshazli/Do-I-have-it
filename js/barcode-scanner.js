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
      html += matches.map(checkLibraryResult).join('');
    } else {
      html += `<div class="result safe-buy"><strong>Safe to buy</strong>No match for "${escapeHtml(checkInput.value.trim())}" in your library.</div>`;
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
  let scannerCandidateCode = null;
  let scannerCandidateCount = 0;
  const scanBox = document.getElementById('scanBox');
  const scanResult = document.getElementById('scanResult');

  function checkLibraryResult(item) {
    const title = escapeHtml(item.title);
    const format = escapeHtml(item.format || 'Unknown');
    const rating = Number(item.communityRating);
    if (String(item.format || '').trim().toLowerCase() === 'dvd' && Number.isFinite(rating) && rating > 7.5) {
      return `<div class="result upgrade"><strong>Worth upgrading</strong>${title} — DVD · ★ ${rating.toFixed(1)}</div>`;
    }
    return `<div class="result do-not-buy"><strong>Do not buy</strong>You already have ${title} — ${format}.</div>`;
  }

  async function lookupBarcode(code) {
    const clean = String(code || '').replace(/\D/g, '');
    if (!clean) return { error: 'invalid', message: 'The scanner did not read a valid barcode. Try again with the full barcode inside the frame.' };
    try {
      const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(clean)}`, {
        headers: { Accept: 'application/json' }, cache: 'no-store'
      });
      let d = null;
      try { d = await res.json(); } catch (e) {}
      if (!res.ok) {
        const detail = d && (d.message || d.reason || d.code);
        return { error: 'http', message: `The barcode lookup service returned HTTP ${res.status}${detail ? ` (${detail})` : ''}. Please try again later or enter the title manually.` };
      }
      if (d && d.code && !['OK', 'SUCCESS'].includes(String(d.code).toUpperCase())) {
        const codeText = String(d.code).toUpperCase();
        const message = d.message || d.reason || '';
        const limited = /limit|rate/i.test(`${codeText} ${message}`);
        return { error: limited ? 'limited' : 'lookup', message: limited ? 'The free barcode lookup limit has been reached. Try again later or enter the title manually.' : 'The barcode service could not look up this code. Try again later or enter the title manually.' };
      }
      const item = d && Array.isArray(d.items) ? d.items[0] : null;
      if (!item || !item.title) return { error: 'not-found', message: 'This barcode was read, but the free product database has no title for this disc. You can search for it by title or add it manually.' };
      return { title: item.title, ean: item.ean || clean, upc: item.upc || '', gtin: item.gtin || '', description: item.description || '' };
    } catch (e) {
      // Browsers intentionally hide CORS and mixed-content details from scripts.
      // Do not expose exception text because it can contain request details.
      return { error: 'network', message: 'The barcode lookup could not be reached. Check your internet connection or browser restrictions, then try again.' };
    }
  }

  function normalizedTitle(title) {
    return String(title || '')
      .normalize('NFKD')
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/\b(?:dvd|blu[ -]?ray|4k|uhd|region\s*[0-9a-z]+|\d{4})\b/gi, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/^(?:the|a|an)\s+/, '')
      .trim();
  }

  function findLibraryTitle(title) {
    const key = normalizedTitle(title);
    if (!key) return null;
    return data.items.find(i => i.mediaType !== 'BoxSet' && normalizedTitle(i.title) === key) || null;
  }

  function barcodeMatches(savedCode, scannedCode) {
    const saved = String(savedCode || '').replace(/\D/g, '');
    const scanned = String(scannedCode || '').replace(/\D/g, '');
    return !!saved && (saved === scanned || (saved.length === 12 && `0${saved}` === scanned) || (scanned.length === 12 && `0${scanned}` === saved));
  }

  function showOwnedBarcodeMatch(item) {
    scanResult.innerHTML = checkLibraryResult(item);
  }

  async function handleCheckBarcode(code) {
    const clean = String(code || '').replace(/\D/g, '');
    const codeMatch = data.items.find(i => i.mediaType !== 'BoxSet' && barcodeMatches(i.barcode, clean));
    if (codeMatch) { showOwnedBarcodeMatch(codeMatch); return; }

    scanResult.innerHTML = '<div class="result" style="background:var(--panel);border:1px solid var(--line);"><strong>Looking up disc title…</strong>Please wait.</div>';
    const product = await lookupBarcode(clean);
    const libraryMatch = product.title && findLibraryTitle(product.title);
    if (libraryMatch) { showOwnedBarcodeMatch(libraryMatch); return; }
    if (product.title) {
      scanResult.innerHTML = `<div class="result safe-buy"><strong>Safe to buy</strong>${escapeHtml(product.title)}<div style="margin-top:5px;font-size:12px;color:var(--ink-dim);">This title was not found in your library. You can add it from the Add tab.</div></div>`;
    } else {
      scanResult.innerHTML = `<div class="result missing"><strong>${product.error === 'not-found' ? 'Barcode read, title unavailable' : 'Barcode lookup unavailable'}</strong>${escapeHtml(product.message)}<button type="button" id="scanAddManually" class="btn-secondary" style="margin-top:10px;width:100%;">Enter title manually</button></div>`;
      document.getElementById('scanAddManually').addEventListener('click', () => {
        document.getElementById('addBarcode').value = clean;
        document.querySelector('nav button[data-tab="add"]').click();
        document.getElementById('addTitle').focus();
      });
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
    scannerCandidateCode = null;
    scannerCandidateCount = 0;
    boxEl.style.display = 'block';
    buttonEl.textContent = '✕ Stop scanning';
    try {
      Quagga.offDetected();
      Quagga.onDetected(d => {
        const code = d && d.codeResult && d.codeResult.code;
        if (!code || !scanning || scannerBox !== boxEl) return;
        if (code === scannerCandidateCode) scannerCandidateCount++;
        else { scannerCandidateCode = code; scannerCandidateCount = 1; }
        // Require two matching frames so a one-frame digit misread is less
        // likely to send the wrong product code to the lookup service.
        if (scannerCandidateCount < 2) return;
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
    scannerCandidateCode = null; scannerCandidateCount = 0;
  }
