import 'dotenv/config'
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const globalForPrisma = globalThis as { prisma?: PrismaClient };

// Ensure database directory exists before initializing Prisma
// DATABASE_URL format: file:/path/to/database.db
const dbUrl = process.env.DATABASE_URL || 'file:./data/settings.db';
const dbPath = dbUrl.replace(/^file:/, '');
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  console.log(`Creating database directory: ${dbDir}`);
  mkdirSync(dbDir, { recursive: true });
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
