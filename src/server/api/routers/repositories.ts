import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { repositoryService } from "~/server/services/repositoryService";

export const repositoriesRouter = createTRPCRouter({
  // Get all repositories
  getAll: publicProcedure.query(async () => {
    try {
      const repositories = await repositoryService.getAllRepositories();
      return {
        success: true,
        repositories
      };
    } catch (error) {
      console.error('Error fetching repositories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch repositories',
        repositories: []
      };
    }
  }),

  // Get enabled repositories
  getEnabled: publicProcedure.query(async () => {
    try {
      const repositories = await repositoryService.getEnabledRepositories();
      return {
        success: true,
        repositories
      };
    } catch (error) {
      console.error('Error fetching enabled repositories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch enabled repositories',
        repositories: []
      };
    }
  }),

  // Create a new repository
  create: publicProcedure
    .input(z.object({
      url: z.string().url(),
      enabled: z.boolean().optional().default(true),
      priority: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const repository = await repositoryService.createRepository({
          url: input.url,
          enabled: input.enabled,
          priority: input.priority
        });
        return {
          success: true,
          repository
        };
      } catch (error) {
        console.error('Error creating repository:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create repository'
        };
      }
    }),

  // Update a repository
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean().optional(),
      url: z.string().url().optional(),
      priority: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        const { id, ...data } = input;
        const repository = await repositoryService.updateRepository(id, data);
        return {
          success: true,
          repository
        };
      } catch (error) {
        console.error('Error updating repository:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update repository'
        };
      }
    }),

  // Delete a repository
  delete: publicProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input }) => {
      try {
        await repositoryService.deleteRepository(input.id);
        return {
          success: true
        };
      } catch (error) {
        console.error('Error deleting repository:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete repository'
        };
      }
    })
});

