# StudioSage Tauri 桌面应用架构

## 核心原则

```
Web 版 = 完整功能（轻量场景）
桌面版 = Web 版 + Native 能力（重活场景）
同一套 React UI，运行时检测环境，按能力开关功能
```

## 1. 项目结构

```
studiosage/
├── server/                # Express API — 不变
│   └── src/
├── client/                # React SPA — 不变
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── contexts/
│       ├── utils/
│       │   ├── api.ts           # HTTP client (现有)
│       │   └── platform.ts      # NEW: 环境检测
│       └── main.tsx
├── desktop/               # Tauri 壳 — 新建
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs          # 入口
│   │   │   ├── lib.rs
│   │   │   └── commands/
│   │   │       ├── mod.rs
│   │   │       ├── upload.rs    # 文件上传（拖拽文件夹）
│   │   │       ├── notify.rs    # 桌面通知
│   │   │       └── cache.rs     # 本地缩略图缓存
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── icons/
│   ├── index.html               # Tauri 入口（指向 client/build）
│   └── package.json
└── package.json            # 根: 新增 desktop dev/build 脚本
```

## 2. 运行时检测

```typescript
// client/src/utils/platform.ts
export const platform = {
  isDesktop: () => '__TAURI_INTERNALS__' in window,
  isWeb: () => !('__TAURI_INTERNALS__' in window),
  
  // 按能力开关功能
  canDragDropFolder: () => '__TAURI_INTERNALS__' in window,
  canSystemNotify: () => '__TAURI_INTERNALS__' in window,
  canLocalCache: () => '__TAURI_INTERNALS__' in window,
};
```

React UI 中按 `platform.isDesktop()` 条件渲染：
- 桌面版：拖拽区域 + 文件夹选择按钮
- Web 版：传统 `<input type="file" multiple>` （现有）

## 3. 核心 Tauri Commands

### 3.1 文件上传（killer feature）

```rust
// desktop/src-tauri/src/commands/upload.rs

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Result<Vec<FileEntry>, String> {
    // 调用系统原生文件夹选择器 → 返回文件列表
    // 支持：JPG/JPEG/PNG/WebP/TIFF/HEIC/RAW(CR2/NEF/ARW)
    // 自动扫描子目录，保持文件夹结构
    let files = tauri::dialog::blocking::FileDialogBuilder::new()
        .add_filter("Images", &["jpg","jpeg","png","webp","tiff","tif","heic","cr2","nef","arw"])
        .pick_folder(); // 选择文件夹，自动扫描内容
    // ...
}

#[tauri::command]
async fn upload_photos(
    app: tauri::AppHandle,
    project_id: String,
    files: Vec<String>,     // 本地文件绝对路径
    on_progress: tauri::ipc::Channel<ProgressEvent>,
) -> Result<UploadResult, String> {
    // 1. 本地生成缩略图（sharp via Rust image crate）
    // 2. 分块上传到 /api/projects/:id/gallery/photos
    // 3. 通过 Channel 实时推送进度给前端
    // 4. 支持断点续传（localStorage 记录已上传文件 hash）
    
    for (i, path) in files.iter().enumerate() {
        // Generate thumbnail locally
        let thumbnail = generate_thumbnail(&path, 400)?;
        
        // Upload via multipart (reqwest)
        let result = upload_single(&app, &project_id, &path, &thumbnail).await?;
        
        // Emit progress
        on_progress.send(ProgressEvent {
            current: i + 1,
            total: files.len(),
            filename: path.file_name(),
        })?;
    }
}
```

前端调用：

```typescript
// 桌面版上传（Projects.tsx 中）
import { invoke, Channel } from '@tauri-apps/api/core';

async function handleDesktopUpload(projectId: string) {
  // Step 1: 选择文件夹
  const files = await invoke<string[]>('select_folder');
  
  // Step 2: 上传 + 实时进度
  const onProgress = new Channel<ProgressEvent>();
  onProgress.onmessage = (event) => {
    setUploadProgress(`${event.current}/${event.total} — ${event.filename}`);
  };
  
  const result = await invoke('upload_photos', {
    projectId,
    files,
    onProgress,
  });
  
  toast(`上传完成：${result.added} 张`);
}
```

