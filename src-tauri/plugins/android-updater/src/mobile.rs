use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{models::DownloadRequest, Result};

pub struct AndroidUpdater<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<AndroidUpdater<R>> {
    let handle = api.register_android_plugin(
        "it.azzato.jugale.androidupdater",
        "AndroidUpdaterPlugin",
    )?;
    Ok(AndroidUpdater(handle))
}

impl<R: Runtime> AndroidUpdater<R> {
    pub fn download_and_install(&self, payload: DownloadRequest) -> Result<()> {
        self.0
            .run_mobile_plugin("downloadAndInstall", payload)
            .map_err(Into::into)
    }
}
