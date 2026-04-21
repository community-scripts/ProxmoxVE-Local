import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';
import { getDatabase } from '~/server/database-prisma';
import { getBackupService } from '~/server/services/backupService';
import { getRestoreService } from '~/server/services/restoreService';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import stripAnsi from 'strip-ansi';

export const backupsRouter = createTRPCRouter({
  // Get all backups grouped by container ID
  getAllBackupsGrouped: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const groupedBackups = await db.getBackupsGroupedByContainer();
        
        // Convert Map to array format for frontend
        const result: Array<{
          container_id: string;
          hostname: string;
          backups: Array<{
            id: number;
            backup_name: string;
            backup_path: string;
            size: bigint | null;
            created_at: Date | null;
            storage_name: string;
            storage_type: string;
            discovered_at: Date;
            server_id?: number;
            server_name: string | null;
            server_color: string | null;
          }>;
        }> = [];
        
        for (const [containerId, backups] of groupedBackups.entries()) {
          if (backups.length === 0) continue;
          
          // Get hostname from first backup (all backups for same container should have same hostname)
          const hostname = backups[0]?.hostname ?? '';
          
          result.push({
            container_id: containerId,
            hostname,
            backups: backups.map(backup => ({
              id: backup.id,
              backup_name: backup.backup_name,
              backup_path: backup.backup_path,
              size: backup.size,
              created_at: backup.created_at,
              storage_name: backup.storage_name,
              storage_type: backup.storage_type,
              discovered_at: backup.discovered_at,
              server_id: backup.server_id,
              server_name: backup.server?.name ?? null,
              server_color: backup.server?.color ?? null,
            })),
          });
        }
        
        return {
          success: true,
          backups: result,
        };
      } catch (error) {
        console.error('Error in getAllBackupsGrouped:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch backups',
          backups: [],
        };
      }
    }),

  // Discover backups for all containers
  discoverBackups: publicProcedure
    .mutation(async () => {
      try {
        const backupService = getBackupService();
        await backupService.discoverAllBackups();
        
        return {
          success: true,
          message: 'Backup discovery completed successfully',
        };
      } catch (error) {
        console.error('Error in discoverBackups:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to discover backups',
        };
      }
    }),

  // Get restore progress from log file
  getRestoreProgress: publicProcedure
    .query(async () => {
      try {
        const logPath = join(process.cwd(), 'restore.log');
        
        if (!existsSync(logPath)) {
          return {
            success: true,
            logs: [],
            isComplete: false
          };
        }

        const logs = await readFile(logPath, 'utf-8');
        const logLines = logs.split('\n')
          .filter(line => line.trim())
          .map(line => stripAnsi(line)); // Strip ANSI color codes
        
        // Check if restore is complete by looking for completion indicators
        const isComplete = logLines.some(line => 
          line.includes('complete: Restore completed successfully') || 
          line.includes('error: Error:') ||
          line.includes('Restore completed successfully') ||
          line.includes('Restore failed')
        );

        return {
          success: true,
          logs: logLines,
          isComplete
        };
      } catch (error) {
        console.error('Error reading restore logs:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read restore logs',
          logs: [],
          isComplete: false
        };
      }
    }),

  // Restore backup
  restoreBackup: publicProcedure
    .input(z.object({
      backupId: z.number(),
      containerId: z.string(),
      serverId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const restoreService = getRestoreService();
        const result = await restoreService.executeRestore(
          input.backupId,
          input.containerId,
          input.serverId
        );
        
        return {
          success: result.success,
          error: result.error,
          progress: result.progress,
        };
      } catch (error) {
        console.error('Error in restoreBackup:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to restore backup',
          progress: [],
        };
      }
    }),

  // Create a new backup via vzdump
  createBackup: publicProcedure
    .input(z.object({
      serverId: z.number(),
      containerId: z.string(),
      storage: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.serverId);

        if (!server) {
          return { success: false, error: 'Server not found' };
        }

        const { default: SSHService } = await import('~/server/ssh-service');
        const { getSSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshService = new SSHService();
        const sshExecutionService = getSSHExecutionService();

        // Test SSH connection first
        const connectionTest = await sshService.testSSHConnection(server as any);
        if (!(connectionTest as any).success) {
          return {
            success: false,
            error: `SSH connection failed: ${(connectionTest as any).error ?? 'Unknown error'}`,
          };
        }

        // vzdump with snapshot mode (non-disruptive) and zstd compression
        const command = `vzdump ${input.containerId} --storage ${input.storage} --compress zstd --mode snapshot 2>&1`;
        let output = '';

        await new Promise<void>((resolve, reject) => {
          sshExecutionService.executeCommand(
            server as any,
            command,
            (data: string) => { output += data; },
            (error: string) => { reject(new Error(error || 'vzdump failed')); },
            (exitCode: number) => {
              if (exitCode !== 0) {
                reject(new Error(`vzdump failed (exit ${exitCode}): ${output.trim()}`));
              } else {
                resolve();
              }
            }
          );
        });

        // Trigger background re-discovery so the new backup appears immediately
        const backupService = getBackupService();
        void backupService.discoverAllBackups().catch(() => {/* non-critical */});

        return {
          success: true,
          message: `Backup of container ${input.containerId} completed on storage "${input.storage}"`,
        };
      } catch (error) {
        console.error('Error in createBackup:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create backup',
        };
      }
    }),
});

