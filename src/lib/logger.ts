/**
 * Minimal structured logging for API routes and server code.
 * In production, logs one JSON line per event (easy to grep / ship to a log drain).
 */

type Meta = Record<string, unknown>;

function asLine(level: string, msg: string, meta?: Meta): string {
  return JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  });
}

export const logger = {
  info(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV === 'production') {
      console.log(asLine('info', msg, meta));
    } else {
      console.log(msg, meta ?? '');
    }
  },

  warn(msg: string, meta?: Meta) {
    console.warn(asLine('warn', msg, meta));
  },

  error(msg: string, err?: unknown, meta?: Meta) {
    const base: Meta = { ...(meta ?? {}) };
    if (err instanceof Error) {
      base.error = err.message;
      if (process.env.NODE_ENV !== 'production') {
        base.stack = err.stack;
      }
    } else if (err !== undefined) {
      base.error = String(err);
    }
    console.error(asLine('error', msg, base));
  },

  /** Verbose / PII-sensitive: disabled in production by default. */
  debug(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(asLine('debug', msg, meta));
    }
  },
};
