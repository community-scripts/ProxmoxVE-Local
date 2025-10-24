import { writeFile, mkdir } from 'fs/promises';
import { readFileSync, readdirSync, statSync, utimesSync } from 'fs';
import { join } from 'path';
import { Buffer } from 'buffer';

export class GitHubJsonService {
  constructor() {
    this.baseUrl = null;
    this.repoUrl = null;
    this.branch = null;
    this.jsonFolder = null;
    this.localJsonDirectory = null;
    this.scriptCache = new Map();
  }

  initializeConfig() {
    if (this.repoUrl === null) {
      // Get environment variables
      this.repoUrl = process.env.REPO_URL || "";
      this.branch = process.env.REPO_BRANCH || "main";
      this.jsonFolder = process.env.JSON_FOLDER || "scripts";
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

  async fetchFromGitHub(endpoint) {
    this.initializeConfig();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PVEScripts-Local/1.0',
        ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` })
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async syncJsonFiles() {
    try {
      this.initializeConfig();
      
      if (!this.baseUrl) {
        return {
          success: false,
          message: 'No GitHub repository configured'
        };
      }

      console.log('Starting fast incremental JSON sync...');
      
      // Ensure local directory exists
      await mkdir(this.localJsonDirectory, { recursive: true });
      
      // Step 1: Get file list from GitHub (single API call)
      console.log('Fetching file list from GitHub...');
      const files = await this.fetchFromGitHub(`/contents/${this.jsonFolder}?ref=${this.branch}`);
      
      if (!Array.isArray(files)) {
        throw new Error('Invalid response from GitHub API');
      }
      
      const jsonFiles = files.filter(file => file.name.endsWith('.json'));
      console.log(`Found ${jsonFiles.length} JSON files in repository`);
      
      // Step 2: Get local file list (fast local operation)
      const localFiles = new Map();
      try {
        console.log(`Looking for local files in: ${this.localJsonDirectory}`);
        const localFileList = readdirSync(this.localJsonDirectory);
        console.log(`Found ${localFileList.length} files in local directory`);
        for (const fileName of localFileList) {
          if (fileName.endsWith('.json')) {
            const filePath = join(this.localJsonDirectory, fileName);
            const stats = statSync(filePath);
            localFiles.set(fileName, {
              mtime: stats.mtime,
              size: stats.size
            });
          }
        }
      } catch (error) {
        console.log('Error reading local directory:', error.message);
        console.log('Directory path:', this.localJsonDirectory);
        console.log('No local files found, will download all');
      }
      
      console.log(`Found ${localFiles.size} local JSON files`);
      
      // Step 3: Compare and identify files that need syncing
      const filesToSync = [];
      let skippedCount = 0;
      
      for (const file of jsonFiles) {
        const localFile = localFiles.get(file.name);
        
        if (!localFile) {
          // File doesn't exist locally
          filesToSync.push(file);
          console.log(`Missing: ${file.name}`);
        } else {
          // Compare modification times and sizes
          const localMtime = new Date(localFile.mtime);
          const remoteMtime = new Date(file.updated_at);
          const localSize = localFile.size;
          const remoteSize = file.size;
          
          // Sync if remote is newer OR sizes are different (content changed)
          if (localMtime < remoteMtime || localSize !== remoteSize) {
            filesToSync.push(file);
            console.log(`Changed: ${file.name} (${localMtime.toISOString()} -> ${remoteMtime.toISOString()})`);
          } else {
            skippedCount++;
            console.log(`Up-to-date: ${file.name}`);
          }
        }
      }
      
      console.log(`Files to sync: ${filesToSync.length}, Up-to-date: ${skippedCount}`);
      
      // Step 4: Download only the files that need syncing
      let syncedCount = 0;
      const errors = [];
      const syncedFiles = [];
      
      // Process files in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < filesToSync.length; i += batchSize) {
        const batch = filesToSync.slice(i, i + batchSize);
        
        // Process batch in parallel
        const promises = batch.map(async (file) => {
          try {
            const content = await this.fetchFromGitHub(`/contents/${file.path}?ref=${this.branch}`);
            
            if (content.content) {
              // Decode base64 content
              const fileContent = Buffer.from(content.content, 'base64').toString('utf-8');
              
              // Write to local file
              const localPath = join(this.localJsonDirectory, file.name);
              await writeFile(localPath, fileContent, 'utf-8');
              
              // Update file modification time to match remote
              const remoteMtime = new Date(file.updated_at);
              utimesSync(localPath, remoteMtime, remoteMtime);
              
              syncedCount++;
              syncedFiles.push(file.name);
              console.log(`Synced: ${file.name}`);
            }
          } catch (error) {
            console.error(`Failed to sync ${file.name}:`, error.message);
            errors.push(`${file.name}: ${error.message}`);
          }
        });
        
        await Promise.all(promises);
        
        // Small delay between batches to be nice to the API
        if (i + batchSize < filesToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`JSON sync completed. Synced ${syncedCount} files, skipped ${skippedCount} files.`);
      
      return {
        success: true,
        message: `Successfully synced ${syncedCount} JSON files (${skippedCount} up-to-date)`,
        syncedCount,
        skippedCount,
        syncedFiles,
        errors
      };
      
    } catch (error) {
      console.error('JSON sync failed:', error);
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }
  }

  async getAllScripts() {
    try {
      this.initializeConfig();
      
      if (!this.localJsonDirectory) {
        return [];
      }
      
      const scripts = [];
      
      // Read all JSON files from local directory
      const files = readdirSync(this.localJsonDirectory);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(this.localJsonDirectory, file);
          const content = readFileSync(filePath, 'utf-8');
          const script = JSON.parse(content);
          
          if (script && typeof script === 'object') {
            scripts.push(script);
          }
        } catch (error) {
          console.error(`Failed to parse ${file}:`, error.message);
        }
      }
      
      return scripts;
    } catch (error) {
      console.error('Failed to get all scripts:', error);
      return [];
    }
  }

  /**
   * Get scripts only for specific JSON files that were synced
   */
  async getScriptsForFiles(syncedFiles) {
    try {
      this.initializeConfig();
      
      if (!this.localJsonDirectory || !syncedFiles || syncedFiles.length === 0) {
        return [];
      }
      
      const scripts = [];
      
      for (const fileName of syncedFiles) {
        try {
          const filePath = join(this.localJsonDirectory, fileName);
          const content = readFileSync(filePath, 'utf-8');
          const script = JSON.parse(content);
          
          if (script && typeof script === 'object') {
            scripts.push(script);
          }
        } catch (error) {
          console.error(`Failed to parse ${fileName}:`, error.message);
        }
      }
      
      return scripts;
    } catch (error) {
      console.error('Failed to get scripts for synced files:', error);
      return [];
    }
  }
}

export const githubJsonService = new GitHubJsonService();
