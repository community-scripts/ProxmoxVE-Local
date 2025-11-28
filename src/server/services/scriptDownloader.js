// Real JavaScript implementation for script downloading
import { join } from 'path';
import { writeFile, mkdir, access, readFile, unlink } from 'fs/promises';

export class ScriptDownloaderService {
  /**
   * @type {string | undefined}
   */
  scriptsDirectory;
  /**
   * @type {string | undefined}
   */
  repoUrl;

  constructor() {
    this.scriptsDirectory = undefined;
    this.repoUrl = undefined;
  }

  initializeConfig() {
    if (this.scriptsDirectory === undefined) {
      this.scriptsDirectory = join(process.cwd(), 'scripts');
      // Get REPO_URL from environment or use default
      this.repoUrl = process.env.REPO_URL || 'https://github.com/community-scripts/ProxmoxVE';
    }
  }

  /**
   * Validates that a directory path doesn't contain nested directories with the same name
   * (e.g., prevents ct/ct or install/install)
   * @param {string} dirPath
   */
  validateDirectoryPath(dirPath) {
    const normalizedPath = dirPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    
    // Check for consecutive duplicate directory names
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === parts[i + 1] && parts[i] !== '') {
        throw new Error(`Invalid directory path: nested directory detected (${parts[i]}/${parts[i + 1]}) in path: ${dirPath}`);
      }
    }
    
    return true;
  }

  /**
   * Validates that finalTargetDir doesn't contain nested directory names like ct/ct or install/install
   * @param {string} targetDir
   * @param {string} finalTargetDir
   */
  validateTargetDir(targetDir, finalTargetDir) {
    // Check if finalTargetDir contains nested directory names
    const normalized = finalTargetDir.replace(/\\/g, '/');
    const parts = normalized.split('/');
    
    // Check for consecutive duplicate directory names
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === parts[i + 1]) {
        console.warn(`[Path Validation] Detected nested directory pattern "${parts[i]}/${parts[i + 1]}" in finalTargetDir: ${finalTargetDir}. Using base directory "${targetDir}" instead.`);
        return targetDir; // Return the base directory instead
      }
    }
    
    return finalTargetDir;
  }

  /**
   * @param {string} dirPath
   */
  async ensureDirectoryExists(dirPath) {
    // Validate the directory path to prevent nested directories with the same name
    this.validateDirectoryPath(dirPath);
    
    try {
      console.log(`[Directory Creation] Ensuring directory exists: ${dirPath}`);
      await mkdir(dirPath, { recursive: true });
      console.log(`[Directory Creation] Directory created/verified: ${dirPath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      /** @type {any} */
      const errAny = err;
      if (errAny.code !== 'EEXIST') {
        console.error(`[Directory Creation] Error creating directory ${dirPath}:`, err.message);
        throw err;
      }
      // Directory already exists, which is fine
      console.log(`[Directory Creation] Directory already exists: ${dirPath}`);
    }
  }

  /**
   * @param {string} repoUrl
   */
  extractRepoPath(repoUrl) {
    const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(repoUrl);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    return `${match[1]}/${match[2]}`;
  }

  /**
   * @param {string} repoUrl
   * @param {string} filePath
   * @param {string} [branch]
   */
  async downloadFileFromGitHub(repoUrl, filePath, branch = 'main') {
    this.initializeConfig();
    if (!repoUrl) {
      throw new Error('Repository URL is not set');
    }

    const repoPath = this.extractRepoPath(repoUrl);
    const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`;
    
    /** @type {Record<string, string>} */
    const headers = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    
    // Add GitHub token authentication if available
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    console.log(`Downloading from GitHub: ${url}`);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath} from ${repoUrl}: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * @param {any} script
   */
  getRepoUrlForScript(script) {
    // Use repository_url from script if available, otherwise fallback to env or default
    if (script.repository_url) {
      return script.repository_url;
    }
    this.initializeConfig();
    return this.repoUrl;
  }

  /**
   * @param {string} content
   */
  modifyScriptContent(content) {
    // Replace the build.func source line
    const oldPattern = /source <\(curl -fsSL https:\/\/raw\.githubusercontent\.com\/community-scripts\/ProxmoxVE\/main\/misc\/build\.func\)/g;
    const newPattern = 'SCRIPT_DIR="$(dirname "$0")" \nsource "$SCRIPT_DIR/../core/build.func"';
    
    return content.replace(oldPattern, newPattern);
  }

  /**
   * @param {any} script
   */
  async loadScript(script) {
    this.initializeConfig();
    try {
      const files = [];
      const repoUrl = this.getRepoUrlForScript(script);
      const branch = process.env.REPO_BRANCH || 'main';
      
      console.log(`Loading script "${script.name}" (${script.slug}) from repository: ${repoUrl}`);
      
      // Ensure directories exist
      await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', 'ct'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', 'install'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', 'tools'));
      await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', 'vm'));

      if (script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              // Download from GitHub using the script's repository URL
              console.log(`Downloading script file: ${scriptPath} from ${repoUrl}`);
              const content = await this.downloadFileFromGitHub(repoUrl, scriptPath, branch);
              
              // Determine target directory based on script path
              let targetDir;
              let finalTargetDir;
              let filePath;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                finalTargetDir = targetDir;
                // Validate and sanitize finalTargetDir
                finalTargetDir = this.validateTargetDir(targetDir, finalTargetDir);
                // Modify the content for CT scripts
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Validate and sanitize finalTargetDir
                finalTargetDir = this.validateTargetDir(targetDir, finalTargetDir);
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', finalTargetDir));
                filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                // Validate and sanitize finalTargetDir
                finalTargetDir = this.validateTargetDir(targetDir, finalTargetDir);
                // Ensure the subdirectory exists
                await this.ensureDirectoryExists(join(this.scriptsDirectory ?? '', finalTargetDir));
                filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
                await writeFile(filePath, content, 'utf-8');
              } else {
                // Handle other script types (fallback to ct directory)
                targetDir = 'ct';
                finalTargetDir = targetDir;
                // Validate and sanitize finalTargetDir
                finalTargetDir = this.validateTargetDir(targetDir, finalTargetDir);
                const modifiedContent = this.modifyScriptContent(content);
                filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
                await writeFile(filePath, modifiedContent, 'utf-8');
              }
              
              files.push(`${finalTargetDir}/${fileName}`);
              console.log(`Successfully downloaded: ${finalTargetDir}/${fileName}`);
            }
          }
        }
      }

      // Only download install script for CT scripts
      const hasCtScript = script.install_methods?.some(/** @param {any} method */ method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        try {
          console.log(`Downloading install script: install/${installScriptName} from ${repoUrl}`);
          const installContent = await this.downloadFileFromGitHub(repoUrl, `install/${installScriptName}`, branch);
          const localInstallPath = join(this.scriptsDirectory ?? '', 'install', installScriptName);
          await writeFile(localInstallPath, installContent, 'utf-8');
          files.push(`install/${installScriptName}`);
          console.log(`Successfully downloaded: install/${installScriptName}`);
        } catch (error) {
          // Install script might not exist, that's okay
          console.log(`Install script not found: install/${installScriptName}`);
        }
      }

      // Download alpine install script if alpine variant exists (only for CT scripts)
      const hasAlpineCtVariant = script.install_methods?.some(
        /** @param {any} method */ method => method.type === 'alpine' && method.script?.startsWith('ct/')
      );
      console.log(`[${script.slug}] Checking for alpine variant:`, {
        hasAlpineCtVariant,
        installMethods: script.install_methods?.map(/** @param {any} m */ m => ({ type: m.type, script: m.script }))
      });
      
      if (hasAlpineCtVariant) {
        const alpineInstallScriptName = `alpine-${script.slug}-install.sh`;
        try {
          console.log(`[${script.slug}] Downloading alpine install script: install/${alpineInstallScriptName} from ${repoUrl}`);
          const alpineInstallContent = await this.downloadFileFromGitHub(repoUrl, `install/${alpineInstallScriptName}`, branch);
          const localAlpineInstallPath = join(this.scriptsDirectory ?? '', 'install', alpineInstallScriptName);
          await writeFile(localAlpineInstallPath, alpineInstallContent, 'utf-8');
          files.push(`install/${alpineInstallScriptName}`);
          console.log(`[${script.slug}] Successfully downloaded: install/${alpineInstallScriptName}`);
        } catch (error) {
          // Alpine install script might not exist, that's okay
          console.error(`[${script.slug}] Alpine install script not found or error: install/${alpineInstallScriptName}`, error);
          if (error instanceof Error) {
            console.error(`[${script.slug}] Error details:`, error.message, error.stack);
          }
        }
      } else {
        console.log(`[${script.slug}] No alpine CT variant found, skipping alpine install script download`);
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
   * @param {any} script
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
            filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
          } else if (scriptPath.startsWith('tools/')) {
            targetDir = 'tools';
            const subPath = scriptPath.replace('tools/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
          } else if (scriptPath.startsWith('vm/')) {
            targetDir = 'vm';
            const subPath = scriptPath.replace('vm/', '');
            const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
            finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
            filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
          } else {
            targetDir = 'ct';
            finalTargetDir = targetDir;
            filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
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

  /**
   * @param {any} script
   */
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
              let finalTargetDir;
              let filePath;
              
              if (scriptPath.startsWith('ct/')) {
                targetDir = 'ct';
                finalTargetDir = targetDir;
                filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
              } else if (scriptPath.startsWith('tools/')) {
                targetDir = 'tools';
                // Preserve subdirectory structure for tools scripts
                const subPath = scriptPath.replace('tools/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
              } else if (scriptPath.startsWith('vm/')) {
                targetDir = 'vm';
                // Preserve subdirectory structure for VM scripts
                const subPath = scriptPath.replace('vm/', '');
                const subDir = subPath.includes('/') ? subPath.substring(0, subPath.lastIndexOf('/')) : '';
                finalTargetDir = subDir ? join(targetDir, subDir) : targetDir;
                filePath = join(this.scriptsDirectory ?? '', finalTargetDir, fileName);
              } else {
                targetDir = 'ct'; // Default fallback
                finalTargetDir = targetDir;
                filePath = join(this.scriptsDirectory ?? '', targetDir, fileName);
              }
              
              try {
                await access(filePath);
                files.push(`${finalTargetDir}/${fileName}`);
                
                // Set ctExists for all script types (CT, tools, vm) for UI consistency
                if (scriptPath.startsWith('ct/') || scriptPath.startsWith('tools/') || scriptPath.startsWith('vm/')) {
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
      const hasCtScript = script.install_methods?.some(/** @param {any} method */ method => method.script?.startsWith('ct/'));
      if (hasCtScript) {
        const installScriptName = `${script.slug}-install.sh`;
        const installPath = join(this.scriptsDirectory ?? '', 'install', installScriptName);
        
        try {
          await access(installPath);
          files.push(`install/${installScriptName}`);
          installExists = true;
        } catch {
          // Install script doesn't exist
        }
      }

      // Check alpine install script if alpine variant exists (only for CT scripts)
      const hasAlpineCtVariant = script.install_methods?.some(
        /** @param {any} method */ method => method.type === 'alpine' && method.script?.startsWith('ct/')
      );
      if (hasAlpineCtVariant) {
        const alpineInstallScriptName = `alpine-${script.slug}-install.sh`;
        const alpineInstallPath = join(this.scriptsDirectory ?? '', 'install', alpineInstallScriptName);
        
        try {
          await access(alpineInstallPath);
          files.push(`install/${alpineInstallScriptName}`);
          installExists = true; // Mark as exists if alpine install script exists
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

  /**
   * @param {any} script
   */
  async deleteScript(script) {
    this.initializeConfig();
    const deletedFiles = [];
    
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
          const fullPath = join(this.scriptsDirectory ?? '', filePath);
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

  /**
   * @param {any} script
   */
  async compareScriptContent(script) {
    this.initializeConfig();
    /** @type {any[]} */
    const differences = [];
    let hasDifferences = false;
    const repoUrl = this.getRepoUrlForScript(script);
    const branch = process.env.REPO_BRANCH || 'main';

    try {
      // First check if any local files exist
      const localFilesExist = await this.checkScriptExists(script);
      if (!localFilesExist.ctExists && !localFilesExist.installExists) {
        // No local files exist, so no comparison needed
        return { hasDifferences: false, differences: [] };
      }

      // If we have local files, proceed with comparison
      // Use Promise.all to run comparisons in parallel
      const comparisonPromises = [];

      // Compare scripts only if they exist locally
      if (localFilesExist.ctExists && script.install_methods?.length) {
        for (const method of script.install_methods) {
          if (method.script) {
            const scriptPath = method.script;
            const fileName = scriptPath.split('/').pop();
            
            if (fileName) {
              let targetDir;
              let finalTargetDir;
              
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
              } else {
                continue; // Skip unknown script types
              }
              
              comparisonPromises.push(
                this.compareSingleFile(script, scriptPath, `${finalTargetDir}/${fileName}`)
                  .then(result => {
                    if (result.error) {
                      console.error(`[Comparison] Error comparing ${result.filePath}: ${result.error}`);
                    }
                    if (result.hasDifferences) {
                      hasDifferences = true;
                      differences.push(result.filePath);
                    }
                  })
                  .catch((error) => {
                    console.error(`[Comparison] Promise error for ${scriptPath}:`, error);
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
              if (result.error) {
                console.error(`[Comparison] Error comparing ${result.filePath}: ${result.error}`);
              }
              if (result.hasDifferences) {
                hasDifferences = true;
                differences.push(result.filePath);
              }
            })
            .catch((error) => {
              console.error(`[Comparison] Promise error for ${installScriptPath}:`, error);
            })
        );
      }

      // Compare alpine install script if alpine variant exists (only for CT scripts)
      const hasAlpineCtVariant = script.install_methods?.some(
        /** @param {any} method */ method => method.type === 'alpine' && method.script?.startsWith('ct/')
      );
      if (hasAlpineCtVariant) {
        const alpineInstallScriptName = `alpine-${script.slug}-install.sh`;
        const alpineInstallScriptPath = `install/${alpineInstallScriptName}`;
        const localAlpineInstallPath = join(this.scriptsDirectory ?? '', alpineInstallScriptPath);
        
        // Check if alpine install script exists locally
        try {
          await access(localAlpineInstallPath);
          comparisonPromises.push(
            this.compareSingleFile(script, alpineInstallScriptPath, alpineInstallScriptPath)
              .then(result => {
                if (result.error) {
                  console.error(`[Comparison] Error comparing ${result.filePath}: ${result.error}`);
                }
                if (result.hasDifferences) {
                  hasDifferences = true;
                  differences.push(result.filePath);
                }
              })
              .catch((error) => {
                console.error(`[Comparison] Promise error for ${alpineInstallScriptPath}:`, error);
              })
          );
        } catch {
          // Alpine install script doesn't exist locally, skip comparison
        }
      }

      // Wait for all comparisons to complete
      await Promise.all(comparisonPromises);

      console.log(`[Comparison] Completed comparison for ${script.slug}: hasDifferences=${hasDifferences}, differences=${differences.length}`);
      return { hasDifferences, differences };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Comparison] Error comparing script content for ${script.slug}:`, error);
      return { hasDifferences: false, differences: [], error: errorMessage };
    }
  }

  /**
   * @param {any} script
   * @param {string} remotePath
   * @param {string} filePath
   */
  async compareSingleFile(script, remotePath, filePath) {
    try {
      const localPath = join(this.scriptsDirectory ?? '', filePath);
      const repoUrl = this.getRepoUrlForScript(script);
      const branch = process.env.REPO_BRANCH || 'main';
      
      console.log(`[Comparison] Comparing ${filePath} from ${repoUrl} (branch: ${branch})`);
      
      // Read local content
      const localContent = await readFile(localPath, 'utf-8');
      console.log(`[Comparison] Local file size: ${localContent.length} bytes`);
      
      // Download remote content from the script's repository
      const remoteContent = await this.downloadFileFromGitHub(repoUrl, remotePath, branch);
      console.log(`[Comparison] Remote file size: ${remoteContent.length} bytes`);
      
      // Apply modification only for CT scripts, not for other script types
      let modifiedRemoteContent;
      if (remotePath.startsWith('ct/')) {
        modifiedRemoteContent = this.modifyScriptContent(remoteContent);
        console.log(`[Comparison] Applied CT script modifications`);
      } else {
        modifiedRemoteContent = remoteContent; // Don't modify tools or vm scripts
      }
      
      // Compare content
      const hasDifferences = localContent !== modifiedRemoteContent;
      
      if (hasDifferences) {
        console.log(`[Comparison] Differences found in ${filePath}`);
      } else {
        console.log(`[Comparison] No differences in ${filePath}`);
      }
      
      return { hasDifferences, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Comparison] Error comparing file ${filePath}:`, errorMessage);
      // Return error information so it can be handled upstream
      return { hasDifferences: false, filePath, error: errorMessage };
    }
  }

  /**
   * @param {any} script
   * @param {string} filePath
   */
  async getScriptDiff(script, filePath) {
    this.initializeConfig();
    try {
      const repoUrl = this.getRepoUrlForScript(script);
      const branch = process.env.REPO_BRANCH || 'main';
      let localContent = null;
      let remoteContent = null;

      if (filePath.startsWith('ct/')) {
        // Handle CT script
        const fileName = filePath.split('/').pop();
        if (fileName) {
          const localPath = join(this.scriptsDirectory ?? '', 'ct', fileName);
          try {
            localContent = await readFile(localPath, 'utf-8');
          } catch {
            // Error reading local CT script
          }

          try {
            // Find the corresponding script path in install_methods
            const method = script.install_methods?.find(/** @param {any} m */ m => m.script === filePath);
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
        const localPath = join(this.scriptsDirectory ?? '', filePath);
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

  /**
   * @param {string} localContent
   * @param {string} remoteContent
   */
  generateDiff(localContent, remoteContent) {
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

export const scriptDownloaderService = new ScriptDownloaderService();

