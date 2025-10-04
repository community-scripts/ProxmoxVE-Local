import { spawn } from 'child_process';
import { spawn as ptySpawn } from 'node-pty';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';


/**
 * @typedef {Object} Server
 * @property {string} ip - Server IP address
 * @property {string} user - Username
 * @property {string} [password] - Password (optional)
 * @property {string} [ssh_key] - SSH private key (optional)
 * @property {string} [auth_method] - Authentication method ('password' or 'ssh_key')
 * @property {string} name - Server name
 */

class SSHExecutionService {
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
    const { ip, user, password, ssh_key, auth_method } = server;

    try {
      await this.transferScriptsFolder(server, onData, onError);

      return new Promise((resolve, reject) => {
        const relativeScriptPath = scriptPath.startsWith('scripts/') ? scriptPath.substring(8) : scriptPath;

        /** @type {any} */
        let sshCommand;
        /** @type {string | null} */
        let keyFile = null;

        if (auth_method === 'ssh_key' && ssh_key) {
          // Create temporary SSH key file
          const tempDir = join(tmpdir(), 'pvescriptslocal');
          if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
          }
          const keyFilename = `ssh_key_${crypto.randomBytes(8).toString('hex')}`;
          keyFile = join(tempDir, keyFilename);
          if (!ssh_key) {
            throw new Error('SSH key is required but not provided');
          }
          writeFileSync(keyFile, ssh_key, { mode: 0o600 });

          // Use SSH with key authentication
          sshCommand = ptySpawn('ssh', [
            '-i', keyFile,
            '-t',
            '-o', 'ConnectTimeout=10',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-o', 'PasswordAuthentication=no',
            '-o', 'PubkeyAuthentication=yes',
            '-o', 'RequestTTY=yes',
            '-o', 'SetEnv=TERM=xterm-256color',
            '-o', 'SetEnv=COLUMNS=120',
            '-o', 'SetEnv=LINES=30',
            '-o', 'SetEnv=COLORTERM=truecolor',
            '-o', 'SetEnv=FORCE_COLOR=1',
            '-o', 'SetEnv=NO_COLOR=0',
            '-o', 'SetEnv=CLICOLOR=1',
            '-o', 'SetEnv=CLICOLOR_FORCE=1',
            `${user}@${ip}`,
            `cd /tmp/scripts && chmod +x ${relativeScriptPath} && export TERM=xterm-256color && export COLUMNS=120 && export LINES=30 && export COLORTERM=truecolor && export FORCE_COLOR=1 && export NO_COLOR=0 && export CLICOLOR=1 && export CLICOLOR_FORCE=1 && bash ${relativeScriptPath}`
          ], {
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
        } else if (password) {
          // Use sshpass for password authentication
          sshCommand = ptySpawn('sshpass', [
            '-p', password,
            'ssh',
            '-t',
            '-o', 'ConnectTimeout=10',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-o', 'PasswordAuthentication=yes',
            '-o', 'PubkeyAuthentication=no',
            '-o', 'RequestTTY=yes',
            '-o', 'SetEnv=TERM=xterm-256color',
            '-o', 'SetEnv=COLUMNS=120',
            '-o', 'SetEnv=LINES=30',
            '-o', 'SetEnv=COLORTERM=truecolor',
            '-o', 'SetEnv=FORCE_COLOR=1',
            '-o', 'SetEnv=NO_COLOR=0',
            '-o', 'SetEnv=CLICOLOR=1',
            '-o', 'SetEnv=CLICOLOR_FORCE=1',
            `${user}@${ip}`,
            `cd /tmp/scripts && chmod +x ${relativeScriptPath} && export TERM=xterm-256color && export COLUMNS=120 && export LINES=30 && export COLORTERM=truecolor && export FORCE_COLOR=1 && export NO_COLOR=0 && export CLICOLOR=1 && export CLICOLOR_FORCE=1 && bash ${relativeScriptPath}`
          ], {
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
        } else {
          throw new Error('No authentication method available: password or SSH key required');
        }

        // Use pty's onData method which handles both stdout and stderr combined
        sshCommand.onData((/** @type {string} */ data) => {
          // pty handles encoding automatically and preserves ANSI codes
          onData(data);
        });

        sshCommand.onExit((/** @type {any} */ e) => {
          // Clean up temporary key file if it exists
          if (keyFile && existsSync(keyFile)) {
            unlinkSync(keyFile);
          }
          onExit(e.exitCode);
        });

        resolve({
          process: sshCommand,
          kill: () => {
            // Clean up temporary key file on kill
            if (keyFile && existsSync(keyFile)) {
              unlinkSync(keyFile);
            }
            sshCommand.kill('SIGTERM');
          }
        });
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
    const { ip, user, password, ssh_key, auth_method } = server;
    /** @type {string | null} */
    let keyFile = null;

    return new Promise((resolve, reject) => {
      try {
        let rshCommand;

        if (auth_method === 'ssh_key' && ssh_key) {
          // Create temporary SSH key file
          const tempDir = join(tmpdir(), 'pvescriptslocal');
          if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
          }
          const keyFilename = `ssh_key_${crypto.randomBytes(8).toString('hex')}`;
          keyFile = join(tempDir, keyFilename);
          if (!ssh_key) {
            throw new Error('SSH key is required but not provided');
          }
          writeFileSync(keyFile, ssh_key, { mode: 0o600 });

          rshCommand = `ssh -i ${keyFile} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PasswordAuthentication=no -o PubkeyAuthentication=yes`;
        } else if (password) {
          rshCommand = `sshpass -p ${password} ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
        } else {
          throw new Error('No authentication method available: password or SSH key required');
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
          if (keyFile && existsSync(keyFile)) {
            unlinkSync(keyFile);
          }

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`rsync failed with code ${code}`));
          }
        });

        rsyncCommand.on('error', (error) => {
          // Clean up temporary key file on error
          if (keyFile && existsSync(keyFile)) {
            unlinkSync(keyFile);
          }
          reject(error);
        });
      } catch (error) {
        // Clean up temporary key file on exception
        if (keyFile && existsSync(keyFile)) {
          unlinkSync(keyFile);
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
    const { ip, user, password, ssh_key, auth_method } = server;

    return new Promise((resolve, reject) => {
      /** @type {any} */
      let sshCommand;
      /** @type {string | null} */
      let keyFile = null;

      try {
        if (auth_method === 'ssh_key' && ssh_key) {
          // Create temporary SSH key file
          const tempDir = join(tmpdir(), 'pvescriptslocal');
          if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
          }
          const keyFilename = `ssh_key_${crypto.randomBytes(8).toString('hex')}`;
          keyFile = join(tempDir, keyFilename);
          if (!ssh_key) {
            throw new Error('SSH key is required but not provided');
          }
          writeFileSync(keyFile, ssh_key, { mode: 0o600 });

          // Use SSH with key authentication
          sshCommand = ptySpawn('ssh', [
            '-i', keyFile,
            '-t',
            '-o', 'ConnectTimeout=10',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-o', 'PasswordAuthentication=no',
            '-o', 'PubkeyAuthentication=yes',
            '-o', 'RequestTTY=yes',
            '-o', 'SetEnv=TERM=xterm-256color',
            '-o', 'SetEnv=COLUMNS=120',
            '-o', 'SetEnv=LINES=30',
            '-o', 'SetEnv=COLORTERM=truecolor',
            '-o', 'SetEnv=FORCE_COLOR=1',
            '-o', 'SetEnv=NO_COLOR=0',
            '-o', 'SetEnv=CLICOLOR=1',
            `${user}@${ip}`,
            command
          ], {
            name: 'xterm-color',
            cols: 120,
            rows: 30,
            cwd: process.cwd(),
            env: process.env
          });
        } else if (password) {
          // Use sshpass for password authentication
          sshCommand = ptySpawn('sshpass', [
            '-p', password,
            'ssh',
            '-t',
            '-o', 'ConnectTimeout=10',
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-o', 'PasswordAuthentication=yes',
            '-o', 'PubkeyAuthentication=no',
            '-o', 'RequestTTY=yes',
            '-o', 'SetEnv=TERM=xterm-256color',
            '-o', 'SetEnv=COLUMNS=120',
            '-o', 'SetEnv=LINES=30',
            '-o', 'SetEnv=COLORTERM=truecolor',
            '-o', 'SetEnv=FORCE_COLOR=1',
            '-o', 'SetEnv=NO_COLOR=0',
            '-o', 'SetEnv=CLICOLOR=1',
            `${user}@${ip}`,
            command
          ], {
            name: 'xterm-color',
            cols: 120,
            rows: 30,
            cwd: process.cwd(),
            env: process.env
          });
        } else {
          throw new Error('No authentication method available: password or SSH key required');
        }

        sshCommand.onData((/** @type {string} */ data) => {
          onData(data);
        });

        sshCommand.onExit((/** @type {any} */ e) => {
          // Clean up temporary key file if it exists
          if (keyFile && existsSync(keyFile)) {
            unlinkSync(keyFile);
          }
          onExit(e.exitCode);
        });

        resolve({
          process: sshCommand,
          kill: () => {
            // Clean up temporary key file on kill
            if (keyFile && existsSync(keyFile)) {
              unlinkSync(keyFile);
            }
            sshCommand.kill('SIGTERM');
          }
        });
      } catch (error) {
        // Clean up temporary key file on exception
        if (keyFile && existsSync(keyFile)) {
          unlinkSync(keyFile);
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