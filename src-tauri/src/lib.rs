use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // 应用毛玻璃效果 (Windows)
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::{apply_acrylic, apply_mica};

                // Windows 11 优先使用 Mica，失败则使用 Acrylic
                if apply_mica(&window, Some(true)).is_err() {
                    let _ = apply_acrylic(&window, Some((18, 18, 18, 180)));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
