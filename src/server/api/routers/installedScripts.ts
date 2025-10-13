import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database";
import { exec } from "child_process";
import { promisify } from "util";
import { getSSHExecutionService } from "~/server/ssh-execution-service";
import type { Server } from "~/types/server";

const execAsync = promisify(exec);

// Helper function to check local container statuses
async function getLocalContainerStatuses(containerIds: string[]): Promise<Record<string, 'running' | 'stopped' | 'unknown'>> {
  try {
    const { stdout } = await execAsync('pct list');
    const statusMap: Record<string, 'running' | 'stopped' | 'unknown'> = {};
    
    // Parse pct list output
    const lines = stdout.trim().split('\n');
    const dataLines = lines.slice(1); // Skip header
    
    for (const line of dataLines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const vmid = parts[0];
        const status = parts[1];
        
        if (vmid && containerIds.includes(vmid)) {
          statusMap[vmid] = status === 'running' ? 'running' : 'stopped';
        }
      }
    }
    
    // Set unknown for containers not found in pct list
    for (const containerId of containerIds) {
      if (!(containerId in statusMap)) {
        statusMap[containerId] = 'unknown';
      }
    }
    
    return statusMap;
  } catch (error) {
    console.error('Error checking local container statuses:', error);
    // Return unknown for all containers on error
    const statusMap: Record<string, 'running' | 'stopped' | 'unknown'> = {};
    for (const containerId of containerIds) {
      statusMap[containerId] = 'unknown';
    }
    return statusMap;
  }
}

// Helper function to check remote container statuses (multiple containers per server)
async function getRemoteContainerStatuses(containerIds: string[], server: Server): Promise<Record<string, 'running' | 'stopped' | 'unknown'>> {
  return new Promise((resolve) => {
    const sshService = getSSHExecutionService();
    const statusMap: Record<string, 'running' | 'stopped' | 'unknown'> = {};
    
    // Initialize all containers as unknown
    for (const containerId of containerIds) {
      statusMap[containerId] = 'unknown';
    }
    
    void sshService.executeCommand(
      server,
      'pct list',
      (data: string) => {
        // Parse the output to find all containers
        const lines = data.trim().split('\n');
        const dataLines = lines.slice(1); // Skip header
        
        for (const line of dataLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const vmid = parts[0];
            const status = parts[1];
            
            // Check if this is one of the containers we're looking for
            if (vmid && containerIds.includes(vmid)) {
              statusMap[vmid] = status === 'running' ? 'running' : 'stopped';
            }
          }
        }
        
        resolve(statusMap);
      },
      (error: string) => {
        console.error(`Error checking remote containers on server ${server.name}:`, error);
        resolve(statusMap); // Return the map with unknown statuses
      },
      (exitCode: number) => {
        if (exitCode !== 0) {
          resolve(statusMap); // Return the map with unknown statuses
        }
      }
    );
  });
}

