import { spawn } from 'child_process';
import { spawn as ptySpawn } from 'node-pty';
import { writeFileSync, unlinkSync, chmodSync, mkdtempSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';


/**
 * @typedef {Object} Server
 * @property {string} ip - Server IP address
 * @property {string} user - Username
 * @property {string} password - Password
 * @property {string} name - Server name
 */

class SSHExecutionService {
  /**
   * Create a temporary SSH key file for authentication
   * @param {Server} server - Server configuration
   * @returns {string} Path to temporary key file
   */
  createTempKeyFile(server) {
    const { ssh_key } = server;
    if (!ssh_key) {
      throw new Error('SSH key not provided');
    }
    
    const tempDir = mkdtempSync(join(tmpdir(), 'ssh-key-'));
    const tempKeyPath = join(tempDir, 'private_key');
    
    writeFileSync(tempKeyPath, ssh_key);
    chmodSync(tempKeyPath, 0o600); // Set proper permissions
    
    return tempKeyPath;
  }

  /**
   * Build SSH command arguments based on authentication type
   * @param {Server} server - Server configuration
   * @param {string} tempKeyPath - Path to temporary key file (if using key auth)
   * @returns {Object} Command and arguments for SSH
   */
  buildSSHCommand(server, tempKeyPath = null) {
    const { ip, user, password, auth_type = 'password', ssh_key_passphrase, ssh_port = 22 } = server;
    
    const baseArgs = [
      '-t',
      '-p', ssh_port.toString(),
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      '-o', 'RequestTTY=yes',
      '-o', 'SetEnv=TERM=xterm-256color',
      '-o', 'SetEnv=COLUMNS=120',
      '-o', 'SetEnv=LINES=30',
      '-o', 'SetEnv=COLORTERM=truecolor',
      '-o', 'SetEnv=FORCE_COLOR=1',
      '-o', 'SetEnv=NO_COLOR=0',
      '-o', 'SetEnv=CLICOLOR=1',
      '-o', 'SetEnv=CLICOLOR_FORCE=1'
    ];

    if (auth_type === 'key') {
      // SSH key authentication
      baseArgs.push('-i', tempKeyPath);
      baseArgs.push('-o', 'PasswordAuthentication=no');
      baseArgs.push('-o', 'PubkeyAuthentication=yes');
      
      if (ssh_key_passphrase) {
        return {
          command: 'sshpass',
          args: ['-P', 'passphrase', '-p', ssh_key_passphrase, 'ssh', ...baseArgs, `${user}@${ip}`]
        };
      } else {
        return {
          command: 'ssh',
          args: [...baseArgs, `${user}@${ip}`]
        };
      }
    } else if (auth_type === 'both') {
      // Try SSH key first, then password
      if (tempKeyPath) {
        baseArgs.push('-i', tempKeyPath);
        baseArgs.push('-o', 'PasswordAuthentication=yes');
        baseArgs.push('-o', 'PubkeyAuthentication=yes');
        
        if (ssh_key_passphrase) {
          return {
            command: 'sshpass',
            args: ['-P', 'passphrase', '-p', ssh_key_passphrase, 'ssh', ...baseArgs, `${user}@${ip}`]
          };
        } else {
          return {
            command: 'ssh',
            args: [...baseArgs, `${user}@${ip}`]
          };
        }
      } else {
        // Fallback to password
        return {
          command: 'sshpass',
          args: ['-p', password, 'ssh', ...baseArgs, '-o', 'PasswordAuthentication=yes', '-o', 'PubkeyAuthentication=no', `${user}@${ip}`]
        };
      }
    } else {
      // Password authentication (default)
      return {
        command: 'sshpass',
        args: ['-p', password, 'ssh', ...baseArgs, '-o', 'PasswordAuthentication=yes', '-o', 'PubkeyAuthentication=no', `${user}@${ip}`]
      };
    }
  }

  /**
   * Execute a script on a remote server via SSH
   * @param {Server} server - Server configuration
   * @param {string} scriptPath - Path to the script
   * @param {Function} onData - Callback for data output
   * @param {Function} onError - Callback for errors
   * @param {Function} onExit - Callback for process exit
   * @returns {Promise<Object>} Process information
   */
  async executeScript(server, scriptPath, onData, onError, onExit) {
    let tempKeyPath = null;
    
    try {
      await this.transferScriptsFolder(server, onData, onError);
      
      return new Promise((resolve, reject) => {
        const relativeScriptPath = scriptPath.startsWith('scripts/') ? scriptPath.substring(8) : scriptPath;
        
        try {
          // Create temporary key file if using key authentication
          if (server.auth_type === 'key' || server.auth_type === 'both') {
            tempKeyPath = this.createTempKeyFile(server);
          }
          
          // Build SSH command based on authentication type
          const { command, args } = this.buildSSHCommand(server, tempKeyPath);
          
          // Add the script execution command to the args
          args.push(`cd /tmp/scripts && chmod +x ${relativeScriptPath} && export TERM=xterm-256color && export COLUMNS=120 && export LINES=30 && export COLORTERM=truecolor && export FORCE_COLOR=1 && export NO_COLOR=0 && export CLICOLOR=1 && export CLICOLOR_FORCE=1 && bash ${relativeScriptPath}`);
          
          // Use ptySpawn for proper terminal emulation and color support
          const sshCommand = ptySpawn(command, args, {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: process.cwd(),
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              COLUMNS: '120',
              LINES: '30',
              SHELL: '/bin/bash',
              COLORTERM: 'truecolor',
              FORCE_COLOR: '1',
              NO_COLOR: '0',
              CLICOLOR: '1',
              CLICOLOR_FORCE: '1'
            }
          });

        // Use pty's onData method which handles both stdout and stderr combined
        sshCommand.onData((data) => {
          // pty handles encoding automatically and preserves ANSI codes
          onData(data);
        });

        sshCommand.onExit((e) => {
          onExit(e.exitCode);
        });

        resolve({
          process: sshCommand,
          kill: () => {
            sshCommand.kill('SIGTERM');
            // Clean up temporary key file
            if (tempKeyPath) {
              try {
                unlinkSync(tempKeyPath);
                const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
                rmdirSync(tempDir);
              } catch (cleanupError) {
                console.warn('Failed to clean up temporary SSH key file:', cleanupError);
              }
            }
          }
        });
        
        } catch (error) {
          // Clean up temporary key file on error
          if (tempKeyPath) {
            try {
              unlinkSync(tempKeyPath);
              const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
              rmdirSync(tempDir);
            } catch (cleanupError) {
              console.warn('Failed to clean up temporary SSH key file:', cleanupError);
            }
          }
          reject(error);
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onError(`SSH execution failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Transfer the entire scripts folder to the remote server
   * @param {Server} server - Server configuration
   * @param {Function} onData - Callback for data output
   * @param {Function} onError - Callback for errors
   * @returns {Promise<void>}
   */
  async transferScriptsFolder(server, onData, onError) {
    const { ip, user, password, auth_type = 'password', ssh_key, ssh_key_passphrase, ssh_port = 22 } = server;
    let tempKeyPath = null;
    
    return new Promise((resolve, reject) => {
      try {
        // Create temporary key file if using key authentication
        if (auth_type === 'key' || auth_type === 'both') {
          if (ssh_key) {
            tempKeyPath = this.createTempKeyFile(server);
          }
        }
        
        // Build rsync command based on authentication type
        let rshCommand;
        if (auth_type === 'key' && tempKeyPath) {
          if (ssh_key_passphrase) {
            rshCommand = `sshpass -P passphrase -p ${ssh_key_passphrase} ssh -i ${tempKeyPath} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          } else {
            rshCommand = `ssh -i ${tempKeyPath} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          }
        } else if (auth_type === 'both' && tempKeyPath) {
          if (ssh_key_passphrase) {
            rshCommand = `sshpass -P passphrase -p ${ssh_key_passphrase} ssh -i ${tempKeyPath} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          } else {
            rshCommand = `ssh -i ${tempKeyPath} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          }
        } else {
          // Fallback to password authentication
          rshCommand = `sshpass -p ${password} ssh -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
        }
        
        const rsyncCommand = spawn('rsync', [
          '-avz',
          '--delete',
          '--exclude=*.log',
          '--exclude=*.tmp',
          `--rsh=${rshCommand}`,
          'scripts/',
          `${user}@${ip}:/tmp/scripts/`
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

      rsyncCommand.stdout.on('data', (/** @type {Buffer} */ data) => {
        // Ensure proper UTF-8 encoding for ANSI colors
        const output = data.toString('utf8');
        onData(output);
      });

      rsyncCommand.stderr.on('data', (/** @type {Buffer} */ data) => {
        // Ensure proper UTF-8 encoding for ANSI colors
        const output = data.toString('utf8');
        onError(output);
      });

      rsyncCommand.on('close', (code) => {
        // Clean up temporary key file
        if (tempKeyPath) {
          try {
            unlinkSync(tempKeyPath);
            const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
            unlinkSync(tempDir);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary SSH key file:', cleanupError);
          }
        }
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}`));
        }
      });

      rsyncCommand.on('error', (error) => {
        // Clean up temporary key file on error
        if (tempKeyPath) {
          try {
            unlinkSync(tempKeyPath);
            const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
            unlinkSync(tempDir);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary SSH key file:', cleanupError);
          }
        }
        reject(error);
      });
      
      } catch (error) {
        // Clean up temporary key file on error
        if (tempKeyPath) {
          try {
            unlinkSync(tempKeyPath);
            const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
            unlinkSync(tempDir);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary SSH key file:', cleanupError);
          }
        }
        reject(error);
      }
    });
  }

  /**
   * Execute a direct command on a remote server via SSH
   * @param {Server} server - Server configuration
   * @param {string} command - Command to execute
   * @param {Function} onData - Callback for data output
   * @param {Function} onError - Callback for errors
   * @param {Function} onExit - Callback for process exit
   * @returns {Promise<Object>} Process information
   */
  async executeCommand(server, command, onData, onError, onExit) {
    let tempKeyPath = null;
    
    return new Promise((resolve, reject) => {
      try {
        // Create temporary key file if using key authentication
        if (server.auth_type === 'key' || server.auth_type === 'both') {
          tempKeyPath = this.createTempKeyFile(server);
        }
        
        // Build SSH command based on authentication type
        const { command: sshCommandName, args } = this.buildSSHCommand(server, tempKeyPath);
        
        // Add the command to execute to the args
        args.push(command);
        
        // Use ptySpawn for proper terminal emulation and color support
        const sshCommand = ptySpawn(sshCommandName, args, {
          name: 'xterm-color',
          cols: 120,
          rows: 30,
          cwd: process.cwd(),
          env: process.env
        });

      sshCommand.onData((data) => {
        onData(data);
      });

      sshCommand.onExit((e) => {
        // Clean up temporary key file
        if (tempKeyPath) {
          try {
            unlinkSync(tempKeyPath);
            const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
            unlinkSync(tempDir);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary SSH key file:', cleanupError);
          }
        }
        onExit(e.exitCode);
      });

      resolve({ 
        process: sshCommand,
        kill: () => {
          sshCommand.kill('SIGTERM');
          // Clean up temporary key file
          if (tempKeyPath) {
            try {
              unlinkSync(tempKeyPath);
              const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
              rmdirSync(tempDir);
            } catch (cleanupError) {
              console.warn('Failed to clean up temporary SSH key file:', cleanupError);
            }
          }
        }
      });
      
      } catch (error) {
        // Clean up temporary key file on error
        if (tempKeyPath) {
          try {
            unlinkSync(tempKeyPath);
            const tempDir = tempKeyPath.substring(0, tempKeyPath.lastIndexOf('/'));
            unlinkSync(tempDir);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary SSH key file:', cleanupError);
          }
        }
        reject(error);
      }
    });
  }

}

// Singleton instance
/** @type {SSHExecutionService | null} */
let sshExecutionInstance = null;

export function getSSHExecutionService() {
  if (!sshExecutionInstance) {
    sshExecutionInstance = new SSHExecutionService();
  }
  return sshExecutionInstance;
}

export default SSHExecutionService;