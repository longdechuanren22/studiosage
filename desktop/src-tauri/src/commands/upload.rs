use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, ipc::Channel};
use image::GenericImageView;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub ext: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub filename: String,
    pub status: String, // "uploading" | "done" | "error"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResult {
    pub added: usize,
    pub total: usize,
    pub errors: Vec<String>,
}

const ALLOWED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "tiff", "tif", "heic", "heif", "cr2", "nef", "arw", "dng"];

/// Scan a directory recursively for image files
#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("不是有效的文件夹".into());
    }

    let mut files = Vec::new();
    scan_dir(dir, &mut files)?;

    // Sort by filename (natural sort)
    files.sort_by(|a, b| natord::compare(&a.name, &b.name));

    Ok(files)
}

fn scan_dir(dir: &Path, files: &mut Vec<FileEntry>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取文件失败: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // Skip hidden directories
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if !name.starts_with('.') && !name.starts_with('_') {
                    scan_dir(&path, files)?;
                }
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ALLOWED_EXTENSIONS.contains(&ext_lower.as_str()) {
                    let metadata = entry.metadata().map_err(|e| format!("读取元数据失败: {}", e))?;
                    files.push(FileEntry {
                        name: path.file_name().unwrap_or_default().to_string_lossy().into(),
                        path: path.to_string_lossy().into(),
                        size: metadata.len(),
                        ext: ext_lower,
                    });
                }
            }
        }
    }
    Ok(())
}

/// Generate a JPEG thumbnail (400px wide) from any supported image format
fn generate_thumbnail(source_path: &Path, max_width: u32) -> Result<Vec<u8>, String> {
    let img = image::open(source_path).map_err(|e| format!("无法打开图片: {}", e))?;
    let (w, h) = img.dimensions();

    let (new_w, new_h) = if w > max_width {
        let ratio = max_width as f64 / w as f64;
        (max_width, (h as f64 * ratio) as u32)
    } else {
        (w, h)
    };

    let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
    let mut buf: Vec<u8> = Vec::new();
    resized.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| format!("缩略图生成失败: {}", e))?;

    Ok(buf)
}

/// Upload photos with thumbnail generation and progress tracking
#[tauri::command]
pub async fn upload_photos(
    app: AppHandle,
    project_id: String,
    files: Vec<String>,
    api_base: String,
    auth_token: String,
    on_progress: Channel<ProgressEvent>,
) -> Result<UploadResult, String> {
    let client = reqwest::Client::new();
    let total = files.len();
    let mut added = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (i, file_path) in files.iter().enumerate() {
        let path = Path::new(file_path);
        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("photo_{}.jpg", i));

        on_progress.send(ProgressEvent {
            current: i + 1,
            total,
            filename: filename.clone(),
            status: "uploading".into(),
        }).map_err(|e| format!("进度通道错误: {}", e))?;

        // Generate thumbnail
        let thumbnail = match generate_thumbnail(path, 400) {
            Ok(data) => data,
            Err(e) => {
                errors.push(format!("{}: 缩略图失败 — {}", filename, e));
                continue;
            }
        };

        // Upload multipart
        let form = reqwest::multipart::Form::new()
            .text("project_id", project_id.clone())
            .part("photos", reqwest::multipart::Part::bytes(fs::read(path)
                .unwrap_or_default())
                .file_name(filename.clone())
                .mime_str(&format!("image/{}", path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("jpeg")))
                .map_err(|e| format!("构建上传请求失败: {}", e))?);

        let upload_url = format!("{}/api/projects/{}/gallery/photos", api_base, project_id);

        match client.post(&upload_url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .multipart(form)
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    // Also cache thumbnail locally
                    if let Some(cache_dir) = app.path().app_cache_dir().ok() {
                        let thumb_dir = cache_dir.join("thumbnails").join(&project_id);
                        let _ = fs::create_dir_all(&thumb_dir);
                        let thumb_path = thumb_dir.join(format!("{}.jpg", uuid::Uuid::new_v4()));
                        let _ = fs::write(&thumb_path, &thumbnail);
                    }
                    added += 1;
                } else {
                    errors.push(format!("{}: HTTP {}", filename, resp.status()));
                }
            }
            Err(e) => {
                errors.push(format!("{}: 上传失败 — {}", filename, e));
            }
        }

        on_progress.send(ProgressEvent {
            current: i + 1,
            total,
            filename,
            status: "done".into(),
        }).ok();
    }

    Ok(UploadResult { added, total, errors })
}

/// Upload edited/delivery photos (no thumbnail needed, already processed)
#[tauri::command]
pub async fn upload_delivery_photos(
    _app: AppHandle,
    project_id: String,
    files: Vec<String>,
    api_base: String,
    auth_token: String,
    on_progress: Channel<ProgressEvent>,
) -> Result<UploadResult, String> {
    let client = reqwest::Client::new();
    let total = files.len();
    let mut added = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (i, file_path) in files.iter().enumerate() {
        let path = Path::new(file_path);
        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| format!("edited_{}.jpg", i));

        on_progress.send(ProgressEvent {
            current: i + 1,
            total,
            filename: filename.clone(),
            status: "uploading".into(),
        }).map_err(|e| format!("进度通道错误: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .part("photos", reqwest::multipart::Part::bytes(fs::read(path)
                .unwrap_or_default())
                .file_name(filename.clone())
                .mime_str("image/jpeg")
                .map_err(|e| format!("构建上传请求失败: {}", e))?);

        let upload_url = format!("{}/api/projects/{}/deliveries", api_base, project_id);

        match client.post(&upload_url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .multipart(form)
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    added += 1;
                } else {
                    errors.push(format!("{}: HTTP {}", filename, resp.status()));
                }
            }
            Err(e) => {
                errors.push(format!("{}: 上传失败 — {}", filename, e));
            }
        }

        on_progress.send(ProgressEvent {
            current: i + 1,
            total,
            filename,
            status: "done".into(),
        }).ok();
    }

    Ok(UploadResult { added, total, errors })
}
