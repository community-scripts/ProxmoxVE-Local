import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { env } from '~/env.js';
import type { Script } from '~/types/script';

export class ScriptDownloaderService {
  private scriptsDirectory: string | null = null;
  private repoUrl: string | null = null;

  constructor() {
    // Initialize lazily to avoid accessing env vars during module load
  }

  private initializeConfig() {
    if (this.scriptsDirectory === null) {
      this.scriptsDirectory = join(process.cwd(), 'scripts');
      this.repoUrl = env.REPO_URL ?? 'https://github.com/community-scripts/ProxmoxVE';
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }
  }

  private extractRepoPath(repoUrl: string): string {
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(repoUrl);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    return `${match[1]}/${match[2]}`;
  }

  private async downloadFileFromGitHub(repoUrl: string, filePath: string, branch: string = 'main'): Promise<string> {
    this.initializeConfig();
    if (!repoUrl) {
      throw new Error('Repository URL is not set');
    }

    const repoPath = this.extractRepoPath(repoUrl);
    const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`;
    
    const headers: HeadersInit = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    const { env } = await import('~/env.js');
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath} from ${repoUrl}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private getRepoUrlForScript(script: Script): string {
    // Use repository_url from script if available, otherwise fallback to env or default
    if (script.repository_url) {
      return script.repository_url;
    }
    this.initializeConfig();
    return this.repoUrl!;
  }

  private modifyScriptContent(content: string): string {
    // Replace the build.func source line
    const oldPattern = /source <\(curl -fsSL https:\/\/raw\.githubusercontent\.com\/community-scripts\/ProxmoxVE\/main\/misc\/build\.func\)/g;
    const newPattern = 'SCRIPT_DIR="$(dirname "$0")" \nsource "$SCRIPT_DIR/../core/build.func"';
    
    return content.replace(oldPattern, newPattern);
    
  }

  async loadScript(script: Script): Promise<{ success: boolean; message: string; files: string[] }> {
    this.initializeConfig();
    try {
      const files: string[] = [];
      const repoUrl = this.getRepoUrlForScript(script);
      const { env } = await import('~/env.js');
      const branch = env.REPO_BRANCH ?? 'main';
      
      // Ensure directories exist
      await this.ensureDirectoryExists(join(this.scriptsDirectory!, 'ct'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory!, 'install'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory!, 'tools'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory!, 'vm'));

      if (script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              // Download from GitHub using the script's repository URL
              const content = await this.downloadFileFromGitHub(repoUrl, scriptPath, branch);
              
              // Determine target directory based on script path
              let targetDir: string;
              let finalTargetDir: string;
              let filePath: string;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                finalTargetDir = targetDir;
                // Modify the content for CT scripts
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory!, targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory!, finalTargetDir));
                filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory!, finalTargetDir));
                filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else if (scriptPath.startsWith('vw/')) {
                targetDir = 'vw';
                // Preserve subdirectory structure for VW scripts
                const subPath = scriptPath.replace('vw/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory!, finalTargetDir));
                filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else {
                // Handle other script types (fallback to ct directory)
                targetDir = 'ct';
                finalTargetDir = targetDir;
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory!, targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              }
              
              files.push(`${finalTargetDir}/${fileName}`);
            }
          }
        }
      }

      // Only download install script for CT scripts
      const hasCtScript = script.install_methods?.some(method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        try {
          const installContent = await this.downloadFileFromGitHub(repoUrl, `install/${installScriptName}`, branch);
          const localInstallPath = join(this.scriptsDirectory!, 'install', installScriptName);
          await writeFile(localInstallPath, installContent, 'utf-8');
          files.push(`install/${installScriptName}`);
        } catch {
          // Install script might not exist, that's okay
        }
      }

      return {
        success: true,
        message: `Successfully loaded ${files.length} script(s) for ${script.name}`,
        files
      };
    } catch (error) {
      console.error('Error loading script:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load script',
        files: []
      };
    }
  }

  /**
   * Auto-download new scripts that haven't been downloaded yet
   */
  async autoDownloadNewScripts(allScripts: Script[]): Promise<{ downloaded: string[]; errors: string[] }> {
    this.initializeConfig();
    const downloaded: string[] = [];
    const errors: string[] = [];

    for (const script of allScripts) {
      try {
        // Check if script is already downloaded
        const isDownloaded = await this.isScriptDownloaded(script);
        
        if (!isDownloaded) {
          const result = await this.loadScript(script);
          if (result.success) {
            downloaded.push(script.name || script.slug);
            console.log(`Auto-downloaded new script: ${script.name || script.slug}`);
          } else {
            errors.push(`${script.name || script.slug}: ${result.message}`);
          }
        }
      } catch (error) {
        const errorMsg = `${script.name || script.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`Failed to auto-download script ${script.slug}:`, error);
      }
    }

    return { downloaded, errors };
  }

  /**
   * Auto-update existing scripts to newer versions
   */
  async autoUpdateExistingScripts(allScripts: Script[]): Promise<{ updated: string[]; errors: string[] }> {
    this.initializeConfig();
    const updated: string[] = [];
    const errors: string[] = [];

    for (const script of allScripts) {
      try {
        // Check if script is downloaded
        const isDownloaded = await this.isScriptDownloaded(script);
        
        if (isDownloaded) {
          // Check if update is needed by comparing content
          const needsUpdate = await this.scriptNeedsUpdate(script);
          
          if (needsUpdate) {
            const result = await this.loadScript(script);
            if (result.success) {
              updated.push(script.name || script.slug);
              console.log(`Auto-updated script: ${script.name || script.slug}`);
            } else {
              errors.push(`${script.name || script.slug}: ${result.message}`);
            }
          }
        }
      } catch (error) {
        const errorMsg = `${script.name || script.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`Failed to auto-update script ${script.slug}:`, error);
      }
    }

    return { updated, errors };
  }

  /**
   * Check if a script is already downloaded
   */
  async isScriptDownloaded(script: Script): Promise<boolean> {
    if (!script.install_methods?.length) return false;

    // Check if ALL script files are downloaded
    for (const method of script.install_methods) {
      if (method.script) {
        const scriptPath = method.script;
        const fileName = scriptPath.split('/').pop();
        
        if (fileName) {
          // Determine target directory based on script path
          let targetDir: string;
          let finalTargetDir: string;
          let filePath: string;
          
          if (scriptPath.startsWith('ct/')) {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory!, targetDir, fileName);
          } else if (scriptPath.startsWith('tools/')) {
            targetDir = 'tools';
            const subPath = scriptPath.replace('tools/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vm/')) {
            targetDir = 'vm';
            const subPath = scriptPath.replace('vm/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vw/')) {
            targetDir = 'vw';
            const subPath = scriptPath.replace('vw/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory!, targetDir, fileName);
          }
          
          try {
            await readFile(filePath, 'utf8');
            // File exists, continue checking other methods
          } catch {
            // File doesn't exist, script is not fully downloaded
            return false;
          }
        }
      }
    }

    // All files exist, script is downloaded
    return true;
  }

  /**
   * Check if a script needs updating by comparing local and remote content
   */
  private async scriptNeedsUpdate(script: Script): Promise<boolean> {
    if (!script.install_methods?.length) return false;

    const repoUrl = this.getRepoUrlForScript(script);
    const { env } = await import('~/env.js');
    const branch = env.REPO_BRANCH ?? 'main';

    for (const method of script.install_methods) {
      if (method.script) {
        const scriptPath = method.script;
        const fileName = scriptPath.split('/').pop();
        
        if (fileName) {
          // Determine target directory based on script path
          let targetDir: string;
          let finalTargetDir: string;
          let filePath: string;
          
          if (scriptPath.startsWith('ct/')) {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory!, targetDir, fileName);
          } else if (scriptPath.startsWith('tools/')) {
            targetDir = 'tools';
            const subPath = scriptPath.replace('tools/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vm/')) {
            targetDir = 'vm';
            const subPath = scriptPath.replace('vm/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vw/')) {
            targetDir = 'vw';
            const subPath = scriptPath.replace('vw/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory!, finalTargetDir, fileName);
          } else {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory!, targetDir, fileName);
          }
          
          try {
            // Read local content
            const localContent = await readFile(filePath, 'utf8');
            
            // Download remote content from the script's repository
            const remoteContent = await this.downloadFileFromGitHub(repoUrl, scriptPath, branch);
            
            // Compare content (simple string comparison for now)
            // In a more sophisticated implementation, you might want to compare
            // file modification times or use content hashing
            return localContent !== remoteContent;
          } catch {
            // If we can't read local or download remote, assume update needed
            return true;
          }
        }
      }
    }

    return false;
  }

  async checkScriptExists(script: Script): Promise<{ ctExists: boolean; installExists: boolean; files: string[] }> {
    this.initializeConfig();
    const files: string[] = [];
    let ctExists = false;
    let installExists = false;

    try {
      // Check scripts based on their install methods
      if (script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              let targetDir: string;
              let localPath: string;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                localPath = join(this.scriptsDirectory!, targetDir, fileName);
                try {
                  await readFile(localPath, 'utf-8');
                  ctExists = true;
                  files.push(`${targetDir}/${fileName}`);
                } catch {
                  // File doesn't exist
                }
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                const finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                localPath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                try {
                  await readFile(localPath, 'utf-8');
                  ctExists = true; // Use ctExists for tools scripts too for UI consistency
                  files.push(`${finalTargetDir}/${fileName}`);
                } catch {
                  // File doesn't exist
                }
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                const finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                localPath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                try {
                  await readFile(localPath, 'utf-8');
                  ctExists = true; // Use ctExists for VM scripts too for UI consistency
                  files.push(`${finalTargetDir}/${fileName}`);
                } catch {
                  // File doesn't exist
                }
              } else if (scriptPath.startsWith('vw/')) {
                targetDir = 'vw';
                // Preserve subdirectory structure for VW scripts
                const subPath = scriptPath.replace('vw/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                const finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                localPath = join(this.scriptsDirectory!, finalTargetDir, fileName);
                try {
                  await readFile(localPath, 'utf-8');
                  ctExists = true; // Use ctExists for VW scripts too for UI consistency
                  files.push(`${finalTargetDir}/${fileName}`);
                } catch {
                  // File doesn't exist
                }
              }
            }
          }
        }
      }

      // Only check install script for CT scripts
      const hasCtScript = script.install_methods?.some(method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
      const localInstallPath = join(this.scriptsDirectory!, 'install', installScriptName);
      try {
        await readFile(localInstallPath, 'utf-8');
        installExists = true;
        files.push(`install/${installScriptName}`);
      } catch {
        // File doesn't exist
      }
      }

      return { ctExists, installExists, files };
    } catch (error) {
      console.error('Error checking script existence:', error);
      return { ctExists: false, installExists: false, files: [] };
    }
  }

  async deleteScript(script: Script): Promise<{ success: boolean; message: string; deletedFiles: string[] }> {
    this.initializeConfig();
    const deletedFiles: string[] = [];
    
    try {
      // Get the list of files that exist for this script
      const fileCheck = await this.checkScriptExists(script);
      
      if (fileCheck.files.length === 0) {
        return {
          success: false,
          message: 'No script files found to delete',
          deletedFiles: []
        };
      }

      // Delete all files
      for (const filePath of fileCheck.files) {
        try {
          const fullPath = join(this.scriptsDirectory!, filePath);
          await unlink(fullPath);
          deletedFiles.push(filePath);
        } catch (error) {
          // Log error but continue deleting other files
          console.error(`Error deleting file ${filePath}:`, error);
        }
      }

      if (deletedFiles.length === 0) {
        return {
          success: false,
          message: 'Failed to delete any script files',
          deletedFiles: []
        };
      }

      return {
        success: true,
        message: `Successfully deleted ${deletedFiles.length} file(s) for ${script.name}`,
        deletedFiles
      };
    } catch (error) {
      console.error('Error deleting script:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete script',
        deletedFiles
      };
    }
  }

  async compareScriptContent(script: Script): Promise<{ hasDifferences: boolean; differences: string[] }> {
    this.initializeConfig();
    const differences: string[] = [];
    let hasDifferences = false;

    try {
      // First check if any local files exist
      const localFilesExist = await this.checkScriptExists(script);
      if (!localFilesExist.ctExists && !localFilesExist.installExists) {
        // No local files exist, so no comparison needed
        return { hasDifferences: false, differences: [] };
      }

      // If we have local files, proceed with comparison
      // Use Promise.all to run comparisons in parallel
      const comparisonPromises: Promise<void>[] = [];

      // Compare scripts only if they exist locally
      if (localFilesExist.ctExists && script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              let targetDir: string;
              let finalTargetDir: string;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                finalTargetDir = targetDir;
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
              } else if (scriptPath.startsWith('vw/')) {
                targetDir = 'vw';
                // Preserve subdirectory structure for VW scripts
                const subPath = scriptPath.replace('vw/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
              } else {
                continue; // Skip unknown script types
              }
              
              comparisonPromises.push(
                this.compareSingleFile(script, scriptPath, `${finalTargetDir}/${fileName}`)
                  .then(result => {
                    if (result.hasDifferences) {
                      hasDifferences = true;
                      differences.push(result.filePath);
                    }
                  })
                  .catch(() => {
                    // Don't add to differences if there's an error reading files
                  })
              );
            }
          }
        }
      }

      // Compare install script only if it exists locally
      if (localFilesExist.installExists) {
        const installScriptName = `${script.slug}-install.sh`;
        const installScriptPath = `install/${installScriptName}`;
        
        comparisonPromises.push(
          this.compareSingleFile(script, installScriptPath, installScriptPath)
            .then(result => {
              if (result.hasDifferences) {
                hasDifferences = true;
                differences.push(result.filePath);
              }
            })
            .catch(() => {
              // Don't add to differences if there's an error reading files
            })
        );
      }

      // Wait for all comparisons to complete
      await Promise.all(comparisonPromises);

      return { hasDifferences, differences };
    } catch (error) {
      console.error('Error comparing script content:', error);
      return { hasDifferences: false, differences: [] };
    }
  }

  private async compareSingleFile(script: Script, remotePath: string, filePath: string): Promise<{ hasDifferences: boolean; filePath: string }> {
    try {
      const localPath = join(this.scriptsDirectory!, filePath);
      const repoUrl = this.getRepoUrlForScript(script);
      const { env } = await import('~/env.js');
      const branch = env.REPO_BRANCH ?? 'main';
      
      // Read local content
      const localContent = await readFile(localPath, 'utf-8');
      
      // Download remote content from the script's repository
      const remoteContent = await this.downloadFileFromGitHub(repoUrl, remotePath, branch);
      
      // Apply modification only for CT scripts, not for other script types
      let modifiedRemoteContent: string;
      if (remotePath.startsWith('ct/')) {
        modifiedRemoteContent = this.modifyScriptContent(remoteContent);
      } else {
        modifiedRemoteContent = remoteContent; // Don't modify tools, vm, or vw scripts
      }
      
      // Compare content
      const hasDifferences = localContent !== modifiedRemoteContent;
      
      return { hasDifferences, filePath };
    } catch (error) {
      console.error(`Error comparing file ${filePath}:`, error);
      return { hasDifferences: false, filePath };
    }
  }

  async getScriptDiff(script: Script, filePath: string): Promise<{ diff: string | null; localContent: string | null; remoteContent: string | null }> {
    this.initializeConfig();
    try {
      const repoUrl = this.getRepoUrlForScript(script);
      const { env } = await import('~/env.js');
      const branch = env.REPO_BRANCH ?? 'main';
      let localContent: string | null = null;
      let remoteContent: string | null = null;

      if (filePath.startsWith('ct/')) {
        // Handle CT script
        const fileName = filePath.split('/').pop();
        if (fileName) {
          const localPath = join(this.scriptsDirectory!, 'ct', fileName);
          try {
            localContent = await readFile(localPath, 'utf-8');
          } catch {
            // Error reading local CT script
          }

          try {
            // Find the corresponding script path in install_methods
            const method = script.install_methods?.find(m => m.script === filePath);
            if (method?.script) {
              const downloadedContent = await this.downloadFileFromGitHub(repoUrl, method.script, branch);
              remoteContent = this.modifyScriptContent(downloadedContent);
            }
          } catch {
            // Error downloading remote CT script
          }
        }
      } else if (filePath.startsWith('install/')) {
        // Handle install script
        const localPath = join(this.scriptsDirectory!, filePath);
        try {
          localContent = await readFile(localPath, 'utf-8');
        } catch {
          // Error reading local install script
        }

        try {
          remoteContent = await this.downloadFileFromGitHub(repoUrl, filePath, branch);
        } catch {
          // Error downloading remote install script
        }
      }

      if (!localContent || !remoteContent) {
        return { diff: null, localContent, remoteContent };
      }

      // Generate diff using a simple line-by-line comparison
      const diff = this.generateDiff(localContent, remoteContent);
      return { diff, localContent, remoteContent };
    } catch (error) {
      console.error('Error getting script diff:', error);
      return { diff: null, localContent: null, remoteContent: null };
    }
  }

  private generateDiff(localContent: string, remoteContent: string): string {
    const localLines = localContent.split('\n');
    const remoteLines = remoteContent.split('\n');
    
    let diff = '';
    let i = 0;
    let j = 0;

    while (i < localLines.length || j < remoteLines.length) {
      const localLine = localLines[i];
      const remoteLine = remoteLines[j];

      if (i >= localLines.length) {
        // Only remote lines left
        diff += `+${j + 1}: ${remoteLine}\n`;
        j++;
      } else if (j >= remoteLines.length) {
        // Only local lines left
        diff += `-${i + 1}: ${localLine}\n`;
        i++;
      } else if (localLine === remoteLine) {
        // Lines are the same
        diff += ` ${i + 1}: ${localLine}\n`;
        i++;
        j++;
      } else {
        // Lines are different - find the best match
        let found = false;
        for (let k = j + 1; k < Math.min(j + 10, remoteLines.length); k++) {
          if (localLine === remoteLines[k]) {
            // Found match in remote, local line was removed
            for (let l = j; l < k; l++) {
              diff += `+${l + 1}: ${remoteLines[l]}\n`;
            }
            diff += ` ${i + 1}: ${localLine}\n`;
            i++;
            j = k + 1;
            found = true;
            break;
          }
        }
        
        if (!found) {
          for (let k = i + 1; k < Math.min(i + 10, localLines.length); k++) {
            if (remoteLine === localLines[k]) {
              // Found match in local, remote line was added
              diff += `-${i + 1}: ${localLine}\n`;
              for (let l = i + 1; l < k; l++) {
                diff += `-${l + 1}: ${localLines[l]}\n`;
              }
              diff += `+${j + 1}: ${remoteLine}\n`;
              i = k + 1;
              j++;
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          // No match found, lines are different
          diff += `-${i + 1}: ${localLine}\n`;
          diff += `+${j + 1}: ${remoteLine}\n`;
          i++;
          j++;
        }
      }
    }

    return diff;
  }
}

// Singleton instance
export const scriptDownloaderService = new ScriptDownloaderService();
