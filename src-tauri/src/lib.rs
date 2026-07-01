#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // Opens external URLs (e.g. the Releases page for the Android update banner) in the
        // system browser. All platforms.
        .plugin(tauri_plugin_opener::init());

    // Android has no real file paths — only SAF content:// URIs, which the stock fs/dialog
    // plugins can't write back to or persist. This plugin adds SAF read/write with persistable
    // permissions; the JS side (src/storage/androidProvider.ts) drives it. Android-only.
    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_android_fs::init());

    // Self-update from GitHub Releases (signed `latest.json`). Desktop only — Tauri's updater
    // doesn't support mobile, so Android uses an in-app "new version" check instead (see
    // src/update/). `process` provides relaunch after an update installs.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
