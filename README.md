# Arcsider

Arc-like sidebar extension for Chromium browsers (Chrome, Brave, Edge).

Organize your links in nested folders with drag & drop, pinned shortcuts, and open tab management — all in a persistent side panel.

## Features

- **Nested folders** — unlimited depth, drag & drop reordering
- **Pinned grid** — pin frequently used links as favicon squares at the top
- **Open tabs** — see current tabs and drag them into folders
- **Smart tab focus** — clicking a link activates the matching tab instead of opening a duplicate
- **Arc Browser import** — import your spaces, folders, and pinned items from Arc's `StorableSidebar.json`
- **Export / Import** — backup and restore your sidebar as JSON
- **Keyboard shortcut** — `Alt+S` to toggle the panel
- **Context menus** — right-click in the browser to add pages or links directly
- **Dark theme** — clean dark UI inspired by Arc

## Install

### From source (developer mode)

1. Clone this repo
2. Open `chrome://extensions` (or `brave://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select this directory
5. Click the Arcsider icon or press `Alt+S` to open the side panel

### From zip

1. Download `arcsider.zip` from [Releases](../../releases)
2. Unzip it
3. Load it as unpacked extension (see above)

## Development

```bash
make test      # run tests (zero dependencies, uses node:test)
make zip       # package extension
make help      # show all targets
```

## Releasing

1. Bump version in `manifest.json`
2. Tag and push:

```bash
make release VERSION=1.1.0
```

This updates `manifest.json`, commits, tags `v1.1.0`, and pushes. The GitHub Actions pipeline will:
- Run tests
- Create a GitHub Release with `arcsider.zip` attached
- Upload and publish to Chrome Web Store (if configured)

### Chrome Web Store setup (one-time)

1. Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) ($5 one-time)
2. Upload the extension manually for the first time
3. Create an OAuth2 client at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Desktop app type)
4. Get a refresh token using the [chrome-webstore-upload guide](https://github.com/nicolo-ribaudo/chrom-ext-deploy#chrome-web-store)
5. Add these GitHub repo secrets (`Settings > Secrets > Actions`):
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`
   - `CHROME_EXTENSION_ID` (from the dashboard URL)

If the secrets are not set, the pipeline still creates the GitHub Release — the Chrome Web Store step is skipped.

## Project structure

```
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Service worker: context menus, panel behavior
├── sidepanel.html     # Side panel UI
├── sidepanel.css      # Dark theme styles
├── sidepanel.js       # UI logic: tree, drag & drop, CRUD, import/export
├── lib.js             # Pure utility functions (shared with tests)
├── icons/             # Extension icons (16, 48, 128px)
├── test/              # Unit tests (node:test, zero deps)
└── .github/workflows/ # CI + Release pipelines
```

## License

[MIT](LICENSE)
