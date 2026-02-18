import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";

const installDefaultFields = {
  var_brg: true,
  var_gateway: true,
  var_ns: true,
  var_net_mode: true,
  var_vlan: true,
  var_mtu: true,
  var_ipv6_method: true,
  var_tags: true,
  var_pw: true,
  var_ssh: true,
  var_ssh_authorized_key: true,
  var_nesting: true,
  var_fuse: true,
  var_keyctl: true,
  var_tun: true,
  var_protection: true,
  var_timezone: true,
  var_verbose: true,
  var_apt_cacher: true,
  var_apt_cacher_ip: true,
  var_container_storage: true,
  var_template_storage: true,
} as const;

const upsertSchema = z.object({
  serverId: z.number().nullable(),
  name: z.string().optional(),
  var_brg: z.string().nullable().optional(),
  var_gateway: z.string().nullable().optional(),
  var_ns: z.string().nullable().optional(),
  var_net_mode: z.string().nullable().optional(),
  var_vlan: z.string().nullable().optional(),
  var_mtu: z.number().nullable().optional(),
  var_ipv6_method: z.string().nullable().optional(),
  var_tags: z.string().nullable().optional(),
  var_pw: z.string().nullable().optional(),
  var_ssh: z.string().nullable().optional(),
  var_ssh_authorized_key: z.string().nullable().optional(),
  var_nesting: z.number().nullable().optional(),
  var_fuse: z.number().nullable().optional(),
  var_keyctl: z.number().nullable().optional(),
  var_tun: z.string().nullable().optional(),
  var_protection: z.string().nullable().optional(),
  var_timezone: z.string().nullable().optional(),
  var_verbose: z.string().nullable().optional(),
  var_apt_cacher: z.string().nullable().optional(),
  var_apt_cacher_ip: z.string().nullable().optional(),
  var_container_storage: z.string().nullable().optional(),
  var_template_storage: z.string().nullable().optional(),
});

export const installDefaultsRouter = createTRPCRouter({
  // Get all install defaults (global + per-server)
  getAll: publicProcedure.query(async () => {
    try {
      const defaults = await prisma.installDefault.findMany({
        include: { server: { select: { id: true, name: true } } },
        orderBy: [{ server_id: "asc" }],
      });
      return { success: true, defaults };
    } catch (error) {
      console.error("Error fetching install defaults:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch install defaults",
        defaults: [],
      };
    }
  }),

  // Get merged defaults for a specific server (server > global > null)
  getForServer: publicProcedure
    .input(z.object({ serverId: z.number().nullable() }))
    .query(async ({ input }) => {
      try {
        // Load global defaults (server_id IS NULL)
        const globalDefaults = await prisma.installDefault.findFirst({
          where: { server_id: null },
          select: installDefaultFields,
        });

        // If no specific server requested, return global only
        if (input.serverId === null) {
          return { success: true, defaults: globalDefaults };
        }

        // Load server-specific defaults
        const serverDefaults = await prisma.installDefault.findFirst({
          where: { server_id: input.serverId },
          select: installDefaultFields,
        });

        // Merge: server values override global values; null fields fall back to global
        if (!serverDefaults) {
          return { success: true, defaults: globalDefaults };
        }

        if (!globalDefaults) {
          return { success: true, defaults: serverDefaults };
        }

        // Merge server over global — server non-null values take priority
        const merged: Record<string, string | number | null> = {};
        for (const key of Object.keys(installDefaultFields)) {
          const serverVal = (serverDefaults as Record<string, unknown>)[key];
          const globalVal = (globalDefaults as Record<string, unknown>)[key];
          merged[key] = (serverVal !== null && serverVal !== undefined ? serverVal : globalVal) as string | number | null;
        }

        return { success: true, defaults: merged };
      } catch (error) {
        console.error("Error fetching install defaults for server:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch install defaults",
          defaults: null,
        };
      }
    }),

  // Get raw defaults for a specific server (no merging, for editing)
  getByServerId: publicProcedure
    .input(z.object({ serverId: z.number().nullable() }))
    .query(async ({ input }) => {
      try {
        const defaults = await prisma.installDefault.findFirst({
          where: input.serverId === null ? { server_id: null } : { server_id: input.serverId },
        });
        return { success: true, defaults };
      } catch (error) {
        console.error("Error fetching install defaults:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to fetch install defaults",
          defaults: null,
        };
      }
    }),

  // Create or update install defaults
  upsert: publicProcedure
    .input(upsertSchema)
    .mutation(async ({ input }) => {
      try {
        const { serverId, name, ...fields } = input;

        // Convert undefined to null for all fields
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          data[key] = value === undefined ? null : value;
        }
        if (name) data.name = name;

        const existing = await prisma.installDefault.findFirst({
          where: serverId === null ? { server_id: null } : { server_id: serverId },
        });

        let result;
        if (existing) {
          result = await prisma.installDefault.update({
            where: { id: existing.id },
            data,
          });
        } else {
          result = await prisma.installDefault.create({
            data: {
              ...data,
              server_id: serverId,
              name: (name ?? (serverId === null ? "Global" : "Server Default")) as string,
            },
          });
        }

        return { success: true, defaults: result };
      } catch (error) {
        console.error("Error upserting install defaults:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save install defaults",
        };
      }
    }),

  // Delete install defaults
  delete: publicProcedure
    .input(z.object({ serverId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      try {
        const existing = await prisma.installDefault.findFirst({
          where: input.serverId === null ? { server_id: null } : { server_id: input.serverId },
        });

        if (!existing) {
          return { success: false, error: "Install defaults not found" };
        }

        await prisma.installDefault.delete({ where: { id: existing.id } });
        return { success: true };
      } catch (error) {
        console.error("Error deleting install defaults:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete install defaults",
        };
      }
    }),
});
