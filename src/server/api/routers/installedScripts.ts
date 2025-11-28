import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database-prisma";
import { createHash } from "crypto";
import type { Server } from "~/types/server";
import { getStorageService } from "~/server/services/storageService";

// Type for SSH connection test result
interface SSHConnectionResult {
  success: boolean;
  error?: string;
}

// Type for parsed LXC config
interface ParsedLXCConfig {
  arch?: string;
  cores?: number;
  memory?: number;
  hostname?: string;
  swap?: number;
  onboot?: number;
  ostype?: string;
  unprivileged?: number;
  tags?: string;
  net_name?: string;
  net_bridge?: string;
  net_hwaddr?: string;
  net_ip?: string;
  net_ip_type?: string;
  net_gateway?: string;
  net_type?: string;
  net_vlan?: number;
  feature_keyctl?: number;
  feature_nesting?: number;
  feature_fuse?: number;
  feature_mount?: string;
  rootfs_storage?: string;
  rootfs_size?: string;
  advanced_config?: string;
  config_hash?: string;
  synced_at?: Date;
  [key: string]: unknown;
}

// Helper function to parse raw LXC config into structured data
function parseRawConfig(rawConfig: string): ParsedLXCConfig {
  const lines = rawConfig.split('\n');
  const config: ParsedLXCConfig & { advanced: string[] } = { advanced: [] };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Preserve comments in advanced
    if (trimmed.startsWith('#')) {
      config.advanced.push(line);
      continue;
    }
    
    if (!trimmed) continue;
    
    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();
    
    switch (key?.trim()) {
      case 'arch': config.arch = value; break;
      case 'cores': config.cores = parseInt(value); break;
      case 'memory': config.memory = parseInt(value); break;
      case 'hostname': config.hostname = value; break;
      case 'swap': config.swap = parseInt(value); break;
      case 'onboot': config.onboot = parseInt(value); break;
      case 'ostype': config.ostype = value; break;
      case 'unprivileged': config.unprivileged = parseInt(value); break;
      case 'tags': config.tags = value; break;
      case 'rootfs': config.rootfs = value; break;
      case 'net0': 
        // Parse: name=eth0,bridge=vmbr0,gw=10.10.10.254,hwaddr=BC:24:11:EC:0F:F0,ip=10.10.10.164/24,type=veth
        const parts = value.split(',');
        for (const part of parts) {
          const [k, v] = part.split('=');
          if (k === 'name') config.net_name = v;
          else if (k === 'bridge') config.net_bridge = v;
          else if (k === 'hwaddr') config.net_hwaddr = v;
          else if (k === 'ip') {
            config.net_ip = v;
            config.net_ip_type = v === 'dhcp' ? 'dhcp' : 'static';
          }
          else if (k === 'gw') config.net_gateway = v;
          else if (k === 'type') config.net_type = v;
          else if (k === 'tag' && v) config.net_vlan = parseInt(v);
        }
        break;
      case 'features':
        // Parse: keyctl=1,nesting=1,fuse=1
        const feats = value.split(',');
        for (const feat of feats) {
          const [k, v] = feat.split('=');
          if (k === 'keyctl' && v) config.feature_keyctl = parseInt(v);
          else if (k === 'nesting' && v) config.feature_nesting = parseInt(v);
          else if (k === 'fuse' && v) config.feature_fuse = parseInt(v);
          else config.feature_mount = (config.feature_mount ? config.feature_mount + ',' : '') + feat;
        }
        break;
      default:
        // Advanced settings (lxc.* and unknown)
        config.advanced.push(line);
    }
  }
  
  // Parse rootfs into storage and size
  if (config.rootfs) {
    const match = config.rootfs.match(/^([^:]+):([^,]+)(?:,size=(.+))?$/);
    if (match) {
      config.rootfs_storage = `${match[1]}:${match[2]}`;
      config.rootfs_size = match[3] ?? '';
    }
    delete config.rootfs; // Remove the rootfs field since we only need rootfs_storage and rootfs_size
  }
  
  config.advanced_config = config.advanced.join('\n');
  // Remove the advanced array after copying to advanced_config
  const { advanced: _, ...configWithoutAdvanced } = config;
  return configWithoutAdvanced;
}

