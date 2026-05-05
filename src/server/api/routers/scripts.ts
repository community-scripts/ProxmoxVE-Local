 
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { scriptManager } from "~/server/lib/scripts";
import { scriptDownloaderService } from "~/server/services/scriptDownloader.js";
import { AutoSyncService } from "~/server/services/autoSyncService";
import { getStorageService } from "~/server/services/storageService";
import { getDatabase } from "~/server/database-prisma";
import { logger } from "~/server/logging/logger";
import {
  getScriptCards,
  getScriptBySlug as pbGetScriptBySlug,
  getAllScripts as pbGetAllScripts,
  getMetadata as pbGetMetadata,
  invalidatePbCache,
  type PBScript,
  type PBScriptCard,
} from "~/server/services/pbScripts";
import type { Script, ScriptCard } from "~/types/script";
import type { Server } from "~/types/server";
import { cacheLogos, getLocalLogoPath } from "~/server/services/logoCacheService";

// Script types not yet supported in PVE-Local
const UNSUPPORTED_TYPES = [] as const;

// ---------------------------------------------------------------------------
// Mapper: PocketBase record → internal Script type (used by scriptDownloader)
// ---------------------------------------------------------------------------
function pbToScript(pb: PBScript): Script {
  return {
    name: pb.name,
    slug: pb.slug,
    categories: pb.categories.map((c) => c.name),
    date_created: pb.script_created,
    type: pb.type,
    updateable: pb.updateable,
    privileged: pb.privileged,
    interface_port: pb.port,
    documentation: pb.documentation,
    website: pb.website,
    logo: pb.logo,
    config_path: pb.config_path,
    description: pb.description,
    install_methods: pb.install_methods.map((m) => ({
      type: m.type,
      resources: m.resources,
      config_path: m.config_path,
      script: scriptDownloaderService.deriveScriptPath(pb.type, m.type, pb.slug) ?? undefined,
    })),
    default_credentials: {
      username: pb.default_user,
      password: pb.default_passwd,
    },
    notes: pb.notes,
    is_dev: pb.is_dev,
    is_disabled: pb.is_disabled,
    is_deleted: pb.is_deleted,
    has_arm: pb.has_arm,
    version: pb.version,
    execute_in: pb.execute_in,
  };
}

function pbCardToScriptCard(pb: PBScriptCard): ScriptCard {
  return {
    name: pb.name,
    slug: pb.slug,
    description: pb.description,
    logo: pb.logo,
    type: pb.type,
    updateable: pb.updateable,
    website: pb.website,
    categoryNames: pb.categories.map((c) => c.name),
    date_created: pb.script_created,
    date_updated: pb.script_updated,
    interface_port: pb.port,
    is_dev: pb.is_dev,
    is_disabled: pb.is_disabled,
    is_deleted: pb.is_deleted,
    has_arm: pb.has_arm,
    // Derive install basenames from type + slug (same convention as the website)
    install_basenames: deriveInstallBasenames(pb.type, pb.slug),
  };
}

/**
 * Derive the expected install file basenames from script type + slug.
 * Mirrors ProxmoxVE-Frontend/lib/install-command.ts conventions.
 */
