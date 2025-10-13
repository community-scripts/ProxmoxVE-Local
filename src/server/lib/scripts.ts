import { readdir, stat, readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { env } from '~/env.js';
import { spawn, type ChildProcess } from 'child_process';
import { localScriptsService } from '~/server/services/localScripts';

export interface ScriptInfo {
  name: string;
  path: string;
  extension: string;
  size: number;
  lastModified: Date;
  executable: boolean;
  logo?: string;
  slug?: string;
}

export class ScriptManager {
  private scriptsDir: string | null = null;
  private allowedExtensions: string[] | null = null;
  private allowedPaths: string[] | null = null;
  private maxExecutionTime: number | null = null;

  constructor() {
    // Initialize lazily to avoid accessing env vars during module load
  }

  private initializeConfig() {
    if (this.scriptsDir === null) {
      // Handle both absolute and relative paths for testing
      this.scriptsDir = env.SCRIPTS_DIRECTORY.startsWith('/') 
        ? env.SCRIPTS_DIRECTORY 
        : join(process.cwd(), env.SCRIPTS_DIRECTORY);
      this.allowedExtensions = env.ALLOWED_SCRIPT_EXTENSIONS.split(',').map(ext => ext.trim());
      this.allowedPaths = env.ALLOWED_SCRIPT_PATHS.split(',').map(path => path.trim());
      this.maxExecutionTime = parseInt(env.MAX_SCRIPT_EXECUTION_TIME, 10);
    }
  }

  /**
   * Get all available scripts in the scripts directory
   */
  async getScripts(): Promise<ScriptInfo[]> {
    this.initializeConfig();
    try {
      const files = await readdir(this.scriptsDir!);
      const scripts: ScriptInfo[] = [];

      for (const file of files) {
        const filePath = join(this.scriptsDir!, file);
        const stats = await stat(filePath);

        if (stats.isFile()) {
          const extension = extname(file);
          
          // Check if file extension is allowed
          if (this.allowedExtensions!.includes(extension)) {
            // Check if file is executable
            const executable = await this.isExecutable(filePath);
            
            scripts.push({
              name: file,
              path: filePath,
              extension,
              size: stats.size,
              lastModified: stats.mtime,
              executable
            });
          }
        }
      }

      return scripts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error reading scripts directory:', error);
      return [];
    }
  }

  /**
   * Get all available scripts in the ct subdirectory
   */
  async getCtScripts(): Promise<ScriptInfo[]> {
    this.initializeConfig();
    try {
      const ctDir = join(this.scriptsDir!, 'ct');
      
      // Check if ct directory exists
      try {
        await stat(ctDir);
      } catch {
        console.warn(`CT scripts directory not found: ${ctDir}`);
        return [];
      }
      
      const files = await readdir(ctDir);
      const scripts: ScriptInfo[] = [];

      for (const file of files) {
        const filePath = join(ctDir, file);
        const stats = await stat(filePath);

        if (stats.isFile()) {
          const extension = extname(file);
          
          // Check if file extension is allowed
          if (this.allowedExtensions!.includes(extension)) {
            // Check if file is executable
            const executable = await this.isExecutable(filePath);
            
            // Extract slug from filename (remove .sh extension)
            const slug = file.replace(/\.sh$/, '');
            
            // Try to get logo from JSON data
            let logo: string | undefined;
            try {
              const scriptData = await localScriptsService.getScriptBySlug(slug);
              logo = scriptData?.logo ?? undefined;
            } catch {
              // JSON file might not exist, that's okay
            }
            
            scripts.push({
              name: file,
              path: filePath,
              extension,
              size: stats.size,
              lastModified: stats.mtime,
              executable,
              logo,
              slug
            });
          }
        }
      }

      return scripts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error reading ct scripts directory:', error);
      return [];
    }
  }

  /**
   * Get all downloaded scripts from all directories (ct, tools, vm, vw)
   */
  async getAllDownloadedScripts(): Promise<ScriptInfo[]> {
    this.initializeConfig();
    const allScripts: ScriptInfo[] = [];
    
    // Define all script directories to scan
    const scriptDirs = ['ct', 'tools', 'vm', 'vw'];
    
    for (const dirName of scriptDirs) {
      try {
        const dirPath = join(this.scriptsDir!, dirName);
        
        // Check if directory exists
        try {
          await stat(dirPath);
        } catch {
          // Directory doesn't exist, skip it
          continue;
        }
        
        const scripts = await this.getScriptsFromDirectory(dirPath, dirName);
        allScripts.push(...scripts);
      } catch (error) {
        console.error(`Error reading ${dirName} scripts directory:`, error);
        // Continue with other directories even if one fails
      }
    }

    return allScripts.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get scripts from a specific directory (recursively)
   */
  private async getScriptsFromDirectory(dirPath: string, dirName: string): Promise<ScriptInfo[]> {
    const scripts: ScriptInfo[] = [];
    
    const scanDirectory = async (currentPath: string, relativePath: string = ''): Promise<void> => {
      const files = await readdir(currentPath);

      for (const file of files) {
        const filePath = join(currentPath, file);
        const stats = await stat(filePath);

        if (stats.isFile()) {
          const extension = extname(file);
          
          // Check if file extension is allowed
          if (this.allowedExtensions!.includes(extension)) {
            // Check if file is executable
            const executable = await this.isExecutable(filePath);
            
            // Extract slug from filename (remove .sh extension)
            const slug = file.replace(/\.sh$/, '');
            
            // Try to get logo from JSON data
            let logo: string | undefined;
            try {
              const scriptData = await localScriptsService.getScriptBySlug(slug);
              logo = scriptData?.logo ?? undefined;
            } catch {
              // JSON file might not exist, that's okay
            }
            
            scripts.push({
              name: file,
              path: filePath,
              extension,
              size: stats.size,
              lastModified: stats.mtime,
              executable,
              logo,
              slug
            });
          }
        } else if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const subRelativePath = relativePath ? join(relativePath, file) : file;
          await scanDirectory(filePath, subRelativePath);
        }
      }
    };

    await scanDirectory(dirPath);
    return scripts;
  }

  /**
   * Check if a file is executable
   */
  private async isExecutable(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);
      // Check if file has execute permission for owner, group, or others
      const mode = stats.mode;
      const isExecutable = !!(mode & parseInt('111', 8));
      return isExecutable;
    } catch {
      return false;
    }
  }

  /**
   * Validate if a script path is allowed to be executed
   */
  validateScriptPath(scriptPath: string): { valid: boolean; message?: string } {
    this.initializeConfig();
    const resolvedPath = resolve(scriptPath);
    const scriptsDirResolved = resolve(this.scriptsDir!);

    // Check if the script is within the allowed directory
    if (!resolvedPath.startsWith(scriptsDirResolved)) {
      return {
        valid: false,
        message: 'Script path is not within the allowed scripts directory'
      };
    }

    // Check if the script path matches any allowed path pattern
    const relativePath = resolvedPath.replace(scriptsDirResolved, '').replace(/\\/g, '/');
    const normalizedRelativePath = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
    
    const isAllowed = this.allowedPaths!.some(allowedPath => {
      const normalizedAllowedPath = allowedPath.startsWith('/') ? allowedPath : '/' + allowedPath;
      // For root path '/', allow files directly in the scripts directory (no subdirectories)
      if (normalizedAllowedPath === '/') {
        return normalizedRelativePath === '/' || (normalizedRelativePath.startsWith('/') && !normalizedRelativePath.substring(1).includes('/'));
      }
      // For other paths like '/ct/', check if the path starts with it
      return normalizedRelativePath.startsWith(normalizedAllowedPath);
    });

    if (!isAllowed) {
      return {
        valid: false,
        message: 'Script path is not in the allowed paths list'
      };
    }

    // Check file extension
    const extension = extname(scriptPath);
    if (!this.allowedExtensions!.includes(extension)) {
      return {
        valid: false,
        message: `File extension '${extension}' is not allowed. Allowed extensions: ${this.allowedExtensions!.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Execute a script and return a child process
   */
  async executeScript(scriptPath: string): Promise<ChildProcess> {
    const validation = this.validateScriptPath(scriptPath);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // Determine the command to run based on file extension
    const extension = extname(scriptPath);
    let command: string;
    let args: string[] = [];

    switch (extension) {
      case '.sh':
      case '.bash':
        command = 'bash';
        args = [scriptPath];
        break;
      case '.py':
        command = 'python';
        args = [scriptPath];
        break;
      case '.js':
        command = 'node';
        args = [scriptPath];
        break;
      case '.ts':
        command = 'npx';
        args = ['ts-node', scriptPath];
        break;
      default:
        // Try to execute directly (for files with shebang)
        command = scriptPath;
        args = [];
    }

    // Spawn the process
    const childProcess = spawn(command, args, {
      cwd: this.scriptsDir!,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill('SIGTERM');
      }
    }, this.maxExecutionTime!);

    // Clean up timeout when process exits
    childProcess.on('exit', () => {
      clearTimeout(timeout);
    });

    return childProcess;
  }

  /**
   * Get script content for display
   */
  async getScriptContent(scriptPath: string): Promise<string> {
    const validation = this.validateScriptPath(scriptPath);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    return await readFile(scriptPath, 'utf-8');
  }

  /**
   * Get scripts directory information
   */
  getScriptsDirectoryInfo(): {
    path: string;
    allowedExtensions: string[];
    allowedPaths: string[];
    maxExecutionTime: number;
  } {
    this.initializeConfig();
    return {
      path: this.scriptsDir!,
      allowedExtensions: this.allowedExtensions!,
      allowedPaths: this.allowedPaths!,
      maxExecutionTime: this.maxExecutionTime!
    };
  }
}

// Export singleton instance
export const scriptManager = new ScriptManager();
