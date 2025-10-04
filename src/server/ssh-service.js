import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, chmodSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

class SSHService {
  /**
   * Test SSH connection with actual login verification
   * This method tests if the user can actually log in with the provided credentials
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(server) {
    const { ip, user, password, ssh_key, auth_method } = server;
    
    return new Promise((resolve) => {
      const timeout = 15000; // 15 seconds timeout for login test
      let resolved = false;

      // Choose authentication method based on auth_method field
      if (auth_method === 'ssh_key' && ssh_key) {
        // Test with SSH key
        this.testWithSSHKey(server).then(result => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        }).catch((error) => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              message: `SSH key authentication failed: ${error.message}`,
              details: {
                method: 'ssh_key',
                error: error.message
              }
            });
          }
        });
      } else if (password) {
        // Try sshpass first if available
        this.testWithSshpass(server).then(result => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        }).catch(() => {
          // If sshpass fails, try expect
          this.testWithExpect(server).then(result => {
            if (!resolved) {
              resolved = true;
              resolve(result);
            }
          }).catch(() => {
            // If both fail, return error
            if (!resolved) {
              resolved = true;
              resolve({
                success: false,
                message: 'SSH login test requires sshpass or expect - neither available or working',
                details: {
                  method: 'no_auth_tools'
                }
              });
            }
          });
        });
      } else {
        resolved = true;
        resolve({
          success: false,
          message: 'No authentication method configured (password or SSH key required)',
          details: {
            method: 'no_auth'
          }
        });
      }

      // Set up overall timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            message: 'SSH login test timeout - server did not respond within 15 seconds',
            details: { timeout: true, method: 'ssh_login_test' }
          });
        }
      }, timeout);
    });
  }

  /**
   * Test SSH connection using SSH key authentication
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testWithSSHKey(server) {
    const { ip, user, ssh_key } = server;

    return new Promise((resolve, reject) => {
      const timeout = 10000;
      let resolved = false;
      /** @type {string | null} */
      let keyFile = null;

      try {
        // Create temporary directory if it doesn't exist
        const tempDir = join(tmpdir(), 'pvescriptslocal');
        if (!existsSync(tempDir)) {
          mkdirSync(tempDir, { recursive: true });
        }

        // Create temporary key file with secure permissions
        const keyFilename = `ssh_key_${crypto.randomBytes(8).toString('hex')}`;
        keyFile = join(tempDir, keyFilename);
        if (!ssh_key) {
          throw new Error('SSH key is required but not provided');
        }
        writeFileSync(keyFile, ssh_key, { mode: 0o600 });

        const sshCommand = spawn('ssh', [
          '-i', keyFile,
          '-o', 'ConnectTimeout=10',
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          '-o', 'LogLevel=ERROR',
          '-o', 'PasswordAuthentication=no',
          '-o', 'PubkeyAuthentication=yes',
          '-o', 'PreferredAuthentications=publickey',
          `${user}@${ip}`,
          'echo "SSH_LOGIN_SUCCESS"'
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            sshCommand.kill('SIGTERM');
            if (keyFile && existsSync(keyFile)) {
              unlinkSync(keyFile);
            }
            reject(new Error('SSH login timeout'));
          }
        }, timeout);

        let output = '';
        let errorOutput = '';

        sshCommand.stdout.on('data', (data) => {
          output += data.toString();
        });

        sshCommand.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        sshCommand.on('close', (code) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);

            // Clean up temporary key file
            if (keyFile && existsSync(keyFile)) {
              unlinkSync(keyFile);
            }

