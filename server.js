import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { join, resolve } from 'path';
import { spawn as ptySpawn } from 'node-pty';
import { getSSHExecutionService } from './src/server/ssh-execution-service.js';
import { getDatabase } from './src/server/database-prisma.js';
import { initializeAutoSync, initializeRepositories, setupGracefulShutdown } from './src/server/lib/autoSyncInit.js';
import dotenv from 'dotenv';

dotenv.config();
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
registerGlobalErrorHandlers();
const handle = app.getRequestHandler();

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
 * @property {boolean} [isBackup]
 * @property {string} [containerId]
 * @property {string} [storage]
 * @property {string} [backupStorage]
 */

class ScriptExecutionHandler {
  /**
   * @param {import('http').Server} server
   */
  constructor(server) {
    this.wss = new WebSocketServer({ 
      noServer: true
    });
    this.activeExecutions = new Map();
    this.db = getDatabase();
    this.setupWebSocket();
  }
  
  /**
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
   * @param {string} output
   * @returns {string|null}
   */
  parseContainerId(output) {
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    const patterns = [
      /🆔\s+Container\s+ID:\s+(\d+)/i,
      /🆔\s*Container\s*ID:\s*(\d+)/i,
      /Container\s*ID:\s*(\d+)/i,
      /CT\s*ID:\s*(\d+)/i,
      /Container\s*(\d+)/i,
      /CT\s*(\d+)/i,
      /Container\s*created\s*with\s*ID\s*(\d+)/i,
      /Created\s*container\s*(\d+)/i,
      /Container\s*(\d+)\s*created/i,
      /ID:\s*(\d+)/i,
      /Container\s*ID\s*:\s*(\d+)/i,
      /CT\s*ID\s*:\s*(\d+)/i,
      /Container\s*#\s*(\d+)/i,
      /CT\s*#\s*(\d+)/i,
      /Successfully\s*created\s*container\s*(\d+)/i,
      /Container\s*(\d+)\s*is\s*ready/i,
      /Container\s*(\d+)\s*started/i,
      /(?:^|\s)(\d{3,4})(?:\s|$)/m,
    ];

    const outputsToTry = [output, cleanOutput];
    
    for (const testOutput of outputsToTry) {
      for (const pattern of patterns) {
        const match = testOutput.match(pattern);
        if (match && match[1]) {
          const containerId = match[1];
          if (containerId.length >= 3 && containerId.length <= 4) {
            return containerId;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * @param {string} output
   * @returns {{ip: string, port: number}|null}
   */
  parseWebUIUrl(output) {
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
    
    const patterns = [
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/gi,
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\/|$|\s)/gi,
      /https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)\//gi,
      /(?:^|\s)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)(?:\s|$)/gi,
      /(?:^|\s)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\s|$)/gi,
    ];

    const outputsToTry = [output, cleanOutput];
    
    for (const testOutput of outputsToTry) {
      for (const pattern of patterns) {
        const matches = [...testOutput.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const ip = match[1];
            const port = match[2] || (match[0].startsWith('https') ? '443' : '80');
            
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
   * @param {string} scriptName
   * @param {string} scriptPath
   * @param {string} executionMode
   * @param {number|null} serverId
   * @returns {Promise<number|null>}
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
   * @param {number} installationId
   * @param {Object} updateData
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
      if (this.activeExecutions.has(executionId)) {
        this.sendMessage(ws, {
          type: 'error',
          data: 'Script execution already running',
          timestamp: Date.now()
        });
        return;
      }

      const scriptName = scriptPath.split('/').pop() ?? scriptPath.split('\\').pop() ?? 'Unknown Script';
      const serverId = server ? (server.id ?? null) : null;
      installationId = await this.createInstallationRecord(scriptName, scriptPath, mode, serverId);
      
      if (!installationId) {
        console.error('Failed to create installation record');
      }

      if (mode === 'ssh' && server) {
        await this.startSSHScriptExecution(ws, scriptPath, executionId, server, installationId);
        return;
      }
      
      if (mode === 'ssh' && !server) {
      }

      const scriptsDir = join(process.cwd(), 'scripts');
      const resolvedPath = resolve(scriptPath);
      
      if (!resolvedPath.startsWith(resolve(scriptsDir))) {
        this.sendMessage(ws, {
          type: 'error',
          data: 'Script path is not within the allowed scripts directory',
          timestamp: Date.now()
        });
        
        if (installationId) {
          await this.updateInstallationRecord(installationId, { status: 'failed' });
        }
        return;
      }

      const childProcess = ptySpawn('bash', [resolvedPath], {
        cwd: scriptsDir,
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          FORCE_ANSI: 'true',
          COLUMNS: '80',
          LINES: '24'
        }
      });

      this.activeExecutions.set(executionId, { 
        process: childProcess, 
        ws, 
        installationId,
        outputBuffer: ''
      });

      this.sendMessage(ws, {
        type: 'start',
        data: `Starting execution of ${scriptPath}`,
        timestamp: Date.now()
      });

      childProcess.onData(/** @param {string} data */ async (data) => {
        const output = data.toString();
        
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
          execution.outputBuffer += output;
          if (execution.outputBuffer.length > 1000) {
            execution.outputBuffer = execution.outputBuffer.slice(-1000);
          }
        }
        
        const containerId = this.parseContainerId(output);
        if (containerId && installationId) {
          await this.updateInstallationRecord(installationId, { container_id: containerId });
        }
        
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

      childProcess.onExit((e) => {
        const execution = this.activeExecutions.get(executionId);
        const isSuccess = e.exitCode === 0;
        
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
        
        this.activeExecutions.delete(executionId);
      });

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start script: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
      
      if (installationId) {
        await this.updateInstallationRecord(installationId, { status: 'failed' });
      }
    }
  }

  /**
   * @param {ExtendedWebSocket} ws
   * @param {string} scriptPath
   * @param {string} executionId
   * @param {ServerInfo} server
   * @param {number|null} installationId
   */
  async startSSHScriptExecution(ws, scriptPath, executionId, server, installationId = null) {
    const sshService = getSSHExecutionService();

    this.sendMessage(ws, {
      type: 'start',
      data: `Starting SSH execution of ${scriptPath} on ${server.name} (${server.ip})`,
      timestamp: Date.now()
    });

    try {
      const execution = await sshService.executeScript(
        server,
        scriptPath,
        /** @param {string} data */ async (data) => {
          const exec = this.activeExecutions.get(executionId);
          if (exec) {
            exec.outputBuffer += data;
            if (exec.outputBuffer.length > 1000) {
              exec.outputBuffer = exec.outputBuffer.slice(-1000);
            }
          }
          
          const containerId = this.parseContainerId(data);
          if (containerId && installationId) {
            await this.updateInstallationRecord(installationId, { container_id: containerId });
          }
          
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
          
          this.sendMessage(ws, {
            type: 'output',
            data: data,
            timestamp: Date.now()
          });
        },
        /** @param {string} error */ (error) => {
          const exec = this.activeExecutions.get(executionId);
          if (exec) {
            exec.outputBuffer += error;
            if (exec.outputBuffer.length > 1000) {
              exec.outputBuffer = exec.outputBuffer.slice(-1000);
            }
          }
          
          this.sendMessage(ws, {
            type: 'error',
            data: error,
            timestamp: Date.now()
          });
        },
        /** @param {number} code */ async (code) => {
          const exec = this.activeExecutions.get(executionId);
          const isSuccess = code === 0;
          
          if (installationId && exec) {
            await this.updateInstallationRecord(installationId, {
              status: isSuccess ? 'success' : 'failed',
              output_log: exec.outputBuffer
            });
          }
          
          this.sendMessage(ws, {
            type: 'end',
            data: `SSH script execution finished with code: ${code}`,
            timestamp: Date.now()
          });
          
          this.activeExecutions.delete(executionId);
        }
      );

      this.activeExecutions.set(executionId, { 
        process: /** @type {ExecutionResult} */ (execution).process, 
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
    if (ws.readyState === 1) {
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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} storage
   * @param {string} mode
   * @param {ServerInfo|null} server
   */
  async startBackupExecution(ws, containerId, executionId, storage, mode = 'local', server = null) {
    try {
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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} storage
   * @param {ServerInfo} server
   * @param {Function|null} [onComplete]
   */
  startSSHBackupExecution(ws, containerId, executionId, storage, server, onComplete = null) {
    const sshService = getSSHExecutionService();
    
    return new Promise((resolve, reject) => {
      try {
        const backupCommand = `vzdump ${containerId} --storage ${storage} --mode snapshot`;
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
            const success = code === 0;
            
            if (!success) {
              this.sendMessage(ws, {
                type: 'error',
                data: `Backup failed with exit code: ${code}`,
                timestamp: Date.now()
              });
            }
            
            this.sendMessage(ws, {
              type: 'output',
              data: `\n[Backup ${success ? 'completed' : 'failed'} with exit code: ${code}]\n`,
              timestamp: Date.now()
            });
            
            if (onComplete) onComplete(success);
            
            if (!promiseResolved) {
              promiseResolved = true;
              const result = { success, code };
              
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
          this.activeExecutions.set(executionId, { 
            process: /** @type {any} */ (execution).process, 
            ws
          });
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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} mode
   * @param {ServerInfo|null} server
   * @param {string|null} [backupStorage]
   */
  async startUpdateExecution(ws, containerId, executionId, mode = 'local', server = null, backupStorage = null) {
    try {
      if (backupStorage && mode === 'ssh' && server) {
        this.sendMessage(ws, {
          type: 'start',
          data: `Starting backup before update for container ${containerId}...`,
          timestamp: Date.now()
        });

        const backupExecutionId = `backup_${executionId}`;
        
        try {
          const backupResult = await this.startSSHBackupExecution(
            ws, 
            containerId, 
            backupExecutionId, 
            backupStorage, 
            server
          );
          
          if (!backupResult || !backupResult.success) {
            this.sendMessage(ws, {
              type: 'output',
              data: '\n⚠️ Backup failed, but proceeding with update as requested...\n',
              timestamp: Date.now()
            });
          } else {
            this.sendMessage(ws, {
              type: 'output',
              data: '\n✅ Backup completed successfully. Starting update...\n',
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('Backup error before update:', error);
          this.sendMessage(ws, {
            type: 'output',
            data: `\n⚠️ Backup error: ${error instanceof Error ? error.message : String(error)}. Proceeding with update...\n`,
            timestamp: Date.now()
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   */
  async startLocalUpdateExecution(ws, containerId, executionId) {
    const { spawn } = await import('node-pty');
    
    const childProcess = spawn('bash', ['-c', `pct enter ${containerId}`], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    this.activeExecutions.set(executionId, { 
      process: childProcess, 
      ws
    });

    childProcess.onData((data) => {
      this.sendMessage(ws, {
        type: 'output',
        data: data.toString(),
        timestamp: Date.now()
      });
    });

    setTimeout(() => {
      childProcess.write('update\n');
    }, 4000);

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

      this.activeExecutions.set(executionId, { 
        process: /** @type {any} */ (execution).process, 
        ws
      });

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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   * @param {string} mode
   * @param {ServerInfo|null} server
   */
  async startShellExecution(ws, containerId, executionId, mode = 'local', server = null) {
    try {
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
   * @param {ExtendedWebSocket} ws
   * @param {string} containerId
   * @param {string} executionId
   */
  async startLocalShellExecution(ws, containerId, executionId) {
    const { spawn } = await import('node-pty');
    
    const childProcess = spawn('bash', ['-c', `pct enter ${containerId}`], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    this.activeExecutions.set(executionId, { 
      process: childProcess, 
      ws
    });

    childProcess.onData((data) => {
      this.sendMessage(ws, {
        type: 'output',
        data: data.toString(),
        timestamp: Date.now()
      });
    });

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

      this.activeExecutions.set(executionId, { 
        process: /** @type {any} */ (execution).process, 
        ws
      });

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `SSH shell execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
    }
  }
}



app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      const { pathname, query } = parsedUrl;

      const isWebSocketUpgrade = req.headers.upgrade === 'websocket';
      
      if (isWebSocketUpgrade && pathname === '/ws/script-execution') {
        return;
      }
      
      if (isWebSocketUpgrade) {
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const scriptHandler = new ScriptExecutionHandler(httpServer);
  
  httpServer.on('upgrade', (request, socket, head) => {
    const parsedUrl = parse(request.url || '', true);
    const { pathname } = parsedUrl;
    
    if (pathname === '/ws/script-execution') {
      scriptHandler.handleUpgrade(request, socket, head);
      return;
    }
    
    socket.destroy();
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, async () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server running on ws://${hostname}:${port}/ws/script-execution`);
      
      await initializeRepositories();      

      initializeAutoSync();      

      setupGracefulShutdown();
    });
});
