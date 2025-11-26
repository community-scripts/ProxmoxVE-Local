import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { join, resolve } from 'path';
import stripAnsi from 'strip-ansi';
import { spawn as ptySpawn } from 'node-pty';
import { getSSHExecutionService } from './src/server/ssh-execution-service.js';
import { getDatabase } from './src/server/database-prisma.js';
import { initializeAutoSync, initializeRepositories, setupGracefulShutdown } from './src/server/lib/autoSyncInit.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();
// Fallback minimal global error handlers for Node runtime (avoid TS import)
function registerGlobalErrorHandlers() {
  if (registerGlobalErrorHandlers._registered) return;
  registerGlobalErrorHandlers._registered = true;
  process.on('uncaughtException', (err) => {
    console.error('uncaught_exception', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('unhandled_rejection', reason);
  });
}
registerGlobalErrorHandlers._registered = false;

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
// Register global handlers once at bootstrap
registerGlobalErrorHandlers();
const handle = app.getRequestHandler();

// WebSocket handler for script execution
/**
 * @typedef {import('ws').WebSocket & {connectionTime?: number, clientIP?: string}} ExtendedWebSocket
 */

/**
 * @typedef {Object} Execution
 * @property {any} process
 * @property {ExtendedWebSocket} ws
 */

/**
 * @typedef {Object} ServerInfo
 * @property {string} name
 * @property {string} ip
 * @property {string} user
 * @property {string} password
 * @property {number} [id]
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {any} process
 * @property {Function} kill
 */

/**
 * @typedef {Object} WebSocketMessage
 * @property {string} action
 * @property {string} [scriptPath]
 * @property {string} [executionId]
 * @property {string} [input]
 * @property {string} [mode]
 * @property {ServerInfo} [server]
 * @property {boolean} [isUpdate]
 * @property {boolean} [isShell]
 * @property {string} [containerId]
 */

class ScriptExecutionHandler {
  /**
   * @param {import('http').Server} server
   */
  constructor(server) {
    // Create WebSocketServer without attaching to server
    // We'll handle upgrades manually to avoid interfering with Next.js HMR
    this.wss = new WebSocketServer({ 
      noServer: true
    });
    this.activeExecutions = new Map();
    this.db = getDatabase();
    this.setupWebSocket();
  }
  
  /**
   * Handle WebSocket upgrade for our endpoint
   * @param {import('http').IncomingMessage} request
   * @param {import('stream').Duplex} socket
   * @param {Buffer} head
   */
  handleUpgrade(request, socket, head) {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  /**
   * Parse Container ID from terminal output
   * @param {string} output - Terminal output to parse
   * @returns {string|null} - Container ID if found, null otherwise
   */
  parseContainerId(output) {
    // First, strip ANSI color codes to make pattern matching more reliable
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Look for various patterns that Proxmox scripts might use
    const patterns = [
      // Primary pattern - the exact format from the output
      /🆔\s+Container\s+ID:\s+(\d+)/i,
      
      // Standard patterns with flexible spacing
      /🆔\s*Container\s*ID:\s*(\d+)/i,
      /Container\s*ID:\s*(\d+)/i,
      /CT\s*ID:\s*(\d+)/i,
      /Container\s*(\d+)/i,
      
      // Alternative patterns
      /CT\s*(\d+)/i,
      /Container\s*created\s*with\s*ID\s*(\d+)/i,
      /Created\s*container\s*(\d+)/i,
      /Container\s*(\d+)\s*created/i,
      /ID:\s*(\d+)/i,
      
      // Patterns with different spacing and punctuation
      /Container\s*ID\s*:\s*(\d+)/i,
      /CT\s*ID\s*:\s*(\d+)/i,
      /Container\s*#\s*(\d+)/i,
      /CT\s*#\s*(\d+)/i,
      
      // Patterns that might appear in success messages
      /Successfully\s*created\s*container\s*(\d+)/i,
      /Container\s*(\d+)\s*is\s*ready/i,
      /Container\s*(\d+)\s*started/i,
      
      // Generic number patterns that might be container IDs (3-4 digits)
      /(?:^|\s)(\d{3,4})(?:\s|$)/m,
    ];

    // Try patterns on both original and cleaned output
    const outputsToTry = [output, cleanOutput];
    
    for (const testOutput of outputsToTry) {
      for (const pattern of patterns) {
        const match = testOutput.match(pattern);
        if (match && match[1]) {
          const containerId = match[1];
          // Additional validation: container IDs are typically 3-4 digits
          if (containerId.length >= 3 && containerId.length <= 4) {
            return containerId;
          }
        }
      }
    }
    
    
    return null;
  }

  /**
   * Parse Web UI URL from terminal output
   * @param {string} output - Terminal output to parse
   * @returns {{ip: string, port: number}|null} - Object with ip and port if found, null otherwise
   */
  parseWebUIUrl(output) {
    // First, strip ANSI color codes to make pattern matching more reliable
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Look for URL patterns with any valid IP address (private or public)
    const patterns = [
      // HTTP/HTTPS URLs with IP and port
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/gi,
      // URLs without explicit port (assume default ports)
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\/|$|\s)/gi,
      // URLs with trailing slash and port
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)\//gi,
      // URLs with just IP and port (no protocol)
      /(?:^|\s)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)(?:\s|$)/gi,
      // URLs with just IP (no protocol, no port)
      /(?:^|\s)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\s|$)/gi,
    ];

    // Try patterns on both original and cleaned output
    const outputsToTry = [output, cleanOutput];
    
    for (const testOutput of outputsToTry) {
      for (const pattern of patterns) {
        const matches = [...testOutput.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const ip = match[1];
            const port = match[2] || (match[0].startsWith('https') ? '443' : '80');
            
            // Validate IP address format
            if (ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
              return {
                ip: ip,
                port: parseInt(port, 10)
              };
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Create installation record
   * @param {string} scriptName - Name of the script
   * @param {string} scriptPath - Path to the script
   * @param {string} executionMode - 'local' or 'ssh'
   * @param {number|null} serverId - Server ID for SSH executions
   * @returns {Promise<number|null>} - Installation record ID
   */
  async createInstallationRecord(scriptName, scriptPath, executionMode, serverId = null) {
    try {
      const result = await this.db.createInstalledScript({
        script_name: scriptName,
        script_path: scriptPath,
        container_id: undefined,
        server_id: serverId ?? undefined,
        execution_mode: executionMode,
        status: 'in_progress',
        output_log: ''
      });
      return Number(result.id);
    } catch (error) {
      console.error('Error creating installation record:', error);
      return null;
    }
  }

  /**
   * Update installation record
   * @param {number} installationId - Installation record ID
   * @param {Object} updateData - Data to update
   */
  async updateInstallationRecord(installationId, updateData) {
    try {
      await this.db.updateInstalledScript(installationId, updateData);
    } catch (error) {
      console.error('Error updating installation record:', error);
    }
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, request) => {
      
      // Set connection metadata
      /** @type {ExtendedWebSocket} */ (ws).connectionTime = Date.now();
      /** @type {ExtendedWebSocket} */ (ws).clientIP = request.socket.remoteAddress || 'unknown';
      
      ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          const message = JSON.parse(rawMessage);
          this.handleMessage(/** @type {ExtendedWebSocket} */ (ws), message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendMessage(ws, {
            type: 'error',
            data: 'Invalid message format',
            timestamp: Date.now()
          });
        }
      });

      ws.on('close', (code, reason) => {
        this.cleanupActiveExecutions(/** @type {ExtendedWebSocket} */ (ws));
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.cleanupActiveExecutions(/** @type {ExtendedWebSocket} */ (ws));
      });
    });
  }

  /**
   * @param {ExtendedWebSocket} ws
   * @param {WebSocketMessage} message
   */
  async handleMessage(ws, message) {
    const { action, scriptPath, executionId, input, mode, server, isUpdate, isShell, isBackup, containerId, storage, backupStorage } = message;

    switch (action) {
      case 'start':
        if (scriptPath && executionId) {
          if (isBackup && containerId && storage) {
            await this.startBackupExecution(ws, containerId, executionId, storage, mode, server);
          } else if (isUpdate && containerId) {
            await this.startUpdateExecution(ws, containerId, executionId, mode, server, backupStorage);
          } else if (isShell && containerId) {
            await this.startShellExecution(ws, containerId, executionId, mode, server);
          } else {
            await this.startScriptExecution(ws, scriptPath, executionId, mode, server);
          }
        } else {
          this.sendMessage(ws, {
            type: 'error',
            data: 'Missing scriptPath or executionId',
            timestamp: Date.now()
          });
        }
        break;

      case 'stop':
        if (executionId) {
          this.stopScriptExecution(executionId);
        }
        break;

      case 'input':
        if (executionId && input !== undefined) {
          this.sendInputToProcess(executionId, input);
        }
        break;

      default:
        this.sendMessage(ws, {
          type: 'error',
          data: 'Unknown action',
          timestamp: Date.now()
        });
    }
  }

  /**
   * @param {ExtendedWebSocket} ws
   * @param {string} scriptPath
   * @param {string} executionId
   * @param {string} mode
   * @param {ServerInfo|null} server
   */
  async startScriptExecution(ws, scriptPath, executionId, mode = 'local', server = null) {
    /** @type {number|null} */
    let installationId = null;
    
    try {
      
      // Check if execution is already running
      if (this.activeExecutions.has(executionId)) {
        this.sendMessage(ws, {
          type: 'error',
          data: 'Script execution already running',
          timestamp: Date.now()
        });
        return;
      }

      // Extract script name from path
      const scriptName = scriptPath.split('/').pop() ?? scriptPath.split('\\').pop() ?? 'Unknown Script';
      
      // Create installation record
      const serverId = server ? (server.id ?? null) : null;
      installationId = await this.createInstallationRecord(scriptName, scriptPath, mode, serverId);
      
      if (!installationId) {
        console.error('Failed to create installation record');
      }

      // Handle SSH execution
      if (mode === 'ssh' && server) {
        await this.startSSHScriptExecution(ws, scriptPath, executionId, server, installationId);
        return;
      }
      
      if (mode === 'ssh' && !server) {
        // SSH mode requested but no server provided, falling back to local execution
      }

      // Basic validation for local execution
      const scriptsDir = join(process.cwd(), 'scripts');
      const resolvedPath = resolve(scriptPath);
      
      if (!resolvedPath.startsWith(resolve(scriptsDir))) {
        this.sendMessage(ws, {
          type: 'error',
          data: 'Script path is not within the allowed scripts directory',
          timestamp: Date.now()
        });
        
        // Update installation record with failure
        if (installationId) {
          await this.updateInstallationRecord(installationId, { status: 'failed' });
        }
        return;
      }

      // Start script execution with pty for proper TTY support
      const childProcess = ptySpawn('bash', [resolvedPath], {
        cwd: scriptsDir,
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: {
          ...process.env,
          TERM: 'xterm-256color', // Enable proper terminal support
          FORCE_ANSI: 'true', // Allow ANSI codes for proper display
          COLUMNS: '80', // Set terminal width
          LINES: '24' // Set terminal height
        }
      });

      // pty handles encoding automatically
      
      // Store the execution with installation ID
      this.activeExecutions.set(executionId, { 
        process: childProcess, 
        ws, 
        installationId,
        outputBuffer: ''
      });

      // Send start message
      this.sendMessage(ws, {
        type: 'start',
        data: `Starting execution of ${scriptPath}`,
        timestamp: Date.now()
      });

      // Handle pty data (both stdout and stderr combined)
      childProcess.onData(async (data) => {
        const output = data.toString();
        
        // Store output in buffer for logging
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
          execution.outputBuffer += output;
          // Keep only last 1000 characters to avoid memory issues
          if (execution.outputBuffer.length > 1000) {
            execution.outputBuffer = execution.outputBuffer.slice(-1000);
          }
        }
        
        // Parse for Container ID
        const containerId = this.parseContainerId(output);
        if (containerId && installationId) {
          await this.updateInstallationRecord(installationId, { container_id: containerId });
        }
        
        // Parse for Web UI URL
        const webUIUrl = this.parseWebUIUrl(output);
        if (webUIUrl && installationId) {
          const { ip, port } = webUIUrl;
          if (ip && port) {
            await this.updateInstallationRecord(installationId, { 
              web_ui_ip: ip, 
              web_ui_port: port 
            });
          }
        }
        
        this.sendMessage(ws, {
          type: 'output',
          data: output,
          timestamp: Date.now()
        });
      });

      // Handle process exit
      childProcess.onExit((e) => {
        const execution = this.activeExecutions.get(executionId);
        const isSuccess = e.exitCode === 0;
        
        // Update installation record with final status and output
        if (installationId && execution) {
          this.updateInstallationRecord(installationId, {
            status: isSuccess ? 'success' : 'failed',
            output_log: execution.outputBuffer
          });
        }
        
        this.sendMessage(ws, {
          type: 'end',
          data: `Script execution finished with code: ${e.exitCode}, signal: ${e.signal}`,
          timestamp: Date.now()
        });
        
        // Clean up
        this.activeExecutions.delete(executionId);
      });

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start script: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
      
      // Update installation record with failure
      if (installationId) {
        await this.updateInstallationRecord(installationId, { status: 'failed' });
      }
    }
  }

  /**
   * Start SSH script execution
   * @param {ExtendedWebSocket} ws
   * @param {string} scriptPath
   * @param {string} executionId
   * @param {ServerInfo} server
   * @param {number|null} installationId
   */
  async startSSHScriptExecution(ws, scriptPath, executionId, server, installationId = null) {
    const sshService = getSSHExecutionService();

    // Send start message
    this.sendMessage(ws, {
      type: 'start',
      data: `Starting SSH execution of ${scriptPath} on ${server.name} (${server.ip})`,
      timestamp: Date.now()
    });

    try {
      const execution = /** @type {ExecutionResult} */ (await sshService.executeScript(
        server,
        scriptPath,
        /** @param {string} data */ async (data) => {
          // Store output in buffer for logging
          const exec = this.activeExecutions.get(executionId);
          if (exec) {
            exec.outputBuffer += data;
            // Keep only last 1000 characters to avoid memory issues
            if (exec.outputBuffer.length > 1000) {
              exec.outputBuffer = exec.outputBuffer.slice(-1000);
            }
          }
          
          // Parse for Container ID
          const containerId = this.parseContainerId(data);
          if (containerId && installationId) {
            await this.updateInstallationRecord(installationId, { container_id: containerId });
          }
          
          // Parse for Web UI URL
          const webUIUrl = this.parseWebUIUrl(data);
          if (webUIUrl && installationId) {
            const { ip, port } = webUIUrl;
            if (ip && port) {
              await this.updateInstallationRecord(installationId, { 
                web_ui_ip: ip, 
                web_ui_port: port 
              });
            }
          }
          
          // Handle data output
          this.sendMessage(ws, {
            type: 'output',
            data: data,
            timestamp: Date.now()
          });
        },
        /** @param {string} error */ (error) => {
          // Store error in buffer for logging
          const exec = this.activeExecutions.get(executionId);
          if (exec) {
            exec.outputBuffer += error;
            // Keep only last 1000 characters to avoid memory issues
            if (exec.outputBuffer.length > 1000) {
              exec.outputBuffer = exec.outputBuffer.slice(-1000);
            }
          }
          
          // Handle errors
          this.sendMessage(ws, {
            type: 'error',
            data: error,
            timestamp: Date.now()
          });
        },
        /** @param {number} code */ async (code) => {
          const exec = this.activeExecutions.get(executionId);
          const isSuccess = code === 0;
          
          // Update installation record with final status and output
          if (installationId && exec) {
            await this.updateInstallationRecord(installationId, {
              status: isSuccess ? 'success' : 'failed',
              output_log: exec.outputBuffer
            });
          }
          
          // Handle process exit
          this.sendMessage(ws, {
            type: 'end',
            data: `SSH script execution finished with code: ${code}`,
            timestamp: Date.now()
          });
          
          // Clean up
          this.activeExecutions.delete(executionId);
        }
      ));

      // Store the execution with installation ID
      this.activeExecutions.set(executionId, { 
        process: execution.process, 
        ws, 
        installationId,
        outputBuffer: ''
      });

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start SSH execution: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
      
      // Update installation record with failure
      if (installationId) {
        await this.updateInstallationRecord(installationId, { status: 'failed' });
      }
    }
  }

  /**
   * @param {string} executionId
   */
  stopScriptExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.process.kill('SIGTERM');
      this.activeExecutions.delete(executionId);
      
      this.sendMessage(execution.ws, {
        type: 'end',
        data: 'Script execution stopped by user',
        timestamp: Date.now()
      });
    }
  }

  /**
   * @param {string} executionId
   * @param {string} input
   */
  sendInputToProcess(executionId, input) {
    const execution = this.activeExecutions.get(executionId);
    if (execution && execution.process.write) {
      execution.process.write(input);
    }
  }

  /**
   * @param {ExtendedWebSocket} ws
   * @param {any} message
   */
  sendMessage(ws, message) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * @param {ExtendedWebSocket} ws
   */
  cleanupActiveExecutions(ws) {
    for (const [executionId, execution] of this.activeExecutions.entries()) {
      if (execution.ws === ws) {
        execution.process.kill('SIGTERM');
        this.activeExecutions.delete(executionId);
      }
    }
  }

  /**
   * Start backup execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} storage
   * @param {string} mode
   * @param {ServerInfo|null} server
   */
  async startBackupExecution(ws, containerId, executionId, storage, mode = 'local', server = null) {
    try {
      // Send start message
      this.sendMessage(ws, {
        type: 'start',
        data: `Starting backup for container ${containerId} to storage ${storage}...`,
        timestamp: Date.now()
      });

      if (mode === 'ssh' && server) {
        await this.startSSHBackupExecution(ws, containerId, executionId, storage, server);
      } else {
        this.sendMessage(ws, {
          type: 'error',
          data: 'Backup is only supported via SSH',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start backup: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start SSH backup execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} storage
   * @param {ServerInfo} server
   * @param {Function} [onComplete] - Optional callback when backup completes
   */
  startSSHBackupExecution(ws, containerId, executionId, storage, server, onComplete = null) {
    const sshService = getSSHExecutionService();
    
    return new Promise((resolve, reject) => {
      try {
        const backupCommand = `vzdump ${containerId} --storage ${storage} --mode snapshot`;
        
        // Wrap the onExit callback to resolve our promise
        let promiseResolved = false;
        
        sshService.executeCommand(
          server,
          backupCommand,
          /** @param {string} data */
          (data) => {
            this.sendMessage(ws, {
              type: 'output',
              data: data,
              timestamp: Date.now()
            });
          },
          /** @param {string} error */
          (error) => {
            this.sendMessage(ws, {
              type: 'error',
              data: error,
              timestamp: Date.now()
            });
          },
          /** @param {number} code */
          (code) => {
            // Don't send 'end' message here if this is part of a backup+update flow
            // The update flow will handle completion messages
            const success = code === 0;
            
            if (!success) {
              this.sendMessage(ws, {
                type: 'error',
                data: `Backup failed with exit code: ${code}`,
                timestamp: Date.now()
              });
            }
            
            // Send a completion message (but not 'end' type to avoid stopping terminal)
            this.sendMessage(ws, {
              type: 'output',
              data: `\n[Backup ${success ? 'completed' : 'failed'} with exit code: ${code}]\n`,
              timestamp: Date.now()
            });
            
            if (onComplete) onComplete(success);
            
            // Resolve the promise when backup completes
            // Use setImmediate to ensure resolution happens in the right execution context
            if (!promiseResolved) {
              promiseResolved = true;
              const result = { success, code };
              
              // Use setImmediate to ensure promise resolution happens in the next tick
              // This ensures the await in startUpdateExecution can properly resume
              setImmediate(() => {
                try {
                  resolve(result);
                } catch (resolveError) {
                  console.error('Error resolving backup promise:', resolveError);
                  reject(resolveError);
                }
              });
            }
            
            this.activeExecutions.delete(executionId);
          }
        ).then((execution) => {
          // Store the execution
          this.activeExecutions.set(executionId, { 
            process: /** @type {any} */ (execution).process, 
            ws
          });
          // Note: Don't resolve here - wait for onExit callback
        }).catch((error) => {
          console.error('Error starting backup execution:', error);
          this.sendMessage(ws, {
            type: 'error',
            data: `SSH backup execution failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now()
          });
          if (onComplete) onComplete(false);
          if (!promiseResolved) {
            promiseResolved = true;
            reject(error);
          }
        });

      } catch (error) {
        console.error('Error in startSSHBackupExecution:', error);
        this.sendMessage(ws, {
          type: 'error',
          data: `SSH backup execution failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now()
        });
        if (onComplete) onComplete(false);
        reject(error);
      }
    });
  }

  /**
   * Start update execution (pct enter + update command)
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} mode
   * @param {ServerInfo|null} server
   * @param {string} [backupStorage] - Optional storage to backup to before update
   */
  async startUpdateExecution(ws, containerId, executionId, mode = 'local', server = null, backupStorage = null) {
    try {
      // If backup storage is provided, run backup first
      if (backupStorage && mode === 'ssh' && server) {
        this.sendMessage(ws, {
          type: 'start',
          data: `Starting backup before update for container ${containerId}...`,
          timestamp: Date.now()
        });

        // Create a separate execution ID for backup
        const backupExecutionId = `backup_${executionId}`;
        
        // Run backup and wait for it to complete
        try {
          const backupResult = await this.startSSHBackupExecution(
            ws, 
            containerId, 
            backupExecutionId, 
            backupStorage, 
            server
          );
          
          // Backup completed (successfully or not)
          if (!backupResult || !backupResult.success) {
            // Backup failed, but we'll still allow update (per requirement 1b)
            this.sendMessage(ws, {
              type: 'output',
              data: '\n⚠️ Backup failed, but proceeding with update as requested...\n',
              timestamp: Date.now()
            });
          } else {
            // Backup succeeded
            this.sendMessage(ws, {
              type: 'output',
              data: '\n✅ Backup completed successfully. Starting update...\n',
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('Backup error before update:', error);
          // Backup failed to start, but allow update to proceed
          this.sendMessage(ws, {
            type: 'output',
            data: `\n⚠️ Backup error: ${error instanceof Error ? error.message : String(error)}. Proceeding with update...\n`,
            timestamp: Date.now()
          });
        }
        
        // Small delay before starting update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Send start message for update (only if we're actually starting an update)
      this.sendMessage(ws, {
        type: 'start',
        data: `Starting update for container ${containerId}...`,
        timestamp: Date.now()
      });

      if (mode === 'ssh' && server) {
        await this.startSSHUpdateExecution(ws, containerId, executionId, server);
      } else {
        await this.startLocalUpdateExecution(ws, containerId, executionId);
      }

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start update: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start local update execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   */
  async startLocalUpdateExecution(ws, containerId, executionId) {
    const { spawn } = await import('node-pty');
    
    // Create a shell process that will run pct enter and then update
    const childProcess = spawn('bash', ['-c', `pct enter ${containerId}`], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    // Store the execution
    this.activeExecutions.set(executionId, { 
      process: childProcess, 
      ws
    });

    // Handle pty data
    childProcess.onData((data) => {
      this.sendMessage(ws, {
        type: 'output',
        data: data.toString(),
        timestamp: Date.now()
      });
    });

    // Send the update command after a delay to ensure we're in the container
    setTimeout(() => {
      childProcess.write('update\n');
    }, 4000);

    // Handle process exit
    childProcess.onExit((e) => {
      this.sendMessage(ws, {
        type: 'end',
        data: `Update completed with exit code: ${e.exitCode}`,
        timestamp: Date.now()
      });
      
      this.activeExecutions.delete(executionId);
    });
  }

  /**
   * Start SSH update execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {ServerInfo} server
   */
  async startSSHUpdateExecution(ws, containerId, executionId, server) {
    const sshService = getSSHExecutionService();
    
    try {
      const execution = await sshService.executeCommand(
        server,
        `pct enter ${containerId}`,
        /** @param {string} data */
        (data) => {
          this.sendMessage(ws, {
            type: 'output',
            data: data,
            timestamp: Date.now()
          });
        },
        /** @param {string} error */
        (error) => {
          this.sendMessage(ws, {
            type: 'error',
            data: error,
            timestamp: Date.now()
          });
        },
        /** @param {number} code */
        (code) => {
          this.sendMessage(ws, {
            type: 'end',
            data: `Update completed with exit code: ${code}`,
            timestamp: Date.now()
          });
          
          this.activeExecutions.delete(executionId);
        }
      );

      // Store the execution
      this.activeExecutions.set(executionId, { 
        process: /** @type {any} */ (execution).process, 
        ws
      });

      // Send the update command after a delay to ensure we're in the container
      setTimeout(() => {
        /** @type {any} */ (execution).process.write('update\n');
      }, 4000);

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `SSH execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start shell execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} mode
   * @param {ServerInfo|null} server
   */
  async startShellExecution(ws, containerId, executionId, mode = 'local', server = null) {
    try {
      
      // Send start message
      this.sendMessage(ws, {
        type: 'start',
        data: `Starting shell session for container ${containerId}...`,
        timestamp: Date.now()
      });

      if (mode === 'ssh' && server) {
        await this.startSSHShellExecution(ws, containerId, executionId, server);
      } else {
        await this.startLocalShellExecution(ws, containerId, executionId);
      }

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start shell: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start local shell execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   */
  async startLocalShellExecution(ws, containerId, executionId) {
    const { spawn } = await import('node-pty');
    
    // Create a shell process that will run pct enter
    const childProcess = spawn('bash', ['-c', `pct enter ${containerId}`], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    // Store the execution
    this.activeExecutions.set(executionId, { 
      process: childProcess, 
      ws
    });

    // Handle pty data
    childProcess.onData((data) => {
      this.sendMessage(ws, {
        type: 'output',
        data: data.toString(),
        timestamp: Date.now()
      });
    });

    // Note: No automatic command is sent - user can type commands interactively

    // Handle process exit
    childProcess.onExit((e) => {
      this.sendMessage(ws, {
        type: 'end',
        data: `Shell session ended with exit code: ${e.exitCode}`,
        timestamp: Date.now()
      });
      
      this.activeExecutions.delete(executionId);
    });
  }

  /**
   * Start SSH shell execution
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {ServerInfo} server
   */
  async startSSHShellExecution(ws, containerId, executionId, server) {
    const sshService = getSSHExecutionService();
    
    try {
      const execution = await sshService.executeCommand(
        server,
        `pct enter ${containerId}`,
        /** @param {string} data */
        (data) => {
          this.sendMessage(ws, {
            type: 'output',
            data: data,
            timestamp: Date.now()
          });
        },
        /** @param {string} error */
        (error) => {
          this.sendMessage(ws, {
            type: 'error',
            data: error,
            timestamp: Date.now()
          });
        },
        /** @param {number} code */
        (code) => {
          this.sendMessage(ws, {
            type: 'end',
            data: `Shell session ended with exit code: ${code}`,
            timestamp: Date.now()
          });
          
          this.activeExecutions.delete(executionId);
        }
      );

      // Store the execution
      this.activeExecutions.set(executionId, { 
        process: /** @type {any} */ (execution).process, 
        ws
      });

      // Note: No automatic command is sent - user can type commands interactively

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `SSH shell execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }
}

// TerminalHandler removed - not used by current application

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url || '', true);
      const { pathname, query } = parsedUrl;

      // Check if this is a WebSocket upgrade request
      const isWebSocketUpgrade = req.headers.upgrade === 'websocket';
      
      // Only intercept WebSocket upgrades for /ws/script-execution
      // Let Next.js handle all other WebSocket upgrades (like HMR) and all HTTP requests
      if (isWebSocketUpgrade && pathname === '/ws/script-execution') {
        // WebSocket upgrade will be handled by the WebSocket server
        // Don't call handle() for this path - let WebSocketServer handle it
        return;
      }

      // Let Next.js handle all other requests including:
      // - HTTP requests to /ws/script-execution (non-WebSocket)
      // - WebSocket upgrades to other paths (like /_next/webpack-hmr)
      // - All static assets (_next routes)
      // - All other routes
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Create WebSocket handlers
  const scriptHandler = new ScriptExecutionHandler(httpServer);
  
  // Handle WebSocket upgrades manually to avoid interfering with Next.js HMR
  // We need to preserve Next.js's upgrade handlers and call them for non-matching paths
  // Save any existing upgrade listeners (Next.js might have set them up)
  const existingUpgradeListeners = httpServer.listeners('upgrade').slice();
  httpServer.removeAllListeners('upgrade');
  
  // Add our upgrade handler that routes based on path
  httpServer.on('upgrade', (request, socket, head) => {
    const parsedUrl = parse(request.url || '', true);
    const { pathname } = parsedUrl;
    
    if (pathname === '/ws/script-execution') {
      // Handle our custom WebSocket endpoint
      scriptHandler.handleUpgrade(request, socket, head);
    } else {
      // For all other paths (including Next.js HMR), call existing listeners
      // This allows Next.js to handle its own WebSocket upgrades
      for (const listener of existingUpgradeListeners) {
        try {
          listener.call(httpServer, request, socket, head);
        } catch (err) {
          console.error('Error in upgrade listener:', err);
        }
      }
    }
  });
  // Note: TerminalHandler removed as it's not being used by the current application

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, async () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server running on ws://${hostname}:${port}/ws/script-execution`);
      
      // Initialize default repositories
      await initializeRepositories();
      
      // Initialize auto-sync service
      initializeAutoSync();
      
      // Setup graceful shutdown handlers
      setupGracefulShutdown();
    });
});
