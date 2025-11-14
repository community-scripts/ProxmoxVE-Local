import { getSSHExecutionService } from '../ssh-execution-service';
import { getStorageService } from './storageService';
import { getDatabase } from '../database-prisma';
import type { Server } from '~/types/server';
import type { Storage } from './storageService';

export interface BackupData {
  container_id: string;
  server_id: number;
  hostname: string;
  backup_name: string;
  backup_path: string;
  size?: bigint;
  created_at?: Date;
  storage_name: string;
  storage_type: 'local' | 'storage' | 'pbs';
}

class BackupService {
  /**
   * Get server hostname via SSH
   */
  async getServerHostname(server: Server): Promise<string> {
    const sshService = getSSHExecutionService();
    let hostname = '';
    
    await new Promise<void>((resolve, reject) => {
      sshService.executeCommand(
        server,
        'hostname',
        (data: string) => {
          hostname += data;
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
    
    return hostname.trim();
  }

  /**
   * Discover local backups in /var/lib/vz/dump/
   */
  async discoverLocalBackups(server: Server, ctId: string, hostname: string): Promise<BackupData[]> {
    const sshService = getSSHExecutionService();
    const backups: BackupData[] = [];
    
    // Find backup files matching pattern (with timeout)
    const findCommand = `timeout 10 find /var/lib/vz/dump/ -type f -name "vzdump-lxc-${ctId}-*.tar*" 2>/dev/null`;
    let findOutput = '';
    
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          sshService.executeCommand(
            server,
            findCommand,
            (data: string) => {
              findOutput += data;
            },
            (error: string) => {
              // Ignore errors - directory might not exist
              resolve();
            },
            (exitCode: number) => {
              resolve();
            }
          );
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 15000); // 15 second timeout
        })
      ]);
      
      const backupPaths = findOutput.trim().split('\n').filter(path => path.trim());
      
