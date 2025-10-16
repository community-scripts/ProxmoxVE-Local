import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database-prisma.js";
// Removed unused imports


export const installedScriptsRouter = createTRPCRouter({
  // Get all installed scripts
  getAllInstalledScripts: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const scripts = await db.getAllInstalledScripts();
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
        const scripts = await db.getInstalledScriptsByServer(input.serverId);
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
        const script = await db.getInstalledScriptById(input.id);
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
      output_log: z.string().optional(),
      web_ui_ip: z.string().optional(),
      web_ui_port: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const result = await db.createInstalledScript(input);
        return {
          success: true,
          id: result.id,
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
      output_log: z.string().optional(),
      web_ui_ip: z.string().optional(),
      web_ui_port: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input;
        const db = getDatabase();
        const result = await db.updateInstalledScript(id, updateData);
        
        if (!result) {
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
        const result = await db.deleteInstalledScript(input.id);
        
        if (!result) {
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
        const allScripts = await db.getAllInstalledScripts();
        
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
        const server = await db.getServerById(input.serverId);
        
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
            (_exitCode: number) => {
              
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
                            serverId: Number((server as any).id),
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
        const existingScripts = await db.getAllInstalledScripts();

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

            const result = await db.createInstalledScript({
              script_name: container.hostname,
              script_path: `detected/${container.hostname}`,
              container_id: container.containerId,
              server_id: container.serverId,
              execution_mode: 'ssh',
              status: 'success',
              output_log: `Auto-detected from LXC config: ${container.configPath}`
            });
            
            createdScripts.push({
              id: result.id,
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
        const allScripts = await db.getAllInstalledScripts();
        const allServers = await db.getAllServers();
        
        
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
              await db.deleteInstalledScript(Number(scriptData.id));
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
              await db.deleteInstalledScript(Number(scriptData.id));
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
        const allServers = await db.getAllServers();
        const statusMap: Record<string, 'running' | 'stopped' | 'unknown'> = {};

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Determine which servers to check
        const serversToCheck = input.serverIds 
          ? allServers.filter((s: any) => input.serverIds!.includes(Number(s.id)))
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
            
            // Add timeout to prevent hanging connections
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('SSH command timeout after 30 seconds')), 30000);
            });
            
            await Promise.race([
              new Promise<void>((resolve, reject) => {
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
              }),
              timeoutPromise
            ]);

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
        const script = await db.getInstalledScriptById(input.id);
        
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
        const server = await db.getServerById(Number(scriptData.server_id));
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
        const script = await db.getInstalledScriptById(input.id);
        
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
        const server = await db.getServerById(Number(scriptData.server_id));
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
          message: `Container ${scriptData.container_id} ${input.action} command executed successfully`,
          containerId: scriptData.container_id
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
        const script = await db.getInstalledScriptById(input.id);
        
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
        const server = await db.getServerById(Number(scriptData.server_id));
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

        // First check if container is running and stop it if necessary
        const statusCommand = `pct status ${scriptData.container_id}`;
        let statusOutput = '';
        
        try {
          await new Promise<void>((resolve, reject) => {
            void sshExecutionService.executeCommand(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              server as any,
              statusCommand,
              (data: string) => {
                statusOutput += data;
              },
              (error: string) => {
                reject(new Error(error));
              },
              (_exitCode: number) => {
                resolve();
              }
            );
          });

          // Check if container is running
          if (statusOutput.includes('status: running')) {
            // Stop the container first
            const stopCommand = `pct stop ${scriptData.container_id}`;
            let stopOutput = '';
            let stopError = '';
            
            await new Promise<void>((resolve, reject) => {
              void sshExecutionService.executeCommand(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                server as any,
                stopCommand,
                (data: string) => {
                  stopOutput += data;
                },
                (error: string) => {
                  stopError += error;
                },
                (exitCode: number) => {
                  if (exitCode !== 0) {
                    const errorMessage = stopError || stopOutput || `Stop command failed with exit code ${exitCode}`;
                    reject(new Error(`Failed to stop container: ${errorMessage}`));
                  } else {
                    resolve();
                  }
                }
              );
            });
          }
        } catch {

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
        const deleteResult = await db.deleteInstalledScript(input.id);
        
        if (!deleteResult) {
          return {
            success: false,
            error: 'Container destroyed but failed to delete database record'
          };
        }

        // Determine if container was stopped first
        const wasStopped = statusOutput.includes('status: running');
        const message = wasStopped 
          ? `Container ${scriptData.container_id} stopped and destroyed successfully, database record deleted`
          : `Container ${scriptData.container_id} destroyed successfully, database record deleted`;

        return {
          success: true,
          message
        };
      } catch (error) {
        console.error('Error in destroyContainer:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to destroy container'
        };
      }
    }),

  // Auto-detect Web UI IP and port
  autoDetectWebUI: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        console.log('🔍 Auto-detect WebUI called with id:', input.id);
        const db = getDatabase();
        const script = await db.getInstalledScriptById(input.id);
        
        if (!script) {
          console.log('❌ Script not found for id:', input.id);
          return {
            success: false,
            error: 'Script not found'
          };
        }

        const scriptData = script as any;
        console.log('📋 Script data:', {
          id: scriptData.id,
          execution_mode: scriptData.execution_mode,
          server_id: scriptData.server_id,
          container_id: scriptData.container_id
        });
        
        // Only works for SSH mode scripts with container_id
        if (scriptData.execution_mode !== 'ssh' || !scriptData.server_id || !scriptData.container_id) {
          console.log('❌ Validation failed - not SSH mode or missing server/container ID');
          return {
            success: false,
            error: 'Auto-detect only works for SSH mode scripts with container ID'
          };
        }

        // Get server info
        const server = await db.getServerById(Number(scriptData.server_id));
        if (!server) {
          console.log('❌ Server not found for id:', scriptData.server_id);
          return {
            success: false,
            error: 'Server not found'
          };
        }

        console.log('🖥️ Server found:', { id: (server as any).id, name: (server as any).name, ip: (server as any).ip });

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Test SSH connection first
        console.log('🔌 Testing SSH connection...');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const connectionTest = await sshService.testSSHConnection(server as any);
        if (!(connectionTest as any).success) {
          console.log('❌ SSH connection failed:', (connectionTest as any).error);
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`
          };
        }

        console.log('✅ SSH connection successful');

        // Run hostname -I inside the container
        // Use pct exec instead of pct enter -c (which doesn't exist)
        const hostnameCommand = `pct exec ${scriptData.container_id} -- hostname -I`;
        console.log('🚀 Running command:', hostnameCommand);
        let commandOutput = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            server as any,
            hostnameCommand,
            (data: string) => {
              console.log('📤 Command output chunk:', data);
              commandOutput += data;
            },
            (error: string) => {
              console.log('❌ Command error:', error);
              reject(new Error(error));
            },
            (exitCode: number) => {
              console.log('🏁 Command finished with exit code:', exitCode);
              if (exitCode !== 0) {
                reject(new Error(`Command failed with exit code ${exitCode}`));
              } else {
                resolve();
              }
            }
          );
        });

        // Parse output to get first IP address
        console.log('📝 Full command output:', commandOutput);
        const ips = commandOutput.trim().split(/\s+/);
        const detectedIp = ips[0];
        console.log('🔍 Parsed IPs:', ips);
        console.log('🎯 Detected IP:', detectedIp);
        
        if (!detectedIp || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.exec(detectedIp)) {
          console.log('❌ Invalid IP address detected:', detectedIp);
          return {
            success: false,
            error: 'Could not detect valid IP address from container'
          };
        }

        // Get the script's interface_port from metadata (prioritize metadata over existing database values)
        let detectedPort = 80; // Default fallback
        
        try {
          // Import localScriptsService to get script metadata
          const { localScriptsService } = await import('~/server/services/localScripts');
          
          // Get all scripts and find the one matching our script name
          const allScripts = await localScriptsService.getAllScripts();
          
          // Extract script slug from script_name (remove .sh extension)
          const scriptSlug = scriptData.script_name.replace(/\.sh$/, '');
          console.log('🔍 Looking for script with slug:', scriptSlug);
          
          const scriptMetadata = allScripts.find(script => script.slug === scriptSlug);
          
          if (scriptMetadata?.interface_port) {
            detectedPort = scriptMetadata.interface_port;
            console.log('📋 Found interface_port in metadata:', detectedPort);
          } else {
            console.log('📋 No interface_port found in metadata, using default port 80');
            detectedPort = 80; // Default to port 80 if no metadata port found
          }
        } catch (error) {
          console.log('⚠️ Error getting script metadata, using default port 80:', error);
          detectedPort = 80; // Default to port 80 if metadata lookup fails
        }
        
        console.log('🎯 Final detected port:', detectedPort);
        
        // Update the database with detected IP and port
        console.log('💾 Updating database with IP:', detectedIp, 'Port:', detectedPort);
        const updateResult = await db.updateInstalledScript(input.id, {
          web_ui_ip: detectedIp,
          web_ui_port: detectedPort
        });

        if (!updateResult) {
          console.log('❌ Database update failed - no changes made');
          return {
            success: false,
            error: 'Failed to update database with detected IP'
          };
        }

        console.log('✅ Successfully updated database');
        return {
          success: true,
          message: `Successfully detected IP: ${detectedIp}:${detectedPort} for LXC ${scriptData.container_id} on ${(server as any).name}`,
          detectedIp,
          detectedPort: detectedPort,
          containerId: scriptData.container_id,
          serverName: (server as any).name
        };
      } catch (error) {
        console.error('Error in autoDetectWebUI:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to auto-detect Web UI IP'
        };
      }
    })
});
