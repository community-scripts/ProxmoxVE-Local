/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/prefer-optional-chain, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/prefer-regexp-exec, @typescript-eslint/no-empty-function */
import { getSSHExecutionService } from '../ssh-execution-service';
import { getBackupService } from './backupService';
import { getStorageService } from './storageService';
import { getDatabase } from '../database-prisma';
import type { Server } from '~/types/server';
import type { Storage } from './storageService';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface RestoreProgress {
  step: string;
  message: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  progress?: RestoreProgress[];
}

class RestoreService {
  /**
   * Get rootfs storage from LXC config or installed scripts database
   */
  async getRootfsStorage(server: Server, ctId: string): Promise<string | null> {
    const sshService = getSSHExecutionService();
    const db = getDatabase();
    const configPath = `/etc/pve/lxc/${ctId}.conf`;
    const readCommand = `cat "${configPath}" 2>/dev/null || echo ""`;
    let rawConfig = '';
    
    try {
      // Try to read config file (container might not exist, so don't fail on error)
      await new Promise<void>((resolve) => {
        sshService.executeCommand(
          server,
          readCommand,
          (data: string) => {
            rawConfig += data;
          },
          () => resolve(), // Don't fail on error
          () => resolve() // Always resolve
        );
      });
      
      // If we got config content, parse it
      if (rawConfig.trim()) {
        // Parse rootfs line: rootfs: PROX2-STORAGE2:vm-148-disk-0,size=4G
        const lines = rawConfig.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('rootfs:')) {
            const match = trimmed.match(/^rootfs:\s*([^:]+):/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }
      }
      
      // If config file doesn't exist or doesn't have rootfs, try to get from installed scripts database
      const installedScripts = await db.getAllInstalledScripts();
      const script = installedScripts.find((s: any) => s.container_id === ctId && s.server_id === server.id);
      
      if (script) {
        // Try to get LXC config from database
        const lxcConfig = await db.getLXCConfigByScriptId(script.id);
        if (lxcConfig?.rootfs_storage) {
          // Extract storage from rootfs_storage format: "STORAGE:vm-148-disk-0"
          const match = lxcConfig.rootfs_storage.match(/^([^:]+):/);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
      }
      
      return null;
      } catch {
        // Try fallback to database
        try {
          const installedScripts = await db.getAllInstalledScripts();
          const script = installedScripts.find((s: any) => s.container_id === ctId && s.server_id === server.id);
          if (script) {
            const lxcConfig = await db.getLXCConfigByScriptId(script.id);
            if (lxcConfig?.rootfs_storage) {
              const match = lxcConfig.rootfs_storage.match(/^([^:]+):/);
              if (match && match[1]) {
                return match[1].trim();
              }
            }
          }
        } catch {
          // Ignore database error
        }
        return null;
      }
  }

  /**
   * Stop container (continue if already stopped)
   */
  async stopContainer(server: Server, ctId: string): Promise<void> {
    const sshService = getSSHExecutionService();
    const command = `pct stop ${ctId} 2>&1 || true`; // Continue even if already stopped
    
    await new Promise<void>((resolve) => {
      sshService.executeCommand(
        server,
        command,
        () => {},
        () => resolve(),
        () => resolve() // Always resolve, don't fail if already stopped
      );
    });
  }

  /**
   * Destroy container
   */
  async destroyContainer(server: Server, ctId: string): Promise<void> {
    const sshService = getSSHExecutionService();
    const command = `pct destroy ${ctId} 2>&1`;
    let output = '';
    let exitCode = 0;
    
    await new Promise<void>((resolve, reject) => {
      sshService.executeCommand(
        server,
        command,
        (data: string) => {
          output += data;
        },
        (error: string) => {
          // Check if error is about container not existing
          if (error.includes('does not exist') || error.includes('not found')) {
            resolve(); // Container doesn't exist, that's fine
          } else {
            reject(new Error(`Destroy failed: ${error}`));
          }
        },
        (code: number) => {
          exitCode = code;
          if (exitCode === 0) {
            resolve();
          } else {
            // Check if error is about container not existing
            if (output.includes('does not exist') || output.includes('not found') || output.includes('No such file')) {
              resolve(); // Container doesn't exist, that's fine
            } else {
              reject(new Error(`Destroy failed with exit code ${exitCode}: ${output}`));
            }
          }
        }
      );
    });
  }

  /**
   * Restore from local/storage backup
   */
  async restoreLocalBackup(
    server: Server,
    ctId: string,
    backupPath: string,
    storage: string
  ): Promise<void> {
    const sshService = getSSHExecutionService();
    const command = `pct restore ${ctId} "${backupPath}" --storage=${storage}`;
    let output = '';
    let exitCode = 0;
    
    await new Promise<void>((resolve, reject) => {
      sshService.executeCommand(
        server,
        command,
        (data: string) => {
          output += data;
        },
        (error: string) => {
          reject(new Error(`Restore failed: ${error}`));
        },
        (code: number) => {
          exitCode = code;
          if (exitCode === 0) {
            resolve();
          } else {
            reject(new Error(`Restore failed with exit code ${exitCode}: ${output}`));
          }
        }
      );
    });
  }

  /**
   * Restore from PBS backup
   */
  async restorePBSBackup(
    server: Server,
    storage: Storage,
    ctId: string,
    snapshotPath: string,
    storageName: string,
    onProgress?: (step: string, message: string) => Promise<void>
  ): Promise<void> {
    const backupService = getBackupService();
    const sshService = getSSHExecutionService();
    const db = getDatabase();
    
    // Get PBS credentials
    const credential = await db.getPBSCredential(server.id, storage.name);
    if (!credential) {
      throw new Error(`No PBS credentials found for storage ${storage.name}`);
    }
    
    const storageService = getStorageService();
    const pbsInfo = storageService.getPBSStorageInfo(storage);
    const pbsIp = credential.pbs_ip || pbsInfo.pbs_ip;
    const pbsDatastore = credential.pbs_datastore || pbsInfo.pbs_datastore;
    
    if (!pbsIp || !pbsDatastore) {
      throw new Error(`Missing PBS IP or datastore for storage ${storage.name}`);
    }
    
    const repository = `root@pam@${pbsIp}:${pbsDatastore}`;
    
    // Extract snapshot name from path (e.g., "2025-10-21T19:14:55Z" from "ct/148/2025-10-21T19:14:55Z")
    const snapshotParts = snapshotPath.split('/');
    const snapshotName = snapshotParts[snapshotParts.length - 1] || snapshotPath;
    // Replace colons with underscores for file paths (tar doesn't like colons in filenames)
    const snapshotNameForPath = snapshotName.replace(/:/g, '_');
    
    // Determine file extension - try common extensions
    let downloadedPath = '';
    let downloadSuccess = false;
    
    // Login to PBS first
    if (onProgress) await onProgress('pbs_login', 'Logging into PBS...');
    const loggedIn = await backupService.loginToPBS(server, storage);
    if (!loggedIn) {
      throw new Error(`Failed to login to PBS for storage ${storage.name}`);
    }
    
    // Download backup from PBS
    // proxmox-backup-client restore outputs a folder, not a file
    if (onProgress) await onProgress('pbs_download', 'Downloading backup from PBS...');
    
    // Target folder for PBS restore (without extension)
    // Use sanitized snapshot name (colons replaced with underscores) for file paths
    const targetFolder = `/var/lib/vz/dump/vzdump-lxc-${ctId}-${snapshotNameForPath}`;
    const targetTar = `${targetFolder}.tar`;
    
    // Use PBS_PASSWORD env var and add timeout for long downloads
    const escapedPassword = credential.pbs_password.replace(/'/g, "'\\''");
    const restoreCommand = `PBS_PASSWORD='${escapedPassword}' PBS_REPOSITORY='${repository}' timeout 300 proxmox-backup-client restore "${snapshotPath}" root.pxar "${targetFolder}" --repository '${repository}' 2>&1`;
    
    let output = '';
    let exitCode = 0;
    
    try {
      // Download from PBS (creates a folder)
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          sshService.executeCommand(
            server,
            restoreCommand,
            (data: string) => {
              output += data;
            },
            (error: string) => {
              reject(new Error(`Download failed: ${error}`));
            },
            (code: number) => {
              exitCode = code;
              if (exitCode === 0) {
                resolve();
              } else {
                reject(new Error(`Download failed with exit code ${exitCode}: ${output}`));
              }
            }
          );
        }),
        new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Download timeout after 5 minutes'));
          }, 300000); // 5 minute timeout
        })
      ]);
      
      // Check if folder exists
      const checkCommand = `test -d "${targetFolder}" && echo "exists" || echo "notfound"`;
      let checkOutput = '';
      
      await new Promise<void>((resolve) => {
        sshService.executeCommand(
          server,
          checkCommand,
          (data: string) => {
            checkOutput += data;
          },
          () => resolve(),
          () => resolve()
        );
      });
      
      if (!checkOutput.includes('exists')) {
        throw new Error(`Downloaded folder ${targetFolder} does not exist`);
      }
      
      // Pack the folder into a tar file
      if (onProgress) await onProgress('pbs_pack', 'Packing backup folder...');
      
      // Use -C to change to the folder directory, then pack all contents (.) into the tar file
      const packCommand = `tar -cf "${targetTar}" -C "${targetFolder}" . 2>&1`;
      let packOutput = '';
      let packExitCode = 0;
      
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          sshService.executeCommand(
            server,
            packCommand,
            (data: string) => {
              packOutput += data;
            },
            (error: string) => {
              reject(new Error(`Pack failed: ${error}`));
            },
            (code: number) => {
              packExitCode = code;
              if (packExitCode === 0) {
                resolve();
              } else {
                reject(new Error(`Pack failed with exit code ${packExitCode}: ${packOutput}`));
              }
            }
          );
        }),
        new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Pack timeout after 2 minutes'));
          }, 120000); // 2 minute timeout for packing
        })
      ]);
      
      // Check if tar file exists
      const checkTarCommand = `test -f "${targetTar}" && echo "exists" || echo "notfound"`;
      let checkTarOutput = '';
      
      await new Promise<void>((resolve) => {
        sshService.executeCommand(
          server,
          checkTarCommand,
          (data: string) => {
            checkTarOutput += data;
          },
          () => resolve(),
          () => resolve()
        );
      });
      
      if (!checkTarOutput.includes('exists')) {
        throw new Error(`Packed tar file ${targetTar} does not exist`);
      }
      
      downloadedPath = targetTar;
      downloadSuccess = true;
    } catch (error) {
      throw error;
    }
    
    if (!downloadSuccess || !downloadedPath) {
      throw new Error(`Failed to download and pack backup from PBS`);
    }
    
    // Restore from packed tar file
      if (onProgress) await onProgress('restoring', 'Restoring container...');
    try {
      await this.restoreLocalBackup(server, ctId, downloadedPath, storageName);
    } finally {
      // Cleanup: delete downloaded folder and tar file
      if (onProgress) await onProgress('cleanup', 'Cleaning up temporary files...');
      const cleanupCommand = `rm -rf "${targetFolder}" "${targetTar}" 2>&1 || true`;
      sshService.executeCommand(
        server,
        cleanupCommand,
        () => {},
        () => {},
        () => {}
      );
    }
  }

  /**
   * Execute full restore flow
   */
  async executeRestore(
    backupId: number,
    containerId: string,
    serverId: number,
    onProgress?: (progress: RestoreProgress) => void
  ): Promise<RestoreResult> {
    const progress: RestoreProgress[] = [];
    const logPath = join(process.cwd(), 'restore.log');
    
    // Clear log file at start of restore
    const clearLogFile = async () => {
      try {
        await writeFile(logPath, '', 'utf-8');
      } catch {
        // Ignore log file errors
      }
    };
    
    // Write progress to log file
    const writeProgressToLog = async (message: string) => {
      try {
        const logLine = `${message}\n`;
        await writeFile(logPath, logLine, { flag: 'a', encoding: 'utf-8' });
      } catch {
        // Ignore log file errors
      }
    };
    
    const addProgress = async (step: string, message: string) => {
      const p = { step, message };
      progress.push(p);
      
      // Write to log file (just the message, without step prefix)
      await writeProgressToLog(message);
      
      // Call callback if provided
      if (onProgress) {
        onProgress(p);
      }
    };
    
    try {
      // Clear log file at start
      await clearLogFile();
      
      const db = getDatabase();
      const sshService = getSSHExecutionService();
      
      await addProgress('starting', 'Starting restore...');
      
      // Get backup details
      const backup = await db.getBackupById(backupId);
      if (!backup) {
        throw new Error(`Backup with ID ${backupId} not found`);
      }
      
      // Get server details
      const serverData = await db.getServerById(serverId);
      if (!serverData) {
        throw new Error(`Server with ID ${serverId} not found`);
      }
      // Cast to Server type (Prisma returns nullable fields as null, Server uses undefined)
      const server = serverData as unknown as Server;
      
      // Get rootfs storage
      await addProgress('reading_config', 'Reading container configuration...');
      const rootfsStorage = await this.getRootfsStorage(server, containerId);
      
      if (!rootfsStorage) {
        // Try to check if container exists, if not we can proceed without stopping/destroying
        const checkCommand = `pct list ${containerId} 2>&1 | grep -q "^${containerId}" && echo "exists" || echo "notfound"`;
        let checkOutput = '';
        await new Promise<void>((resolve) => {
          sshService.executeCommand(
            server,
            checkCommand,
            (data: string) => {
              checkOutput += data;
            },
            () => resolve(),
            () => resolve()
          );
        });
        
        if (checkOutput.includes('notfound')) {
          // Container doesn't exist, we can't determine storage - need user input or use default
          throw new Error(`Container ${containerId} does not exist and storage could not be determined. Please ensure the container exists or specify the storage manually.`);
        }
        
        throw new Error(`Could not determine rootfs storage for container ${containerId}. Please ensure the container exists and has a valid configuration.`);
      }
      
      // Try to stop and destroy container - if it doesn't exist, continue anyway
      await addProgress('stopping', 'Stopping container...');
      try {
        await this.stopContainer(server, containerId);
      } catch {
        // Continue even if stop fails
      }
      
      // Try to destroy container - if it doesn't exist, continue anyway
      await addProgress('destroying', 'Destroying container...');
      try {
        await this.destroyContainer(server, containerId);
      } catch {
        // Container might not exist, which is fine - continue with restore
        await addProgress('skipping', 'Container does not exist or already destroyed, continuing...');
      }
      
      // Restore based on backup type
      if (backup.storage_type === 'pbs') {
        // Get storage info for PBS
        const storageService = getStorageService();
        const storages = await storageService.getStorages(server, false);
        const storage = storages.find(s => s.name === backup.storage_name);
        
        if (!storage) {
          throw new Error(`Storage ${backup.storage_name} not found`);
        }
        
        // Parse snapshot path from backup_path (format: pbs://root@pam@IP:DATASTORE/ct/148/2025-10-21T19:14:55Z)
        const snapshotPathMatch = backup.backup_path.match(/pbs:\/\/[^/]+\/(.+)$/);
        if (!snapshotPathMatch || !snapshotPathMatch[1]) {
          throw new Error(`Invalid PBS backup path format: ${backup.backup_path}`);
        }
        
        const snapshotPath = snapshotPathMatch[1];
        
        await this.restorePBSBackup(server, storage, containerId, snapshotPath, rootfsStorage, async (step, message) => {
          await addProgress(step, message);
        });
      } else {
        // Local or storage backup
        await addProgress('restoring', 'Restoring container...');
        await this.restoreLocalBackup(server, containerId, backup.backup_path, rootfsStorage);
      }
      
      await addProgress('complete', 'Restore completed successfully');
      
      return {
        success: true,
        progress,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await addProgress('error', `Error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        progress,
      };
    }
  }
}

// Singleton instance
let restoreServiceInstance: RestoreService | null = null;

export function getRestoreService(): RestoreService {
  if (!restoreServiceInstance) {
    restoreServiceInstance = new RestoreService();
  }
  return restoreServiceInstance;
}


