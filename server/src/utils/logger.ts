const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_FORMAT = process.env.LOG_FORMAT || 'plain'; // 'plain' | 'json'

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function fmt(level: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  if (LOG_FORMAT === 'json') {
    const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    return JSON.stringify({ ts, level, message, pid: process.pid });
  }
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  return `[${ts}] [${level}] ${msg}`;
}

export const logger: Logger = {
  debug: (...args) => { if (LOG_LEVEL === 'debug') console.log(fmt('DEBUG', args)); },
  info: (...args) => console.log(fmt('INFO', args)),
  warn: (...args) => console.warn(fmt('WARN', args)),
  error: (...args) => console.error(fmt('ERROR', args)),
};

/** Create a component-scoped logger that prefixes every message with [Component] */
export function createLogger(component: string): Logger {
  return {
    debug: (...args) => logger.debug(`[${component}]`, ...args),
    info: (...args) => logger.info(`[${component}]`, ...args),
    warn: (...args) => logger.warn(`[${component}]`, ...args),
    error: (...args) => logger.error(`[${component}]`, ...args),
  };
}
