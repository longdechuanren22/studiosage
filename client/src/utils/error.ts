// Centralized client-side error handling
// Use logError() for non-critical catch blocks; pair with toast() for user-facing operations

export function logError(context: string, err: unknown): void {
  // Only log in development (Vite sets import.meta.env.DEV)
  try {
    if ((import.meta as any).env?.DEV) {
      const msg = err instanceof Error ? err.message : String(err || 'Unknown error');
      console.error(`[${context}]`, err);
    }
  } catch {}
}

// Extract a human-readable error message from an API response or generic error
export function errorMessage(err: unknown, fallback = 'Network error — please try again'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as any;
    if (e.error) return String(e.error);
    if (e.message) return String(e.message);
  }
  return fallback;
}
