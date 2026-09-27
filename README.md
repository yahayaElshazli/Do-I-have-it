# Do I Have It

A static film and disc library for GitHub Pages. The app is split into `index.html`, `css/`, and `js/`; there is no build step. Keep `library.json` and `wishlist.json` beside `index.html` in the published folder.

## Publish the app

Upload the full `do-i-have-it` folder contents to your GitHub Pages repository, preserving the `css/` and `js/` folders. The JSON data files should be in the same directory as `index.html`.

The app reads `library.json` and `wishlist.json` directly from the published site. GitHub settings are needed when you want to save changes. The two data files have separate purposes:

- `library.json` contains titles you own.
- `wishlist.json` contains titles you want to buy.

Adding and removing wishlist entries writes to `wishlist.json`, so GitHub write access is required. Existing wishlists embedded in the older combined library file are moved to `wishlist.json` when the app connects.

## GitHub settings

In the app’s Admin page, enter your GitHub username, repository name, and the paths to the two JSON files. Defaults are `library.json` and `wishlist.json`.

To let the app save changes, create a fine-grained personal access token in GitHub:

1. Open **Settings → Developer settings → Fine-grained tokens → Generate new token**.
2. Limit repository access to the repository containing the app and data files.
3. Under **Repository permissions**, set **Contents** to **Read and write**.
4. Copy the token into the Admin page and save settings.

The token is stored in this browser on this device. Do not share it or put it in a public file. Viewing the published library does not require the token.

## TMDB cover art

TMDB is used for cover images only. To enable automatic cover lookups:

1. Sign in to your TMDB account.
2. Open **Account settings → API**.
3. Copy the **API Read Access Token** into the Admin page and save settings.

The TMDB token is stored in this browser on this device. Wishlist covers are looked up when a TMDB token is configured and saved with the wishlist data when GitHub write settings are available. This product uses the TMDB API but is not endorsed or certified by TMDB. TMDB attribution terms apply.

## Import titles from Jellyfin

Use the Admin page’s **Import / update from Jellyfin** box to paste either one title per line or a Jellyfin JSON response. The JSON import can read movie, series, and BoxSet records and uses `MediaSources` for format and technical metadata.

To request a title list from Jellyfin without a plugin:

1. In Jellyfin, open **Dashboard → API Keys** and create an API key.
2. Find your user ID in **Dashboard → Users** by opening your user; the ID is in the page URL.
3. In a browser, visit the following address after replacing the server address, user ID, and API key:

   ```text
   http://SERVER:8096/Users/USER_ID/Items?api_key=API_KEY&Recursive=true&IncludeItemTypes=Movie,Series,BoxSet&CollapseBoxSetItems=false&Fields=MediaSources,ProviderIds,ParentId&SortBy=SortName
   ```

4. Copy the complete JSON response and paste it into the Admin import box.

Jellyfin is authoritative for collection membership. Use Jellyfin’s per-item collections endpoint (`/Items/{itemId}/Collections`) when reading collection membership; do not infer it from TMDB `TmdbCollection` IDs.

The import updates matching entries and adds new ones. It does not currently remove library entries just because they are absent from a later import; review the library after changing Jellyfin.

## Backups

Use **Export backup** in Admin to download a JSON backup of the library and wishlist. **Restore backup** merges its titles into the current data and saves them to GitHub.
