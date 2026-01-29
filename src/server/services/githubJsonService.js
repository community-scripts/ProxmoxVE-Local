// JavaScript wrapper for githubJsonService (for use with node server.js)
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { repositoryService } from './repositoryService.js';
import { listDirectory, downloadRawFile } from '../lib/gitProvider/index.js';

// Get environment variables
const getEnv = () => ({
  REPO_BRANCH: process.env.REPO_BRANCH || 'main',
  JSON_FOLDER: process.env.JSON_FOLDER || 'json',
  REPO_URL: process.env.REPO_URL || 'https://github.com/community-scripts/ProxmoxVE',
  GITHUB_TOKEN: process.env.GITHUB_TOKEN
});

class GitHubJsonService {
  constructor() {
    this.branch = null;
    this.jsonFolder = null;
    this.localJsonDirectory = null;
    this.scriptCache = new Map();
  }

  initializeConfig() {
    if (this.branch === null) {
      const env = getEnv();
      this.branch = env.REPO_BRANCH;
      this.jsonFolder = env.JSON_FOLDER;
      this.localJsonDirectory = join(process.cwd(), 'scripts', 'json');
    }
  }

  async downloadJsonFile(repoUrl, filePath) {
    this.initializeConfig();
    const content = await downloadRawFile(repoUrl, filePath, this.branch);
    const script = JSON.parse(content);
    script.repository_url = repoUrl;
    return script;
  }

  async getJsonFiles(repoUrl) {
    this.initializeConfig();
    try {
      const entries = await listDirectory(repoUrl, this.jsonFolder, this.branch);
      return entries
        .filter((e) => e.type === 'file' && e.name.endsWith('.json'))
        .map((e) => ({ name: e.name, path: e.path }));
    } catch (error) {
      console.error(`Error fetching JSON files from repository (${repoUrl}):`, error);
      throw new Error(`Failed to fetch script files from repository: ${repoUrl}`);
    }
  }

  async getAllScripts(repoUrl) {
    try {
      const jsonFiles = await this.getJsonFiles(repoUrl);
      const scripts = [];

      for (const file of jsonFiles) {
        try {
          const script = await this.downloadJsonFile(repoUrl, file.path);
          scripts.push(script);
        } catch (error) {
          console.error(`Failed to download script ${file.name} from ${repoUrl}:`, error);
        }
      }

      return scripts;
    } catch (error) {
      console.error(`Error fetching all scripts from ${repoUrl}:`, error);
      throw new Error(`Failed to fetch scripts from repository: ${repoUrl}`);
    }
  }

  async getScriptCards(repoUrl) {
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

  async getScriptBySlug(slug, repoUrl) {
    try {
      const localScript = await this.getScriptFromLocal(slug);
      if (localScript) {
        if (repoUrl && localScript.repository_url !== repoUrl) {
          return null;
        }
        return localScript;
      }

      if (repoUrl) {
        try {
          this.initializeConfig();
          const script = await this.downloadJsonFile(repoUrl, `${this.jsonFolder}/${slug}.json`);
          return script;
        } catch {
          return null;
        }
      }

      const enabledRepos = await repositoryService.getEnabledRepositories();
      for (const repo of enabledRepos) {
        try {
          this.initializeConfig();
          const script = await this.downloadJsonFile(repo.url, `${this.jsonFolder}/${slug}.json`);
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

  async getScriptFromLocal(slug) {
    try {
      if (this.scriptCache.has(slug)) {
        return this.scriptCache.get(slug);
      }

      this.initializeConfig();
      const filePath = join(this.localJsonDirectory, `${slug}.json`);
      const content = await readFile(filePath, 'utf-8');
      const script = JSON.parse(content);
      
      if (!script.repository_url) {
        const env = getEnv();
        script.repository_url = env.REPO_URL;
      }
      
      this.scriptCache.set(slug, script);
      
      return script;
    } catch {
      return null;
    }
  }

  async syncJsonFilesForRepo(repoUrl) {
    try {
      console.log(`Starting JSON sync from repository: ${repoUrl}`);
      
      const githubFiles = await this.getJsonFiles(repoUrl);
      console.log(`Found ${githubFiles.length} JSON files in repository ${repoUrl}`);
      
      const localFiles = await this.getLocalJsonFiles();
      console.log(`Found ${localFiles.length} local JSON files`);
      
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

  async syncJsonFiles() {
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
      
      const allSyncedFiles = [];
      const processedSlugs = new Set();
      let totalSynced = 0;

      for (const repo of enabledRepos) {
        try {
          console.log(`Syncing from repository: ${repo.url} (priority: ${repo.priority})`);
          
          const result = await this.syncJsonFilesForRepo(repo.url);
          
          if (result.success) {
            const newFiles = result.syncedFiles.filter(file => {
              const slug = file.replace('.json', '');
              if (processedSlugs.has(slug)) {
                return false;
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

  async updateExistingFilesWithRepositoryUrl() {
    try {
      this.initializeConfig();
      const files = await this.getLocalJsonFiles();
      const env = getEnv();
      const mainRepoUrl = env.REPO_URL;
      
      for (const file of files) {
        try {
          const filePath = join(this.localJsonDirectory, file);
          const content = await readFile(filePath, 'utf-8');
          const script = JSON.parse(content);
          
          if (!script.repository_url) {
            script.repository_url = mainRepoUrl;
            await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
            console.log(`Updated ${file} with repository_url: ${mainRepoUrl}`);
          }
        } catch (error) {
          console.error(`Error updating ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error updating existing files with repository_url:', error);
    }
  }

  async getLocalJsonFiles() {
    this.initializeConfig();
    try {
      const files = await readdir(this.localJsonDirectory);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  async findFilesToSyncForRepo(repoUrl, githubFiles, localFiles) {
    const filesToSync = [];
    
    for (const ghFile of githubFiles) {
      const localFilePath = join(this.localJsonDirectory, ghFile.name);
      
      let needsSync = false;
      
      if (!localFiles.includes(ghFile.name)) {
        needsSync = true;
      } else {
        try {
          const content = await readFile(localFilePath, 'utf-8');
          const script = JSON.parse(content);
          
          if (!script.repository_url || script.repository_url !== repoUrl) {
            needsSync = true;
          }
        } catch {
          needsSync = true;
        }
      }
      
      if (needsSync) {
        filesToSync.push(ghFile);
      }
    }
    
    return filesToSync;
  }

  async syncSpecificFiles(repoUrl, filesToSync) {
    this.initializeConfig();
    const syncedFiles = [];
    
    await mkdir(this.localJsonDirectory, { recursive: true });
    
    for (const file of filesToSync) {
      try {
        const script = await this.downloadJsonFile(repoUrl, file.path);
        const filename = `${script.slug}.json`;
        const filePath = join(this.localJsonDirectory, filename);
        
        script.repository_url = repoUrl;
        
        await writeFile(filePath, JSON.stringify(script, null, 2), 'utf-8');
        syncedFiles.push(filename);
        
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
