use tauri::{command, AppHandle, Runtime};

use crate::{models::DownloadRequest, AndroidUpdaterExt, Result};

#[command]
pub async fn download_and_install<R: Runtime>(
    app: AppHandle<R>,
    payload: DownloadRequest,
) -> Result<()> {
    app.android_updater().download_and_install(payload)
}