function deriveInstallBasenames(type: string, slug: string): string[] {
  const t = (type || "ct").toLowerCase().trim();
  const basenames: string[] = [];

  if (t === "ct" || t === "lxc") {
    basenames.push(slug); // ct/{slug}.sh
    basenames.push(`alpine-${slug}`); // ct/alpine-{slug}.sh (optional)
  } else if (t === "pve") {
    basenames.push(slug); // tools/pve/{slug}.sh
  } else if (t === "addon") {
    basenames.push(slug); // tools/addon/{slug}.sh
  } else if (t === "vm") {
    basenames.push(slug); // vm/{slug}.sh
  } else if (t === "turnkey") {
    basenames.push(slug); // turnkey/{slug}.sh
  } else {
    basenames.push(slug);
  }

  return basenames;
}

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

  // Get all downloaded scripts from all directories
  getAllDownloadedScripts: publicProcedure
    .query(async () => {
      const scripts = await scriptManager.getAllDownloadedScripts();
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
        logger.error('Error reading script content:', undefined, error);
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

  // Local script routes (using PocketBase)
  // Get all script cards for the UI listing
  getScriptCards: publicProcedure
    .query(async () => {
      try {
        const cards = await getScriptCards();
        return {
          success: true,
          cards: cards.map((c) => {
            const card = pbCardToScriptCard(c);
            card.logo = getLocalLogoPath(c.slug, card.logo);
            return card;
          }),
        };
      } catch (error) {
        logger.error('Error in getScriptCards:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script cards',
          cards: []
        };
      }
    }),

  // Get all scripts from PocketBase
  getAllScripts: publicProcedure
    .query(async () => {
      try {
        const pbScripts = await pbGetAllScripts();
        return { success: true, scripts: pbScripts.map(pbToScript) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch scripts',
          scripts: []
        };
      }
    }),

  // Get script by slug from PocketBase
  getScriptBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', script: null };
        }
        const script = pbToScript(pb);
        script.logo = getLocalLogoPath(pb.slug, script.logo);
        return { success: true, script };
      } catch (error) {
        logger.error('Error in getScriptBySlug:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script',
          script: null
        };
      }
    }),

  // Get metadata (categories and script types) from PocketBase
  getMetadata: publicProcedure
    .query(async () => {
      try {
        const metadata = await pbGetMetadata();
        return { success: true, metadata };
      } catch (error) {
        logger.error('Error in getMetadata:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch metadata',
          metadata: null
        };
      }
    }),

  // Get script cards with category information from PocketBase
  getScriptCardsWithCategories: publicProcedure
    .query(async () => {
      try {
        // Fetch cards and metadata in parallel (both hit PocketBase)
        const [cards, metadata] = await Promise.all([
          getScriptCards(),
          pbGetMetadata(),
        ]);

        const scriptCards = cards.map((c) => {
          const card = pbCardToScriptCard(c);
          card.logo = getLocalLogoPath(c.slug, card.logo);
          return card;
        });

        return { success: true, cards: scriptCards, metadata };
      } catch (error) {
        logger.error('Error in getScriptCardsWithCategories:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch script cards with categories',
          cards: [],
          metadata: null
        };
      }
    }),

  // Sync: cache logos locally from PocketBase script data
  resyncScripts: publicProcedure
    .mutation(async () => {
      try {
        // Invalidate server-side PB cache so fresh data is fetched
        invalidatePbCache();

        const cards = await getScriptCards();
        const entries = cards
          .filter((c) => c.logo)
          .map((c) => ({ slug: c.slug, url: c.logo! }));
        const result = await cacheLogos(entries);
        return {
          success: true,
          message: `Logo cache updated: ${result.downloaded} downloaded, ${result.skipped} cached, ${result.errors} errors.`,
          count: result.downloaded,
          error: undefined as string | undefined,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to sync logos',
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Load script files from the community repository
  loadScript: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', files: [] };
        }
        if (UNSUPPORTED_TYPES.includes(pb.type as typeof UNSUPPORTED_TYPES[number])) {
          return { success: false, error: `Script type '${pb.type}' is not supported yet`, files: [] };
        }
        const result = await scriptDownloaderService.loadScript(pbToScript(pb));
        return result;
      } catch (error) {
        logger.error('Error in loadScript:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load script',
          files: []
        };
      }
    }),

  // Load multiple scripts from the community repository
  loadMultipleScripts: publicProcedure
    .input(z.object({ slugs: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      try {
        const successful: { slug: string; files: unknown[] }[] = [];
        const failed: { slug: string; error: string }[] = [];

        // Process in batches to avoid GitHub rate limits
        const BATCH_SIZE = 5;
        for (let i = 0; i < input.slugs.length; i += BATCH_SIZE) {
          const batch = input.slugs.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (slug) => {
              const pb = await pbGetScriptBySlug(slug);
              if (!pb) {
                throw Object.assign(new Error('Script not found'), { slug });
              }
              if (UNSUPPORTED_TYPES.includes(pb.type as typeof UNSUPPORTED_TYPES[number])) {
                throw Object.assign(new Error(`Script type '${pb.type}' is not supported yet`), { slug });
              }
              const result = await scriptDownloaderService.loadScript(pbToScript(pb));
              if (!result.success) {
                const error = 'error' in result ? result.error : 'Failed to load script';
                throw Object.assign(new Error(String(error)), { slug });
              }
              return { slug, files: result.files };
            }),
          );

          for (const [idx, result] of results.entries()) {
            const slug = batch[idx]!;
            if (result.status === 'fulfilled') {
              successful.push(result.value);
            } else {
              failed.push({
                slug,
                error: result.reason instanceof Error ? result.reason.message : 'Failed to load script',
              });
            }
          }

          // Small delay between batches to stay under rate limits
          if (i + BATCH_SIZE < input.slugs.length) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        return {
          success: true,
          message: `Downloaded ${successful.length} scripts successfully, ${failed.length} failed`,
          successful,
          failed,
          total: input.slugs.length
        };
      } catch (error) {
        logger.error('Error in loadMultipleScripts:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load multiple scripts',
          successful: [],
          failed: [],
          total: 0
        };
      }
    }),

  // Check if script files exist locally
  checkScriptFiles: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', ctExists: false, installExists: false, files: [] };
        }
        const result = await scriptDownloaderService.checkScriptExists(pbToScript(pb));
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in checkScriptFiles:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check script files',
          ctExists: false,
          installExists: false,
          files: []
        };
      }
    }),

  // Delete script files
  deleteScript: publicProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', deletedFiles: [] };
        }
        const result = await scriptDownloaderService.deleteScript(pbToScript(pb));
        return result;
      } catch (error) {
        logger.error('Error in deleteScript:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete script',
          deletedFiles: []
        };
      }
    }),

  // Compare local and remote script content
  compareScriptContent: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      try {
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', hasDifferences: false, differences: [] };
        }
        const result = await scriptDownloaderService.compareScriptContent(pbToScript(pb));
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in compareScriptContent:', undefined, error);
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
        const pb = await pbGetScriptBySlug(input.slug);
        if (!pb) {
          return { success: false, error: 'Script not found', diff: null };
        }
        const result = await scriptDownloaderService.getScriptDiff(pbToScript(pb), input.filePath);
        return { success: true, ...result };
      } catch (error) {
        logger.error('Error in getScriptDiff:', undefined, error);
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
        logger.error('Error in checkProxmoxVE:', undefined, error);
        return {
          success: false,
          isProxmoxVE: false,
          error: error instanceof Error ? error.message : 'Failed to check Proxmox VE status',
          message: 'Failed to check Proxmox VE status'
        };
      }
    }),

  // Auto-sync settings and operations
  getAutoSyncSettings: publicProcedure
    .query(async () => {
      try {
        const autoSyncService = new AutoSyncService();
        const settings = autoSyncService.loadSettings();
        return { success: true, settings };
      } catch (error) {
        logger.error('Error getting auto-sync settings:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get auto-sync settings',
          settings: null
        };
      }
    }),

  saveAutoSyncSettings: publicProcedure
    .input(z.object({
      autoSyncEnabled: z.boolean(),
      syncIntervalType: z.enum(['predefined', 'custom']),
      syncIntervalPredefined: z.string().optional(),
      syncIntervalCron: z.string().optional(),
      autoDownloadNew: z.boolean(),
      autoUpdateExisting: z.boolean(),
      notificationEnabled: z.boolean(),
      appriseUrls: z.array(z.string()).optional()
    }))
    .mutation(async ({ input }) => {
      try {
        // Use the global auto-sync service instance
        const { getAutoSyncService, setAutoSyncService } = await import('~/server/lib/autoSyncInit');
        let autoSyncService = getAutoSyncService();
        
        // If no global instance exists, create one
        if (!autoSyncService) {
          const { AutoSyncService } = await import('~/server/services/autoSyncService');
          autoSyncService = new AutoSyncService();
          setAutoSyncService(autoSyncService);
        }
        
        // Save settings to both .env file and service instance
        autoSyncService.saveSettings(input);
        
        // Reschedule auto-sync if enabled
        if (input.autoSyncEnabled) {
          autoSyncService.scheduleAutoSync();
          logger.info('Auto-sync rescheduled with new settings');
        } else {
          autoSyncService.stopAutoSync();
          // Ensure the service is completely stopped and won't restart
          autoSyncService.isRunning = false;
          logger.info('Auto-sync stopped');
        }
        
        return { success: true, message: 'Auto-sync settings saved successfully' };
      } catch (error) {
        logger.error('Error saving auto-sync settings', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save auto-sync settings'
        };
      }
    }),

  testNotification: publicProcedure
    .mutation(async () => {
      try {
        const autoSyncService = new AutoSyncService();
        const result = await autoSyncService.testNotification();
        return result;
      } catch (error) {
        logger.error('Error testing notification', undefined, error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to test notification'
        };
      }
    }),

  triggerManualAutoSync: publicProcedure
    .mutation(async () => {
      try {
        const autoSyncService = new AutoSyncService();
        const result = await autoSyncService.executeAutoSync();
        return {
          success: true,
          message: 'Manual auto-sync completed successfully',
          result
        };
      } catch (error) {
        logger.error('Error in manual auto-sync:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute manual auto-sync',
          result: null
        };
      }
    }),

  getAutoSyncStatus: publicProcedure
    .query(async () => {
      try {
        const autoSyncService = new AutoSyncService();
        const status = autoSyncService.getStatus();
        return { success: true, status };
      } catch (error) {
        logger.error('Error getting auto-sync status:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get auto-sync status',
          status: null
        };
      }
    }),

  // Get rootfs storages for a server (for container creation)
  getRootfsStorages: publicProcedure
    .input(z.object({ 
      serverId: z.number(),
      forceRefresh: z.boolean().optional().default(false)
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.serverId);
        
        if (!server) {
          return {
            success: false,
            error: 'Server not found',
            storages: []
          };
        }

        // Get server hostname to filter storages by node assignment
        const { getSSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshExecutionService = getSSHExecutionService();
        let serverHostname = '';
        try {
          await new Promise<void>((resolve, reject) => {
            void sshExecutionService.executeCommand(
              server as Server,
              'hostname',
              (data: string) => {
                serverHostname += data;
              },
              (error: string) => {
                reject(new Error(`Failed to get hostname: ${error}`));
              },
              (exitCode: number) => {
                if (exitCode === 0) {
                  resolve();
                } else {
                  reject(new Error(`hostname command failed with exit code ${exitCode}`));
                }
              }
            );
          });
        } catch (error) {
          logger.error('Error getting server hostname:', undefined, error);
          // Continue without filtering if hostname can't be retrieved
        }
        
        const normalizedHostname = serverHostname.trim().toLowerCase();

        const storageService = getStorageService();
        const allStorages = await storageService.getStorages(server as Server, input.forceRefresh);
        
        // Filter storages by node hostname matching and content type (rootdir for containers)
        const rootfsStorages = allStorages.filter(storage => {
          // Check content type - must have rootdir for containers
          const hasRootdir = storage.content.includes('rootdir');
          if (!hasRootdir) {
            return false;
          }
          
          // If storage has no nodes specified, it's available on all nodes
          if (!storage.nodes || storage.nodes.length === 0) {
            return true;
          }
          
          // If we couldn't get hostname, include all storages (fallback)
          if (!normalizedHostname) {
            return true;
          }
          
          // Check if server hostname is in the nodes array (case-insensitive, trimmed)
          const normalizedNodes = storage.nodes.map(node => node.trim().toLowerCase());
          return normalizedNodes.includes(normalizedHostname);
        });

        return {
          success: true,
          storages: rootfsStorages.map(s => ({
            name: s.name,
            type: s.type,
            content: s.content
          }))
        };
      } catch (error) {
        logger.error('Error fetching rootfs storages:', undefined, error);
        // Return empty array on error (as per plan requirement)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch storages',
          storages: []
        };
      }
    }),

  // Get template storages for a server (for template storage selection)
  getTemplateStorages: publicProcedure
    .input(z.object({ 
      serverId: z.number(),
      forceRefresh: z.boolean().optional().default(false)
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const server = await db.getServerById(input.serverId);
        
        if (!server) {
          return {
            success: false,
            error: 'Server not found',
            storages: []
          };
        }

        // Get server hostname to filter storages by node assignment
        const { getSSHExecutionService } = await import('~/server/ssh-execution-service');
        const sshExecutionService = getSSHExecutionService();
        let serverHostname = '';
        try {
          await new Promise<void>((resolve, reject) => {
            void sshExecutionService.executeCommand(
              server as Server,
              'hostname',
              (data: string) => {
                serverHostname += data;
              },
              (error: string) => {
                reject(new Error(`Failed to get hostname: ${error}`));
              },
              (exitCode: number) => {
                if (exitCode === 0) {
                  resolve();
                } else {
                  reject(new Error(`hostname command failed with exit code ${exitCode}`));
                }
              }
            );
          });
        } catch (error) {
          logger.error('Error getting server hostname:', undefined, error);
          // Continue without filtering if hostname can't be retrieved
        }
        
        const normalizedHostname = serverHostname.trim().toLowerCase();

        const storageService = getStorageService();
        const allStorages = await storageService.getStorages(server as Server, input.forceRefresh);
        
        // Filter storages by node hostname matching and content type (vztmpl for templates)
        const templateStorages = allStorages.filter(storage => {
          // Check content type - must have vztmpl for templates
          const hasVztmpl = storage.content.includes('vztmpl');
          if (!hasVztmpl) {
            return false;
          }
          
          // If storage has no nodes specified, it's available on all nodes
          if (!storage.nodes || storage.nodes.length === 0) {
            return true;
          }
          
          // If we couldn't get hostname, include all storages (fallback)
          if (!normalizedHostname) {
            return true;
          }
          
          // Check if server hostname is in the nodes array (case-insensitive, trimmed)
          const normalizedNodes = storage.nodes.map(node => node.trim().toLowerCase());
          return normalizedNodes.includes(normalizedHostname);
        });

        return {
          success: true,
          storages: templateStorages.map(s => ({
            name: s.name,
            type: s.type,
            content: s.content
          }))
        };
      } catch (error) {
        logger.error('Error fetching template storages:', undefined, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch storages',
          storages: []
        };
      }
    })
});
