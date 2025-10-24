import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class ScriptDownloaderService {
  constructor() {
    this.scriptsDirectory = null;
  }

  initializeConfig() {
    if (this.scriptsDirectory === null) {
      this.scriptsDirectory = join(process.cwd(), 'scripts');
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
    // This is a simplified version - in a real implementation,
    // you would fetch the file content from GitHub
    // For now, we'll return a placeholder
    return `#!/bin/bash
# Downloaded script: ${filePath}
# This is a placeholder - implement actual GitHub file download
echo "Script downloaded: ${filePath}"
`;
  }

  modifyScriptContent(content) {
    // Modify script content for CT scripts if needed
    return content;
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
            }
          }
        }
      }

      // Only download install script for CT scripts
      const hasCtScript = script.install_methods?.some(method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        try {
          const installContent = await this.downloadFileFromGitHub(`install/${installScriptName}`);
          const localInstallPath = join(this.scriptsDirectory, 'install', installScriptName);
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
  async autoDownloadNewScripts(allScripts) {
    this.initializeConfig();
    const downloaded = [];
    const errors = [];

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
  async autoUpdateExistingScripts(allScripts) {
    this.initializeConfig();
    const updated = [];
    const errors = [];

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
  async scriptNeedsUpdate(script) {
    if (!script.install_methods?.length) return false;

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
            // Read local content
            const localContent = await readFile(filePath, 'utf8');
            
            // Download remote content
            const remoteContent = await this.downloadFileFromGitHub(scriptPath);
            
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
}

export const scriptDownloaderService = new ScriptDownloaderService();