export const installedScriptsRouter = createTRPCRouter({
  // Get all installed scripts
  getAllInstalledScripts: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const scripts = db.getAllInstalledScripts();
        return {
          success: true,
          scripts
        };
      } catch (error) {
        console.error('Error in getAllInstalledScripts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch installed scripts',
          scripts: []
        };
      }
    }),

  // Get installed scripts by server
  getInstalledScriptsByServer: publicProcedure
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const scripts = db.getInstalledScriptsByServer(input.serverId);
        return {
          success: true,
          scripts
        };
      } catch (error) {
        console.error('Error in getInstalledScriptsByServer:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch installed scripts by server',
          scripts: []
        };
      }
    }),

  // Get installed script by ID
  getInstalledScriptById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = db.getInstalledScriptById(input.id);
        if (!script) {
          return {
            success: false,
            error: 'Installed script not found',
            script: null
          };
        }
        return {
          success: true,
          script
        };
      } catch (error) {
        console.error('Error in getInstalledScriptById:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch installed script',
          script: null
        };
      }
    }),

  // Create new installed script record
  createInstalledScript: publicProcedure
    .input(z.object({
      script_name: z.string(),
      script_path: z.string(),
      container_id: z.string().optional(),
      server_id: z.number().optional(),
      execution_mode: z.enum(['local', 'ssh']),
      status: z.enum(['in_progress', 'success', 'failed']),
      output_log: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const result = db.createInstalledScript(input);
        return {
          success: true,
          id: result.lastInsertRowid,
          message: 'Installed script record created successfully'
        };
      } catch (error) {
        console.error('Error in createInstalledScript:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create installed script record'
        };
      }
    }),

  // Update installed script
  updateInstalledScript: publicProcedure
    .input(z.object({
      id: z.number(),
      script_name: z.string().optional(),
      container_id: z.string().optional(),
      status: z.enum(['in_progress', 'success', 'failed']).optional(),
      output_log: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input;
        const db = getDatabase();
        const result = db.updateInstalledScript(id, updateData);
        
        if (result.changes === 0) {
          return {
            success: false,
            error: 'No changes made or script not found'
          };
        }
        
        return {
          success: true,
          message: 'Installed script updated successfully'
        };
      } catch (error) {
        console.error('Error in updateInstalledScript:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update installed script'
        };
      }
    }),

  // Delete installed script
  deleteInstalledScript: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const result = db.deleteInstalledScript(input.id);
        
        if (result.changes === 0) {
          return {
            success: false,
            error: 'Script not found or already deleted'
          };
        }
        
        return {
          success: true,
          message: 'Installed script deleted successfully'
        };
      } catch (error) {
        console.error('Error in deleteInstalledScript:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete installed script'
        };
      }
    }),

  // Get installation statistics
  getInstallationStats: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const allScripts = db.getAllInstalledScripts();
        
        const stats = {
          total: allScripts.length,
          byStatus: {
            success: allScripts.filter((s: any) => s.status === 'success').length,
            failed: allScripts.filter((s: any) => s.status === 'failed').length,
            in_progress: allScripts.filter((s: any) => s.status === 'in_progress').length
          },
          byMode: {
            local: allScripts.filter((s: any) => s.execution_mode === 'local').length,
            ssh: allScripts.filter((s: any) => s.execution_mode === 'ssh').length
          },
          byServer: {} as Record<string, number>
        };

        // Count by server
        allScripts.forEach((script: any) => {
          const serverKey = script.server_name ?? 'Local';
          stats.byServer[serverKey] = (stats.byServer[serverKey] ?? 0) + 1;
        });

        return {
          success: true,
          stats
        };
      } catch (error) {
        console.error('Error in getInstallationStats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch installation statistics',
          stats: null
        };
      }
    }),

  // Auto-detect LXC containers with community-script tag
  autoDetectLXCContainers: publicProcedure
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ input }) => {
      
      try {
        
        const db = getDatabase();
        const server = db.getServerById(input.serverId);
        
        if (!server) {
          console.error('Server not found for ID:', input.serverId);
          return {
            success: false,
            error: 'Server not found',
            detectedContainers: []
          };
        }


        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();
        
              // Test SSH connection first
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              const connectionTest = await sshService.testSSHConnection(server as any);
              
              if (!(connectionTest as any).success) {
                return {
                  success: false,
                  error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`,
                  detectedContainers: []
                };
              }


        // Use the working approach - manual loop through all config files
        const command = `for file in /etc/pve/lxc/*.conf; do if [ -f "$file" ]; then if grep -q "community-script" "$file"; then echo "$file"; fi; fi; done`;
        let detectedContainers: any[] = [];


        let commandOutput = '';
        
        await new Promise<void>((resolve, reject) => {
         
          void sshExecutionService.executeCommand(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            server as any,
            command,
            (data: string) => {
              commandOutput += data;
            },
            (error: string) => {
              console.error('Command error:', error);
            },
            (exitCode: number) => {
              
              // Parse the complete output to get config file paths that contain community-script tag
              const configFiles = commandOutput.split('\n')
                .filter((line: string) => line.trim())
                .map((line: string) => line.trim())
                .filter((line: string) => line.endsWith('.conf'));
              

              // Process each config file to extract hostname
              const processPromises = configFiles.map(async (configPath: string) => {
                try {
                  const containerId = configPath.split('/').pop()?.replace('.conf', '');
                  if (!containerId) return null;


                  // Read the config file content
                  const readCommand = `cat "${configPath}" 2>/dev/null`;
                  
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  return new Promise<any>((readResolve) => {
                   
                    void sshExecutionService.executeCommand(
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                      server as any,
                      readCommand,
                      (configData: string) => {
                        // Parse config file for hostname
                        const lines = configData.split('\n');
                        let hostname = '';

                        for (const line of lines) {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('hostname:')) {
                            hostname = trimmedLine.substring(9).trim();
                            break;
                          }
                        }

                        if (hostname) {
                          const container = {
                            containerId,
                            hostname,
                            configPath,
                            serverId: (server as any).id,
                            serverName: (server as any).name
                          };
                          readResolve(container);
                        } else {
                          readResolve(null);
                        }
                      },
                      (readError: string) => {
                        console.error(`Error reading config file ${configPath}:`, readError);
                        readResolve(null);
                      },
                      (_exitCode: number) => {
                        readResolve(null);
                      }
                    );
                  });
                } catch (error) {
                  console.error(`Error processing config file ${configPath}:`, error);
                  return null;
                }
              });

              // Wait for all config files to be processed
              void Promise.all(processPromises).then((results) => {
                detectedContainers = results.filter(result => result !== null);
                resolve();
              }).catch((error) => {
                console.error('Error processing config files:', error);
                reject(new Error(`Error processing config files: ${error}`));
              });
            }
          );
        });


        // Get existing scripts to check for duplicates
        const existingScripts = db.getAllInstalledScripts();

        // Create installed script records for detected containers (skip duplicates)
        const createdScripts = [];
        const skippedScripts = [];
        
        for (const container of detectedContainers) {
          try {
            // Check if a script with this container_id and server_id already exists
            const duplicate = existingScripts.find((script: any) => 
              script.container_id === container.containerId && 
              script.server_id === container.serverId
            );

            if (duplicate) {
              skippedScripts.push({
                containerId: container.containerId,
                hostname: container.hostname,
                serverName: container.serverName
              });
              continue;
            }

            const result = db.createInstalledScript({
              script_name: container.hostname,
              script_path: `detected/${container.hostname}`,
              container_id: container.containerId,
              server_id: container.serverId,
              execution_mode: 'ssh',
              status: 'success',
              output_log: `Auto-detected from LXC config: ${container.configPath}`
            });
            
            createdScripts.push({
              id: result.lastInsertRowid,
              containerId: container.containerId,
              hostname: container.hostname,
              serverName: container.serverName
            });
          } catch (error) {
            console.error(`Error creating script record for ${container.hostname}:`, error);
          }
        }

        const message = skippedScripts.length > 0 
          ? `Auto-detection completed. Found ${detectedContainers.length} containers with community-script tag. Added ${createdScripts.length} new scripts, skipped ${skippedScripts.length} duplicates.`
          : `Auto-detection completed. Found ${detectedContainers.length} containers with community-script tag. Added ${createdScripts.length} new scripts.`;

        return {
          success: true,
          message: message,
          detectedContainers: createdScripts,
          skippedContainers: skippedScripts
        };
      } catch (error) {
        console.error('Error in autoDetectLXCContainers:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to auto-detect LXC containers',
          detectedContainers: []
        };
      }
    }),

  // Cleanup orphaned scripts (check if LXC containers still exist on servers)
  cleanupOrphanedScripts: publicProcedure
    .mutation(async () => {
      try {
        
        const db = getDatabase();
        const allScripts = db.getAllInstalledScripts();
        const allServers = db.getAllServers();
        
        
        if (allScripts.length === 0) {
          return {
            success: true,
            message: 'No scripts to check',
            deletedCount: 0,
            deletedScripts: []
          };
        }

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        const deletedScripts: string[] = [];
        const scriptsToCheck = allScripts.filter((script: any) => 
          script.execution_mode === 'ssh' && 
          script.server_id && 
          script.container_id
        );


        for (const script of scriptsToCheck) {
          try {
            const scriptData = script as any;
            const server = allServers.find((s: any) => s.id === scriptData.server_id);
            if (!server) {
              db.deleteInstalledScript(Number(scriptData.id));
              deletedScripts.push(String(scriptData.script_name));
              continue;
            }


            // Test SSH connection
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const connectionTest = await sshService.testSSHConnection(server as any);
            if (!(connectionTest as any).success) {
              continue;
            }

            // Check if the container config file still exists
            const checkCommand = `test -f "/etc/pve/lxc/${scriptData.container_id}.conf" && echo "exists" || echo "not_found"`;
            
            const containerExists = await new Promise<boolean>((resolve) => {
             
              void sshExecutionService.executeCommand(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                server as any,
                checkCommand,
                (data: string) => {
                  resolve(data.trim() === 'exists');
                },
                (error: string) => {
                  console.error(`Error checking container ${scriptData.script_name}:`, error);
                  resolve(false);
                },
                (_exitCode: number) => {
                  resolve(false);
                }
              );
            });

            if (!containerExists) {
              db.deleteInstalledScript(Number(scriptData.id));
              deletedScripts.push(String(scriptData.script_name));
            } else {
            }

          } catch (error) {
            console.error(`Error checking script ${(script as any).script_name}:`, error);
          }
        }


        return {
          success: true,
          message: `Cleanup completed. ${deletedScripts.length} orphaned script(s) removed.`,
          deletedCount: deletedScripts.length,
          deletedScripts: deletedScripts
        };
      } catch (error) {
        console.error('Error in cleanupOrphanedScripts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cleanup orphaned scripts',
          deletedCount: 0,
          deletedScripts: []
        };
      }
    }),

  // Get container running statuses
  getContainerStatuses: publicProcedure
    .input(z.object({ 
      serverIds: z.array(z.number()).optional() // Optional: check specific servers, or all if empty
    }))
    .mutation(async ({ input }) => {
      try {
        
        const db = getDatabase();
        const allServers = db.getAllServers();
        const statusMap: Record<string, 'running' | 'stopped' | 'unknown'> = {};

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Determine which servers to check
        const serversToCheck = input.serverIds 
          ? allServers.filter(s => input.serverIds!.includes((s as any).id))
          : allServers;


        // Check status for each server
        for (const server of serversToCheck) {
          try {

            // Test SSH connection
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const connectionTest = await sshService.testSSHConnection(server as any);
            if (!(connectionTest as any).success) {
              continue;
            }

            // Run pct list to get all container statuses at once
            const listCommand = 'pct list';
            let listOutput = '';
            
            await new Promise<void>((resolve, reject) => {
              void sshExecutionService.executeCommand(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                server as any,
                listCommand,
                (data: string) => {
                  listOutput += data;
                },
                (error: string) => {
                  console.error(`pct list error on server ${(server as any).name}:`, error);
                  reject(new Error(error));
                },
                (_exitCode: number) => {
                  resolve();
                }
              );
            });

            // Parse pct list output
            const lines = listOutput.split('\n').filter(line => line.trim());
            for (const line of lines) {
              // pct list format: CTID     Status       Name
              // Example: "100     running     my-container"
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 3) {
                const containerId = parts[0];
                const status = parts[1];
                
                if (containerId && status) {
                  // Map pct list status to our status
                  let mappedStatus: 'running' | 'stopped' | 'unknown' = 'unknown';
                  if (status === 'running') {
                    mappedStatus = 'running';
                  } else if (status === 'stopped') {
                    mappedStatus = 'stopped';
                  }
                  
                  statusMap[containerId] = mappedStatus;
                }
              }
            }
          } catch (error) {
            console.error(`Error processing server ${(server as any).name}:`, error);
          }
        }


        return {
          success: true,
          statusMap
        };
      } catch (error) {
        console.error('Error in getContainerStatuses:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch container statuses',
          statusMap: {}
        };
      }
    }),

  // Get container status (running/stopped)
  getContainerStatus: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = db.getInstalledScriptById(input.id);
        
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            status: 'unknown' as const
          };
        }

        const scriptData = script as any;
        
        // Only check status for SSH scripts with container_id
        if (scriptData.execution_mode !== 'ssh' || !scriptData.server_id || !scriptData.container_id) {
          return {
            success: false,
            error: 'Script is not an SSH script with container ID',
            status: 'unknown' as const
          };
        }

        // Get server info
        const server = db.getServerById(Number(scriptData.server_id));
        if (!server) {
          return {
            success: false,
            error: 'Server not found',
            status: 'unknown' as const
          };
        }

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Test SSH connection first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const connectionTest = await sshService.testSSHConnection(server as any);
        if (!(connectionTest as any).success) {
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`,
            status: 'unknown' as const
          };
        }

        // Check container status
        const statusCommand = `pct status ${scriptData.container_id}`;
        let statusOutput = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            server as any,
            statusCommand,
            (data: string) => {
              statusOutput += data;
            },
            (error: string) => {
              console.error('Status command error:', error);
              reject(new Error(error));
            },
            (_exitCode: number) => {
              resolve();
            }
          );
        });

        // Parse status from output
        let status: 'running' | 'stopped' | 'unknown' = 'unknown';
        if (statusOutput.includes('status: running')) {
          status = 'running';
        } else if (statusOutput.includes('status: stopped')) {
          status = 'stopped';
        }

        return {
          success: true,
          status,
          error: undefined
        };
      } catch (error) {
        console.error('Error in getContainerStatus:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get container status',
          status: 'unknown' as const
        };
      }
    }),

  // Control container (start/stop)
  controlContainer: publicProcedure
    .input(z.object({ 
      id: z.number(), 
      action: z.enum(['start', 'stop']) 
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = db.getInstalledScriptById(input.id);
        
        if (!script) {
          return {
            success: false,
            error: 'Script not found'
          };
        }

        const scriptData = script as any;
        
        // Only control SSH scripts with container_id
        if (scriptData.execution_mode !== 'ssh' || !scriptData.server_id || !scriptData.container_id) {
          return {
            success: false,
            error: 'Script is not an SSH script with container ID'
          };
        }

        // Get server info
        const server = db.getServerById(Number(scriptData.server_id));
        if (!server) {
          return {
            success: false,
            error: 'Server not found'
          };
        }

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Test SSH connection first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const connectionTest = await sshService.testSSHConnection(server as any);
        if (!(connectionTest as any).success) {
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`
          };
        }

        // Execute control command
        const controlCommand = `pct ${input.action} ${scriptData.container_id}`;
        let commandOutput = '';
        let commandError = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            server as any,
            controlCommand,
            (data: string) => {
              commandOutput += data;
            },
            (error: string) => {
              commandError += error;
            },
            (exitCode: number) => {
              if (exitCode !== 0) {
                const errorMessage = commandError || commandOutput || `Command failed with exit code ${exitCode}`;
                reject(new Error(errorMessage));
              } else {
                resolve();
              }
            }
          );
        });

        return {
          success: true,
          message: `Container ${scriptData.container_id} ${input.action} command executed successfully`
        };
      } catch (error) {
        console.error('Error in controlContainer:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to control container'
        };
      }
    }),

  // Destroy container and delete DB record
  destroyContainer: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = db.getInstalledScriptById(input.id);
        
        if (!script) {
          return {
            success: false,
            error: 'Script not found'
          };
        }

        const scriptData = script as any;
        
        // Only destroy SSH scripts with container_id
        if (scriptData.execution_mode !== 'ssh' || !scriptData.server_id || !scriptData.container_id) {
          return {
            success: false,
            error: 'Script is not an SSH script with container ID'
          };
        }

        // Get server info
        const server = db.getServerById(Number(scriptData.server_id));
        if (!server) {
          return {
            success: false,
            error: 'Server not found'
          };
        }

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Test SSH connection first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const connectionTest = await sshService.testSSHConnection(server as any);
        if (!(connectionTest as any).success) {
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`
          };
        }

        // Execute destroy command
        const destroyCommand = `pct destroy ${scriptData.container_id}`;
        let commandOutput = '';
        let commandError = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            server as any,
            destroyCommand,
            (data: string) => {
              commandOutput += data;
            },
            (error: string) => {
              commandError += error;
            },
            (exitCode: number) => {
              if (exitCode !== 0) {
                const errorMessage = commandError || commandOutput || `Destroy command failed with exit code ${exitCode}`;
                reject(new Error(errorMessage));
              } else {
                resolve();
              }
            }
          );
        });

        // If destroy was successful, delete the database record
        const deleteResult = db.deleteInstalledScript(input.id);
        
        if (deleteResult.changes === 0) {
          return {
            success: false,
            error: 'Container destroyed but failed to delete database record'
          };
        }

        return {
          success: true,
          message: `Container ${scriptData.container_id} destroyed and database record deleted successfully`
        };
      } catch (error) {
        console.error('Error in destroyContainer:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to destroy container'
        };
      }
    })
});
