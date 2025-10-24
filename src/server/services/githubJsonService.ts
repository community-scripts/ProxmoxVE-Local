import { writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { env } from '../../env.js';
import type { Script, ScriptCard, GitHubFile } from '../../types/script';

export class GitHubJsonService {
  private baseUrl: string | null = null;
  private repoUrl: string | null = null;
  private branch: string | null = null;
  private jsonFolder: string | null = null;
  private localJsonDirectory: string | null = null;
  private scriptCache: Map<string, Script> = new Map();

  constructor() {
    // Initialize lazily to avoid accessing env vars during module load
  }

  private initializeConfig() {
    if (this.repoUrl === null) {
      this.repoUrl = env.REPO_URL ?? "";
      this.branch = env.REPO_BRANCH;
      this.jsonFolder = env.JSON_FOLDER;
      this.localJsonDirectory = join(process.cwd(), 'scripts', 'json');
      
      // Only validate GitHub URL if it's provided
      if (this.repoUrl) {
        // Extract owner and repo from the URL
        const urlMatch = /github\.com\/([^\/]+)\/([^\/]+)/.exec(this.repoUrl);
        if (!urlMatch) {
          throw new Error(`Invalid GitHub repository URL: ${this.repoUrl}`);
        }
        
        const [, owner, repo] = urlMatch;
        this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
      } else {
        // Set a dummy base URL if no REPO_URL is provided
        this.baseUrl = "";
      }
    }
  }

  private async fetchFromGitHub<T>(endpoint: string): Promise<T> {
    this.initializeConfig();
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${this.baseUrl!}${endpoint}`, { headers });

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

  private async downloadJsonFile(filePath: string): Promise<Script> {
    this.initializeConfig();
    const rawUrl = `https://raw.githubusercontent.com/${this.extractRepoPath()}/${this.branch!}/${filePath}`;
    
    const headers: HeadersInit = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available (for raw files, use token in URL or header)
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
    return JSON.parse(content) as Script;
  }

  private extractRepoPath(): string {
    this.initializeConfig();
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(this.repoUrl!);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return `${match[1]}/${match[2]}`;
  }

  async getJsonFiles(): Promise<GitHubFile[]> {
    this.initializeConfig();
    if (!this.repoUrl) {
      throw new Error('REPO_URL environment variable is not set. Cannot fetch from GitHub.');
    }
    
    try {
      const files = await this.fetchFromGitHub<GitHubFile[]>(
        `/contents/${this.jsonFolder!}?ref=${this.branch!}`
      );
      
      // Filter for JSON files only
      return files.filter(file => file.name.endsWith('.json'));
    } catch (error) {
      console.error('Error fetching JSON files from GitHub:', error);
      throw new Error('Failed to fetch script files from repository');
    }
  }

  async getAllScripts(): Promise<Script[]> {
    try {
      // First, get the list of JSON files (1 API call)
      const jsonFiles = await this.getJsonFiles();
      const scripts: Script[] = [];

      // Then download each JSON file using raw URLs (no rate limit)
      for (const file of jsonFiles) {
        try {
          const script = await this.downloadJsonFile(file.path);
          scripts.push(script);
        } catch (error) {
          console.error(`Failed to download script ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }

      return scripts;
    } catch (error) {
      console.error('Error fetching all scripts:', error);
      throw new Error('Failed to fetch scripts from repository');
    }
  }

  async getScriptCards(): Promise<ScriptCard[]> {
    try {
      const scripts = await this.getAllScripts();
      
      return scripts.map(script => ({
        name: script.name,
        slug: script.slug,
        description: script.description,
        logo: script.logo,
        type: script.type,
        updateable: script.updateable,
        website: script.website,
      }));
    } catch (error) {
      console.error('Error creating script cards:', error);
      throw new Error('Failed to create script cards');
    }
  }

  async getScriptBySlug(slug: string): Promise<Script | null> {
    try {
      // Try to get from local cache first
      const localScript = await this.getScriptFromLocal(slug);
      if (localScript) {
        return localScript;
      }

      // If not found locally, try to download just this specific script
      try {
        this.initializeConfig();
        const script = await this.downloadJsonFile(`${this.jsonFolder!}/${slug}.json`);
        return script;
      } catch {
        return null;
      }
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

      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      
      this.initializeConfig();
      const filePath = join(this.localJsonDirectory!, `${slug}.json`);
      const content = await readFile(filePath, 'utf-8');
      const script = JSON.parse(content) as Script;
      
      // Cache the script
      this.scriptCache.set(slug, script);
      
      return script;
    } catch {
      return null;
    }
  }

  async syncJsonFiles(): Promise<{ success: boolean; message: string; count: number; syncedFiles: string[] }> {
    try {
      console.log('Starting fast incremental JSON sync...');
      
      // Get file list from GitHub
      console.log('Fetching file list from GitHub...');
      const githubFiles = await this.getJsonFiles();
      console.log(`Found ${githubFiles.length} JSON files in repository`);
      
      // Get local files
      const localFiles = await this.getLocalJsonFiles();
      console.log(`Found ${localFiles.length} files in local directory`);
      console.log(`Found ${localFiles.filter(f => f.endsWith('.json')).length} local JSON files`);
      
      // Compare and find files that need syncing
      const filesToSync = this.findFilesToSync(githubFiles, localFiles);
      console.log(`Found ${filesToSync.length} files that need syncing`);
      
      if (filesToSync.length === 0) {
        return {
          success: true,
          message: 'All JSON files are up to date',
          count: 0,
          syncedFiles: []
        };
      }
      
      // Download and save only the files that need syncing
      const syncedFiles = await this.syncSpecificFiles(filesToSync);
      
      return {
        success: true,
        message: `Successfully synced ${syncedFiles.length} JSON files from GitHub`,
        count: syncedFiles.length,
        syncedFiles
      };
    } catch (error) {
      console.error('JSON sync failed:', error);
      return {
        success: false,
        message: `Failed to sync JSON files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0,
        syncedFiles: []
      };
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

  private findFilesToSync(githubFiles: GitHubFile[], localFiles: string[]): GitHubFile[] {
    const localFileSet = new Set(localFiles);
    // Return only files that don't exist locally
    return githubFiles.filter(ghFile => !localFileSet.has(ghFile.name));
  }

  private async syncSpecificFiles(filesToSync: GitHubFile[]): Promise<string[]> {
    this.initializeConfig();
    const syncedFiles: string[] = [];
    
    await mkdir(this.localJsonDirectory!, { recursive: true });
    
    for (const file of filesToSync) {
      try {
        const script = await this.downloadJsonFile(file.path);
        const filename = `${script.slug}.json`;
        const filePath = join(this.localJsonDirectory!, filename);
        await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
        syncedFiles.push(filename);
      } catch (error) {
        console.error(`Failed to sync ${file.name}:`, error);
      }
    }
    
    return syncedFiles;
  }

}

// Singleton instance
export const githubJsonService = new GitHubJsonService();
