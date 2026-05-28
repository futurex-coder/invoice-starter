/**
 * Tiny structured logger.
 *
 * In development: pretty single-line output with level + timestamp,
 *   `[INFO 14:32:01] my message  { meta }`
 * In production: JSON-per-line, ready to pipe into Sentry / Logflare /
 *   Axiom / etc. without a parser:
 *   `{"level":"info","time":"2026-05-28T11:32:01.234Z","msg":"my message","meta":{...}}`
 *
 * Use `child(bindings)` to attach context that should appear on every
 * log line from a request handler or action:
 *
 * @example
 *   const log = logger.child({ route: '/api/extract', requestId });
 *   log.info('extraction starting');
 *   try { … } catch (e) { log.error('extraction failed', { err: e }); }
 *
 * The implementation is intentionally minimal — no transports, no
 * filtering, no async sinks. Swap to pino/winston when we actually ship
 * to a third-party log service.
 */

type Bindings = Record<string, unknown>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Bindings): void;
  info(msg: string, meta?: Bindings): void;
  warn(msg: string, meta?: Bindings): void;
  error(msg: string, meta?: Bindings): void;
  /** Returns a new logger with extra bindings merged into every line. */
  child(bindings: Bindings): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

const MIN_LEVEL = LEVEL_ORDER[resolveMinLevel()];
const IS_PROD = process.env.NODE_ENV === 'production';

function serializeError(err: unknown): Bindings | string {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  if (typeof err === 'object' && err !== null) {
    return err as Bindings;
  }
  return String(err);
}

function normalizeMeta(meta?: Bindings): Bindings | undefined {
  if (!meta) return undefined;
  const out: Bindings = {};
  for (const [k, v] of Object.entries(meta)) {
    if ((k === 'err' || k === 'error') && (v instanceof Error || typeof v === 'object')) {
      out[k] = serializeError(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* eslint-disable no-console -- this module is the one place allowed to call console.* directly; everything else goes through `logger`. */
const consoleFor: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
/* eslint-enable no-console */

function emit(level: LogLevel, bindings: Bindings, msg: string, meta?: Bindings): void {
  if (LEVEL_ORDER[level] < MIN_LEVEL) return;
  const time = new Date().toISOString();
  const merged = { ...bindings, ...(normalizeMeta(meta) ?? {}) };
  if (IS_PROD) {
    consoleFor[level](JSON.stringify({ level, time, msg, ...merged }));
    return;
  }
  const tag = `[${level.toUpperCase()} ${time.slice(11, 19)}]`;
  if (Object.keys(merged).length === 0) {
    consoleFor[level](tag, msg);
  } else {
    consoleFor[level](tag, msg, merged);
  }
}

function makeLogger(bindings: Bindings): Logger {
  return {
    debug: (msg, meta) => emit('debug', bindings, msg, meta),
    info: (msg, meta) => emit('info', bindings, msg, meta),
    warn: (msg, meta) => emit('warn', bindings, msg, meta),
    error: (msg, meta) => emit('error', bindings, msg, meta),
    child: (extra) => makeLogger({ ...bindings, ...extra }),
  };
}

/** Default root logger. Use `logger.child({ … })` to add request context. */
export const logger: Logger = makeLogger({});
