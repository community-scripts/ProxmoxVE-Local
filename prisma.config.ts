import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// @ts-ignore - Prisma 7 config types are incomplete
export default defineConfig({
  schema: 'prisma/schema.prisma',
  studio: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
    },
  },
})
