const COMMANDS: &[&str] = &["share_prompt"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
