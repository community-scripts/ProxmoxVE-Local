import { redactObject } from './redact';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const envLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const currentLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;

function safeMeta(meta?: unknown): unknown {
  if (meta === undefined) return undefined;
  try {
    return redactObject(meta);
  } catch {
    return undefined;
  }
}

function safeError(err: unknown): { name?: string; code?: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      code: (err as any).code,
      stack: formatStack(err.stack)
    };
  }
  return undefined;
}

function formatStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split('\n').slice(0, 10);
  return lines.join('\n');
}

function log(level: LogLevel, message: string, meta?: unknown, err?: unknown) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const payload: Record<string, unknown> = {
    level,
    msg: message,
    time: new Date().toISOString(),
  };
  const redactedMeta = safeMeta(meta);
  if (redactedMeta !== undefined) payload.meta = redactedMeta;
  const safeErr = safeError(err);
  if (safeErr) payload.err = safeErr;

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, meta?: unknown) {
    log('debug', message, meta);
  },
  info(message: string, meta?: unknown) {
    log('info', message, meta);
  },
  warn(message: string, meta?: unknown) {
    log('warn', message, meta);
  },
  error(message: string, meta?: unknown, err?: unknown) {
    log('error', message, meta, err);
  }
};

export default logger;


