use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{
    models::{PendingShare, SharePromptRequest},
    Result,
};

pub struct AndroidShare<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<AndroidShare<R>> {
    let handle =
        api.register_android_plugin("it.azzato.jugale.androidshare", "AndroidSharePlugin")?;
    Ok(AndroidShare(handle))
}

impl<R: Runtime> AndroidShare<R> {
    pub fn share_prompt(&self, payload: SharePromptRequest) -> Result<()> {
        self.0
            .run_mobile_plugin("sharePrompt", payload)
            .map_err(Into::into)
    }

    pub fn take_pending_share(&self) -> Result<PendingShare> {
        self.0
            .run_mobile_plugin("takePendingShare", ())
            .map_err(Into::into)
    }
}
