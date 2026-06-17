// Runtime environment detection
// StudioSage runs in 3 modes: Web, Tauri Desktop, Mobile Web (client portal)

interface PlatformAPI {
  isDesktop: () => boolean;
  isWeb: () => boolean;
  canDragDropFolder: () => boolean;
  canSystemNotify: () => boolean;
  canLocalCache: () => boolean;
}

export const platform: PlatformAPI = {
  isDesktop: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  isWeb: () => !(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window),
  canDragDropFolder: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  canSystemNotify: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
  canLocalCache: () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
};

// ── Tauri invoke helpers (only call when isDesktop() === true) ──

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  ext: string;
}

export interface ProgressEvent {
  current: number;
  total: number;
  filename: string;
  status: string;
}

export interface UploadResult {
  added: number;
  total: number;
  errors: string[];
}

/**
 * Open native folder picker and scan for images (Desktop only)
 */
export async function selectFolder(): Promise<FileEntry[]> {
  if (!platform.isDesktop()) {
    throw new Error('Folder selection only available in desktop app');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('scan_folder', { path: '' });
}

/**
 * Upload photos with native progress tracking (Desktop only)
 */
export async function uploadPhotosDesktop(
  projectId: string,
  files: string[],
  apiBase: string,
  authToken: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<UploadResult> {
  if (!platform.isDesktop()) {
    throw new Error('Desktop upload only available in Tauri');
  }
  const { invoke, Channel } = await import('@tauri-apps/api/core');

  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;

  return invoke('upload_photos', {
    projectId,
    files,
    apiBase,
    authToken,
    onProgress: channel,
  });
}

/**
 * Upload delivery photos with native progress (Desktop only)
 */
export async function uploadDeliveryDesktop(
  projectId: string,
  files: string[],
  apiBase: string,
  authToken: string,
  onProgress: (e: ProgressEvent) => void,
): Promise<UploadResult> {
  if (!platform.isDesktop()) {
    throw new Error('Desktop upload only available in Tauri');
  }
  const { invoke, Channel } = await import('@tauri-apps/api/core');

  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;

  return invoke('upload_delivery_photos', {
    projectId,
    files,
    apiBase,
    authToken,
    onProgress: channel,
  });
}

/**
 * Send desktop notification (Desktop only, no-op on web)
 */
export async function desktopNotify(title: string, body: string): Promise<void> {
  if (!platform.isDesktop()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('send_notification', { title, body });
  } catch {
    // Silently fail — notifications are non-critical
  }
}
