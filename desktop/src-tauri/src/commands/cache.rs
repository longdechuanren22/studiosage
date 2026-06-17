use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStatus {
    pub cached_count: usize,
    pub total_size_kb: u64,
    pub cache_dir: String,
}

/// Get the path to the local thumbnail cache for a project
#[tauri::command]
pub fn get_cache_dir(app: AppHandle, project_id: String) -> Result<String, String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?
        .join("thumbnails")
        .join(&project_id);

    fs::create_dir_all(&cache_dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

    Ok(cache_dir.to_string_lossy().into())
}

/// Check if a thumbnail is cached locally
#[tauri::command]
pub fn get_cached_thumbnail(app: AppHandle, project_id: String, photo_id: String) -> Result<Option<String>, String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?
        .join("thumbnails")
        .join(&project_id);

    let thumb_path = cache_dir.join(format!("{}.jpg", photo_id));

    if thumb_path.exists() {
        // Convert to tauri asset protocol URL for img src
        let asset_url = format!("https://tauri.localhost/{}", thumb_path.to_string_lossy());
        Ok(Some(asset_url))
    } else {
        Ok(None)
    }
}

/// Cache a list of thumbnails by downloading from remote URLs
#[tauri::command]
pub async fn cache_thumbnails(
    app: AppHandle,
    project_id: String,
    photos: Vec<PhotoCacheRequest>,
) -> Result<usize, String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?
        .join("thumbnails")
        .join(&project_id);

    fs::create_dir_all(&cache_dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

    let client = reqwest::Client::new();
    let mut cached = 0usize;

    for photo in &photos {
        let thumb_path = cache_dir.join(format!("{}.jpg", photo.id));

        // Skip if already cached
        if thumb_path.exists() {
            cached += 1;
            continue;
        }

        // Download thumbnail
        if let Ok(resp) = client.get(&photo.thumbnail_url).send().await {
            if let Ok(bytes) = resp.bytes().await {
                if fs::write(&thumb_path, &bytes).is_ok() {
                    cached += 1;
                }
            }
        }
    }

    Ok(cached)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhotoCacheRequest {
    pub id: String,
    pub thumbnail_url: String,
}

/// Get cache statistics
#[tauri::command]
pub fn get_cache_stats(app: AppHandle) -> Result<CacheStatus, String> {
    let base_cache = app.path().app_cache_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?
        .join("thumbnails");

    let mut total_files = 0usize;
    let mut total_size = 0u64;

    if base_cache.exists() {
        fn walk_dir(dir: &PathBuf, count: &mut usize, size: &mut u64) {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        walk_dir(&path, count, size);
                    } else if path.is_file() {
                        *count += 1;
                        *size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                    }
                }
            }
        }
        walk_dir(&base_cache, &mut total_files, &mut total_size);
    }

    Ok(CacheStatus {
        cached_count: total_files,
        total_size_kb: total_size / 1024,
        cache_dir: base_cache.to_string_lossy().into(),
    })
}

/// Clear all cached thumbnails
#[tauri::command]
pub fn clear_cache(app: AppHandle) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?
        .join("thumbnails");

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .map_err(|e| format!("清除缓存失败: {}", e))?;
    }

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("重建缓存目录失败: {}", e))?;

    Ok(())
}
