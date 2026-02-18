import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";

const upsertSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  gateway: z.string().nullable(),
  nameserver: z.string().nullable(),
  serverId: z.number().nullable(),
});

export const bridgeProfilesRouter = createTRPCRouter({
  // Get all bridge profiles
  getAll: publicProcedure.query(async () => {
    try {
      const profiles = await prisma.bridgeProfile.findMany({
        include: { server: { select: { id: true, name: true } } },
        orderBy: [{ server_id: "asc" }, { name: "asc" }],
      });
      return { success: true, profiles };
    } catch (error) {
      console.error("Error fetching bridge profiles:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch bridge profiles",
        profiles: [],
      };
    }
  }),

  // Get bridge profiles for a specific server (server-specific + global)
  getForServer: publicProcedure
    .input(z.object({ serverId: z.number().nullable() }))
    .query(async ({ input }) => {
      try {
        const where = input.serverId !== null
          ? { OR: [{ server_id: null }, { server_id: input.serverId }] }
          : { server_id: null };

        const profiles = await prisma.bridgeProfile.findMany({
          where,
          orderBy: [{ name: "asc" }],
        });

        // Deduplicate: server-specific overrides global with same name
        const byName = new Map<string, typeof profiles[0]>();
        for (const p of profiles) {
          const existing = byName.get(p.name);
          if (!existing || (p.server_id !== null && existing.server_id === null)) {
            byName.set(p.name, p);
          }
        }

        return { success: true, profiles: Array.from(byName.values()) };
      } catch (error) {
        console.error("Error fetching bridge profiles for server:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch bridge profiles",
          profiles: [],
        };
      }
    }),

  // Create or update a bridge profile
  upsert: publicProcedure
    .input(upsertSchema)
    .mutation(async ({ input }) => {
      try {
        const { id, name, gateway, nameserver, serverId } = input;

        if (id) {
          // Update existing
          const result = await prisma.bridgeProfile.update({
            where: { id },
            data: { name, gateway, nameserver, server_id: serverId },
          });
          return { success: true, profile: result };
        }

        // Create new — check for duplicate name+server
        const existing = await prisma.bridgeProfile.findFirst({
          where: serverId === null
            ? { name, server_id: null }
            : { name, server_id: serverId },
        });

        if (existing) {
          const result = await prisma.bridgeProfile.update({
            where: { id: existing.id },
            data: { gateway, nameserver },
          });
          return { success: true, profile: result };
        }

        const result = await prisma.bridgeProfile.create({
          data: { name, gateway, nameserver, server_id: serverId },
        });
        return { success: true, profile: result };
      } catch (error) {
        console.error("Error upserting bridge profile:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save bridge profile",
        };
      }
    }),

  // Delete a bridge profile
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await prisma.bridgeProfile.delete({ where: { id: input.id } });
        return { success: true };
      } catch (error) {
        console.error("Error deleting bridge profile:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete bridge profile",
        };
      }
    }),
});
