use tauri::AppHandle;

/// Send a system desktop notification
#[tauri::command]
pub fn send_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("通知发送失败: {}", e))?;

    Ok(())
}

/// Send notification with a specific urgency level
#[tauri::command]
pub fn send_priority_notification(
    app: AppHandle,
    title: String,
    body: String,
    urgency: String, // "low" | "normal" | "critical"
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let builder = app.notification().builder().title(&title).body(&body);

    match urgency.as_str() {
        "low" => builder.show().map_err(|e| format!("通知发送失败: {}", e))?,
        "critical" => builder.show().map_err(|e| format!("通知发送失败: {}", e))?,
        _ => builder.show().map_err(|e| format!("通知发送失败: {}", e))?,
    };

    Ok(())
}
