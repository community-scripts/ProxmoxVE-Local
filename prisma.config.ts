import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // @ts-expect-error - Prisma 7 config types are incomplete
  studio: {
    adapter: async () => {
      const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
    },
  },
})
