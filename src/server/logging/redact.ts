const DEFAULT_MASK = '***REDACTED***';

const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'ssh_key',
  'sshKey',
  'ssh_key_passphrase',
  'sshKeyPassphrase',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'apiKey',
  'apikey'
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function redactObject(
  value: unknown,
  opts?: { keys?: string[]; mask?: string }
): unknown {
  const keys = (opts?.keys ?? DEFAULT_SENSITIVE_KEYS).map(k => k.toLowerCase());
  const mask = opts?.mask ?? DEFAULT_MASK;

  const visit = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) return val.map(visit);
    if (val instanceof Map) {
      const mapped = new Map();
      for (const [k, v] of val.entries()) {
        const shouldRedact = typeof k === 'string' && keys.includes(k.toLowerCase());
        mapped.set(k, shouldRedact ? mask : visit(v));
      }
      return mapped;
    }
    if (isPlainObject(val)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        const shouldRedact = keys.includes(k.toLowerCase());
        out[k] = shouldRedact ? mask : visit(v);
      }
      return out;
    }
    return maskIfLikelySecret(val, mask);
  };

  return visit(value);
}

function maskIfLikelySecret(val: unknown, mask: string): unknown {
  // For safety, non-serializable or unexpected values get masked when logged
  try {
    JSON.stringify(val);
    return val;
  } catch {
    return mask;
  }
}

export function summarizeBody(body: unknown): { keys: string[]; size?: number } {
  try {
    if (isPlainObject(body)) {
      const keys = Object.keys(body);
      const size = Buffer.from(JSON.stringify(body)).length;
      return { keys, size };
    }
    if (Array.isArray(body)) {
      const size = Buffer.from(JSON.stringify(body)).length;
      return { keys: ['<array>'], size };
    }
    return { keys: [typeof body], size: undefined };
  } catch {
    return { keys: ['<unserializable>'] };
  }
}

export const SENSITIVE_KEYS = DEFAULT_SENSITIVE_KEYS;


