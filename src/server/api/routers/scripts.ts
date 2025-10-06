import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { scriptManager } from "~/server/lib/scripts";
import { githubJsonService } from "~/server/services/githubJsonService";
import { localScriptsService } from "~/server/services/localScripts";
import { scriptDownloaderService } from "~/server/services/scriptDownloader";

export const scriptsRouter = createTRPCRouter({
  // Get all available scripts
  getScripts: publicProcedure
    .query(async () => {
      const scripts = await scriptManager.getScripts();
      return {
        scripts,
        directoryInfo: scriptManager.getScriptsDirectoryInfo()
      };
    }),

  // Get CT scripts (for local scripts tab)
  getCtScripts: publicProcedure
    .query(async () => {
      const scripts = await scriptManager.getCtScripts();
      return {
        scripts,
        directoryInfo: scriptManager.getScriptsDirectoryInfo()
      };
    }),

 
  // Get script content for viewing
  getScriptContent: publicProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ input }) => {
      try {
        const { readFile } = await import('fs/promises');
        const { join } = await import('path');
        const { env } = await import('~/env');
        
        const scriptsDir = join(process.cwd(), env.SCRIPTS_DIRECTORY);
        const fullPath = join(scriptsDir, input.path);
        
        // Security check: ensure the path is within the scripts directory
        if (!fullPath.startsWith(scriptsDir)) {
          throw new Error('Invalid script path');
        }
        
        const content = await readFile(fullPath, 'utf-8');
        return { success: true, content };
      } catch (error) {
        console.error('Error reading script content:', error);
        return { success: false, error: 'Failed to read script content' };
      }
    }),

  // Validate script path
  validateScript: publicProcedure
    .input(z.object({ scriptPath: z.string() }))
    .query(async ({ input }) => {
      const validation = scriptManager.validateScriptPath(input.scriptPath);
      return validation;
    }),

  // Get directory information
  getDirectoryInfo: publicProcedure
    .query(async () => {
      return scriptManager.getScriptsDirectoryInfo();
    }),

  // Local script routes (using scripts/json directory)
  // Get all script cards from local directory
  getScriptCards: publicProcedure
    .query(async () => {
      try {
        const cards = await localScriptsService.getScriptCards();
        return { success: true, cards };
      } catch (error) {
        console.error('Error in getScriptCards:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script cards',
          cards: []
        };
      }
    }),

  // Get all scripts from GitHub (1 API call + raw downloads)
  getAllScripts: publicProcedure
    .query(async () => {
      try {
        const scripts = await githubJsonService.getAllScripts();
        return { success: true, scripts };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch scripts',
          scripts: []
        };
      }
    }),

  // Get script by slug from GitHub (1 API call + raw downloads)
  getScriptBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const script = await githubJsonService.getScriptBySlug(input.slug);
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            script: null
          };
        }
        return { success: true, script };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script',
          script: null
        };
      }
    }),

  // Get metadata (categories and other metadata)
  getMetadata: publicProcedure
    .query(async () => {
      try {
        const metadata = await localScriptsService.getMetadata();
        return { success: true, metadata };
      } catch (error) {
        console.error('Error in getMetadata:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch metadata',
          metadata: null
        };
      }
    }),

  // Get script cards with category information
  getScriptCardsWithCategories: publicProcedure
    .query(async () => {
      try {
        const [cards, metadata] = await Promise.all([
          localScriptsService.getScriptCards(),
          localScriptsService.getMetadata()
        ]);

        // Get all scripts to access their categories
        const scripts = await localScriptsService.getAllScripts();
        
        // Create category ID to name mapping
        const categoryMap: Record<number, string> = {};
        if (metadata?.categories) {
          metadata.categories.forEach((cat: any) => {
            categoryMap[cat.id] = cat.name;
          });
        }

        // Enhance cards with category information and additional script data
        const cardsWithCategories = cards.map(card => {
          const script = scripts.find(s => s.slug === card.slug);
          const categoryNames = script?.categories?.map(id => categoryMap[id]).filter(Boolean) ?? [];
          
          return {
            ...card,
            categories: script?.categories ?? [],
            categoryNames,
            // Add date_created from script
            date_created: script?.date_created,
          };
        });

        return { success: true, cards: cardsWithCategories, metadata };
      } catch (error) {
        console.error('Error in getScriptCardsWithCategories:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script cards with categories',
          cards: [],
          metadata: null
        };
      }
    }),

  // Resync scripts from GitHub (1 API call + raw downloads)
  resyncScripts: publicProcedure
    .mutation(async () => {
      try {
        // Sync JSON files using 1 API call + raw downloads
        const result = await githubJsonService.syncJsonFiles();
        
        return { 
          success: result.success, 
          message: result.message,
          count: result.count
        };
      } catch (error) {
        console.error('Error in resyncScripts:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to resync scripts. Make sure REPO_URL is set.',
          count: 0
        };
      }
    }),

  // Load script files from GitHub
  loadScript: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // Get the script details
        const script = await localScriptsService.getScriptBySlug(input.slug);
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            files: []
          };
        }

        // Load the script files
        const result = await scriptDownloaderService.loadScript(script);
        return result;
      } catch (error) {
        console.error('Error in loadScript:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load script',
          files: []
        };
      }
    }),

  // Check if script files exist locally
  checkScriptFiles: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const script = await localScriptsService.getScriptBySlug(input.slug);
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            ctExists: false,
            installExists: false,
            files: []
          };
        }

        const result = await scriptDownloaderService.checkScriptExists(script);
        return {
          success: true,
          ...result
        };
      } catch (error) {
        console.error('Error in checkScriptFiles:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check script files',
          ctExists: false,
          installExists: false,
          files: []
        };
      }
    }),

  // Compare local and remote script content
  compareScriptContent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const script = await localScriptsService.getScriptBySlug(input.slug);
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            hasDifferences: false,
            differences: []
          };
        }

        const result = await scriptDownloaderService.compareScriptContent(script);
        return {
          success: true,
          ...result
        };
      } catch (error) {
        console.error('Error in compareScriptContent:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to compare script content',
          hasDifferences: false,
          differences: []
        };
      }
    }),

  // Get diff content for a specific script file
  getScriptDiff: publicProcedure
    .input(z.object({ slug: z.string(), filePath: z.string() }))
    .query(async ({ input }) => {
      try {
        const script = await localScriptsService.getScriptBySlug(input.slug);
        if (!script) {
          return {
            success: false,
            error: 'Script not found',
            diff: null
          };
        }

        const result = await scriptDownloaderService.getScriptDiff(script, input.filePath);
        return {
          success: true,
          ...result
        };
      } catch (error) {
        console.error('Error in getScriptDiff:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get script diff',
          diff: null
        };
      }
    }),

  // Check if running on Proxmox VE host
  checkProxmoxVE: publicProcedure
    .query(async () => {
      try {
        const { spawn } = await import('child_process');
        
        return new Promise((resolve) => {
          const child = spawn('command', ['-v', 'pveversion'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
          });


          child.on('close', (code) => {
            // If command exits with code 0, pveversion command exists
            if (code === 0) {
              resolve({
                success: true,
                isProxmoxVE: true,
                message: 'Running on Proxmox VE host'
              });
            } else {
              resolve({
                success: true,
                isProxmoxVE: false,
                message: 'Not running on Proxmox VE host'
              });
            }
          });

          child.on('error', (error) => {
            resolve({
              success: false,
              isProxmoxVE: false,
              error: error.message,
              message: 'Failed to check Proxmox VE status'
            });
          });
        });
      } catch (error) {
        console.error('Error in checkProxmoxVE:', error);
        return {
          success: false,
          isProxmoxVE: false,
          error: error instanceof Error ? error.message : 'Failed to check Proxmox VE status',
          message: 'Failed to check Proxmox VE status'
        };
      }
    })
});
