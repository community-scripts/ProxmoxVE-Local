import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getDatabase } from "~/server/database-prisma";

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
});
