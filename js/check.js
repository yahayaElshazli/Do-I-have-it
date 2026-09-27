// ---- Check tab ----
  const checkInput = document.getElementById('checkInput');
  const checkResults = document.getElementById('checkResults');
  checkInput.addEventListener('input', () => {
    const q = checkInput.value.trim().toLowerCase();
    if (!q) checkResults.innerHTML = '';
    else {
      const matches = data.items.filter(i => i.title.toLowerCase().includes(q));
      if (matches.length) checkResults.innerHTML = matches.map(checkLibraryResult).join('');
      else checkResults.innerHTML = `<div class="result safe-buy"><strong>Safe to buy</strong>No match for "${escapeHtml(checkInput.value.trim())}" in your library.</div>`;
    }
    renderCheckWishlist();
  });

  function checkLibraryResult(item) {
    const title = escapeHtml(item.title);
    const format = escapeHtml(item.format || 'Unknown');
    const rating = Number(item.communityRating);
    if (String(item.format || '').trim().toLowerCase() === 'dvd' && Number.isFinite(rating) && rating > 7.5) {
      return `<div class="result upgrade"><strong>Worth upgrading</strong>${title} — DVD · ★ ${rating.toFixed(1)}</div>`;
    }
    return `<div class="result do-not-buy"><strong>Do not buy</strong>You already have ${title} — ${format}.</div>`;
  }
