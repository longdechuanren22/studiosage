mod commands;

use commands::{upload, notify, cache};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Upload
            upload::scan_folder,
            upload::upload_photos,
            upload::upload_delivery_photos,
            // Notify
            notify::send_notification,
            notify::send_priority_notification,
            // Cache
            cache::get_cache_dir,
            cache::get_cached_thumbnail,
            cache::cache_thumbnails,
            cache::get_cache_stats,
            cache::clear_cache,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
