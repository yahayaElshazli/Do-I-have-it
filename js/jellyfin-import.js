function guessFormat(o) {
    if (o.Type === 'BoxSet') return 'Box set';
    const streams = o.MediaSources && o.MediaSources[0] && o.MediaSources[0].MediaStreams;
    const video = streams && streams.find(s => s.Type === 'Video');
    const height = o.Height || (video && video.Height) || null;
    if (!height) return 'Unknown';
    if (height >= 1600) return '4K UHD';
    if (height >= 720) return 'Blu-ray';
    return 'DVD';
  }

  function looksLikeJson(raw) {
    return /"Items"\s*:|"Name"\s*:|"MediaSources"\s*:/.test(raw);
  }
  function tryParseJson(raw) {
    const trimmed = raw.trim();
    const candidates = [trimmed];
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) candidates.push('{' + trimmed + '}');
    const all = candidates.flatMap(c => [c, c.replace(/,\s*([}\]])\s*$/, '$1')]);
    for (const c of all) { try { return JSON.parse(c); } catch (e) {} }
    return null;
  }

  function extractJellyfinMeta(o) {
    const src = o && o.MediaSources && o.MediaSources[0] ? o.MediaSources[0] : null;
    const streams = src && Array.isArray(src.MediaStreams) ? src.MediaStreams : [];
    const video = streams.find(x => x && x.Type === 'Video') || null;
    const audio = streams.find(x => x && x.Type === 'Audio') || null;
    const user = o && o.UserData ? o.UserData : {};
    const runtimeTicks = o && o.RunTimeTicks || (src && src.RunTimeTicks) || 0;
    return {
      productionYear: o && o.ProductionYear || null,
      premiereDate: o && o.PremiereDate || null,
      officialRating: o && o.OfficialRating || null,
      communityRating: o && o.CommunityRating || null,
      criticRating: o && o.CriticRating || null,
      runtimeMinutes: runtimeTicks ? Math.round(runtimeTicks / 600000000) : null,
      container: o && o.Container || (src && src.Container) || null,
      fileSize: src && src.Size || null,
      videoLabel: video && (video.DisplayTitle || `${video.Height || ''}p ${video.Codec || ''}`.trim()) || null,
      videoWidth: video && video.Width || null,
      videoHeight: video && video.Height || null,
      videoCodec: video && video.Codec || null,
      audioLabel: audio && audio.DisplayTitle || null,
      audioCodec: audio && audio.Codec || null,
      hasSubtitles: !!(o && o.HasSubtitles),
      played: !!user.Played,
      playCount: Number(user.PlayCount || 0),
      lastPlayed: user.LastPlayedDate || null,
      mediaType: o && o.Type || null,
      status: o && o.Status || null,
      unplayedCount: user.UnplayedItemCount != null ? Number(user.UnplayedItemCount) : null,
      providerIds: o && o.ProviderIds ? { ...o.ProviderIds } : {},
      collectionId: o && o.ProviderIds ? (o.ProviderIds.TmdbCollection || null) : null,
      jellyfinId: o && o.Id ? String(o.Id) : null
    };
  }

  function normalizeImportedItem(o) {
    const meta = extractJellyfinMeta(o || {});
    const mediaType = (o && o.Type) || meta.mediaType || 'Movie';
    const providerIds = o && o.ProviderIds ? { ...o.ProviderIds } : (meta.providerIds || {});
    const collectionId = mediaType === 'BoxSet' ? (providerIds.TmdbCollection || providerIds.Tmdb || meta.collectionId || null) : (providerIds.TmdbCollection || meta.collectionId || null);
    return {
      title: (o && (o.Name || o.name || o.title)) || '',
      format: guessFormat(o || {}),
      ...meta,
      mediaType,
      providerIds,
      collectionId,
      jellyfinCollectionIds: Array.isArray(o && o.JellyfinCollectionIds) ? o.JellyfinCollectionIds.map(String) : (Array.isArray(o && o.jellyfinCollectionIds) ? o.jellyfinCollectionIds.map(String) : []),
      jellyfinCollectionNames: Array.isArray(o && o.JellyfinCollectionNames) ? o.JellyfinCollectionNames.slice() : (Array.isArray(o && o.jellyfinCollectionNames) ? o.jellyfinCollectionNames.slice() : [])
    };
  }

  function extractItems(raw) {
    raw = raw.trim();
    if (!raw) return { items: [], jsonError: false };
    if (looksLikeJson(raw)) {
      const parsed = tryParseJson(raw);
      if (parsed) {
        const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.Items) ? parsed.Items : null);
        if (arr) return { items: arr.map(normalizeImportedItem).filter(x => x.title), jsonError: false };
      }
      return { items: [], jsonError: true };
    }
    return { items: raw.split(/\r?\n/).flatMap(l => l.split(',')).map(s => s.trim()).filter(Boolean).map(t => ({ title: t, format: 'Unknown' })), jsonError: false };
  }
