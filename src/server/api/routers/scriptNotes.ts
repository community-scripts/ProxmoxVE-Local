import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { PrismaClient } from "../../../../prisma/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/** Get a fresh PrismaClient that definitely includes ScriptNote */
function getNotesDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL ?? "file:./data/pve-scripts.db";
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const scriptNotesRouter = createTRPCRouter({
  /** Get all notes for a specific script */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = getNotesDb();
        const notes = await db.scriptNote.findMany({
          where: { script_slug: input.slug },
          orderBy: { updated_at: "desc" },
        });
        return { success: true, notes };
      } catch {
        return { success: true, notes: [] };
      }
    }),

  /** Create a new note */
  create: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        title: z.string().max(200).optional(),
        content: z.string().min(1).max(10000),
        isShared: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getNotesDb();
      const note = await db.scriptNote.create({
        data: {
          script_slug: input.slug,
          title: input.title ?? "",
          content: input.content,
          is_shared: input.isShared ?? false,
        },
      });
      return { success: true, note };
    }),

  /** Update an existing note */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().max(200).optional(),
        content: z.string().min(1).max(10000).optional(),
        isShared: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getNotesDb();
      const note = await db.scriptNote.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.content !== undefined && { content: input.content }),
          ...(input.isShared !== undefined && { is_shared: input.isShared }),
        },
      });
      return { success: true, note };
    }),

  /** Delete a note */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getNotesDb();
      await db.scriptNote.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Get all shared notes (community notes) */
  getShared: publicProcedure.query(async () => {
    try {
      const db = getNotesDb();
      const notes = await db.scriptNote.findMany({
        where: { is_shared: true },
        orderBy: { updated_at: "desc" },
      });
      return { success: true, notes };
    } catch {
      return { success: true, notes: [] };
    }
  }),
});
