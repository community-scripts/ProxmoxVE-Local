/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { prisma } from '../db.ts';

export class RepositoryService {
  /**
   * Initialize default repositories if they don't exist
   */
  async initializeDefaultRepositories(): Promise<void> {
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

    const existingUrls = new Set(existingRepos.map(r => r.url));

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
  }

  /**
   * Get all repositories, sorted by priority
   */
  async getAllRepositories() {
    return await prisma.repository.findMany({
      orderBy: [
        { priority: 'asc' },
        { created_at: 'asc' }
      ]
    });
  }

  /**
   * Get enabled repositories, sorted by priority
   */
  async getEnabledRepositories() {
    return await prisma.repository.findMany({
      where: {
        enabled: true
      },
      orderBy: [
        { priority: 'asc' },
        { created_at: 'asc' }
      ]
    });
  }

  /**
   * Get repository by URL
   */
  async getRepositoryByUrl(url: string) {
    return await prisma.repository.findUnique({
      where: { url }
    });
  }

  /**
   * Create a new repository
   */
  async createRepository(data: {
    url: string;
    enabled?: boolean;
    priority?: number;
  }) {
    // Validate GitHub URL
    if (!data.url.match(/^https:\/\/github\.com\/[^\/]+\/[^\/]+$/)) {
      throw new Error('Invalid GitHub repository URL. Format: https://github.com/owner/repo');
    }

    // Check for duplicates
    const existing = await this.getRepositoryByUrl(data.url);
    if (existing) {
      throw new Error('Repository already exists');
    }

    // Get max priority for user-added repos
    const maxPriority = await prisma.repository.aggregate({
      _max: {
        priority: true
      }
    });

    return await prisma.repository.create({
      data: {
        url: data.url,
        enabled: data.enabled ?? true,
        is_default: false,
        is_removable: true,
        priority: data.priority ?? (maxPriority._max.priority ?? 0) + 1
      }
    });
  }

  /**
   * Update repository
   */
  async updateRepository(id: number, data: {
    enabled?: boolean;
    url?: string;
    priority?: number;
  }) {
    // If updating URL, validate it
    if (data.url) {
      if (!data.url.match(/^https:\/\/github\.com\/[^\/]+\/[^\/]+$/)) {
        throw new Error('Invalid GitHub repository URL. Format: https://github.com/owner/repo');
      }

      // Check for duplicates (excluding current repo)
      const existing = await prisma.repository.findFirst({
        where: {
          url: data.url,
          id: { not: id }
        }
      });
      if (existing) {
        throw new Error('Repository URL already exists');
      }
    }

    return await prisma.repository.update({
      where: { id },
      data
    });
  }

  /**
   * Delete repository and associated JSON files
   */
  async deleteRepository(id: number) {
    const repo = await prisma.repository.findUnique({
      where: { id }
    });

    if (!repo) {
      throw new Error('Repository not found');
    }

    if (!repo.is_removable) {
      throw new Error('Cannot delete default repository');
    }

    // Delete associated JSON files
    await this.deleteRepositoryJsonFiles(repo.url);

    // Delete repository
    await prisma.repository.delete({
      where: { id }
    });

    return { success: true };
  }

  /**
   * Delete all JSON files associated with a repository
   */
  private async deleteRepositoryJsonFiles(repoUrl: string): Promise<void> {
    const { readdir, unlink, readFile } = await import('fs/promises');
    const { join } = await import('path');

    const jsonDirectory = join(process.cwd(), 'scripts', 'json');

    try {
      const files = await readdir(jsonDirectory);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = join(jsonDirectory, file);
          const content = await readFile(filePath, 'utf-8');
          const script = JSON.parse(content);

          // If script has repository_url matching the repo, delete it
          if (script.repository_url === repoUrl) {
            await unlink(filePath);
            console.log(`Deleted JSON file: ${file} (from repository: ${repoUrl})`);
          }
        } catch (error) {
          // Skip files that can't be read or parsed
          console.error(`Error processing file ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error deleting repository JSON files:', error);
      }
    }
  }
}

// Singleton instance
export const repositoryService = new RepositoryService();

