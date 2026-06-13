import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const SALT_ROUNDS = 10;
const DEFAULT_JWT_EXPIRY_DAYS = 7; // Default 7 days

// Cache for JWT secret to avoid multiple file reads
let jwtSecretCache: string | null = null;

/**
 * Get or generate JWT secret.
 * Reads from process.env (loaded by dotenv). Auto-generates and persists
 * a new secret only when none is present in the environment.
 */
export function getJwtSecret(): string {
  if (jwtSecretCache) {
    return jwtSecretCache;
  }

  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) {
    jwtSecretCache = envSecret;
    return jwtSecretCache;
  }

  // No secret in process.env — generate and persist a new one
  const newSecret = randomBytes(64).toString('hex');

  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  envContent += (envContent.endsWith('\n') ? '' : '\n') + `JWT_SECRET=${newSecret}\n`;
  fs.writeFileSync(envPath, envContent);

  jwtSecretCache = newSecret;
  return newSecret;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 */
export function generateToken(username: string, durationDays?: number): string {
  const secret = getJwtSecret();
  const days = durationDays ?? DEFAULT_JWT_EXPIRY_DAYS;
  return jwt.sign({ username }, secret, { expiresIn: `${days}d` });
}

/**
 * Decode a JWT token without verification (for extracting expiration time)
 */
export function decodeToken(token: string): { username: string; exp?: number; iat?: number } | null {
  try {
    const decoded = jwt.decode(token) as { username: string; exp?: number; iat?: number } | null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): { username: string; exp?: number; iat?: number } | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { username: string; exp?: number; iat?: number };
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Read auth configuration from process.env (loaded by dotenv).
 * Typed schema is defined in ~/env.js; here we read the raw env values
 * because server.js imports this module before dotenv.config() runs.
 */
export function getAuthConfig(): {
  username: string | null;
  passwordHash: string | null;
  enabled: boolean;
  hasCredentials: boolean;
  setupCompleted: boolean;
  sessionDurationDays: number;
} {
  const username = process.env.AUTH_USERNAME?.trim() || null;
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim() || null;
  const enabled = (process.env.AUTH_ENABLED?.toLowerCase() ?? '') === 'true';
  const setupCompleted = (process.env.AUTH_SETUP_COMPLETED?.toLowerCase() ?? '') === 'true';
  const parsed = parseInt(process.env.AUTH_SESSION_DURATION_DAYS ?? '', 10);
  const sessionDurationDays = Number.isNaN(parsed) ? DEFAULT_JWT_EXPIRY_DAYS : parsed;
  const hasCredentials = !!(username && passwordHash);

  return {
    username,
    passwordHash,
    enabled,
    hasCredentials,
    setupCompleted,
    sessionDurationDays,
  };
}

/**
 * Update auth credentials in .env
 */
export async function updateAuthCredentials(
  username: string,
  password?: string,
  enabled?: boolean
): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Hash the password if provided
  const passwordHash = password ? await hashPassword(password) : null;

  // Update or add AUTH_USERNAME
  const usernameRegex = /^AUTH_USERNAME=.*$/m;
  if (usernameRegex.test(envContent)) {
    envContent = envContent.replace(usernameRegex, `AUTH_USERNAME=${username}`);
  } else {
    envContent += (envContent.endsWith('\n') ? '' : '\n') + `AUTH_USERNAME=${username}\n`;
  }

  // Update or add AUTH_PASSWORD_HASH only if password is provided
  if (passwordHash) {
    const passwordHashRegex = /^AUTH_PASSWORD_HASH=.*$/m;
    if (passwordHashRegex.test(envContent)) {
      envContent = envContent.replace(passwordHashRegex, `AUTH_PASSWORD_HASH=${passwordHash}`);
    } else {
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `AUTH_PASSWORD_HASH=${passwordHash}\n`;
    }
  }

  // Update or add AUTH_ENABLED if provided
  if (enabled !== undefined) {
    const enabledRegex = /^AUTH_ENABLED=.*$/m;
    if (enabledRegex.test(envContent)) {
      envContent = envContent.replace(enabledRegex, `AUTH_ENABLED=${enabled}`);
    } else {
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `AUTH_ENABLED=${enabled}\n`;
    }
  }

  // Write back to .env file
  fs.writeFileSync(envPath, envContent);
}

/**
 * Set AUTH_SETUP_COMPLETED flag in .env
 */
export function setSetupCompleted(): void {
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add AUTH_SETUP_COMPLETED
  const setupCompletedRegex = /^AUTH_SETUP_COMPLETED=.*$/m;
  if (setupCompletedRegex.test(envContent)) {
    envContent = envContent.replace(setupCompletedRegex, 'AUTH_SETUP_COMPLETED=true');
  } else {
    envContent += (envContent.endsWith('\n') ? '' : '\n') + 'AUTH_SETUP_COMPLETED=true\n';
  }

  // Write back to .env file
  fs.writeFileSync(envPath, envContent);
}

/**
 * Update AUTH_ENABLED flag in .env
 */
export function updateAuthEnabled(enabled: boolean): void {
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add AUTH_ENABLED
  const enabledRegex = /^AUTH_ENABLED=.*$/m;
  if (enabledRegex.test(envContent)) {
    envContent = envContent.replace(enabledRegex, `AUTH_ENABLED=${enabled}`);
  } else {
    envContent += (envContent.endsWith('\n') ? '' : '\n') + `AUTH_ENABLED=${enabled}\n`;
  }

  // Write back to .env file
  fs.writeFileSync(envPath, envContent);
}

/**
 * Update AUTH_SESSION_DURATION_DAYS in .env
 */
export function updateSessionDuration(days: number): void {
  // Validate: between 1 and 365 days
  const validDays = Math.max(1, Math.min(365, Math.floor(days)));
  
  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add AUTH_SESSION_DURATION_DAYS
  const sessionDurationRegex = /^AUTH_SESSION_DURATION_DAYS=.*$/m;
  if (sessionDurationRegex.test(envContent)) {
    envContent = envContent.replace(sessionDurationRegex, `AUTH_SESSION_DURATION_DAYS=${validDays}`);
  } else {
    envContent += (envContent.endsWith('\n') ? '' : '\n') + `AUTH_SESSION_DURATION_DAYS=${validDays}\n`;
  }

  // Write back to .env file
  fs.writeFileSync(envPath, envContent);
}