### 3.2 桌面通知

```rust
// desktop/src-tauri/src/commands/notify.rs

#[tauri::command]
fn notify(title: String, body: String) {
    // 调用系统通知 API
    // macOS: NSUserNotification
    // Windows: Windows Toast Notification
    tauri::notification::Notification::new(&app.config().tauri.bundle.identifier)
        .title(&title)
        .body(&body)
        .show();
}
```

SSE 事件 → 桌面通知的桥接：

```typescript
// Dashboard.tsx 中 SSE 事件处理增强
es.addEventListener('project:updated', (e) => {
  fetchData();
  if (platform.isDesktop()) {
    const data = JSON.parse((e as any).data);
    invoke('notify', {
      title: '项目状态更新',
      body: `项目已变更为: ${data.status}`,
    });
  }
});

// 新增 SSE 事件：selection:submitted（客户选片完成）
// 桌面通知："Sarah 已完成选片，共选择 30 张"
```

### 3.3 本地缩略图缓存

```rust
// desktop/src-tauri/src/commands/cache.rs

#[tauri::command]
fn cache_thumbnails(photos: Vec<PhotoRef>) -> Result<(), String> {
    // 下载远程缩略图到本地缓存目录
    // ~/.studiosage/thumbnails/{project_id}/{photo_id}.jpg
    // 前端 <img> 通过 tauri://localhost 协议读取本地文件
    // 秒开，不需要网络
}

#[tauri::command]
fn get_cached_path(url: String) -> Option<String> {
    // 检查本地缓存，命中则返回 tauri:// 协议路径
}
```

## 4. 数据流对比

### Web 版（现有）
```
摄影师点击 <input file>
  → 浏览器选文件（限制：不能选文件夹）
  → JS 读取 File 对象
  → FormData append
  → fetch POST → multer → sharp 缩略图 → 存磁盘 → 写DB
  → 返回 JSON
```

### 桌面版（新增）
```
摄影师拖拽文件夹到应用
  → Tauri 命令: 扫描文件夹 → 返回文件列表
  → Rust 本地生成缩略图（image crate）
  → Rust 分块上传到 Express API（reqwest）
  → Channel 推送实时进度 → React 显示进度条
  → 上传完毕 → 前端刷新 Gallery
```

## 5. 开发脚本

```json
// package.json (根)
{
  "scripts": {
    "dev": "pnpm --filter server dev & pnpm --filter client dev",
    "dev:desktop": "pnpm --filter server dev & pnpm --filter desktop tauri dev",
    "build:desktop": "pnpm --filter client build && pnpm --filter desktop tauri build"
  }
}
```

```json
// desktop/package.json
{
  "scripts": {
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0",
    "@tauri-apps/plugin-notification": "^2.0",
    "@tauri-apps/plugin-dialog": "^2.0",
    "@tauri-apps/plugin-fs": "^2.0"
  }
}
```

## 6. 兼容策略

Tauri 入口 `desktop/index.html` 直接指向 Vite 构建产物：

```html
<!-- desktop/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>
    // 标记运行环境
    window.__TAURI_INTERNALS__ = true;
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="../client/dist/assets/index.js"></script>
</body>
</html>
```

前端无感知——同一份 React build 同时服务于 Web 和 Tauri。`platform.ts` 在运行时检测 `window.__TAURI_INTERNALS__`。

## 7. 分阶段交付

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | Tauri 壳 + 复用现有 Web UI + 文件夹拖拽上传 + 本地缩略图 | 核心 |
| **Phase 2** | 上传进度条 + 桌面通知（选片完成/审核提交） | 体验 |
| **Phase 3** | 断点续传 + 离线缓存 + 系统托盘 | 增强 |
| **Phase 4** | RAW 预览（libraw binding）+ 批量导出 | 专业 |

## 8. 关键依赖

```toml
# desktop/src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["multipart", "stream"] }
image = "0.25"       # 缩略图生成
tokio = { version = "1", features = ["full"] }
```

---

**一句话**：桌面版不重写 UI，只在需要 native 能力的地方（文件上传/通知/缓存）用 Tauri commands 替换浏览器 API，其余 90% 复用 Web 代码。
