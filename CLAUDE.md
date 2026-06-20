# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A general-purpose character sheet platform for tabletop characters (D&D 5e in practice), built as a JSON-source-of-truth renderer/editor. `index.html` + `js/` is a stateless ES6-module front end; `character.json` inside a character folder is the canonical data. The same front end runs both as a static page in a browser and packaged as an Electron desktop app.

## Commands

- `npm start` / `npm run dev` — launch the Electron app (`electron .`)
- `npm run build` — package the app via `electron-builder` (outputs mac dmg/zip per `package.json` `build` config)
- No test suite, lint, or typecheck is configured in this repo.
- There is no bundler/dev server for the plain-browser path: open `index.html` directly, or serve the directory statically. JS is loaded as native ES6 modules (`<script type="module">`), so opening via `file://` works in browsers that allow module fetches from disk, but the File System Access API path (live read/write sync) only works on `http(s)://`/Electron, not `file://`.

## Architecture

### Two runtime environments, one front end

The same `js/` modules run in two hosts that provide character data differently:

- **Browser** (no Electron): uses the File System Access API (`showOpenFilePicker`/directory handles) and IndexedDB (`js/storage.js`) to remember and re-open the last `character.json` handle. Live sync writes happen via `FileSystemFileHandle.createWritable()`.
- **Electron**: `electron-main.js` does all filesystem work in the main process (via `fs/promises`) and exposes it to the renderer through `preload.js`'s `contextBridge` API (`window.electronAPI`). It maintains its own "recent directories" list (`userData/recent-directories.json`) and an app menu with "Open Recent". `js/character-data.js` checks `window.electronAPI` to decide which path to use — see `loadCharacterFromDirectoryPath`, `connectJson`, `tryAutoLoad`.

When adding a new persistence operation, it generally needs a counterpart in both `electron-main.js` (`ipcMain.handle(...)`) + `preload.js` (`contextBridge.exposeInMainWorld`) **and** a browser-only fallback using the File System Access API.

### Data flow / module responsibilities (`js/`)

- `state.js` — single global `state` object (current character, handles, sync/UI flags) and the `elements` map of DOM node lookups. Nearly every other module imports from here; there's no other shared state.
- `character-data.js` — load/save orchestration: `loadCharacterData()` sets `state.character` and triggers a render; `scheduleSave()` debounces writes (250ms) and only persists if `state.liveSync` is true; `openCharacterPayload`/`connectJson`/`tryAutoLoad` handle the Electron bundle vs. browser-handle flows.
- `storage.js` — IndexedDB handle persistence + File System Access API helpers (browser-only path).
- `image-handler.js` — builds the `imageManifest` (list of images for the character) either from the Electron-provided manifest or from `data.assets.images` in the JSON; images are always sorted alphabetically by filename.
- `render.js` — `renderCharacter()` is the single function that re-renders the whole sheet from `state.character`; called after every load and after every data mutation.
- `session.js` — reads/writes the "session" portion of the character (HP, slots, inventory qty, currencies) between the DOM form fields and `state.character.session` / `inventory`.
- `events.js` — all `addEventListener` wiring lives here, plus `window.characterPlatform` (a small global API for programmatic load/get of character data, e.g. from devtools or external scripts).
- `portrait.js`, `lightbox.js` — portrait carousel and full-screen image viewer, both driven by the `imageManifest`.
- `ui-controls.js` — table-of-contents (TOC) collapse/expand/overlay behavior and responsive sync.
- `theme.js` — cycles between `dark`/`night`/`light` themes (Mihon-style), persisted to `localStorage`, applied via `document.body[data-theme]`.
- `main.js` — wires everything together at startup: initializes modules, binds events, attempts auto-load of the last character.

There is no `utils.js`/`render.js` re-export layer beyond what's described — read the module directly rather than guessing at indirection.

### Character JSON contract

A character lives in its own folder: `character.json` + `images/` (read in alphabetical filename order; `meta.portrait.src` picks the active one). `pg.example/` is the canonical template to copy for new characters. Top-level JSON sections: `schemaVersion`, `platform`, `meta`, `identity`, `build`, `combat`, `spellSections`, `reminders`, `features`, `inventory`, `origin`, `narrative`, `session`.

Rules that matter when editing character data (also encoded in `.github/agents/*.agent.md`):

- **`character.json` is the single source of truth; `index.html`/JS is a stateless renderer.** Don't hardcode character-specific content into the HTML/JS — it must come from the JSON.
- **Session vs. structural data**: `session.resources` and `inventory.currencies` are live play-state the UI updates continuously. Everything else (build, levels, spells, features, inventory structure) is persistent data that should only change on an explicit level-up/edit, never silently from a render.
- Preserve all existing JSON fields when editing — don't drop fields that aren't part of the requested change.
- Preserve clickable `link` properties on spells, feats, weapons, background, class features, etc.
- Images stay in `images/` with alphabetically-sortable filenames; the UI scans the folder automatically and never expects a hardcoded image list outside the manifest.

### Custom agents

`.github/agents/` defines two specialized D&D 5e rules agents (`dnd-5e-character-expert`, `dnd-5e-warlock-tome-draconide`) for character-building/optimization questions. They encode the same `character.json`-is-canonical workflow described above.
