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
        return JSON.parse(content) as Script;
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
