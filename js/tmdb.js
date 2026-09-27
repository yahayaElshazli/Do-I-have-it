let lastCoverError = '';
  async function fetchCover(title, format, releaseDate) {
    lastCoverError = '';
    if (!cfg.tmdbToken) {
      lastCoverError = 'No TMDB token is saved. Enter it in Admin and save settings.';
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const token = cfg.tmdbToken.trim();
      const headers = { Accept: 'application/json' };
      if (token.startsWith('eyJ')) headers.Authorization = `Bearer ${token}`;

      async function search(path, params) {
        let url = 'https://api.themoviedb.org/3/' + path +
          '?' + new URLSearchParams({ ...params, language: 'en-GB', page: '1' }).toString();
        if (!token.startsWith('eyJ')) url += '&api_key=' + encodeURIComponent(token);
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) {
          let detail = '';
          try { detail = await res.text(); } catch (e) {}
          throw new Error(`TMDB returned HTTP ${res.status}${detail ? ': ' + detail.slice(0, 180) : ''}`);
        }
        const d = await res.json();
        if (d && d.status_code && d.status_message) throw new Error(`TMDB: ${d.status_message}`);
        return Array.isArray(d.results) ? d.results : [];
      }

      const cleanTitle = title.replace(/\s+collection\s*$/i, '').trim();
      const releaseYear = String(releaseDate || '').match(/\d{4}/)?.[0] || '';
      const looksLikeCollection = (format || '').toLowerCase() === 'box set' || /\bcollection\b/i.test(title);

      // Box sets such as "Shrek Collection" are TMDB collections, not movies.
      if (looksLikeCollection) {
        const collections = await search('search/collection', { query: cleanTitle, include_adult: 'false' });
        const collection = collections.find(x => x && x.poster_path) || null;
        if (collection) return `https://image.tmdb.org/t/p/w500${collection.poster_path}`;
      }

      // Match movie posters against the known release year to avoid picking
      // another film with the same or a similar title.
      const movieParams = { query: cleanTitle, include_adult: 'false' };
      if (releaseYear) movieParams.primary_release_year = releaseYear;
      let movies = await search('search/movie', movieParams);
      let movie = movies.find(x => x && x.poster_path && (!releaseYear || !x.release_date || x.release_date.startsWith(releaseYear))) || null;
      if (!movie && releaseYear) {
        movies = await search('search/movie', { query: cleanTitle, include_adult: 'false' });
        movie = movies.find(x => x && x.poster_path && x.release_date && x.release_date.startsWith(releaseYear)) || null;
      }
      if (movie) return `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

      // TV series such as "The Big Bang Theory" use their first air year.
      const showParams = { query: cleanTitle, include_adult: 'false' };
      if (releaseYear) showParams.first_air_date_year = releaseYear;
      let shows = await search('search/tv', showParams);
      let show = shows.find(x => x && x.poster_path && (!releaseYear || !x.first_air_date || x.first_air_date.startsWith(releaseYear))) || null;
      if (!show && releaseYear) {
        shows = await search('search/tv', { query: cleanTitle, include_adult: 'false' });
        show = shows.find(x => x && x.poster_path && x.first_air_date && x.first_air_date.startsWith(releaseYear)) || null;
      }
      if (show) return `https://image.tmdb.org/t/p/w500${show.poster_path}`;

      // If a collection-shaped title didn't match as a collection above,
      // retry the original title against movies/TV before giving up.
      if (cleanTitle !== title) {
        const originalMovies = await search('search/movie', { query: title, include_adult: 'false' });
        const originalMovie = originalMovies.find(x => x && x.poster_path) || null;
        if (originalMovie) return `https://image.tmdb.org/t/p/w500${originalMovie.poster_path}`;
      }

      lastCoverError = `No TMDB poster found for "${title}".`;
      return null;
    } catch (e) {
      lastCoverError = e && e.name === 'AbortError'
        ? 'TMDB request timed out.'
        : (e && e.message ? e.message : 'Could not reach TMDB.');
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
