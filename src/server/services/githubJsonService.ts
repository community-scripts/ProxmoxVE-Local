import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { env } from '../../env.js';
import type { Script, ScriptCard, GitHubFile } from '../../types/script';
import { repositoryService } from './repositoryService.js';

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

  private getBaseUrl(repoUrl: string): string {
    const urlMatch = /github\.com\/([^\/]+)\/([^\/]+)/.exec(repoUrl);
    if (!urlMatch) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    
    const [, owner, repo] = urlMatch;
    return `https://api.github.com/repos/${owner}/${repo}`;
  }

  private extractRepoPath(repoUrl: string): string {
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(repoUrl);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return `${match[1]}/${match[2]}`;
  }

  private async fetchFromGitHub<T>(repoUrl: string, endpoint: string): Promise<T> {
    const baseUrl = this.getBaseUrl(repoUrl);
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${baseUrl}${endpoint}`, { headers });

    if (!response.ok) {
      if (response.status === 403) {
        const error = new Error(`GitHub API rate limit exceeded. Consider setting GITHUB_TOKEN for higher limits. Status: ${response.status} ${response.statusText}`);
        error.name = 'RateLimitError';
        throw error;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async downloadJsonFile(repoUrl: string, filePath: string): Promise<Script> {
    this.initializeConfig();
    const repoPath = this.extractRepoPath(repoUrl);
    const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${this.branch!}/${filePath}`;
    
    const headers: HeadersInit = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      if (response.status === 403) {
        const error = new Error(`GitHub rate limit exceeded while downloading ${filePath}. Consider setting GITHUB_TOKEN for higher limits. Status: ${response.status} ${response.statusText}`);
        error.name = 'RateLimitError';
        throw error;
      }
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    const script = JSON.parse(content) as Script;
    // Add repository_url to script
    script.repository_url = repoUrl;
    return script;
  }

  async getJsonFiles(repoUrl: string): Promise<GitHubFile[]> {
    this.initializeConfig();
    
    try {
      const files = await this.fetchFromGitHub<GitHubFile[]>(
        repoUrl,
        `/contents/${this.jsonFolder!}?ref=${this.branch!}`
      );
      
      // Filter for JSON files only
      return files.filter(file => file.name.endsWith('.json'));
    } catch (error) {
      console.error(`Error fetching JSON files from GitHub (${repoUrl}):`, error);
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
      if (!script.repository_url) {
        script.repository_url = env.REPO_URL ?? 'https://github.com/community-scripts/ProxmoxVE';
      }
      
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
  async syncJsonFilesForRepo(repoUrl: string): Promise<{ success: boolean; message: string; count: number; syncedFiles: string[] }> {
    try {
      console.log(`Starting JSON sync from repository: ${repoUrl}`);
      
      // Get file list from GitHub
      console.log(`Fetching file list from GitHub (${repoUrl})...`);
      const githubFiles = await this.getJsonFiles(repoUrl);
      console.log(`Found ${githubFiles.length} JSON files in repository ${repoUrl}`);
      
      // Get local files
      const localFiles = await this.getLocalJsonFiles();
      console.log(`Found ${localFiles.length} local JSON files`);
      
      // Compare and find files that need syncing
      // For multi-repo support, we need to check if file exists AND if it's from this repo
      const filesToSync = await this.findFilesToSyncForRepo(repoUrl, githubFiles, localFiles);
      console.log(`Found ${filesToSync.length} files that need syncing from ${repoUrl}`);
      
      if (filesToSync.length === 0) {
        return {
          success: true,
          message: `All JSON files are up to date for repository: ${repoUrl}`,
          count: 0,
          syncedFiles: []
        };
      }
      
      // Download and save only the files that need syncing
      const syncedFiles = await this.syncSpecificFiles(repoUrl, filesToSync);
      
      return {
        success: true,
        message: `Successfully synced ${syncedFiles.length} JSON files from ${repoUrl}`,
        count: syncedFiles.length,
        syncedFiles
      };
    } catch (error) {
      console.error(`JSON sync failed for ${repoUrl}:`, error);
      return {
        success: false,
        message: `Failed to sync JSON files from ${repoUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0,
        syncedFiles: []
      };
    }
  }

  /**
   * Sync JSON files from all enabled repositories (main repo has priority)
   */
  async syncJsonFiles(): Promise<{ success: boolean; message: string; count: number; syncedFiles: string[] }> {
    try {
      console.log('Starting multi-repository JSON sync...');
      
      const enabledRepos = await repositoryService.getEnabledRepositories();
      
      if (enabledRepos.length === 0) {
        return {
          success: false,
          message: 'No enabled repositories found',
          count: 0,
          syncedFiles: []
        };
      }

      console.log(`Found ${enabledRepos.length} enabled repositories`);
      
      const allSyncedFiles: string[] = [];
      const processedSlugs = new Set<string>(); // Track slugs we've already processed
      let totalSynced = 0;

      // Process repos in priority order (lower priority number = higher priority)
      for (const repo of enabledRepos) {
        try {
          console.log(`Syncing from repository: ${repo.url} (priority: ${repo.priority})`);
          
          const result = await this.syncJsonFilesForRepo(repo.url);
          
          if (result.success) {
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

      return {
        success: true,
        message: `Successfully synced ${totalSynced} JSON files from ${enabledRepos.length} repositories`,
        count: totalSynced,
        syncedFiles: allSyncedFiles
      };
    } catch (error) {
      console.error('Multi-repository JSON sync failed:', error);
      return {
        success: false,
        message: `Failed to sync JSON files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0,
        syncedFiles: []
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
   * Find files that need syncing for a specific repository
   * This checks if file exists locally AND if it's from the same repository
   */
  private async findFilesToSyncForRepo(repoUrl: string, githubFiles: GitHubFile[], localFiles: string[]): Promise<GitHubFile[]> {
    const filesToSync: GitHubFile[] = [];
    
    for (const ghFile of githubFiles) {
      const slug = ghFile.name.replace('.json', '');
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
