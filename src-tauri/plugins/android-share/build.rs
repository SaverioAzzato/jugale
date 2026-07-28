const COMMANDS: &[&str] = &["share_prompt", "take_pending_share"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