// Helper function to reconstruct config from structured data
function reconstructConfig(parsed: ParsedLXCConfig): string {
  const lines: string[] = [];
  
  // Add standard fields in order
  if (parsed.arch) lines.push(`arch: ${String(parsed.arch)}`);
  if (parsed.cores) lines.push(`cores: ${String(parsed.cores)}`);
  
  // Build features line
  if (parsed.feature_keyctl !== undefined || parsed.feature_nesting !== undefined || parsed.feature_fuse !== undefined) {
    const feats: string[] = [];
    if (parsed.feature_keyctl !== undefined) feats.push(`keyctl=${parsed.feature_keyctl}`);
    if (parsed.feature_nesting !== undefined) feats.push(`nesting=${parsed.feature_nesting}`);
    if (parsed.feature_fuse !== undefined) feats.push(`fuse=${parsed.feature_fuse}`);
    if (parsed.feature_mount) feats.push(String(parsed.feature_mount));
    lines.push(`features: ${feats.join(',')}`);
  }
  
  if (parsed.hostname) lines.push(`hostname: ${parsed.hostname}`);
  if (parsed.memory) lines.push(`memory: ${parsed.memory}`);
  
  // Build net0 line
  if (parsed.net_name || parsed.net_bridge || parsed.net_ip) {
    const netParts: string[] = [];
    if (parsed.net_name) netParts.push(`name=${parsed.net_name}`);
    if (parsed.net_bridge) netParts.push(`bridge=${parsed.net_bridge}`);
    if (parsed.net_gateway && parsed.net_ip_type === 'static') netParts.push(`gw=${parsed.net_gateway}`);
    if (parsed.net_hwaddr) netParts.push(`hwaddr=${parsed.net_hwaddr}`);
    if (parsed.net_ip) netParts.push(`ip=${parsed.net_ip}`);
    if (parsed.net_type) netParts.push(`type=${parsed.net_type}`);
    if (parsed.net_vlan) netParts.push(`tag=${parsed.net_vlan}`);
    lines.push(`net0: ${netParts.join(',')}`);
  }
  
  if (parsed.onboot !== undefined) lines.push(`onboot: ${parsed.onboot}`);
  if (parsed.ostype) lines.push(`ostype: ${parsed.ostype}`);
  if (parsed.rootfs_storage) {
    const rootfs = parsed.rootfs_size 
      ? `${parsed.rootfs_storage},size=${parsed.rootfs_size}`
      : parsed.rootfs_storage;
    lines.push(`rootfs: ${rootfs}`);
  }
  if (parsed.swap !== undefined) lines.push(`swap: ${parsed.swap}`);
  if (parsed.tags) lines.push(`tags: ${parsed.tags}`);
  if (parsed.unprivileged !== undefined) lines.push(`unprivileged: ${parsed.unprivileged}`);
  
  // Add advanced config
  if (parsed.advanced_config) {
    lines.push(String(parsed.advanced_config));
  }
  
  return lines.join('\n');
}

// Helper function to calculate config hash
function calculateConfigHash(rawConfig: string): string {
  return createHash('md5').update(rawConfig).digest('hex');
}

// Helper function to parse rootfs_storage and extract storage pool and disk identifier
function parseRootfsStorage(rootfs_storage: string): { storagePool: string; diskId: string } | null {
  // Format: "PROX2-STORAGE2:vm-113-disk-0"
  const regex = /^([^:]+):(.+)$/;
  const match = regex.exec(rootfs_storage);
  if (!match?.[1] || !match?.[2]) return null;
  
  return {
    storagePool: match[1],
    diskId: match[2]
  };
}

// Helper function to extract size in GB from size string
function extractSizeInGB(sizeString: string): number {
  if (!sizeString) return 0;
  
  const regex = /^(\d+(?:\.\d+)?)\s*([GMK]?)$/i;
  const match = regex.exec(sizeString);
  if (!match?.[1]) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] ?? '').toUpperCase();
  
  switch (unit) {
    case 'T': return value * 1024;
    case 'G': return value;
    case 'M': return value / 1024;
    case 'K': return value / (1024 * 1024);
    case '': return value; // Assume GB if no unit
    default: return 0;
  }
}


