import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    migrations: 'prisma/migrations',
  },
  studio: {
    adapter: async () => {
      const { PrismaBetterSQLite3 } = await import('@prisma/adapter-better-sqlite3')
      return new PrismaBetterSQLite3({ url: process.env.DATABASE_URL! })
    },
  },
})
