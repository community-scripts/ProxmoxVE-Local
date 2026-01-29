import { writeFile, mkdir, readdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { env } from '../../env.js';
import type { Script, ScriptCard, GitHubFile } from '../../types/script';
import { repositoryService } from './repositoryService';
import { listDirectory, downloadRawFile } from '~/server/lib/gitProvider';

export class GitHubJsonService {
  private branch: string | null = null;
  private jsonFolder: string | null = null;
  private localJsonDirectory: string | null = null;
  private scriptCache: Map<string, Script> = new Map();

  constructor() {
    // Initialize lazily to avoid accessing env vars during module load
  }

  private initializeConfig() {
    if (this.branch === null) {
      this.branch = env.REPO_BRANCH;
      this.jsonFolder = env.JSON_FOLDER;
      this.localJsonDirectory = join(process.cwd(), 'scripts', 'json');
    }
  }

  private async downloadJsonFile(repoUrl: string, filePath: string): Promise<Script> {
    this.initializeConfig();
    const content = await downloadRawFile(repoUrl, filePath, this.branch!);
    const script = JSON.parse(content) as Script;
    script.repository_url = repoUrl;
    return script;
  }

  async getJsonFiles(repoUrl: string): Promise<GitHubFile[]> {
    this.initializeConfig();
    try {
      const entries = await listDirectory(repoUrl, this.jsonFolder!, this.branch!);
      const files: GitHubFile[] = entries
        .filter((e) => e.type === 'file' && e.name.endsWith('.json'))
        .map((e) => ({ name: e.name, path: e.path } as GitHubFile));
      return files;
    } catch (error) {
      console.error(`Error fetching JSON files from repository (${repoUrl}):`, error);
      throw new Error(`Failed to fetch script files from repository: ${repoUrl}`);
    }
  }

  async getAllScripts(repoUrl: string): Promise<Script[]> {
    try {
      // First, get the list of JSON files (1 API call)
      const jsonFiles = await this.getJsonFiles(repoUrl);
      const scripts: Script[] = [];

      // Then download each JSON file using raw URLs (no rate limit)
      for (const file of jsonFiles) {
        try {
          const script = await this.downloadJsonFile(repoUrl, file.path);
          scripts.push(script);
        } catch (error) {
          console.error(`Failed to download script ${file.name} from ${repoUrl}:`, error);
          // Continue with other files even if one fails
        }
      }

      return scripts;
    } catch (error) {
      console.error(`Error fetching all scripts from ${repoUrl}:`, error);
      throw new Error(`Failed to fetch scripts from repository: ${repoUrl}`);
    }
  }

  async getScriptCards(repoUrl: string): Promise<ScriptCard[]> {
    try {
      const scripts = await this.getAllScripts(repoUrl);
      
      return scripts.map(script => ({
        name: script.name,
        slug: script.slug,
        description: script.description,
        logo: script.logo,
        type: script.type,
        updateable: script.updateable,
        website: script.website,
        repository_url: script.repository_url,
      }));
    } catch (error) {
      console.error(`Error creating script cards from ${repoUrl}:`, error);
      throw new Error(`Failed to create script cards from repository: ${repoUrl}`);
    }
  }

  async getScriptBySlug(slug: string, repoUrl?: string): Promise<Script | null> {
    try {
      // Try to get from local cache first
      const localScript = await this.getScriptFromLocal(slug);
      if (localScript) {
        // If repoUrl is specified and doesn't match, return null
        if (repoUrl && localScript.repository_url !== repoUrl) {
          return null;
        }
        return localScript;
      }

      // If not found locally and repoUrl is provided, try to download from that repo
      if (repoUrl) {
        try {
          this.initializeConfig();
          const script = await this.downloadJsonFile(repoUrl, `${this.jsonFolder!}/${slug}.json`);
          return script;
        } catch {
          return null;
        }
      }

      // If no repoUrl specified, try all enabled repos
      const enabledRepos = await repositoryService.getEnabledRepositories();
      for (const repo of enabledRepos) {
        try {
          this.initializeConfig();
          const script = await this.downloadJsonFile(repo.url, `${this.jsonFolder!}/${slug}.json`);
          return script;
        } catch {
          // Continue to next repo
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching script by slug:', error);
      throw new Error(`Failed to fetch script: ${slug}`);
    }
  }

  private async getScriptFromLocal(slug: string): Promise<Script | null> {
    try {
      // Check cache first
      if (this.scriptCache.has(slug)) {
        return this.scriptCache.get(slug)!;
      }

      this.initializeConfig();
      const filePath = join(this.localJsonDirectory!, `${slug}.json`);
      const content = await readFile(filePath, 'utf-8');
      const script = JSON.parse(content) as Script;
      
      // If script doesn't have repository_url, set it to main repo (for backward compatibility)
      script.repository_url ??= env.REPO_URL ?? 'https://github.com/community-scripts/ProxmoxVE';
      
      // Cache the script
      this.scriptCache.set(slug, script);
      
      return script;
    } catch {
      return null;
    }
  }

  /**
   * Sync JSON files from a specific repository
   */
  async syncJsonFilesForRepo(repoUrl: string): Promise<{ success: boolean; message: string; count: number; syncedFiles: string[]; deletedFiles: string[] }> {
    try {
      console.log(`Starting JSON sync from repository: ${repoUrl}`);
      
      console.log(`Fetching file list from repository (${repoUrl})...`);
      const githubFiles = await this.getJsonFiles(repoUrl);
      console.log(`Found ${githubFiles.length} JSON files in repository ${repoUrl}`);
      
      // Get local files
      const localFiles = await this.getLocalJsonFiles();
      console.log(`Found ${localFiles.length} local JSON files`);
      
      // Delete local JSON files that belong to this repo but are no longer in the remote
      const remoteFilenames = new Set(githubFiles.map((f) => f.name));
      const deletedFiles = await this.deleteLocalFilesRemovedFromRepo(repoUrl, remoteFilenames);
      if (deletedFiles.length > 0) {
        console.log(`Removed ${deletedFiles.length} obsolete JSON file(s) no longer in ${repoUrl}`);
      }
      
      // Compare and find files that need syncing
      // For multi-repo support, we need to check if file exists AND if it's from this repo
      const filesToSync = await this.findFilesToSyncForRepo(repoUrl, githubFiles, localFiles);
      console.log(`Found ${filesToSync.length} files that need syncing from ${repoUrl}`);
      
      if (filesToSync.length === 0) {
        const msg =
          deletedFiles.length > 0
            ? `All JSON files are up to date for repository: ${repoUrl}. Removed ${deletedFiles.length} obsolete file(s).`
            : `All JSON files are up to date for repository: ${repoUrl}`;
        return {
          success: true,
          message: msg,
          count: 0,
          syncedFiles: [],
          deletedFiles
        };
      }
      
      // Download and save only the files that need syncing
      const syncedFiles = await this.syncSpecificFiles(repoUrl, filesToSync);
      
      const msg =
        deletedFiles.length > 0
          ? `Successfully synced ${syncedFiles.length} JSON files from ${repoUrl}, removed ${deletedFiles.length} obsolete file(s).`
          : `Successfully synced ${syncedFiles.length} JSON files from ${repoUrl}`;
      return {
        success: true,
        message: msg,
        count: syncedFiles.length,
        syncedFiles,
        deletedFiles
      };
    } catch (error) {
      console.error(`JSON sync failed for ${repoUrl}:`, error);
      return {
        success: false,
        message: `Failed to sync JSON files from ${repoUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0,
        syncedFiles: [],
        deletedFiles: []
      };
    }
  }

  /**
   * Sync JSON files from all enabled repositories (main repo has priority)
   */
  async syncJsonFiles(): Promise<{ success: boolean; message: string; count: number; syncedFiles: string[]; deletedFiles: string[] }> {
    try {
      console.log('Starting multi-repository JSON sync...');
      
      const enabledRepos = await repositoryService.getEnabledRepositories();
      
      if (enabledRepos.length === 0) {
        return {
          success: false,
          message: 'No enabled repositories found',
          count: 0,
          syncedFiles: [],
          deletedFiles: []
        };
      }

      console.log(`Found ${enabledRepos.length} enabled repositories`);
      
      const allSyncedFiles: string[] = [];
      const allDeletedFiles: string[] = [];
      const processedSlugs = new Set<string>(); // Track slugs we've already processed
      let totalSynced = 0;

      // Process repos in priority order (lower priority number = higher priority)
      for (const repo of enabledRepos) {
        try {
          console.log(`Syncing from repository: ${repo.url} (priority: ${repo.priority})`);
          
          const result = await this.syncJsonFilesForRepo(repo.url);
          
          if (result.success) {
            allDeletedFiles.push(...(result.deletedFiles ?? []));
            // Only count files that weren't already processed from a higher priority repo
            const newFiles = result.syncedFiles.filter(file => {
              const slug = file.replace('.json', '');
              if (processedSlugs.has(slug)) {
                return false; // Already processed from higher priority repo
              }
              processedSlugs.add(slug);
              return true;
            });
            
            allSyncedFiles.push(...newFiles);
            totalSynced += newFiles.length;
          } else {
            console.error(`Failed to sync from ${repo.url}: ${result.message}`);
          }
        } catch (error) {
          console.error(`Error syncing from ${repo.url}:`, error);
        }
      }

      // Also update existing files that don't have repository_url set (backward compatibility)
      await this.updateExistingFilesWithRepositoryUrl();

      const msg =
        allDeletedFiles.length > 0
          ? `Successfully synced ${totalSynced} JSON files from ${enabledRepos.length} repositories, removed ${allDeletedFiles.length} obsolete file(s).`
          : `Successfully synced ${totalSynced} JSON files from ${enabledRepos.length} repositories`;
      return {
        success: true,
        message: msg,
        count: totalSynced,
        syncedFiles: allSyncedFiles,
        deletedFiles: allDeletedFiles
      };
    } catch (error) {
      console.error('Multi-repository JSON sync failed:', error);
      return {
        success: false,
        message: `Failed to sync JSON files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0,
        syncedFiles: [],
        deletedFiles: []
      };
    }
  }

  /**
   * Update existing JSON files that don't have repository_url (backward compatibility)
   */
  private async updateExistingFilesWithRepositoryUrl(): Promise<void> {
    try {
      this.initializeConfig();
      const files = await this.getLocalJsonFiles();
      const mainRepoUrl = env.REPO_URL ?? 'https://github.com/community-scripts/ProxmoxVE';
      
      for (const file of files) {
        try {
          const filePath = join(this.localJsonDirectory!, file);
          const content = await readFile(filePath, 'utf-8');
          const script = JSON.parse(content) as Script;
          
          if (!script.repository_url) {
            script.repository_url = mainRepoUrl;
            await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
            console.log(`Updated ${file} with repository_url: ${mainRepoUrl}`);
          }
        } catch (error) {
          // Skip files that can't be read or parsed
          console.error(`Error updating ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error updating existing files with repository_url:', error);
    }
  }

  private async getLocalJsonFiles(): Promise<string[]> {
    this.initializeConfig();
    try {
      const files = await readdir(this.localJsonDirectory!);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /**
   * Delete local JSON files that belong to this repo but are no longer in the remote list.
   * Returns the list of deleted filenames.
   */
  private async deleteLocalFilesRemovedFromRepo(repoUrl: string, remoteFilenames: Set<string>): Promise<string[]> {
    this.initializeConfig();
    const localFiles = await this.getLocalJsonFiles();
    const deletedFiles: string[] = [];

    for (const file of localFiles) {
      try {
        const filePath = join(this.localJsonDirectory!, file);
        const content = await readFile(filePath, 'utf-8');
        const script = JSON.parse(content) as Script;

        if (script.repository_url === repoUrl && !remoteFilenames.has(file)) {
          await unlink(filePath);
          const slug = file.replace(/\.json$/, '');
          this.scriptCache.delete(slug);
          deletedFiles.push(file);
          console.log(`Removed obsolete script JSON: ${file} (no longer in ${repoUrl})`);
        }
      } catch {
        // If we can't read or parse the file, skip (do not delete)
      }
    }

    return deletedFiles;
  }

  /**
   * Find files that need syncing for a specific repository
   * This checks if file exists locally AND if it's from the same repository
   */
  private async findFilesToSyncForRepo(repoUrl: string, githubFiles: GitHubFile[], localFiles: string[]): Promise<GitHubFile[]> {
    const filesToSync: GitHubFile[] = [];
    
    for (const ghFile of githubFiles) {
      const localFilePath = join(this.localJsonDirectory!, ghFile.name);
      
      let needsSync = false;
      
      // Check if file exists locally
      if (!localFiles.includes(ghFile.name)) {
        needsSync = true;
      } else {
        // File exists, check if it's from the same repository
        try {
          const content = await readFile(localFilePath, 'utf-8');
          const script = JSON.parse(content) as Script;
          
          // If repository_url doesn't match or doesn't exist, we need to sync
          if (!script.repository_url || script.repository_url !== repoUrl) {
            needsSync = true;
          }
        } catch {
          // If we can't read the file, sync it
          needsSync = true;
        }
      }
      
      if (needsSync) {
        filesToSync.push(ghFile);
      }
    }
    
    return filesToSync;
  }

  private async syncSpecificFiles(repoUrl: string, filesToSync: GitHubFile[]): Promise<string[]> {
    this.initializeConfig();
    const syncedFiles: string[] = [];
    
    await mkdir(this.localJsonDirectory!, { recursive: true });
    
    for (const file of filesToSync) {
      try {
        const script = await this.downloadJsonFile(repoUrl, file.path);
        const filename = `${script.slug}.json`;
        const filePath = join(this.localJsonDirectory!, filename);
        
        // Ensure repository_url is set
        script.repository_url = repoUrl;
        
        await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
        syncedFiles.push(filename);
        
        // Clear cache for this script
        this.scriptCache.delete(script.slug);
      } catch (error) {
        console.error(`Failed to sync ${file.name} from ${repoUrl}:`, error);
      }
    }
    
    return syncedFiles;
  }
}

// Singleton instance
export const githubJsonService = new GitHubJsonService();
