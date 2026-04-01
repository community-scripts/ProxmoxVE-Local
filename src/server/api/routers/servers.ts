import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database-prisma";
import type { Server } from "~/types/server";

export const serversRouter = createTRPCRouter({
  getAllServers: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const servers = await db.getAllServers();
        return { success: true, servers };
      } catch (error) {
        console.error('Error fetching servers:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch servers',
          servers: []
        };
      }
    }),

  getServerById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.id);
        if (!server) {
          return { success: false, error: 'Server not found', server: null };
        }
        return { success: true, server };
      } catch (error) {
        console.error('Error fetching server:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch server',
          server: null
        };
      }
    }),

  /**
   * Check connectivity of all configured servers via SSH.
   * Returns each server's id, name, ip, and reachability status.
   */
  checkServersStatus: publicProcedure
    .query(async () => {
      try {
        const db = getDatabase();
        const servers = await db.getAllServers();
        if (!servers || servers.length === 0) {
          return { success: true, servers: [] };
        }

        const { default: SSHService } = await import('~/server/ssh-service');
        const sshService = new SSHService();

        const results = await Promise.all(
          servers.map(async (server) => {
            try {
              const test = await sshService.testSSHConnection(server as Server) as { success: boolean };
              return {
                id: server.id,
                name: (server as any).name ?? 'Unknown',
                ip: (server as any).ip ?? '',
                online: test.success,
              };
            } catch {
              return {
                id: server.id,
                name: (server as any).name ?? 'Unknown',
                ip: (server as any).ip ?? '',
                online: false,
              };
            }
          }),
        );

        return { success: true, servers: results };
      } catch (error) {
        console.error('Error checking servers status:', error);
        return { success: false, servers: [] };
      }
    }),
});
