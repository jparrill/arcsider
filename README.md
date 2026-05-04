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
make install   # install dev dependencies
make test      # run tests
make zip       # package extension
```

## Project structure

```
├── manifest.json      # Extension manifest (Manifest V3)
├── background.js      # Service worker: context menus, panel behavior
├── sidepanel.html     # Side panel UI
├── sidepanel.css      # Dark theme styles
├── sidepanel.js       # UI logic: tree, drag & drop, CRUD, import/export
├── lib.js             # Pure utility functions (shared with tests)
├── icons/             # Extension icons (16, 48, 128px)
└── test/              # Unit tests (vitest)
```

## License

[MIT](LICENSE)
