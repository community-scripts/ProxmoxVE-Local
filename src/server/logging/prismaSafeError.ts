type SafeError = { code?: string; name: string; safeMessage: string };

export function toSafeError(err: unknown): SafeError {
  if (err && typeof err === 'object') {
    const name = (err as any).name as string | undefined;
    const code = (err as any).code as string | undefined;

    // Prisma error names to map
    if (name === 'PrismaClientValidationError') {
      return { name, code, safeMessage: 'Invalid input' };
    }
    if (name === 'PrismaClientKnownRequestError') {
      // Avoid echoing message which may include parameters
      return { name, code, safeMessage: 'Database constraint or known request error' };
    }
    if (name === 'PrismaClientUnknownRequestError') {
      return { name, code, safeMessage: 'Database request failed' };
    }
    if (name === 'PrismaClientRustPanicError') {
      return { name, code, safeMessage: 'Database engine error' };
    }
    if (name === 'PrismaClientInitializationError') {
      return { name, code, safeMessage: 'Database initialization failed' };
    }
    if (name === 'PrismaClientFetchEngineError') {
      return { name, code, safeMessage: 'Database engine fetch error' };
    }

    if (name) {
      return { name, code, safeMessage: 'Unhandled server error' };
    }
  }
  return { name: 'Error', safeMessage: 'Unhandled server error' };
}


