import { writeFile, mkdir } from 'fs/promises';
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
    const response = await fetch(`${this.baseUrl!}${endpoint}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PVEScripts-Local/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async downloadJsonFile(filePath: string): Promise<Script> {
    this.initializeConfig();
    const rawUrl = `https://raw.githubusercontent.com/${this.extractRepoPath()}/${this.branch!}/${filePath}`;
    
    const response = await fetch(rawUrl);
    if (!response.ok) {
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

  async syncJsonFiles(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      // Get all scripts from GitHub (1 API call + raw downloads)
      const scripts = await this.getAllScripts();
      
      // Save scripts to local directory
      await this.saveScriptsLocally(scripts);
      
      return {
        success: true,
        message: `Successfully synced ${scripts.length} scripts from GitHub using 1 API call + raw downloads`,
        count: scripts.length
      };
    } catch (error) {
      console.error('Error syncing JSON files:', error);
      return {
        success: false,
        message: `Failed to sync JSON files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0
      };
    }
  }

  private async saveScriptsLocally(scripts: Script[]): Promise<void> {
    this.initializeConfig();
    try {
      // Ensure the directory exists
      await mkdir(this.localJsonDirectory!, { recursive: true });

      // Save each script as a JSON file
      for (const script of scripts) {
        const filename = `${script.slug}.json`;
        const filePath = join(this.localJsonDirectory!, filename);
        const content = JSON.stringify(script, null, 2);
        await writeFile(filePath, content, 'utf-8');
      }

    } catch (error) {
      console.error('Error saving scripts locally:', error);
      throw new Error('Failed to save scripts locally');
    }
  }
}

// Singleton instance
export const githubJsonService = new GitHubJsonService();
