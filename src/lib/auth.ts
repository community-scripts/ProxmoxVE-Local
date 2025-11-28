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
 * Get or generate JWT secret
 */
export function getJwtSecret(): string {
  // Return cached secret if available
  if (jwtSecretCache) {
    return jwtSecretCache;
  }

  const envPath = path.join(process.cwd(), '.env');
  
  // Read existing .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Check if JWT_SECRET already exists
  const jwtSecretRegex = /^JWT_SECRET=(.*)$/m;
  const jwtSecretMatch = jwtSecretRegex.exec(envContent);
  
  if (jwtSecretMatch?.[1]?.trim()) {
    jwtSecretCache = jwtSecretMatch[1].trim();
    return jwtSecretCache;
  }

  // Generate new secret
  const newSecret = randomBytes(64).toString('hex');
  
  // Add to .env file
  envContent += (envContent.endsWith('\n') ? '' : '\n') + `JWT_SECRET=${newSecret}\n`;
  fs.writeFileSync(envPath, envContent);
  
  // Cache the new secret
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
 * Read auth configuration from .env
 */
export function getAuthConfig(): {
  username: string | null;
  passwordHash: string | null;
  enabled: boolean;
  hasCredentials: boolean;
  setupCompleted: boolean;
  sessionDurationDays: number;
} {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    return {
      username: null,
      passwordHash: null,
      enabled: false,
      hasCredentials: false,
      setupCompleted: false,
      sessionDurationDays: DEFAULT_JWT_EXPIRY_DAYS,
    };
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Extract AUTH_USERNAME
  const usernameRegex = /^AUTH_USERNAME=(.*)$/m;
  const usernameMatch = usernameRegex.exec(envContent);
  const username = usernameMatch ? usernameMatch[1]?.trim() : null;
  
  // Extract AUTH_PASSWORD_HASH
  const passwordHashRegex = /^AUTH_PASSWORD_HASH=(.*)$/m;
  const passwordHashMatch = passwordHashRegex.exec(envContent);
  const passwordHash = passwordHashMatch ? passwordHashMatch[1]?.trim() : null;
  
  // Extract AUTH_ENABLED
  const enabledRegex = /^AUTH_ENABLED=(.*)$/m;
  const enabledMatch = enabledRegex.exec(envContent);
  const enabled = enabledMatch ? enabledMatch[1]?.trim().toLowerCase() === 'true' : false;
  
  // Extract AUTH_SETUP_COMPLETED
  const setupCompletedRegex = /^AUTH_SETUP_COMPLETED=(.*)$/m;
  const setupCompletedMatch = setupCompletedRegex.exec(envContent);
  const setupCompleted = setupCompletedMatch ? setupCompletedMatch[1]?.trim().toLowerCase() === 'true' : false;
  
  // Extract AUTH_SESSION_DURATION_DAYS
  const sessionDurationRegex = /^AUTH_SESSION_DURATION_DAYS=(.*)$/m;
  const sessionDurationMatch = sessionDurationRegex.exec(envContent);
  const sessionDurationDays = sessionDurationMatch 
    ? parseInt(sessionDurationMatch[1]?.trim() ?? String(DEFAULT_JWT_EXPIRY_DAYS), 10) || DEFAULT_JWT_EXPIRY_DAYS
    : DEFAULT_JWT_EXPIRY_DAYS;
  
  const hasCredentials = !!(username && passwordHash);
  
  return {
    username: username ?? null,
    passwordHash: passwordHash ?? null,
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

