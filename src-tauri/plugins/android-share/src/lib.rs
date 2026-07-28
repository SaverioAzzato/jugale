use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;
mod mobile;
mod models;

pub use error::{Error, Result};
use mobile::AndroidShare;

pub trait AndroidShareExt<R: Runtime> {
    fn android_share(&self) -> &AndroidShare<R>;
}

impl<R: Runtime, T: Manager<R>> AndroidShareExt<R> for T {
    fn android_share(&self) -> &AndroidShare<R> {
        self.state::<AndroidShare<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-share")
        .invoke_handler(tauri::generate_handler![
            commands::share_prompt,
            commands::take_pending_share
        ])
        .setup(|app, api| {
            let share = mobile::init(app, api)?;
            app.manage(share);
            Ok(())
        })
        .build()
}