            if (code === 0 && output.includes('SSH_LOGIN_SUCCESS')) {
              resolve({
                success: true,
                message: 'SSH key authentication successful',
                details: {
                  server: server.name || 'Unknown',
                  ip: ip,
                  user: user,
                  method: 'ssh_key_verified'
                }
              });
            } else {
              let errorMessage = 'SSH key authentication failed';

              if (errorOutput.includes('Permission denied')) {
                errorMessage = 'SSH key authentication failed - key may be invalid or not authorized';
              } else if (errorOutput.includes('Connection refused')) {
                errorMessage = 'Connection refused - server may be down or SSH not running';
              } else if (errorOutput.includes('invalid format')) {
                errorMessage = 'Invalid SSH key format';
              } else if (errorOutput.includes('Connection timed out')) {
                errorMessage = 'Connection timeout - server may be unreachable';
              } else if (errorOutput) {
                errorMessage = `SSH key authentication failed: ${errorOutput.trim()}`;
              }

              reject(new Error(errorMessage));
            }
          }
        });

        sshCommand.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            if (keyFile && existsSync(keyFile)) {
              unlinkSync(keyFile);
            }
            reject(error);
          }
        });
      } catch (error) {
        if (keyFile && existsSync(keyFile)) {
          unlinkSync(keyFile);
        }
        reject(error);
      }
    });
  }

  /**
   * Test SSH connection using sshpass
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testWithSshpass(server) {
    const { ip, user, password } = server;
    
    return new Promise((resolve, reject) => {
      const timeout = 10000;
      let resolved = false;
      
      if (!password) {
        throw new Error('Password is required but not provided');
      }
      const sshCommand = spawn('sshpass', [
        '-p', password,
        'ssh',
        '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-o', 'PasswordAuthentication=yes',
        '-o', 'PubkeyAuthentication=no',
        `${user}@${ip}`,
        'echo "SSH_LOGIN_SUCCESS"'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sshCommand.kill('SIGTERM');
          reject(new Error('SSH login timeout'));
        }
      }, timeout);

      let output = '';
      let errorOutput = '';
      
      sshCommand.stdout.on('data', (data) => {
        output += data.toString();
      });

      sshCommand.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshCommand.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          if (code === 0 && output.includes('SSH_LOGIN_SUCCESS')) {
            resolve({
              success: true,
              message: 'SSH login successful - credentials verified',
              details: {
                server: server.name || 'Unknown',
                ip: ip,
                user: user,
                method: 'sshpass_verified'
              }
            });
          } else {
            let errorMessage = 'SSH login failed';
            
            if (errorOutput.includes('Permission denied') || errorOutput.includes('Authentication failed')) {
              errorMessage = 'Authentication failed - check username and password';
            } else if (errorOutput.includes('Connection refused')) {
              errorMessage = 'Connection refused - server may be down or SSH not running';
            } else if (errorOutput.includes('Name or service not known') || errorOutput.includes('No route to host')) {
              errorMessage = 'Host not found - check IP address';
            } else if (errorOutput.includes('Connection timed out')) {
              errorMessage = 'Connection timeout - server may be unreachable';
            } else {
              errorMessage = `SSH login failed: ${errorOutput.trim()}`;
            }

            reject(new Error(errorMessage));
          }
        }
      });

      sshCommand.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  /**
   * Test SSH connection using expect
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testWithExpect(server) {
    const { ip, user, password } = server;

    return new Promise((resolve, reject) => {
      const timeout = 10000;
      let resolved = false;

      if (!password) {
        reject(new Error('Password is required but not provided'));
        return;
      }

      const expectScript = `#!/usr/bin/expect -f
set timeout 10
spawn ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o PasswordAuthentication=yes -o PubkeyAuthentication=no ${user}@${ip} "echo SSH_LOGIN_SUCCESS"
expect {
  "password:" {
    send "${password}\r"
    exp_continue
  }
  "Password:" {
    send "${password}\r"
    exp_continue
  }
  "SSH_LOGIN_SUCCESS" {
    exit 0
  }
  timeout {
    exit 1
  }
  eof {
    exit 1
  }
}`;

      const expectCommand = spawn('expect', ['-c', expectScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          expectCommand.kill('SIGTERM');
          reject(new Error('SSH login timeout'));
        }
      }, timeout);

      let output = '';
      let errorOutput = '';
      
      expectCommand.stdout.on('data', (data) => {
        output += data.toString();
      });

      expectCommand.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      expectCommand.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          if (code === 0) {
            resolve({
              success: true,
              message: 'SSH login successful - credentials verified',
              details: {
                server: server.name || 'Unknown',
                ip: ip,
                user: user,
                method: 'expect_verified'
              }
            });
          } else {
            let errorMessage = 'SSH login failed';
            
            if (errorOutput.includes('Permission denied') || errorOutput.includes('Authentication failed')) {
              errorMessage = 'Authentication failed - check username and password';
            } else if (errorOutput.includes('Connection refused')) {
              errorMessage = 'Connection refused - server may be down or SSH not running';
            } else if (errorOutput.includes('Name or service not known') || errorOutput.includes('No route to host')) {
              errorMessage = 'Host not found - check IP address';
            } else if (errorOutput.includes('Connection timed out')) {
              errorMessage = 'Connection timeout - server may be unreachable';
            } else {
              errorMessage = `SSH login failed: ${errorOutput.trim()}`;
            }

            reject(new Error(errorMessage));
          }
        }
      });

      expectCommand.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  /**
   * Test SSH connection using basic connectivity check (fallback method)
   * This method tests if the SSH port is open and reachable
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testConnectionBasic(server) {
    const { ip, user, password } = server;
    
    return new Promise((resolve) => {
      const timeout = 10000; // 10 seconds timeout
      let resolved = false;
      
      // First, test if the SSH port is open using netcat or telnet
      const portTestCommand = spawn('nc', ['-z', '-w', '5', ip, '22'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up timeout
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          portTestCommand.kill('SIGTERM');
          resolve({
            success: false,
            message: 'Connection timeout - server did not respond within 10 seconds',
            details: { timeout: true, method: 'port_check' }
          });
        }
      }, timeout);

      // Handle port test results
      portTestCommand.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          if (code === 0) {
            // Port is open, now try a basic SSH connection test
            this.testSSHConnection(server).then(resolve).catch(() => {
              resolve({
                success: false,
                message: 'SSH port is open but connection failed - check credentials',
                details: {
                  portOpen: true,
                  method: 'ssh_connection_test'
                }
              });
            });
          } else {
            resolve({
              success: false,
              message: 'SSH port (22) is not accessible - server may be down or SSH not running',
              details: {
                portOpen: false,
                exitCode: code,
                method: 'port_check'
              }
            });
          }
        }
      });

      // Handle port test errors
      portTestCommand.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          // If netcat is not available, try with telnet
          this.testWithTelnet(server).then(resolve).catch(() => {
            resolve({
              success: false,
              message: 'Cannot test SSH connectivity - netcat and telnet not available',
              details: {
                error: error.message,
                method: 'port_check_fallback'
              }
            });
          });
        }
      });
    });
  }

  /**
   * Test SSH connection using telnet as fallback
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testWithTelnet(server) {
    const { ip } = server;
    
    return new Promise((resolve) => {
      const timeout = 5000;
      let resolved = false;
      
      const telnetCommand = spawn('timeout', ['5', 'telnet', ip, '22'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          telnetCommand.kill('SIGTERM');
          resolve({
            success: false,
            message: 'SSH port test timeout',
            details: { method: 'telnet_timeout' }
          });
        }
      }, timeout);

      let output = '';
      
      telnetCommand.stdout.on('data', (data) => {
        output += data.toString();
      });

      telnetCommand.stderr.on('data', (data) => {
        output += data.toString();
      });

      telnetCommand.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          if (output.includes('Connected') || output.includes('SSH')) {
            resolve({
              success: true,
              message: 'SSH port is accessible - basic connectivity confirmed',
              details: {
                portOpen: true,
                method: 'telnet_test'
              }
            });
          } else {
            resolve({
              success: false,
              message: 'SSH port is not accessible',
              details: {
                portOpen: false,
                output: output.trim(),
                method: 'telnet_test'
              }
            });
          }
        }
      });

      telnetCommand.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            success: false,
            message: 'Cannot test SSH connectivity - required tools not available',
            details: {
              error: error.message,
              method: 'telnet_error'
            }
          });
        }
      });
    });
  }

  /**
   * Test actual SSH connection (without password authentication)
   * @param {import('../types/server').Server} server - Server configuration
   * @returns {Promise<Object>} Connection test result
   */
  async testSSHConnection(server) {
    const { ip, user } = server;
    
    return new Promise((resolve) => {
      const timeout = 5000;
      let resolved = false;
      
      const sshCommand = spawn('ssh', [
        '-o', 'ConnectTimeout=5',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-o', 'PasswordAuthentication=no',
        '-o', 'PubkeyAuthentication=no',
        '-o', 'PreferredAuthentications=none',
        `${user}@${ip}`,
        'exit'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sshCommand.kill('SIGTERM');
          resolve({
            success: false,
            message: 'SSH connection timeout',
            details: { method: 'ssh_timeout' }
          });
        }
      }, timeout);

      let errorOutput = '';
      
      sshCommand.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshCommand.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          
          // SSH connection was established but authentication failed
          // This is actually a good sign - it means SSH is working
          if (errorOutput.includes('Permission denied') || errorOutput.includes('Authentication failed')) {
            resolve({
              success: true,
              message: 'SSH service is running and accessible - authentication required',
              details: {
                server: server.name || 'Unknown',
                ip: ip,
                user: user,
                method: 'ssh_auth_required'
              }
            });
          } else if (errorOutput.includes('Connection refused')) {
            resolve({
              success: false,
              message: 'SSH connection refused - service may not be running',
              details: {
                error: errorOutput.trim(),
                method: 'ssh_connection_refused'
              }
            });
          } else {
            resolve({
              success: false,
              message: `SSH connection failed: ${errorOutput.trim()}`,
              details: {
                error: errorOutput.trim(),
                method: 'ssh_connection_failed'
              }
            });
          }
        }
      });

      sshCommand.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            success: false,
            message: `SSH command failed: ${error.message}`,
            details: {
              error: error.message,
              method: 'ssh_command_error'
            }
          });
        }
      });
    });
  }

}

// Singleton instance
/** @type {SSHService | null} */
let sshInstance = null;

export function getSSHService() {
  if (!sshInstance) {
    sshInstance = new SSHService();
  }
  return sshInstance;
}

export default SSHService;
