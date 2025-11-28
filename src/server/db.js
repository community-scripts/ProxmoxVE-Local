import 'dotenv/config'
import { createRequire } from 'module'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Use createRequire to load CommonJS module from node_modules/.prisma/client
const require = createRequire(import.meta.url)
const { PrismaClient } = require('.prisma/client')

const globalForPrisma = globalThis;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
