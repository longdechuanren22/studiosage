// Type declarations for @tauri-apps/api — only available in desktop build
// In web builds, these modules don't exist, but the code paths are guarded by platform.isDesktop()
declare module '@tauri-apps/api/core' {
  export function invoke<T = any>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  export class Channel<T = unknown> {
    onmessage: ((data: T) => void) | null;
    constructor();
  }
}
