import 'dotenv/config'
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as { prisma?: PrismaClient; repositoriesInitialized?: boolean };

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: ['warn', 'error']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Initialize default repositories if they don't exist.
 * This is called lazily to ensure it runs even when using `npm run dev`.
 */
export async function ensureDefaultRepositories(): Promise<void> {
  // Only run once per process
  if (globalForPrisma.repositoriesInitialized) {
    return;
  }
  
  try {
    const mainRepoUrl = 'https://github.com/community-scripts/ProxmoxVE';
    const devRepoUrl = 'https://github.com/community-scripts/ProxmoxVED';

    // Check if repositories already exist
    const existingRepos = await prisma.repository.findMany({
      where: {
        url: {
          in: [mainRepoUrl, devRepoUrl]
        }
      }
    });

    const existingUrls = new Set(existingRepos.map((r: { url: string }) => r.url));

    // Create main repo if it doesn't exist
    if (!existingUrls.has(mainRepoUrl)) {
      await prisma.repository.create({
        data: {
          url: mainRepoUrl,
          enabled: true,
          is_default: true,
          is_removable: false,
          priority: 1
        }
      });
      console.log('Initialized main repository:', mainRepoUrl);
    }

    // Create dev repo if it doesn't exist
    if (!existingUrls.has(devRepoUrl)) {
      await prisma.repository.create({
        data: {
          url: devRepoUrl,
          enabled: false,
          is_default: true,
          is_removable: false,
          priority: 2
        }
      });
      console.log('Initialized dev repository:', devRepoUrl);
    }

    globalForPrisma.repositoriesInitialized = true;
  } catch (error) {
    console.error('Failed to initialize default repositories:', error);
  }
}
