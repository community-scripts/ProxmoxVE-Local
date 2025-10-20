import logger from './logger';
import { toSafeError } from './prismaSafeError';

let registered = false;

export function registerGlobalErrorHandlers() {
  if (registered) return;
  registered = true;

  process.on('uncaughtException', (err) => {
    const safe = toSafeError(err);
    logger.error('uncaught_exception', { name: safe.name, code: safe.code }, err);
  });

  process.on('unhandledRejection', (reason) => {
    const safe = toSafeError(reason as any);
    logger.error('unhandled_rejection', { name: safe.name, code: safe.code }, reason);
  });
}


