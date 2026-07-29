# Release testing checklist

Manual smoke test before publishing a draft Release. The app's schema/model layer is covered by
unit tests (`npm test`) and the web build is exercised in CI, but three things **can only be
verified on real targets** and have burned us before: macOS Gatekeeper, Android SAF storage, and
touch interaction. Run the relevant sections against the draft Release artifacts, then publish.

Legend: ☐ = check on the built artifact from the draft Release (not `npm run dev`).

## Help Center (all targets)
- ☐ Open Help from the welcome screen and again with a character open (direct `?` or the `…`
  overflow). The home shows one grid of six distinct topics without duplicate sections or
  horizontal overflow.
- ☐ Open every topic; advanced details start collapsed, breadcrumb and task links work, and the
  URL hash is `#help/<topic>`. Back/Escape first returns to the Help home, then closes Help.
- ☐ Screenshots match the current UI, use the selected language and load offline. On **Use the
  character sheet**, the four-screen gallery scrolls horizontally without moving the whole page.
- ☐ Switch EN/IT while a topic is open. Content changes without reload and retains the same topic.
- ☐ On Android at 80%, 100% and 120% UI scale, verify cards, long titles, accordions and bottom
  navigation remain readable and tappable.

## macOS (`.dmg` / `.app`)
- ☐ Download the `.dmg` from the draft Release in a browser (so it gets the quarantine flag).
- ☐ First launch: right-click → Open → Open. **It must launch** — no "damaged and can't be
  opened". (If it says "damaged", the ad-hoc signing in `release.yml` regressed.)
- ☐ Open a character `character.json`; edit HP; confirm it saves in place (reopen shows the change).
- ☐ Open a character *folder* — portrait shows.
- ☐ With Character versions enabled, **Save version** accepts an optional title and creates
  `history/` on first use; Versions shows compact cards. Restore once with Yes (a `before-restore`
  snapshot appears), once with No (none appears), and verify Cancel changes nothing. Delete a test
  version and confirm both its JSON and optional `.meta.json` sidecar disappear.
- ☐ Roll dice; drag one; tap to dismiss.

## Windows (`.msi` / `.exe`)
- ☐ Install and launch (SmartScreen "more info → run anyway" is expected — unsigned).
- ☐ Open `character.json`, edit, save; reopen from Recents.
- ☐ Dice roll / drag / dismiss.

## Android (`.apk`) — the SAF storage path (highest-risk)
- ☐ For a Dev draft, confirm the launcher displays **JUGALE Dev**, stable **JUGALE** remains
  installed beside it, and Android reports package `it.azzato.jugale.dev`. Installing the next
  `-dev.N` APK upgrades only JUGALE Dev. Settings/Recents are separate; grant the test folder again.
- ☐ Sideload the APK (enable "install unknown apps"). Icon is the JUGALE icon, app is not "debug".
- ☐ **Open folder**: pick a character folder on local device storage → sheet + portrait load
  (no "Invalid JSON").
- ☐ **Save in place**: edit HP/resources → it persists to the original file (reopen the file in a
  file manager or reload to confirm; status is *not* stuck on read-only). *(Regression watch: the
  plugin's `android-fs:default` capability excludes all write commands, so `capabilities/android.json`
  must grant `android-fs:allow-write-text-file` explicitly — otherwise saves silently fail.)*
- ☐ **Reopen from Recents after fully closing the app** (swipe it away, relaunch) → the character
  reopens writable without re-picking. (This proves the persisted SAF permission.)
- ☐ **Character versions** on a local SAF folder: the setting starts enabled on a clean install;
  Save version creates `history/`, optional titles render only when non-empty, and the filename toast
  appears only after the write. Test Restore with Yes/No/Cancel and delete both titled and untitled
  versions. The canonical `character.json` and `images/` must remain untouched by history metadata.
- ☐ Repeat on a DocumentsProvider that refuses create/write: show a clear error and leave the
  canonical `character.json` unchanged; never report a successful version.
- ☐ **Open single file** (`character.json` directly): loads; edits save.
- ☐ **Google Drive**, known platform limits:
  - It is **absent from the folder picker** (Drive has no `ACTION_OPEN_DOCUMENT_TREE`) — use the
    single-file picker, where Drive *does* appear.
  - Opening a Drive file must **not** fail with a wrong "Invalid JSON": persisting the permission
    can be refused, but the read still works (best-effort persist).
  - Saving may still be refused → app falls back to **read-only + "Export to save"**, not a crash.
- ☐ A genuine open failure now shows its **real message** ("Couldn't open the character: …"), and
  only a truly malformed file says "Invalid JSON file".
