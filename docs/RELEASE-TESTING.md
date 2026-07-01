# Release testing checklist

Manual smoke test before publishing a draft Release. The app's schema/model layer is covered by
unit tests (`npm test`) and the web build is exercised in CI, but three things **can only be
verified on real targets** and have burned us before: macOS Gatekeeper, Android SAF storage, and
touch interaction. Run the relevant sections against the draft Release artifacts, then publish.

Legend: ☐ = check on the built artifact from the draft Release (not `npm run dev`).

## macOS (`.dmg` / `.app`)
- ☐ Download the `.dmg` from the draft Release in a browser (so it gets the quarantine flag).
- ☐ First launch: right-click → Open → Open. **It must launch** — no "damaged and can't be
  opened". (If it says "damaged", the ad-hoc signing in `release.yml` regressed.)
- ☐ Open a character `character.json`; edit HP; confirm it saves in place (reopen shows the change).
- ☐ Open a character *folder* — portrait shows.
- ☐ Roll dice; drag one; tap to dismiss.

## Windows (`.msi` / `.exe`)
- ☐ Install and launch (SmartScreen "more info → run anyway" is expected — unsigned).
- ☐ Open `character.json`, edit, save; reopen from Recents.
- ☐ Dice roll / drag / dismiss.

## Android (`.apk`) — the SAF storage path (highest-risk)
- ☐ Sideload the APK (enable "install unknown apps"). Icon is the JUGALE icon, app is not "debug".
- ☐ **Open folder**: pick a character folder on local device storage → sheet + portrait load
  (no "Invalid JSON").
- ☐ **Save in place**: edit HP/resources → it persists to the original file (reopen the file in a
  file manager or reload to confirm; status is *not* stuck on read-only).
- ☐ **Reopen from Recents after fully closing the app** (swipe it away, relaunch) → the character
  reopens writable without re-picking. (This proves the persisted SAF permission.)
- ☐ **Open single file** (`character.json` directly): loads; edits save.
- ☐ Google Drive file (known limitation): opening may work but saving can fail → app should fall
  back to **read-only + "Export to save"**, not crash.
- ☐ Top bar clears the status bar / notch (safe-area).
- ☐ **Dice on a button**: roll a die so it rests over a button; tap/hold the die → only the die
  reacts, the button underneath does **not** fire.

## Web on mobile (the Pages site from a phone browser)
- ☐ Open the live site on a phone.
- ☐ **Dice on a button**: same as above — tapping a die over a button must not trigger the button.
- ☐ Open a `character.json` (read-only import path); dice work.

## Auto-update (once shipped)
- ☐ Desktop: install the previous version, then release a newer tag → the app detects the update.
- ☐ Android: previous version installed → in-app banner points to the new APK on Releases.

---

When all relevant boxes pass, publish the draft Release (`gh release edit <tag> --draft=false
--latest`). If a native build shows a blank window, suspect the Tauri CSP — rollback is one line
(`csp` → `null` in `src-tauri/tauri.conf.json`, see [ARCHITECTURE.md §9](ARCHITECTURE.md)).
