import 'dotenv/config'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
