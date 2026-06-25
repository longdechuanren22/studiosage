// Lightweight Sentry integration — no npm dependency, uses raw envelope API
// Protocol: https://develop.sentry.dev/sdk/envelopes/

const SENTRY_DSN = process.env.SENTRY_DSN || '';
let _enabled = false;
let _endpoint = '';
let _headers: Record<string, string> = {};

function parseDsn(dsn: string) {
  if (!dsn) { _enabled = false; return; }
  try {
    const url = new URL(dsn);
    // DSN format: https://<key>@<host>/<projectId>
    const key = url.username;
    const host = url.host;
    const projectId = url.pathname.replace(/^\//, '');
    if (!key || !host || !projectId) { _enabled = false; return; }
    _endpoint = `https://${host}/api/${projectId}/envelope/`;
    _headers = {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=studiosage/1.0`,
    };
    _enabled = true;
    console.log(`[Sentry] Initialized — project ${projectId} on ${host}`);
  } catch {
    _enabled = false;
  }
}

// Lazy init on first use
let _initialized = false;
function ensureInit() {
  if (_initialized) return;
  _initialized = true;
  parseDsn(SENTRY_DSN);
}

export interface SentryEvent {
  message: string;
  level?: 'error' | 'warning' | 'info' | 'fatal';
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

function buildEnvelope(event: SentryEvent, stack?: string): string {
  const now = Date.now() / 1000;
  const eventId = crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);

  const payload = {
    event_id: eventId,
    timestamp: now,
    level: event.level || 'error',
    platform: 'node',
    environment: process.env.NODE_ENV || 'development',
    server_name: process.env.APP_URL || 'localhost',
    logger: 'studiosage-server',
    tags: {
      ...event.tags,
      node_version: process.version,
    },
    exception: {
      values: [{
        type: 'Error',
        value: event.message,
        ...(stack ? { stacktrace: { frames: [{ filename: 'unknown', function: 'unknown', lineno: 0 }] } } : {}),
      }],
    },
    extra: event.extra || {},
    fingerprint: event.fingerprint || ['{{ default }}'],
  };

  const envelopeHeader = { event_id: eventId, sent_at: new Date().toISOString() };
  const itemHeader = { type: 'event', content_type: 'application/json' };

  return JSON.stringify(envelopeHeader) + '\n' +
         JSON.stringify(itemHeader) + '\n' +
         JSON.stringify(payload);
}

export function captureException(err: Error | string, extra?: Record<string, unknown>) {
  ensureInit();
  if (!_enabled) return;

  const message = typeof err === 'string' ? err : err.message;
  const stack = typeof err === 'string' ? undefined : err.stack;

  const body = buildEnvelope({ message, level: 'error', extra }, stack);

  // Fire-and-forget — don't block on Sentry delivery
  fetch(_endpoint, { method: 'POST', headers: _headers, body })
    .then(() => {})
    .catch(() => {}); // Silent — don't loop if Sentry is down
}

export function captureMessage(message: string, level: SentryEvent['level'] = 'info') {
  ensureInit();
  if (!_enabled) return;

  const body = buildEnvelope({ message, level });
  fetch(_endpoint, { method: 'POST', headers: _headers, body })
    .then(() => {})
    .catch(() => {});
}

export function isSentryEnabled(): boolean {
  ensureInit();
  return _enabled;
}
