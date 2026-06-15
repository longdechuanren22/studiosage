const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function fmt(level: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  return `[${ts}] [${level}] ${msg}`;
}

export const logger: Logger = {
  debug: (...args) => { if (LOG_LEVEL === 'debug') console.log(fmt('DEBUG', args)); },
  info: (...args) => console.log(fmt('INFO', args)),
  warn: (...args) => console.warn(fmt('WARN', args)),
  error: (...args) => console.error(fmt('ERROR', args)),
};
