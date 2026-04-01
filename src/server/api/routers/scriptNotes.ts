import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { prisma } from "~/server/db";

export const scriptNotesRouter = createTRPCRouter({
  /** Get all notes for a specific script */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const notes = await prisma.scriptNote.findMany({
        where: { script_slug: input.slug },
        orderBy: { updated_at: "desc" },
      });
      return { success: true, notes };
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
      const note = await prisma.scriptNote.create({
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
      const note = await prisma.scriptNote.update({
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
      await prisma.scriptNote.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /** Get all shared notes (community notes) */
  getShared: publicProcedure.query(async () => {
    const notes = await prisma.scriptNote.findMany({
      where: { is_shared: true },
      orderBy: { updated_at: "desc" },
    });
    return { success: true, notes };
  }),
});
