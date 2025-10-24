// Real JavaScript implementation for script downloading
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

export class ScriptDownloaderService {
  constructor() {
    this.scriptsDirectory = null;
    this.repoUrl = null;
  }

  initializeConfig() {
    if (this.scriptsDirectory === null) {
      this.scriptsDirectory = join(process.cwd(), 'scripts');
      // Get REPO_URL from environment or use default
      this.repoUrl = process.env.REPO_URL || 'https://github.com/community-scripts/ProxmoxVE';
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async downloadFileFromGitHub(filePath) {
    this.initializeConfig();
    if (!this.repoUrl) {
      throw new Error('REPO_URL environment variable is not set');
    }

    // Extract repo path from URL
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(this.repoUrl);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    const [, owner, repo] = match;
    
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
    
    console.log(`Downloading from GitHub: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  modifyScriptContent(content) {
    // Replace the build.func source line
    const oldPattern = /source <\(curl -fsSL https:\/\/raw\.githubusercontent\.com\/community-scripts\/ProxmoxVE\/main\/misc\/build\.func\)/g;
    const newPattern = 'SCRIPT_DIR="$(dirname "$0")" \nsource "$SCRIPT_DIR/../core/build.func"';
    
    return content.replace(oldPattern, newPattern);
  }

  async loadScript(script) {
    this.initializeConfig();
    try {
      const files = [];
      
      // Ensure directories exist
      await this.ensureDirectoryExists(join(this.scriptsDirectory, 'ct'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory, 'install'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory, 'tools'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory, 'vm'));

      if (script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              // Download from GitHub
              console.log(`Downloading script file: ${scriptPath}`);
              const content = await this.downloadFileFromGitHub(scriptPath);
              
              // Determine target directory based on script path
              let targetDir;
              let finalTargetDir;
              let filePath;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                finalTargetDir = targetDir;
                // Modify the content for CT scripts
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory, targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory, finalTargetDir));
                filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory, finalTargetDir));
                filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else if (scriptPath.startsWith('vw/')) {
                targetDir = 'vw';
                // Preserve subdirectory structure for VW scripts
                const subPath = scriptPath.replace('vw/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory, finalTargetDir));
                filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else {
                // Handle other script types (fallback to ct directory)
                targetDir = 'ct';
                finalTargetDir = targetDir;
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory, targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              }
              
              files.push(`${finalTargetDir}/${fileName}`);
              console.log(`Successfully downloaded: ${finalTargetDir}/${fileName}`);
            }
          }
        }
      }

      // Only download install script for CT scripts
      const hasCtScript = script.install_methods?.some(method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        try {
          console.log(`Downloading install script: install/${installScriptName}`);
          const installContent = await this.downloadFileFromGitHub(`install/${installScriptName}`);
          const localInstallPath = join(this.scriptsDirectory, 'install', installScriptName);
          await writeFile(localInstallPath, installContent, 'utf-8');
          files.push(`install/${installScriptName}`);
          console.log(`Successfully downloaded: install/${installScriptName}`);
        } catch (error) {
          // Install script might not exist, that's okay
          console.log(`Install script not found: install/${installScriptName}`);
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

  async isScriptDownloaded(script) {
    if (!script.install_methods?.length) return false;

    // Check if ALL script files are downloaded
    for (const method of script.install_methods) {
      if (method.script) {
        const scriptPath = method.script;
        const fileName = scriptPath.split('/').pop();
        
        if (fileName) {
          // Determine target directory based on script path
          let targetDir;
          let finalTargetDir;
          let filePath;
          
          if (scriptPath.startsWith('ct/')) {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory, targetDir, fileName);
          } else if (scriptPath.startsWith('tools/')) {
            targetDir = 'tools';
            const subPath = scriptPath.replace('tools/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vm/')) {
            targetDir = 'vm';
            const subPath = scriptPath.replace('vm/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vw/')) {
            targetDir = 'vw';
            const subPath = scriptPath.replace('vw/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory, finalTargetDir, fileName);
          } else {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory, targetDir, fileName);
          }
          
          try {
            await import('fs/promises').then(fs => fs.readFile(filePath, 'utf8'));
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

  async checkScriptExists(script) {
    this.initializeConfig();
    const files = [];
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
              let targetDir;
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
              } else {
                targetDir = 'ct'; // Default fallback
              }
              
              const filePath = join(this.scriptsDirectory, targetDir, fileName);
              
              try {
                await access(filePath);
                files.push(`${targetDir}/${fileName}`);
                
                if (scriptPath.startsWith('ct/')) {
                  ctExists = true;
                }
              } catch {
                // File doesn't exist
              }
            }
          }
        }
      }

      // Check for install script for CT scripts
      const hasCtScript = script.install_methods?.some(method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        const installPath = join(this.scriptsDirectory, 'install', installScriptName);
        
        try {
          await access(installPath);
          files.push(`install/${installScriptName}`);
          installExists = true;
        } catch {
          // Install script doesn't exist
        }
      }

      return { ctExists, installExists, files };
    } catch (error) {
      console.error('Error checking script existence:', error);
      return { ctExists: false, installExists: false, files: [] };
    }
  }
}

export const scriptDownloaderService = new ScriptDownloaderService();
