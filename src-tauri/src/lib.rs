use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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

            // 应用毛玻璃效果 (macOS)
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{
                    apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
                };

                let _ = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::Sidebar,   // 随系统明暗
                    Some(NSVisualEffectState::Active), // 失焦时也保持效果
                    Some(12.0),                        // 与前端圆角 12px 一致
                );
            }

            // 其他平台不加效果，显式忽略 window 以免 unused 警告
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            let _ = window;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
