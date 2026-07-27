use tauri::{command, AppHandle, Runtime};

use crate::{models::SharePromptRequest, AndroidShareExt, Result};

#[command]
pub async fn share_prompt<R: Runtime>(
    app: AppHandle<R>,
    payload: SharePromptRequest,
) -> Result<()> {
    app.android_share().share_prompt(payload)
}
