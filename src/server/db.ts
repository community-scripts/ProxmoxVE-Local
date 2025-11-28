import 'dotenv/config'
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