      // Get detailed info for each backup file
      for (const backupPath of backupPaths) {
        if (!backupPath.trim()) continue;
        
        try {
          // Get file size and modification time
          const statCommand = `stat -c "%s|%Y|%n" "${backupPath}" 2>/dev/null || stat -f "%z|%m|%N" "${backupPath}" 2>/dev/null || echo ""`;
          let statOutput = '';
          
          await Promise.race([
            new Promise<void>((resolve) => {
              sshService.executeCommand(
                server,
                statCommand,
                (data: string) => {
                  statOutput += data;
                },
                () => resolve(),
                () => resolve()
              );
            }),
            new Promise<void>((resolve) => {
              setTimeout(() => resolve(), 5000); // 5 second timeout for stat
            })
          ]);
          
          const statParts = statOutput.trim().split('|');
          const fileName = backupPath.split('/').pop() || backupPath;
          
          if (statParts.length >= 2 && statParts[0] && statParts[1]) {
            const size = BigInt(statParts[0] || '0');
            const mtime = parseInt(statParts[1] || '0', 10);
            
            backups.push({
              container_id: ctId,
              server_id: server.id,
              hostname,
              backup_name: fileName,
              backup_path: backupPath,
              size,
              created_at: mtime > 0 ? new Date(mtime * 1000) : undefined,
              storage_name: 'local',
              storage_type: 'local',
            });
          } else {
            // If stat fails, still add the backup with minimal info
            backups.push({
              container_id: ctId,
              server_id: server.id,
              hostname,
              backup_name: fileName,
              backup_path: backupPath,
              size: undefined,
              created_at: undefined,
              storage_name: 'local',
              storage_type: 'local',
            });
          }
        } catch (error) {
          // Still try to add the backup even if stat fails
          const fileName = backupPath.split('/').pop() || backupPath;
          backups.push({
            container_id: ctId,
            server_id: server.id,
            hostname,
            backup_name: fileName,
            backup_path: backupPath,
            size: undefined,
            created_at: undefined,
            storage_name: 'local',
            storage_type: 'local',
          });
        }
      }
    } catch (error) {
      console.error(`Error discovering local backups for CT ${ctId}:`, error);
    }
    
    return backups;
  }

  /**
   * Discover backups in mounted storage (/mnt/pve/<storage>/dump/)
   */
  async discoverStorageBackups(server: Server, storage: Storage, ctId: string, hostname: string): Promise<BackupData[]> {
    const sshService = getSSHExecutionService();
    const backups: BackupData[] = [];
    
    const dumpPath = `/mnt/pve/${storage.name}/dump/`;
    const findCommand = `timeout 10 find "${dumpPath}" -type f -name "vzdump-lxc-${ctId}-*.tar*" 2>/dev/null`;
    let findOutput = '';
    
    console.log(`[BackupService] Discovering storage backups for CT ${ctId} on ${storage.name}`);
    
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          sshService.executeCommand(
            server,
            findCommand,
            (data: string) => {
              findOutput += data;
            },
            (error: string) => {
              // Ignore errors - storage might not be mounted
              resolve();
            },
            (exitCode: number) => {
              resolve();
            }
          );
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log(`[BackupService] Storage backup discovery timeout for ${storage.name}`);
            resolve();
          }, 15000); // 15 second timeout
        })
      ]);
      
      const backupPaths = findOutput.trim().split('\n').filter(path => path.trim());
      console.log(`[BackupService] Found ${backupPaths.length} backup files for CT ${ctId} on storage ${storage.name}`);
      
      // Get detailed info for each backup file
      for (const backupPath of backupPaths) {
        if (!backupPath.trim()) continue;
        
        try {
          const statCommand = `stat -c "%s|%Y|%n" "${backupPath}" 2>/dev/null || stat -f "%z|%m|%N" "${backupPath}" 2>/dev/null || echo ""`;
          let statOutput = '';
          
          await Promise.race([
            new Promise<void>((resolve) => {
              sshService.executeCommand(
                server,
                statCommand,
                (data: string) => {
                  statOutput += data;
                },
                () => resolve(),
                () => resolve()
              );
            }),
            new Promise<void>((resolve) => {
              setTimeout(() => resolve(), 5000); // 5 second timeout for stat
            })
          ]);
          
          const statParts = statOutput.trim().split('|');
          const fileName = backupPath.split('/').pop() || backupPath;
          
          if (statParts.length >= 2 && statParts[0] && statParts[1]) {
            const size = BigInt(statParts[0] || '0');
            const mtime = parseInt(statParts[1] || '0', 10);
            
            backups.push({
              container_id: ctId,
              server_id: server.id,
              hostname,
              backup_name: fileName,
              backup_path: backupPath,
              size,
              created_at: mtime > 0 ? new Date(mtime * 1000) : undefined,
              storage_name: storage.name,
              storage_type: 'storage',
            });
            console.log(`[BackupService] Added storage backup: ${fileName} from ${storage.name}`);
          } else {
            // If stat fails, still add the backup with minimal info
            console.log(`[BackupService] Stat failed for ${fileName}, adding backup without size/date`);
            backups.push({
              container_id: ctId,
              server_id: server.id,
              hostname,
              backup_name: fileName,
              backup_path: backupPath,
              size: undefined,
              created_at: undefined,
              storage_name: storage.name,
              storage_type: 'storage',
            });
          }
        } catch (error) {
          console.error(`Error processing backup ${backupPath}:`, error);
          // Still try to add the backup even if stat fails
          const fileName = backupPath.split('/').pop() || backupPath;
          backups.push({
            container_id: ctId,
            server_id: server.id,
            hostname,
            backup_name: fileName,
            backup_path: backupPath,
            size: undefined,
            created_at: undefined,
            storage_name: storage.name,
            storage_type: 'storage',
          });
        }
      }
      
      console.log(`[BackupService] Total storage backups found for CT ${ctId} on ${storage.name}: ${backups.length}`);
    } catch (error) {
      console.error(`Error discovering storage backups for CT ${ctId} on ${storage.name}:`, error);
    }
    
    return backups;
  }

  /**
   * Login to PBS using stored credentials
   */
  async loginToPBS(server: Server, storage: Storage): Promise<boolean> {
    const db = getDatabase();
    const credential = await db.getPBSCredential(server.id, storage.name);
    
    if (!credential) {
      console.log(`[BackupService] No PBS credentials found for storage ${storage.name}, skipping PBS discovery`);
      return false;
    }
    
    const sshService = getSSHExecutionService();
    const storageService = getStorageService();
    const pbsInfo = storageService.getPBSStorageInfo(storage);
    
    // Use IP and datastore from credentials (they override config if different)
    const pbsIp = credential.pbs_ip || pbsInfo.pbs_ip;
    const pbsDatastore = credential.pbs_datastore || pbsInfo.pbs_datastore;
    
    if (!pbsIp || !pbsDatastore) {
      console.log(`[BackupService] Missing PBS IP or datastore for storage ${storage.name}`);
      return false;
    }
    
    // Build login command
    // Format: proxmox-backup-client login --repository root@pam@<IP>:<DATASTORE>
    const repository = `root@pam@${pbsIp}:${pbsDatastore}`;
    
    // Auto-accept fingerprint using echo "y"
    // Provide password via stdin
    // proxmox-backup-client accepts password via stdin
    const fullCommand = `echo -e "y\\n${credential.pbs_password}" | timeout 10 proxmox-backup-client login --repository ${repository} 2>&1`;
    
    console.log(`[BackupService] Logging into PBS: ${repository}`);
    
    let loginOutput = '';
    let loginSuccess = false;
    
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          sshService.executeCommand(
            server,
            fullCommand,
            (data: string) => {
              loginOutput += data;
            },
            (error: string) => {
              console.log(`[BackupService] PBS login error: ${error}`);
              resolve();
            },
            (exitCode: number) => {
              loginSuccess = exitCode === 0;
              if (loginSuccess) {
                console.log(`[BackupService] Successfully logged into PBS: ${repository}`);
              } else {
                console.log(`[BackupService] PBS login failed with exit code ${exitCode}`);
                console.log(`[BackupService] Login output: ${loginOutput}`);
              }
              resolve();
            }
          );
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log(`[BackupService] PBS login timeout`);
            resolve();
          }, 15000); // 15 second timeout
        })
      ]);
      
      // Check if login was successful (look for success indicators in output)
      if (loginSuccess || loginOutput.includes('successfully') || loginOutput.includes('logged in')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[BackupService] Error during PBS login:`, error);
      return false;
    }
  }

  /**
   * Discover PBS backups using proxmox-backup-client
   */
  async discoverPBSBackups(server: Server, storage: Storage, ctId: string, hostname: string): Promise<BackupData[]> {
    const sshService = getSSHExecutionService();
    const backups: BackupData[] = [];
    
    // Login to PBS first
    const loggedIn = await this.loginToPBS(server, storage);
    if (!loggedIn) {
      console.log(`[BackupService] Failed to login to PBS for storage ${storage.name}, skipping backup discovery`);
      return backups;
    }
    
    // Use storage name as repository name (e.g., "PBS1")
    const repositoryName = storage.name;
    const command = `timeout 30 proxmox-backup-client snapshots host/${ctId} --repository ${repositoryName} 2>&1 || echo "PBS_ERROR"`;
    let output = '';
    
    console.log(`[BackupService] Discovering PBS backups for CT ${ctId} on repository ${repositoryName}`);
    
    try {
      // Add timeout to prevent hanging
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          sshService.executeCommand(
            server,
            command,
            (data: string) => {
              output += data;
            },
            (error: string) => {
              console.log(`[BackupService] PBS command error for ${repositoryName}: ${error}`);
              resolve();
            },
            (exitCode: number) => {
              console.log(`[BackupService] PBS command completed for ${repositoryName} with exit code ${exitCode}`);
              resolve();
            }
          );
        }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log(`[BackupService] PBS discovery timeout for ${repositoryName}, continuing...`);
            resolve();
          }, 35000); // 35 second timeout (command has 30s timeout, so this is a safety net)
        })
      ]);
      
      // Check if PBS command failed
      if (output.includes('PBS_ERROR') || output.includes('error') || output.includes('Error')) {
        console.log(`[BackupService] PBS discovery failed or no backups found for CT ${ctId} on ${repositoryName}`);
        return backups;
      }
      
      // Parse PBS snapshot output
      // Format is typically: snapshot_name timestamp (optional size info)
      const lines = output.trim().split('\n').filter(line => line.trim());
      
      console.log(`[BackupService] Parsing ${lines.length} lines from PBS output for ${repositoryName}`);
      
      for (const line of lines) {
        // Skip header lines or error messages
        if (line.includes('repository') || line.includes('error') || line.includes('Error') || line.includes('PBS_ERROR')) {
          continue;
        }
        
        // Parse snapshot line - format varies, try to extract snapshot name and timestamp
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const snapshotName = parts[0];
          
          // Try to extract timestamp if available
          let createdAt: Date | undefined;
          if (parts.length > 1 && parts[1]) {
            const timestampMatch = parts[1].match(/\d+/);
            if (timestampMatch && timestampMatch[0]) {
              const timestamp = parseInt(timestampMatch[0], 10);
              // PBS timestamps might be in seconds or milliseconds
              createdAt = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
            }
          }
          
          backups.push({
            container_id: ctId,
            server_id: server.id,
            hostname,
            backup_name: snapshotName || 'unknown',
            backup_path: `pbs://${repositoryName}/host/${ctId}/${snapshotName || 'unknown'}`,
            size: undefined, // PBS doesn't always provide size in snapshot list
            created_at: createdAt,
            storage_name: repositoryName,
            storage_type: 'pbs',
          });
        }
      }
    } catch (error) {
      console.error(`Error discovering PBS backups for CT ${ctId} on ${repositoryName}:`, error);
    }
    
    return backups;
  }

  /**
   * Discover all backups for a container across all backup-capable storages
   */
  async discoverAllBackupsForContainer(server: Server, ctId: string, hostname: string): Promise<BackupData[]> {
    const allBackups: BackupData[] = [];
    
    try {
      // Get server hostname to filter storages
      const serverHostname = await this.getServerHostname(server);
      const normalizedHostname = serverHostname.trim().toLowerCase();
      console.log(`[BackupService] Discovering backups for server ${server.name} (hostname: ${serverHostname}, normalized: ${normalizedHostname})`);
      
      // Get all backup-capable storages (force refresh to get latest node assignments)
      const storageService = getStorageService();
      const allStorages = await storageService.getBackupStorages(server, true); // Force refresh
      
      console.log(`[BackupService] Found ${allStorages.length} backup-capable storages total`);
      
      // Filter storages by node hostname matching
      const applicableStorages = allStorages.filter(storage => {
        // If storage has no nodes specified, it's available on all nodes
        if (!storage.nodes || storage.nodes.length === 0) {
          console.log(`[BackupService] Storage ${storage.name} has no nodes specified, including it`);
          return true;
        }
        
        // Normalize all nodes for comparison
        const normalizedNodes = storage.nodes.map(node => node.trim().toLowerCase());
        const isApplicable = normalizedNodes.includes(normalizedHostname);
        
        if (!isApplicable) {
          console.log(`[BackupService] EXCLUDING Storage ${storage.name} (nodes: ${storage.nodes.join(', ')}) - not applicable for hostname: ${serverHostname}`);
        } else {
          console.log(`[BackupService] INCLUDING Storage ${storage.name} (nodes: ${storage.nodes.join(', ')}) - applicable for hostname: ${serverHostname}`);
        }
        
        return isApplicable;
      });
      
      console.log(`[BackupService] Filtered to ${applicableStorages.length} applicable storages for ${serverHostname}`);
      
      // Discover local backups
      const localBackups = await this.discoverLocalBackups(server, ctId, hostname);
      allBackups.push(...localBackups);
      
      // Discover backups from each applicable storage
      for (const storage of applicableStorages) {
        try {
          if (storage.type === 'pbs') {
            // PBS storage
            const pbsBackups = await this.discoverPBSBackups(server, storage, ctId, hostname);
            allBackups.push(...pbsBackups);
          } else {
            // Regular storage (dir, nfs, etc.)
            const storageBackups = await this.discoverStorageBackups(server, storage, ctId, hostname);
            allBackups.push(...storageBackups);
          }
        } catch (error) {
          console.error(`[BackupService] Error discovering backups from storage ${storage.name}:`, error);
          // Continue with other storages
        }
      }
      
      console.log(`[BackupService] Total backups discovered for CT ${ctId}: ${allBackups.length}`);
    } catch (error) {
      console.error(`Error discovering backups for container ${ctId}:`, error);
    }
    
    return allBackups;
  }

  /**
   * Discover backups for all installed scripts with container_id
   */
  async discoverAllBackups(): Promise<void> {
    const db = getDatabase();
    const scripts = await db.getAllInstalledScripts();
    
    // Filter scripts that have container_id and server_id
    const scriptsWithContainers = scripts.filter(
      (script: any) => script.container_id && script.server_id && script.server
    );
    
    // Clear all existing backups first to ensure we start fresh
    console.log('[BackupService] Clearing all existing backups before rediscovery...');
    const allBackups = await db.getAllBackups();
    for (const backup of allBackups) {
      await db.deleteBackupsForContainer(backup.container_id, backup.server_id);
    }
    console.log('[BackupService] Cleared all existing backups');
    
    for (const script of scriptsWithContainers) {
      if (!script.container_id || !script.server_id || !script.server) continue;
      
      const containerId = script.container_id;
      const serverId = script.server_id;
      const server = script.server as Server;
      
      try {
        // Get hostname from LXC config if available, otherwise use script name
        let hostname = script.script_name || `CT-${script.container_id}`;
        try {
          const lxcConfig = await db.getLXCConfigByScriptId(script.id);
          if (lxcConfig?.hostname) {
            hostname = lxcConfig.hostname;
          }
        } catch (error) {
          // LXC config might not exist, use script name
          console.debug(`No LXC config found for script ${script.id}, using script name as hostname`);
        }
        
        console.log(`[BackupService] Discovering backups for script ${script.id}, CT ${containerId} on server ${server.name}`);
        
        // Discover backups for this container
        const backups = await this.discoverAllBackupsForContainer(
          server,
          containerId,
          hostname
        );
        
        console.log(`[BackupService] Found ${backups.length} backups for CT ${containerId} on server ${server.name}`);
        
        // Save discovered backups
        for (const backup of backups) {
          await db.createOrUpdateBackup(backup);
        }
      } catch (error) {
        console.error(`Error discovering backups for script ${script.id} (CT ${script.container_id}):`, error);
      }
    }
  }
}

// Singleton instance
let backupServiceInstance: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}

