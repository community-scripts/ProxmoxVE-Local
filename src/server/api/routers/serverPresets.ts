import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { PrismaClient } from "../../../../prisma/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function getPresetsDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./data/pve-scripts.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const serverPresetsRouter = createTRPCRouter({
  /** Get all presets for a specific server */
  getByServerId: publicProcedure
    .input(z.object({ serverId: z.number() }))
    .query(async ({ input }) => {
      const db = getPresetsDb();
      const presets = await db.serverPreset.findMany({
        where: { server_id: input.serverId },
        orderBy: { updated_at: "desc" },
      });
      return { success: true, presets };
    }),

  /** Get all presets */
  getAll: publicProcedure.query(async () => {
    const db = getPresetsDb();
    const presets = await db.serverPreset.findMany({
      orderBy: { updated_at: "desc" },
    });
    return { success: true, presets };
  }),

  /** Get a single preset by ID */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getPresetsDb();
      const preset = await db.serverPreset.findUnique({
        where: { id: input.id },
      });
      return { success: true, preset };
    }),

  /** Create a new preset */
  create: publicProcedure
    .input(
      z.object({
        serverId: z.number(),
        name: z.string().min(1).max(100),
        cpu: z.number().int().min(1).optional(),
        ram: z.number().int().min(64).optional(),
        disk: z.number().int().min(1).optional(),
        privileged: z.boolean().optional(),
        bridge: z.string().max(50).optional(),
        vlan: z.string().max(20).optional(),
        dns: z.string().max(200).optional(),
        ssh: z.boolean().optional(),
        nesting: z.boolean().optional(),
        fuse: z.boolean().optional(),
        aptProxyAddr: z.string().max(200).optional(),
        aptProxyOn: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getPresetsDb();
      const preset = await db.serverPreset.create({
        data: {
          server_id: input.serverId,
          name: input.name,
          cpu: input.cpu,
          ram: input.ram,
          disk: input.disk,
          privileged: input.privileged ?? false,
          bridge: input.bridge,
          vlan: input.vlan,
          dns: input.dns,
          ssh: input.ssh ?? false,
          nesting: input.nesting ?? true,
          fuse: input.fuse ?? false,
          apt_proxy_addr: input.aptProxyAddr,
          apt_proxy_on: input.aptProxyOn ?? false,
        },
      });
      return { success: true, preset };
    }),

  /** Update an existing preset */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        cpu: z.number().int().min(1).optional(),
        ram: z.number().int().min(64).optional(),
        disk: z.number().int().min(1).optional(),
        privileged: z.boolean().optional(),
        bridge: z.string().max(50).optional(),
        vlan: z.string().max(20).optional(),
        dns: z.string().max(200).optional(),
        ssh: z.boolean().optional(),
        nesting: z.boolean().optional(),
        fuse: z.boolean().optional(),
        aptProxyAddr: z.string().max(200).optional(),
        aptProxyOn: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const db = getPresetsDb();
      const preset = await db.serverPreset.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.cpu !== undefined && { cpu: data.cpu }),
          ...(data.ram !== undefined && { ram: data.ram }),
          ...(data.disk !== undefined && { disk: data.disk }),
          ...(data.privileged !== undefined && { privileged: data.privileged }),
          ...(data.bridge !== undefined && { bridge: data.bridge }),
          ...(data.vlan !== undefined && { vlan: data.vlan }),
          ...(data.dns !== undefined && { dns: data.dns }),
          ...(data.ssh !== undefined && { ssh: data.ssh }),
          ...(data.nesting !== undefined && { nesting: data.nesting }),
          ...(data.fuse !== undefined && { fuse: data.fuse }),
          ...(data.aptProxyAddr !== undefined && { apt_proxy_addr: data.aptProxyAddr }),
          ...(data.aptProxyOn !== undefined && { apt_proxy_on: data.aptProxyOn }),
        },
      });
      return { success: true, preset };
    }),

  /** Delete a preset */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getPresetsDb();
      await db.serverPreset.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
