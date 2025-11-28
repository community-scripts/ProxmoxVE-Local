import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Import from .prisma/client which is the runtime location
import { PrismaClient } from '.prisma/client'

const globalForPrisma = globalThis;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
