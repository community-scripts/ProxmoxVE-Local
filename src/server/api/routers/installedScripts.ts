import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database";

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
      console.log('=== AUTO-DETECT API ENDPOINT CALLED ===');
      console.log('Input received:', input);
      console.log('Timestamp:', new Date().toISOString());
      
      try {
        console.log('Starting auto-detect LXC containers for server ID:', input.serverId);
        
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

        console.log('Found server:', (server as any).name, 'at', (server as any).ip);

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();
        
        // Test SSH connection first
        console.log('Testing SSH connection...');
        const connectionTest = await sshService.testSSHConnection(server as any);
        console.log('SSH connection test result:', connectionTest);
        
        if (!(connectionTest as any).success) {
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error || 'Unknown error'}`,
            detectedContainers: []
          };
        }

        console.log('SSH connection successful, scanning for LXC containers...');

        // Use the working approach - manual loop through all config files
        const command = `for file in /etc/pve/lxc/*.conf; do if [ -f "$file" ]; then if grep -q "community-script" "$file"; then echo "$file"; fi; fi; done`;
        let detectedContainers: any[] = [];
        let errorOutput = '';

        console.log('Executing manual loop command...');
        console.log('Command:', command);

        let commandOutput = '';
        
        await new Promise<void>((resolve, reject) => {
          sshExecutionService.executeCommand(
            server as any,
            command,
            (data: string) => {
              console.log('Command output chunk:', data);
              commandOutput += data;
            },
            (error: string) => {
              console.error('Command error:', error);
              errorOutput += error;
            },
            (exitCode: number) => {
              console.log('Command exit code:', exitCode);
              console.log('Full command output:', commandOutput);
              
              // Parse the complete output to get config file paths that contain community-script tag
              const configFiles = commandOutput.split('\n')
                .filter((line: string) => line.trim())
                .map((line: string) => line.trim())
                .filter((line: string) => line.endsWith('.conf'));
              
              console.log('Found config files with community-script tag:', configFiles.length);
              console.log('Config files:', configFiles);

              // Process each config file to extract hostname
              const processPromises = configFiles.map(async (configPath: string) => {
                try {
                  const containerId = configPath.split('/').pop()?.replace('.conf', '');
                  if (!containerId) return null;

                  console.log('Processing container:', containerId, 'from', configPath);

                  // Read the config file content
                  const readCommand = `cat "${configPath}" 2>/dev/null`;
                  
                  return new Promise<any>((readResolve) => {
                    sshExecutionService.executeCommand(
                      server as any,
                      readCommand,
                      (configData: string) => {
                        console.log('Config data for', containerId, ':', configData.substring(0, 300) + '...');
                        
                        // Parse config file for hostname
                        const lines = configData.split('\n');
                        let hostname = '';

                        for (const line of lines) {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('hostname:')) {
                            hostname = trimmedLine.substring(9).trim();
                            console.log('Found hostname for', containerId, ':', hostname);
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
                          console.log('Adding container to detected list:', container);
                          readResolve(container);
                        } else {
                          console.log('No hostname found for', containerId);
                          readResolve(null);
                        }
                      },
                      (readError: string) => {
                        console.error(`Error reading config file ${configPath}:`, readError);
                        readResolve(null);
                      },
                      (exitCode: number) => {
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
              Promise.all(processPromises).then((results) => {
                detectedContainers = results.filter(result => result !== null);
                console.log('Final detected containers:', detectedContainers.length);
                resolve();
              }).catch((error) => {
                console.error('Error processing config files:', error);
                reject(error);
              });
            }
          );
        });

        console.log('Detected containers:', detectedContainers.length);

        // Create installed script records for detected containers
        const createdScripts = [];
        for (const container of detectedContainers) {
          try {
            console.log('Creating script record for:', container.hostname, container.containerId);
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
            console.log('Created script record with ID:', result.lastInsertRowid);
          } catch (error) {
            console.error(`Error creating script record for ${container.hostname}:`, error);
          }
        }

        return {
          success: true,
          message: `Auto-detection completed. Found ${detectedContainers.length} containers with community-script tag.`,
          detectedContainers: createdScripts
        };
      } catch (error) {
        console.error('Error in autoDetectLXCContainers:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to auto-detect LXC containers',
          detectedContainers: []
        };
      }
    })
});