// Helper function to resize disk
async function resizeDisk(
  server: Server, 
  containerId: string, 
  storageInfo: { storagePool: string; diskId: string }, 
  oldSizeGB: number, 
  newSizeGB: number
): Promise<{ success: boolean; message: string; error?: string }> {
  const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
  const sshExecutionService = new SSHExecutionService();
  
  try {
    // First, try using pct resize (works for most storage types)
    const pctCommand = `pct resize ${containerId} rootfs ${newSizeGB}G`;
    
    return new Promise((resolve) => {
      let errorOutput = '';
      let dataOutput = '';
      
      console.log(`Executing pct resize command: ${pctCommand}`);
      
      void sshExecutionService.executeCommand(
        server,
        pctCommand,
        (data: string) => {
          dataOutput += data;
          console.log('pct resize data:', data);
        },
        (error: string) => {
          errorOutput += error;
          console.log('pct resize error:', error);
        },
        (exitCode: number) => {
          console.log(`pct resize exit code: ${exitCode}`);
          console.log(`pct resize error output: "${errorOutput}"`);
          console.log(`pct resize data output: "${dataOutput}"`);
          
          // Check for error messages in both stderr and stdout
          const hasError = errorOutput.trim() || dataOutput.toLowerCase().includes('error') || dataOutput.toLowerCase().includes('insufficient');
          
          // Check both exit code and error output for failure
          if (exitCode === 0 && !hasError) {
            resolve({
              success: true,
              message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using pct resize`
            });
          } else {
            // If pct resize fails (either non-zero exit code or error output), try LVM-specific commands
            const errorMessage = errorOutput.trim() || dataOutput.trim();
            const combinedError = errorMessage ? `pct resize error: ${errorMessage}` : `pct resize failed with exit code ${exitCode}`;
            void tryLVMResize(server, containerId, storageInfo, newSizeGB, oldSizeGB, resolve, combinedError);
          }
        }
      );
    });
  } catch (error) {
    return {
      success: false,
      message: 'Resize failed',
      error: error instanceof Error ? error.message : 'Unknown error during resize'
    };
  }
}

// Helper function to try LVM-specific resize
async function tryLVMResize(
  server: Server,
  containerId: string,
  storageInfo: { storagePool: string; diskId: string },
  newSizeGB: number,
  oldSizeGB: number,
  resolve: (result: { success: boolean; message: string; error?: string }) => void,
  previousError?: string
) {
  const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
  const sshExecutionService = new SSHExecutionService();
  
  // Try LVM resize commands
  const lvPath = `/dev/${storageInfo.storagePool}/${storageInfo.diskId}`;
  const lvresizeCommand = `lvresize -L ${newSizeGB}G ${lvPath}`;
  
  void sshExecutionService.executeCommand(
    server,
    lvresizeCommand,
    (_data: string) => {
      // Now resize the filesystem
      const resize2fsCommand = `resize2fs ${lvPath}`;
      
      void sshExecutionService.executeCommand(
        server,
        resize2fsCommand,
        (_fsData: string) => {
          resolve({
            success: true,
            message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM commands`
          });
        },
        (fsError: string) => {
          // Try xfs_growfs as fallback
          const xfsCommand = `xfs_growfs ${lvPath}`;
          
          void sshExecutionService.executeCommand(
            server,
            xfsCommand,
            (_xfsData: string) => {
              resolve({
                success: true,
                message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM + XFS commands`
              });
            },
            (xfsError: string) => {
              resolve({
                success: false,
                message: 'Filesystem resize failed',
                error: `LVM resize succeeded but filesystem resize failed: ${fsError}, XFS fallback also failed: ${xfsError}`
              });
            },
            (xfsExitCode: number) => {
              if (xfsExitCode === 0) {
                resolve({
                  success: true,
                  message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM + XFS commands`
                });
              } else {
                resolve({
                  success: false,
                  message: 'Filesystem resize failed',
                  error: `LVM resize succeeded but filesystem resize failed: ${fsError}, XFS fallback also failed with exit code ${xfsExitCode}`
                });
              }
            }
          );
        },
        (fsExitCode: number) => {
          if (fsExitCode === 0) {
            resolve({
              success: true,
              message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM commands`
            });
          } else {
            // Try xfs_growfs as fallback
            const xfsCommand = `xfs_growfs ${lvPath}`;
            
            void sshExecutionService.executeCommand(
              server,
              xfsCommand,
              (_xfsData: string) => {
                resolve({
                  success: true,
                  message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM + XFS commands`
                });
              },
              (xfsError: string) => {
                resolve({
                  success: false,
                  message: 'Filesystem resize failed',
                  error: `LVM resize succeeded but filesystem resize failed with exit code ${fsExitCode}, XFS fallback also failed: ${xfsError}`
                });
              },
              (xfsExitCode: number) => {
                if (xfsExitCode === 0) {
                  resolve({
                    success: true,
                    message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM + XFS commands`
                  });
                } else {
                  resolve({
                    success: false,
                    message: 'Filesystem resize failed',
                    error: `LVM resize succeeded but filesystem resize failed with exit code ${fsExitCode}, XFS fallback also failed with exit code ${xfsExitCode}`
                  });
                }
              }
            );
          }
        }
      );
    },
    (error: string) => {
      const combinedError = previousError ? `${previousError} LVM error: ${error}` : `LVM resize failed: ${error}`;
      resolve({
        success: false,
        message: 'Resize failed',
        error: `Both pct resize and LVM resize failed. ${combinedError}`
      });
    },
    (exitCode: number) => {
      if (exitCode === 0) {
        // This shouldn't happen as we're in the error callback, but handle it
        resolve({
          success: true,
          message: `Disk resized from ${oldSizeGB}G to ${newSizeGB}G using LVM commands`
        });
      } else {
        const combinedError = previousError ? `${previousError} LVM command failed with exit code ${exitCode}` : `LVM command failed with exit code ${exitCode}`;
        resolve({
          success: false,
          message: 'Resize failed',
          error: `Both pct resize and LVM resize failed. ${combinedError}`
        });
      }
    }
  );
}


export const installedScriptsRouter = createTRPCRouter({
  // Get all installed scripts
  getAllInstalledScripts: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const scripts = await db.getAllInstalledScripts();
        
        // Transform scripts to flatten server data for frontend compatibility
        const transformedScripts = scripts.map(script => ({
          ...script,
          server_name: script.server?.name ?? null,
          server_ip: script.server?.ip ?? null,
          server_user: script.server?.user ?? null,
          server_password: script.server?.password ?? null,
          server_auth_type: script.server?.auth_type ?? null,
          server_ssh_key: script.server?.ssh_key ?? null,
          server_ssh_key_passphrase: script.server?.ssh_key_passphrase ?? null,
          server_ssh_port: script.server?.ssh_port ?? null,
          server_color: script.server?.color ?? null,
          server: undefined // Remove nested server object
        }));
        
        return {
          success: true,
          scripts: transformedScripts
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
        
        // Transform scripts to flatten server data for frontend compatibility
        const transformedScripts = scripts.map(script => ({
          ...script,
          server_name: script.server?.name ?? null,
          server_ip: script.server?.ip ?? null,
          server_user: script.server?.user ?? null,
          server_password: script.server?.password ?? null,
          server_auth_type: script.server?.auth_type ?? null,
          server_ssh_key: script.server?.ssh_key ?? null,
          server_ssh_key_passphrase: script.server?.ssh_key_passphrase ?? null,
          server_ssh_port: script.server?.ssh_port ?? null,
          server_color: script.server?.color ?? null,
          server: undefined // Remove nested server object
        }));
        
        return {
          success: true,
          scripts: transformedScripts
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
        // Transform script to flatten server data for frontend compatibility
        const transformedScript = {
          ...script,
          server_name: script.server?.name ?? null,
          server_ip: script.server?.ip ?? null,
          server_user: script.server?.user ?? null,
          server_password: script.server?.password ?? null,
          server_auth_type: script.server?.auth_type ?? null,
          server_ssh_key: script.server?.ssh_key ?? null,
          server_ssh_key_passphrase: script.server?.ssh_key_passphrase ?? null,
          server_ssh_port: script.server?.ssh_port ?? null,
          server_color: script.server?.color ?? null,
          server: undefined // Remove nested server object
        };
        
        return {
          success: true,
          script: transformedScript
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
               
              const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
              
              if (!connectionTest.success) {
                return {
                  success: false,
                  error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`,
                  detectedContainers: []
                };
              }


        // Use the working approach - manual loop through all config files
        const command = `for file in /etc/pve/lxc/*.conf; do if [ -f "$file" ]; then if grep -q "community-script" "$file"; then echo "$file"; fi; fi; done`;
        let detectedContainers: any[] = [];


        let commandOutput = '';
        
        await new Promise<void>((resolve, reject) => {
         
          void sshExecutionService.executeCommand(
             
            server as Server,
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
                       
                      server as Server,
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
                          // Parse full config and store in database
                          const parsedConfig = parseRawConfig(configData);
                          const configHash = calculateConfigHash(configData);
                          
                          const container = {
                            containerId,
                            hostname,
                            configPath,
                            serverId: Number(server.id),
                            serverName: String(server.name),
                            parsedConfig: {
                              ...parsedConfig,
                              config_hash: configHash,
                              synced_at: new Date()
                            }
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
            
            // Store LXC config in database
            if (container.parsedConfig) {
              await db.createLXCConfig(result.id, container.parsedConfig);
            }
            
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


        // Group scripts by server to batch check containers
        const scriptsByServer = new Map<number, any[]>();
        for (const script of scriptsToCheck) {
          const scriptData = script as any;
          if (!scriptData.server_id) continue;
          
          if (!scriptsByServer.has(scriptData.server_id)) {
            scriptsByServer.set(scriptData.server_id, []);
          }
          scriptsByServer.get(scriptData.server_id)!.push(scriptData);
        }

        // Process each server
        for (const [serverId, serverScripts] of scriptsByServer.entries()) {
          try {
            const server = allServers.find((s: any) => s.id === serverId);
            if (!server) {
              // Server doesn't exist, delete all scripts for this server
              for (const scriptData of serverScripts) {
                await db.deleteInstalledScript(Number(scriptData.id));
                deletedScripts.push(String(scriptData.script_name));
              }
              continue;
            }

            // Test SSH connection
            const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
            if (!connectionTest.success) {
              console.warn(`cleanupOrphanedScripts: SSH connection failed for server ${String(String(server.name))}, skipping ${serverScripts.length} scripts`);
              continue;
            }

            // Get all existing containers from pct list (more reliable than checking config files)
            const listCommand = 'pct list';
            let listOutput = '';
            
            const existingContainerIds = await new Promise<Set<string>>((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn(`cleanupOrphanedScripts: timeout while getting container list from server ${String(String(server.name))}`);
                resolve(new Set()); // Treat timeout as no containers found
              }, 20000);

              void sshExecutionService.executeCommand(
                server as Server,
                listCommand,
                (data: string) => {
                  listOutput += data;
                },
                (error: string) => {
                  console.error(`cleanupOrphanedScripts: error getting container list from server ${String(String(server.name))}:`, error);
                  clearTimeout(timeout);
                  resolve(new Set()); // Treat error as no containers found
                },
                (_exitCode: number) => {
                  clearTimeout(timeout);
                  
                  // Parse pct list output to extract container IDs
                  const containerIds = new Set<string>();
                  const lines = listOutput.split('\n').filter(line => line.trim());
                  
                  for (const line of lines) {
                    // pct list format: CTID     Status       Name
                    // Skip header line if present
                    if (line.includes('CTID') || line.includes('VMID')) continue;
                    
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 0) {
                      const containerId = parts[0]?.trim();
                      if (containerId && /^\d{3,4}$/.test(containerId)) {
                        containerIds.add(containerId);
                      }
                    }
                  }
                  
                  resolve(containerIds);
                }
              );
            });

            // Check each script against the list of existing containers
            for (const scriptData of serverScripts) {
              try {
                const containerId = String(scriptData.container_id).trim();
                
                // Check if container exists in pct list
                if (!existingContainerIds.has(containerId)) {
                  // Also verify config file doesn't exist as a double-check
                  const checkCommand = `test -f "/etc/pve/lxc/${containerId}.conf" && echo "exists" || echo "not_found"`;
                  
                  const configExists = await new Promise<boolean>((resolve) => {
                    let combinedOutput = '';
                    let resolved = false;

                    const finish = () => {
                      if (resolved) return;
                      resolved = true;
                      const out = combinedOutput.trim();
                      resolve(out.includes('exists'));
                    };

                    const timer = setTimeout(() => {
                      finish();
                    }, 10000);

                    void sshExecutionService.executeCommand(
                      server as Server,
                      checkCommand,
                      (data: string) => {
                        combinedOutput += data;
                      },
                      (_error: string) => {
                        // Ignore errors, just check output
                      },
                      (_exitCode: number) => {
                        clearTimeout(timer);
                        finish();
                      }
                    );
                  });

                  // If container is not in pct list AND config file doesn't exist, it's orphaned
                  if (!configExists) {
                    console.log(`cleanupOrphanedScripts: Removing orphaned script ${String(scriptData.script_name)} (container ${containerId}) from server ${String(String(server.name))}`);
                    await db.deleteInstalledScript(Number(scriptData.id));
                    deletedScripts.push(String(scriptData.script_name));
                  } else {
                    // Config exists but not in pct list - might be in a transitional state, log but don't delete
                    console.warn(`cleanupOrphanedScripts: Container ${containerId} (${String(scriptData.script_name)}) config exists but not in pct list - may be in transitional state`);
                  }
                }
              } catch (error) {
                console.error(`cleanupOrphanedScripts: Error checking script ${String(scriptData.script_name)}:`, error);
              }
            }
          } catch (error) {
            console.error(`cleanupOrphanedScripts: Error processing server ${serverId}:`, error);
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
             
            const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
            if (!connectionTest.success) {
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
                   
                  server as Server,
                  listCommand,
                  (data: string) => {
                    listOutput += data;
                  },
                  (error: string) => {
                    console.error(`pct list error on server ${String(server.name)}:`, error);
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
            console.error(`Error processing server ${String(server.name)}:`, error);
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
         
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`,
            status: 'unknown' as const
          };
        }

        // Check container status
        const statusCommand = `pct status ${scriptData.container_id}`;
        let statusOutput = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
             
            server as Server,
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
         
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`
          };
        }

        // Execute control command
        const controlCommand = `pct ${input.action} ${scriptData.container_id}`;
        let commandOutput = '';
        let commandError = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
             
            server as Server,
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
         
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`
          };
        }

        // First check if container is running and stop it if necessary
        const statusCommand = `pct status ${scriptData.container_id}`;
        let statusOutput = '';
        
        try {
          await new Promise<void>((resolve, reject) => {
            void sshExecutionService.executeCommand(
               
              server as Server,
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
                 
                server as Server,
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
             
            server as Server,
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

        console.log('🖥️ Server found:', { id: Number(server.id), name: String(server.name), ip: String(server.ip) });

        // Import SSH services
        const { default: SSHService } = await import('~/server/ssh-service');
        const { default: SSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = new SSHExecutionService();

        // Test SSH connection first
        console.log('🔌 Testing SSH connection...');
         
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          console.log('❌ SSH connection failed:', connectionTest.error);
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`
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
             
            server as Server,
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
          message: `Successfully detected IP: ${detectedIp}:${detectedPort} for LXC ${scriptData.container_id} on ${String(server.name)}`,
          detectedIp,
          detectedPort: detectedPort,
          containerId: scriptData.container_id,
          serverName: String(server.name)
        };
      } catch (error) {
        console.error('Error in autoDetectWebUI:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to auto-detect Web UI IP'
        };
      }
    }),

  // Get LXC configuration
  getLXCConfig: publicProcedure
    .input(z.object({ 
      scriptId: z.number(), 
      forceSync: z.boolean().optional().default(false) 
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = await db.getInstalledScriptById(input.scriptId);
        
        if (!script) {
          return {
            success: false,
            error: 'Script not found'
          };
        }

        if (!script.container_id || !script.server_id) {
          return {
            success: false,
            error: 'Script does not have container ID or server ID'
          };
        }

        // Check if we have cached config and it's recent (5 minutes)
        console.log("DB object in getLXCConfig:", Object.keys(db));
        console.log("getLXCConfigByScriptId exists:", typeof db.getLXCConfigByScriptId);
        const cachedConfig = await db.getLXCConfigByScriptId(input.scriptId);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        if (cachedConfig?.synced_at && cachedConfig.synced_at > fiveMinutesAgo && !input.forceSync) {
          return {
            success: true,
            config: cachedConfig,
            source: 'cache',
            has_changes: false,
            synced_at: cachedConfig.synced_at
          };
        }

        // Read from server
        const server = await db.getServerById(script.server_id);
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
        
        // Test SSH connection
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`
          };
        }

        // Read config file
        const configPath = `/etc/pve/lxc/${script.container_id}.conf`;
        const readCommand = `cat "${configPath}" 2>/dev/null`;
        let rawConfig = '';
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            server as Server,
            readCommand,
            (data: string) => {
              rawConfig += data;
            },
            (error: string) => {
              reject(new Error(error));
            },
            (exitCode: number) => {
              if (exitCode === 0) {
                resolve();
              } else {
                reject(new Error(`Command failed with exit code ${exitCode}`));
              }
            }
          );
        });

        // Parse config
        const parsedConfig = parseRawConfig(rawConfig);
        const configHash = calculateConfigHash(rawConfig);
        
        // Check for changes if we have cached config
        const hasChanges = cachedConfig ? cachedConfig.config_hash !== configHash : false;
        
        // Update database cache
        const configData = {
          ...parsedConfig,
          config_hash: configHash,
          synced_at: new Date()
        };
        
        await db.updateLXCConfig(input.scriptId, configData);
        
        return {
          success: true,
          config: configData,
          source: 'server',
          has_changes: hasChanges,
          synced_at: configData.synced_at
        };
      } catch (error) {
        console.error('Error in getLXCConfig:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get LXC config'
        };
      }
    }),

  // Save LXC configuration
  saveLXCConfig: publicProcedure
    .input(z.object({ 
      scriptId: z.number(), 
      config: z.any() 
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const script = await db.getInstalledScriptById(input.scriptId);
        
        if (!script) {
          return {
            success: false,
            error: 'Script not found'
          };
        }

        if (!script.container_id || !script.server_id) {
          return {
            success: false,
            error: 'Script does not have container ID or server ID'
          };
        }

        // Validate required fields
        if (!input.config.arch || !input.config.cores || !input.config.memory || !input.config.hostname || !input.config.ostype || !input.config.rootfs_storage) {
          return {
            success: false,
            error: 'Missing required fields: arch, cores, memory, hostname, ostype, or rootfs_storage'
          };
        }

        // Reconstruct config
        const rawConfig = reconstructConfig(input.config);
        const configHash = calculateConfigHash(rawConfig);

        // Get server info
        const server = await db.getServerById(script.server_id);
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
        
        // Test SSH connection
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`
          };
        }

        // Get current config for comparison
        const currentConfig = await db.getLXCConfigByScriptId(input.scriptId);
        const oldSizeGB = currentConfig ? extractSizeInGB(String(currentConfig.rootfs_size ?? '0G')) : 0;
        const newSizeGB = extractSizeInGB(String(input.config.rootfs_size ?? '0G'));
        
        // Validate size change - only allow increases
        if (newSizeGB < oldSizeGB) {
          return {
            success: false,
            error: `Disk size cannot be decreased. Current size: ${oldSizeGB}G, requested size: ${newSizeGB}G. Only increases are allowed for safety.`
          };
        }

        // Write config file using heredoc for safe escaping
        const configPath = `/etc/pve/lxc/${script.container_id}.conf`;
        const writeCommand = `cat > "${configPath}" << 'EOFCONFIG'
${rawConfig}
EOFCONFIG`;
        
        await new Promise<void>((resolve, reject) => {
          void sshExecutionService.executeCommand(
            server as Server,
            writeCommand,
            (_data: string) => {
              // Success data
            },
            (error: string) => {
              reject(new Error(error));
            },
            (exitCode: number) => {
              if (exitCode === 0) {
                resolve();
              } else {
                reject(new Error(`Command failed with exit code ${exitCode}`));
              }
            }
          );
        });

        // Check if disk size increased and needs resizing
        let resizeResult: { success: boolean; message: string; error?: string } | null = null;
        if (newSizeGB > oldSizeGB) {
          // Parse storage information
          const storageInfo = parseRootfsStorage(String(input.config.rootfs_storage));
          if (!storageInfo) {
            // Rollback config file
            const rollbackCommand = `cat > "${configPath}" << 'EOFCONFIG'
${reconstructConfig(currentConfig ?? {})}
EOFCONFIG`;
            
            await new Promise<void>((resolve, reject) => {
              void sshExecutionService.executeCommand(
                server as Server,
                rollbackCommand,
                () => resolve(),
                (error: string) => reject(new Error(error)),
                (exitCode: number) => {
                  if (exitCode === 0) resolve();
                  else reject(new Error(`Rollback failed with exit code ${exitCode}`));
                }
              );
            });
            
            return {
              success: false,
              error: 'Invalid rootfs_storage format. Configuration rolled back.'
            };
          }

          // Attempt disk resize
          try {
            console.log(`Attempting to resize disk from ${oldSizeGB}G to ${newSizeGB}G for container ${script.container_id}`);
            resizeResult = await resizeDisk(server as Server, script.container_id, storageInfo, oldSizeGB, newSizeGB);
            console.log('Resize result:', resizeResult);
            
            if (!resizeResult.success) {
              console.log('Resize failed, attempting rollback...');
              // Rollback config file on resize failure
              const rollbackCommand = `cat > "${configPath}" << 'EOFCONFIG'
${reconstructConfig(currentConfig ?? {})}
EOFCONFIG`;
              
              try {
                await new Promise<void>((resolve, reject) => {
                  void sshExecutionService.executeCommand(
                    server as Server,
                    rollbackCommand,
                    () => resolve(),
                    (error: string) => reject(new Error(error)),
                    (exitCode: number) => {
                      if (exitCode === 0) resolve();
                      else reject(new Error(`Rollback failed with exit code ${exitCode}`));
                    }
                  );
                });
                console.log('Rollback successful');
              } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
              }
              
              return {
                success: false,
                error: `Configuration rolled back. Disk resize failed: ${resizeResult.error}`
              };
            }
          } catch (error) {
            console.error('Resize operation threw error:', error);
            // Rollback config file on resize error
            const rollbackCommand = `cat > "${configPath}" << 'EOFCONFIG'
${reconstructConfig(currentConfig ?? {})}
EOFCONFIG`;
            
            try {
              await new Promise<void>((resolve, reject) => {
                void sshExecutionService.executeCommand(
                  server as Server,
                  rollbackCommand,
                  () => resolve(),
                  (error: string) => reject(new Error(error)),
                  (exitCode: number) => {
                    if (exitCode === 0) resolve();
                    else reject(new Error(`Rollback failed with exit code ${exitCode}`));
                  }
                );
              });
              console.log('Rollback successful after error');
            } catch (rollbackError) {
              console.error('Rollback failed after error:', rollbackError);
            }
            
            return {
              success: false,
              error: `Configuration rolled back. Disk resize error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        }

        // Update database cache
        const configData = {
          ...input.config,
          config_hash: configHash,
          synced_at: new Date()
        };
        
        await db.updateLXCConfig(input.scriptId, configData);
        
        // Return success message with resize info if applicable
        const message = resizeResult 
          ? `LXC configuration saved successfully. ${resizeResult.message}`
          : 'LXC configuration saved successfully';
        
        return {
          success: true,
          message
        };
      } catch (error) {
        console.error('Error in saveLXCConfig:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save LXC config'
        };
      }
    }),

  // Sync LXC configuration from server
  syncLXCConfig: publicProcedure
    .input(z.object({ scriptId: z.number() }))
    .mutation(async ({ input }): Promise<any> => {
      // This is just a wrapper around getLXCConfig with forceSync=true
      const result = await installedScriptsRouter
        .createCaller({ headers: new Headers() })
        .getLXCConfig({ scriptId: input.scriptId, forceSync: true });
      
      return result;
    }),

  // Get backup-capable storages for a server
  getBackupStorages: publicProcedure
    .input(z.object({ 
      serverId: z.number(), 
      forceRefresh: z.boolean().optional().default(false) 
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.serverId);
        
        if (!server) {
          return {
            success: false,
            error: 'Server not found',
            storages: [],
            cached: false
          };
        }

        const storageService = getStorageService();
        const { default: SSHService } = await import('~/server/ssh-service');
        const { getSSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = getSSHExecutionService();
        
        // Test SSH connection first
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`,
            storages: [],
            cached: false
          };
        }

        // Get server hostname to filter storages
        let serverHostname = '';
        try {
          await new Promise<void>((resolve, reject) => {
            sshExecutionService.executeCommand(
              server as Server,
              'hostname',
              (data: string) => {
                serverHostname += data;
              },
              (error: string) => {
                reject(new Error(`Failed to get hostname: ${error}`));
              },
              (exitCode: number) => {
                if (exitCode === 0) {
                  resolve();
                } else {
                  reject(new Error(`hostname command failed with exit code ${exitCode}`));
                }
              }
            );
          });
        } catch (error) {
          console.error('Error getting server hostname:', error);
          // Continue without filtering if hostname can't be retrieved
        }
        
        const normalizedHostname = serverHostname.trim().toLowerCase();
        
        // Check if we have cached data
        const wasCached = !input.forceRefresh;
        
        // Fetch storages (will use cache if not forcing refresh)
        const allStorages = await storageService.getStorages(server as Server, input.forceRefresh);
        
        // Filter storages by node hostname matching
        const applicableStorages = allStorages.filter(storage => {
          // If storage has no nodes specified, it's available on all nodes
          if (!storage.nodes || storage.nodes.length === 0) {
            return true;
          }
          
          // If we couldn't get hostname, include all storages (fallback)
          if (!normalizedHostname) {
            return true;
          }
          
          // Check if server hostname is in the nodes array (case-insensitive, trimmed)
          const normalizedNodes = storage.nodes.map(node => node.trim().toLowerCase());
          return normalizedNodes.includes(normalizedHostname);
        });
        
        return {
          success: true,
          storages: applicableStorages,
          cached: wasCached && applicableStorages.length > 0
        };
      } catch (error) {
        console.error('Error in getBackupStorages:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch storages',
          storages: [],
          cached: false
        };
      }
    }),

  // Execute backup for a container
  executeBackup: publicProcedure
    .input(z.object({ 
      containerId: z.string(),
      storage: z.string(),
      serverId: z.number()
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.serverId);
        
        if (!server) {
          return {
            success: false,
            error: 'Server not found',
            executionId: null
          };
        }

        const { default: SSHService } = await import('~/server/ssh-service');
        const sshService = new SSHService();
        
        // Test SSH connection first
        const connectionTest = await sshService.testSSHConnection(server as Server) as SSHConnectionResult;
        if (!connectionTest.success) {
          return {
            success: false,
            error: `SSH connection failed: ${connectionTest.error ?? 'Unknown error'}`,
            executionId: null
          };
        }

        // Generate execution ID for websocket tracking
        const executionId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          success: true,
          executionId,
          containerId: input.containerId,
          storage: input.storage,
          server: server as Server
        };
      } catch (error) {
        console.error('Error in executeBackup:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute backup',
          executionId: null
        };
      }
    })
});



