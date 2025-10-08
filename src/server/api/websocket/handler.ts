import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { scriptManager } from '~/server/lib/scripts';
import { getSSHExecutionService } from '~/server/ssh-execution-service';
import type { Server } from '~/types/server';

interface ScriptExecutionMessage {
  type: 'start' | 'output' | 'error' | 'end';
  data: string;
  timestamp: number;
}

export class ScriptExecutionHandler {
  private wss: WebSocketServer;
  private activeExecutions: Map<string, { process: any; ws: WebSocket }> = new Map();

  constructor(server: unknown) {
    this.wss = new WebSocketServer({ 
      server: server as any,
      path: '/ws/script-execution'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleConnection(ws: WebSocket, _request: IncomingMessage) {
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as { action: string; scriptPath?: string; executionId?: string };
        void this.handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.sendMessage(ws, {
          type: 'error',
          data: 'Invalid message format',
          timestamp: Date.now()
        });
      }
    });

    ws.on('close', () => {
      // Clean up any active executions for this connection
      this.cleanupActiveExecutions(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanupActiveExecutions(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: { action: string; scriptPath?: string; executionId?: string; mode?: 'local' | 'ssh'; server?: any; data?: string }) {
    const { action, scriptPath, executionId, mode, server, data } = message;
    
    console.log('WebSocket message received:', { action, scriptPath, executionId, mode, server: server ? { name: server.name, ip: server.ip } : null, hasData: !!data });

    switch (action) {
      case 'start':
        if (scriptPath && executionId) {
          await this.startScriptExecution(ws, scriptPath, executionId, mode, server);
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
        if (executionId && data !== undefined) {
          this.sendInputToExecution(executionId, data);
        } else {
          this.sendMessage(ws, {
            type: 'error',
            data: 'Missing executionId or input data',
            timestamp: Date.now()
          });
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

  private async startScriptExecution(ws: WebSocket, scriptPath: string, executionId: string, mode?: 'local' | 'ssh', server?: any) {
    console.log('startScriptExecution called with:', { scriptPath, executionId, mode, server: server ? { name: server.name, ip: server.ip } : null });
    
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

      let process: any;

      if (mode === 'ssh' && server) {
        // SSH execution
        console.log('Starting SSH execution:', { scriptPath, server });
        console.log('SSH execution mode detected, calling SSH service...');
        console.log('Mode check: mode=', mode, 'server=', !!server);
        this.sendMessage(ws, {
          type: 'start',
          data: `Starting SSH execution of ${scriptPath} on ${server.name ?? server.ip}`,
          timestamp: Date.now()
        });

        const sshService = getSSHExecutionService();
        console.log('SSH service obtained, calling executeScript...');
        console.log('SSH service object:', typeof sshService, sshService.constructor.name);
        
        try {
          const result = await sshService.executeScript(server as Server, scriptPath, 
            (data: string) => {
              console.log('SSH onData callback:', data.substring(0, 100) + '...');
              this.sendMessage(ws, {
                type: 'output',
                data: data,
                timestamp: Date.now()
              });
            },
            (error: string) => {
              console.log('SSH onError callback:', error);
              this.sendMessage(ws, {
                type: 'error',
                data: error,
                timestamp: Date.now()
              });
            },
            (code: number) => {
              console.log('SSH onExit callback, code:', code);
              this.sendMessage(ws, {
                type: 'end',
                data: `SSH script execution finished with code: ${code}`,
                timestamp: Date.now()
              });
              this.activeExecutions.delete(executionId);
            }
          );
          console.log('SSH service executeScript completed, result:', result);
          process = (result as any).process;
        } catch (sshError) {
          console.error('SSH service executeScript failed:', sshError);
          this.sendMessage(ws, {
            type: 'error',
            data: `SSH execution failed: ${sshError instanceof Error ? sshError.message : String(sshError)}`,
            timestamp: Date.now()
          });
          return;
        }
      } else {
        // Local execution
        console.log('Starting local execution:', { scriptPath });
        console.log('Local execution mode detected, calling local script manager...');
        console.log('Mode check: mode=', mode, 'server=', !!server, 'condition result:', mode === 'ssh' && server);
        
        // Validate script path
        const validation = scriptManager.validateScriptPath(scriptPath);
        if (!validation.valid) {
          this.sendMessage(ws, {
            type: 'error',
            data: validation.message ?? 'Invalid script path',
            timestamp: Date.now()
          });
          return;
        }

        // Start script execution
        process = await scriptManager.executeScript(scriptPath);
        
        // Send start message
        this.sendMessage(ws, {
          type: 'start',
          data: `Starting execution of ${scriptPath}`,
          timestamp: Date.now()
        });

        // Handle stdout
        process.stdout?.on('data', (data: Buffer) => {
          this.sendMessage(ws, {
            type: 'output',
            data: data.toString(),
            timestamp: Date.now()
          });
        });

        // Handle stderr
        process.stderr?.on('data', (data: Buffer) => {
          this.sendMessage(ws, {
            type: 'error',
            data: data.toString(),
            timestamp: Date.now()
          });
        });

        // Handle process exit
        process.on('exit', (code: number | null, signal: string | null) => {
          this.sendMessage(ws, {
            type: 'end',
            data: `Script execution finished with code: ${code}, signal: ${signal}`,
            timestamp: Date.now()
          });
          
          // Clean up
          this.activeExecutions.delete(executionId);
        });

        // Handle process error
        process.on('error', (error: Error) => {
          this.sendMessage(ws, {
            type: 'error',
            data: `Process error: ${error.message}`,
            timestamp: Date.now()
          });
          
          // Clean up
          this.activeExecutions.delete(executionId);
        });
      }
      
      // Store the execution
      this.activeExecutions.set(executionId, { process, ws });

    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        data: `Failed to start script: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      });
    }
  }

  private stopScriptExecution(executionId: string) {
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

  private sendInputToExecution(executionId: string, input: string) {
    console.log('sendInputToExecution called:', { executionId, input, inputLength: input.length });
    const execution = this.activeExecutions.get(executionId);
    console.log('Active executions:', Array.from(this.activeExecutions.keys()));
    
    if (execution && execution.process) {
      console.log('Execution found, process details:', {
        hasStdin: !!execution.process.stdin,
        stdinDestroyed: execution.process.stdin?.destroyed,
        processPid: execution.process.pid,
        processKilled: execution.process.killed,
        hasWrite: typeof execution.process.write === 'function',
        isPty: !!(execution.process as any).write && !execution.process.stdin
      });
      
      try {
        // Check if it's a pty process (SSH) or regular process
        if (typeof execution.process.write === 'function' && !execution.process.stdin) {
          // This is a pty process (SSH execution)
          console.log('Writing to pty process:', input);
          execution.process.write(input);
          console.log('Successfully wrote to pty process');
        } else if (execution.process.stdin && !execution.process.stdin.destroyed) {
          // This is a regular process (local execution)
          console.log('Writing to stdin:', input);
          execution.process.stdin.write(input);
          console.log('Successfully wrote to stdin');
        } else {
          console.warn('Process input not available or destroyed');
          this.sendMessage(execution.ws, {
            type: 'error',
            data: 'Process input not available',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error sending input to execution:', error);
        this.sendMessage(execution.ws, {
          type: 'error',
          data: `Failed to send input: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        });
      }
    } else {
      console.warn('No active execution found for input:', executionId);
      this.sendMessage(execution.ws, {
        type: 'error',
        data: `No active execution found for ID: ${executionId}`,
        timestamp: Date.now()
      });
    }
  }

  private sendMessage(ws: WebSocket, message: ScriptExecutionMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private cleanupActiveExecutions(ws: WebSocket) {
    for (const [executionId, execution] of this.activeExecutions.entries()) {
      if (execution.ws === ws) {
        execution.process.kill('SIGTERM');
        this.activeExecutions.delete(executionId);
      }
    }
  }

  // Get active executions count
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  // Get active executions info
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }
}

// Export function to create handler
export function createScriptExecutionHandler(server: unknown): ScriptExecutionHandler {
  return new ScriptExecutionHandler(server);
}