- ☐ Top bar clears the status bar / notch (safe-area).
- ☐ The sheet itself does not pinch-zoom or double-tap-zoom.
- ☐ Story gallery: open an image, swipe left/right to change it, pinch/double-tap to zoom, then
  pan it. None of those gestures may switch the underlying sheet tab.
- ☐ Settings → Interface scale: check 80%, 100%, and 120% on welcome, sheet, Settings, a modal,
  and Raw JSON. Text, icons, buttons and spacing scale together; no horizontal page overflow or
  inaccessible fixed bar appears. The background reaches the bottom without a color seam. Close/
  reopen the app and confirm the selected scale persists.
- ☐ At a narrow viewport / 120% scale, toolbar actions that do not fit move into `…`: Settings,
  prompts, Raw JSON, Export and Edit disappear in that order; dice disappears last. Back remains.
- ☐ Make the tab row overflow, then swipe between sheet pages: the active tab label automatically
  scrolls into view without moving the document vertically.
- ☐ **Dice on a button**: roll a die so it rests over a button; tap/hold the die → only the die
  reacts, the button underneath does **not** fire.
- ☐ **Prompt sharing**: on the Prompts page, Base/Create/Custom can open Android's generic
  sharesheet without a character; Level up/Validate/Migrate are disabled and explain why. With a
  character open, share Level up and verify the chooser opens immediately. ChatGPT should receive
  one `jugale-request.json` attachment with instructions plus schema and character entries. A
  text-only receiver should instead receive `prompt.txt` with delimited PROMPT, schema and character
  sections plus the same bundle in its text/message channel. Create must omit the current character;
  Migrate must also contain the changelog entry/section.
- ☐ Complete the chatbot matrix for the installed ChatGPT/Gemini/Claude versions: target visible,
  new-chat behavior, which JSON/text variant is selected, whether the attachment is read correctly,
  whether a complete `character.json` can be returned, and return MIME. Record app versions and
  failures as receiver compatibility.
  Transport preflight completed on 2026-07-29 with a disposable canary APK: ChatGPT selected/read
  `jugale-request.json`; Gemini and Claude selected/read `prompt.txt`. All three returned an edited
  character, although the intentionally oversized 420-item stress output was truncated by Gemini
  and caused Claude to request one explicit confirmation. Repeat here against the actual Dev APK and
  a normal-size character before promotion.
- ☐ **Return a character to JUGALE:** share one `application/json` character file from a chatbot or
  file manager. Test once with JUGALE closed and once already open. The preview must show name,
  schema and issue counts before any write; Android Back/Cancel must leave the target unchanged.
- ☐ Apply to the open folder with versioning enabled: `history/` gains a `before-import` snapshot and
  images remain unchanged. Repeat with versioning disabled, then select another existing folder.
- ☐ Select a truly empty folder: `character.json` is created only after confirmation. A non-empty
  folder without `character.json` must be rejected. Also try invalid JSON, an unreadable URI and a
  file over 5 MiB; none may alter a character.

## Web on mobile (the Pages site from a phone browser)
- ☐ Open the live site on a phone.
- ☐ **Dice on a button**: same as above — tapping a die over a button must not trigger the button.
- ☐ Open a `character.json` (read-only import path); dice work.
- ☐ A single JSON/read-only import does not expose version actions. On Chromium desktop, opening a
  writable folder does; titled save, compact history, restore choices and delete work through File
  System Access.
- ☐ The page does not pinch/double-tap zoom; the Story gallery still supports its own zoom/swipe.

## Auto-update (once shipped)
- ☐ Desktop: install the previous version, then release a newer tag → the app detects the update.
- ☐ Settings → Check for updates uses the same updater path as startup: when a release is found,
  the fixed update banner appears at the top; when current, a success toast appears.
- ☐ Android: install the previous release, publish a newer one, then tap the in-app update banner.
  The button reads “Download in corso…”, Android's browser/download notification never opens, and
  Package Installer appears only after the APK has been fully downloaded and verified.
- ☐ Refuse or cancel “install unknown apps”, then retry: the app remains usable and no endless
  100% download remains in Android's Downloads UI.
- ☐ Before publishing, verify the release asset has a non-zero size and preferably a `sha256:`
  digest in GitHub's API metadata. The updater always enforces size and verifies the digest whenever
  GitHub supplies it.

---

When all relevant boxes pass, publish the draft Release (`gh release edit <tag> --draft=false
--latest`). If a native build shows a blank window, suspect the Tauri CSP — rollback is one line
(`csp` → `null` in `src-tauri/tauri.conf.json`, see [ARCHITECTURE.md §9](ARCHITECTURE.md)).
