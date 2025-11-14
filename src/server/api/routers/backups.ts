import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';
import { getDatabase } from '~/server/database-prisma';
import { getBackupService } from '~/server/services/backupService';
import { getRestoreService } from '~/server/services/restoreService';

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
            server_name: string | null;
            server_color: string | null;
          }>;
        }> = [];
        
        for (const [containerId, backups] of groupedBackups.entries()) {
          if (backups.length === 0) continue;
          
          // Get hostname from first backup (all backups for same container should have same hostname)
          const hostname = backups[0]?.hostname || '';
          
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
});

