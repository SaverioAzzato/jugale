use tauri::{command, AppHandle, Runtime};

use crate::{
    models::{PendingShare, SharePromptRequest},
    AndroidShareExt, Result,
};

#[command]
pub async fn share_prompt<R: Runtime>(
    app: AppHandle<R>,
    payload: SharePromptRequest,
) -> Result<()> {
    app.android_share().share_prompt(payload)
}

#[command]
pub async fn take_pending_share<R: Runtime>(app: AppHandle<R>) -> Result<PendingShare> {
    app.android_share().take_pending_share()
}
