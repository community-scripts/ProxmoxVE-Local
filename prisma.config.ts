import 'dotenv/config'
import path from 'path'
import { defineConfig } from 'prisma/config'

// Resolve database path
const dbPath = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), 'data', 'pve-scripts.db')}`

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: dbPath,
  },
  // @ts-expect-error - Prisma 7 config types are incomplete
  studio: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSqlite3({ url: dbPath })
    },
  },
})
