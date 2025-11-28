 
import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Script, ScriptCard } from '~/types/script';

export class LocalScriptsService {
  private scriptsDirectory: string;

  constructor() {
    this.scriptsDirectory = join(process.cwd(), 'scripts', 'json');
  }

  async getJsonFiles(): Promise<string[]> {
    try {
      const files = await readdir(this.scriptsDirectory);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      console.error('Error reading scripts directory:', error);
      throw new Error('Failed to read scripts directory');
    }
  }

  async getScriptContent(filename: string): Promise<Script> {
    try {
      const filePath = join(this.scriptsDirectory, filename);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as Script;
    } catch (error) {
      console.error(`Error reading script file ${filename}:`, error);
      throw new Error(`Failed to read script: ${filename}`);
    }
  }

  async getAllScripts(): Promise<Script[]> {
    try {
      const jsonFiles = await this.getJsonFiles();
      const scripts: Script[] = [];

      for (const filename of jsonFiles) {
        try {
          const script = await this.getScriptContent(filename);
          scripts.push(script);
        } catch (error) {
          console.error(`Failed to parse script ${filename}:`, error);
          // Continue with other files even if one fails
        }
      }

      return scripts;
    } catch (error) {
      console.error('Error fetching all scripts:', error);
      throw new Error('Failed to fetch scripts from local directory');
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
        repository_url: script.repository_url,
      }));
    } catch (error) {
      console.error('Error creating script cards:', error);
      throw new Error('Failed to create script cards');
    }
  }

  async getScriptBySlug(slug: string): Promise<Script | null> {
    try {
      // Try to read the specific script file directly instead of loading all scripts
      const filename = `${slug}.json`;
      const filePath = join(this.scriptsDirectory, filename);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        const script = JSON.parse(content) as Script;
        
        // Ensure repository_url is set (backward compatibility)
        // If missing, try to determine which repo it came from by checking all enabled repos
        // Note: This is a fallback for scripts synced before repository_url was added
        if (!script.repository_url) {
          const { repositoryService } = await import('./repositoryService');
          const enabledRepos = await repositoryService.getEnabledRepositories();
          
          // Check each repo in priority order to see which one has this script
          // We check in priority order so that if a script exists in multiple repos,
          // we use the highest priority repo (same as sync logic)
          let foundRepo: string | null = null;
          for (const repo of enabledRepos) {
            try {
              const { githubJsonService } = await import('./githubJsonService');
              const repoScript = await githubJsonService.getScriptBySlug(slug, repo.url);
              if (repoScript) {
                foundRepo = repo.url;
                // Don't break - continue to check higher priority repos first
                // Actually, repos are already sorted by priority, so first match is highest priority
                break;
              }
            } catch {
              // Continue checking other repos
            }
          }
          
          // Set repository_url to found repo or default to main repo
          const { env } = await import('~/env.js');
          script.repository_url = foundRepo ?? env.REPO_URL ?? 'https://github.com/community-scripts/ProxmoxVE';
          
          // Update the JSON file with the repository_url for future loads
          try {
            await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
          } catch {
            // If we can't write, that's okay - at least we have it in memory
          }
        }
        
        return script;
      } catch {
        // If file doesn't exist, return null instead of throwing
        return null;
      }
    } catch (error) {
      console.error('Error fetching script by slug:', error);
      throw new Error(`Failed to fetch script: ${slug}`);
    }
  }

  async getMetadata(): Promise<any> {
    try {
      const filePath = join(this.scriptsDirectory, 'metadata.json');
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading metadata file:', error);
      throw new Error('Failed to read metadata');
    }
  }

  async saveScriptsFromGitHub(scripts: Script[]): Promise<void> {
    try {
      // Ensure the directory exists
      await mkdir(this.scriptsDirectory, { recursive: true });

      // Save each script as a JSON file
      for (const script of scripts) {
        const filename = `${script.slug}.json`;
        const filePath = join(this.scriptsDirectory, filename);
        const content = JSON.stringify(script, null, 2);
        await writeFile(filePath, content, 'utf-8');
      }

    } catch (error) {
      console.error('Error saving scripts from GitHub:', error);
      throw new Error('Failed to save scripts from GitHub');
    }
  }
}

// Singleton instance
export const localScriptsService = new LocalScriptsService();
