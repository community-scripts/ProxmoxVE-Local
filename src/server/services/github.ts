import { env } from "~/env.js";
import type { Script, ScriptCard, GitHubFile } from "~/types/script.js";

export class GitHubService {
  private baseUrl: string;
  private repoUrl: string;
  private branch: string;
  private jsonFolder: string;

  constructor() {
    this.repoUrl = env.REPO_URL ?? "";
    this.branch = env.REPO_BRANCH;
    this.jsonFolder = env.JSON_FOLDER;
    
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

  private async fetchFromGitHub<T>(endpoint: string): Promise<T> {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });

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

  async getJsonFiles(): Promise<GitHubFile[]> {
    if (!this.repoUrl) {
      throw new Error('REPO_URL environment variable is not set. Cannot fetch from GitHub.');
    }
    
    try {
      const files = await this.fetchFromGitHub<GitHubFile[]>(
        `/contents/${this.jsonFolder}?ref=${this.branch}`
      );
      
      // Filter for JSON files only
      return files.filter(file => file.name.endsWith('.json'));
    } catch (error) {
      console.error('Error fetching JSON files from GitHub:', error);
      throw new Error('Failed to fetch script files from repository');
    }
  }

  async getScriptContent(filePath: string): Promise<Script> {
    try {
      const file = await this.fetchFromGitHub<GitHubFile>(
        `/contents/${filePath}?ref=${this.branch}`
      );

      if (!file.content) {
        throw new Error('File content is empty');
      }

      // Decode base64 content
      const content = Buffer.from(file.content, 'base64').toString('utf-8');
      return JSON.parse(content) as Script;
    } catch (error) {
      console.error('Error fetching script content:', error);
      throw new Error(`Failed to fetch script: ${filePath}`);
    }
  }

  async getAllScripts(): Promise<Script[]> {
    try {
      const jsonFiles = await this.getJsonFiles();
      const scripts: Script[] = [];

      for (const file of jsonFiles) {
        try {
          const script = await this.getScriptContent(file.path);
          scripts.push(script);
        } catch (error) {
          console.error(`Failed to parse script ${file.name}:`, error);
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
      const scripts = await this.getAllScripts();
      return scripts.find(script => script.slug === slug) ?? null;
    } catch (error) {
      console.error('Error fetching script by slug:', error);
      throw new Error(`Failed to fetch script: ${slug}`);
    }
  }
}

// Singleton instance
export const githubService = new GitHubService();
