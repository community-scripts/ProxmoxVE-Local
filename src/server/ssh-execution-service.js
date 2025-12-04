import { spawn } from 'child_process';
import { spawn as ptySpawn } from 'node-pty';
import { existsSync } from 'fs';


/**
 * @typedef {Object} Server
 * @property {string} ip - Server IP address
 * @property {string} user - Username
 * @property {string} [password] - Password (optional)
 * @property {string} name - Server name
 * @property {string} [auth_type] - Authentication type ('password', 'key')
 * @property {string} [ssh_key] - SSH private key content
 * @property {string} [ssh_key_passphrase] - SSH key passphrase
 * @property {string} [ssh_key_path] - Path to persistent SSH key file
 * @property {number} [ssh_port] - SSH port (default: 22)
 */

class SSHExecutionService {

  /**
   * Build SSH command arguments based on authentication type
   * @param {Server} server - Server configuration
   * @returns {{command: string, args: string[]}} Command and arguments for SSH
   */
  buildSSHCommand(server) {
    const { ip, user, password, auth_type = 'password', ssh_key_passphrase, ssh_key_path, ssh_port = 22 } = server;
    
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
      if (!ssh_key_path || !existsSync(ssh_key_path)) {
        throw new Error('SSH key file not found');
      }
      
      baseArgs.push('-i', ssh_key_path);
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
    } else {
      // Password authentication (default)
      if (password) {
        return {
          command: 'sshpass',
          args: ['-p', password, 'ssh', ...baseArgs, '-o', 'PasswordAuthentication=yes', '-o', 'PubkeyAuthentication=no', `${user}@${ip}`]
        };
      } else {
        throw new Error('Password is required for password authentication');
      }
    }
  }

  /**
   * Execute a script on a remote server via SSH
   * @param {Server} server - Server configuration
   * @param {string} scriptPath - Path to the script
   * @param {Function} onData - Callback for data output
   * @param {Function} onError - Callback for errors
   * @param {Function} onExit - Callback for process exit
   * @param {Object} [envVars] - Optional environment variables to pass to the script
   * @returns {Promise<Object>} Process information
   */
  async executeScript(server, scriptPath, onData, onError, onExit, envVars = {}) {
    try {
      await this.transferScriptsFolder(server, onData, onError);
      
      return new Promise((resolve, reject) => {
        const relativeScriptPath = scriptPath.startsWith('scripts/') ? scriptPath.substring(8) : scriptPath;
        
        try {
          // Build SSH command based on authentication type
          const { command, args } = this.buildSSHCommand(server);
          
          // Format environment variables as var_name=value pairs
          const envVarsString = Object.entries(envVars)
            .map(([key, value]) => {
              // Escape special characters in values
              const escapedValue = String(value).replace(/'/g, "'\\''");
              return `${key}='${escapedValue}'`;
            })
            .join(' ');
          
          // Build the command with environment variables
          let scriptCommand = `cd /tmp/scripts && chmod +x ${relativeScriptPath} && export TERM=xterm-256color && export COLUMNS=120 && export LINES=30 && export COLORTERM=truecolor && export FORCE_COLOR=1 && export NO_COLOR=0 && export CLICOLOR=1 && export CLICOLOR_FORCE=1`;
          
          if (envVarsString) {
            scriptCommand += ` && ${envVarsString} bash ${relativeScriptPath}`;
          } else {
            scriptCommand += ` && bash ${relativeScriptPath}`;
          }
          
          // Log the full command that will be executed
          console.log('='.repeat(80));
          console.log(`[SSH Execution] Executing on host: ${server.ip} (${server.name || 'Unnamed'})`);
          console.log(`[SSH Execution] Script path: ${scriptPath}`);
          console.log(`[SSH Execution] Relative script path: ${relativeScriptPath}`);
          if (Object.keys(envVars).length > 0) {
            console.log(`[SSH Execution] Environment variables (${Object.keys(envVars).length} vars):`);
            Object.entries(envVars).forEach(([key, value]) => {
              console.log(`  ${key}=${String(value)}`);
            });
          } else {
            console.log(`[SSH Execution] No environment variables provided`);
          }
          console.log(`[SSH Execution] Full command:`);
          console.log(scriptCommand);
          console.log('='.repeat(80));
          
          // Add the script execution command to the args
          args.push(scriptCommand);
          
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
          }
        });
        
        } catch (error) {
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
    const { ip, user, password, auth_type = 'password', ssh_key_passphrase, ssh_key_path, ssh_port = 22 } = server;
    
    return new Promise((resolve, reject) => {
      try {
        // Build rsync command based on authentication type
        let rshCommand;
        if (auth_type === 'key') {
          if (!ssh_key_path || !existsSync(ssh_key_path)) {
            throw new Error('SSH key file not found');
          }
          
          if (ssh_key_passphrase) {
            rshCommand = `sshpass -P passphrase -p ${ssh_key_passphrase} ssh -i ${ssh_key_path} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          } else {
            rshCommand = `ssh -i ${ssh_key_path} -p ${ssh_port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
          }
        } else {
          // Password authentication
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
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}`));
        }
      });

      rsyncCommand.on('error', (error) => {
        reject(error);
      });
      
      } catch (error) {
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
    return new Promise((resolve, reject) => {
      try {
        // Build SSH command based on authentication type
        const { command: sshCommandName, args } = this.buildSSHCommand(server);
        
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
        onExit(e.exitCode);
      });

      resolve({ 
        process: sshCommand,
        kill: () => {
          sshCommand.kill('SIGTERM');
        }
      });
      
      } catch (error) {
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