import 'dotenv/config'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Use createRequire with absolute path to .prisma/client
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
const prismaClientPath = join(__dirname, '../../node_modules/.prisma/client')
const { PrismaClient } = require(prismaClientPath)

const globalForPrisma = globalThis;

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
