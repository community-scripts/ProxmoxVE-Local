import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';
import { getDatabase } from '~/server/database-prisma';

export const pbsCredentialsRouter = createTRPCRouter({
  // Get credentials for a specific storage
  getCredentialsForStorage: publicProcedure
    .input(z.object({
      serverId: z.number(),
      storageName: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const credential = await db.getPBSCredential(input.serverId, input.storageName);
        
        if (!credential) {
          return {
            success: false,
            error: 'PBS credentials not found',
            credential: null,
          };
        }
        
        return {
          success: true,
          credential: {
            id: credential.id,
            server_id: credential.server_id,
            storage_name: credential.storage_name,
            pbs_ip: credential.pbs_ip,
            pbs_datastore: credential.pbs_datastore,
            pbs_fingerprint: credential.pbs_fingerprint,
            // Don't return password for security
          },
        };
      } catch (error) {
        console.error('Error in getCredentialsForStorage:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch PBS credentials',
          credential: null,
        };
      }
    }),

  // Get all PBS credentials for a server
  getAllCredentialsForServer: publicProcedure
    .input(z.object({
      serverId: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const db = getDatabase();
        const credentials = await db.getPBSCredentialsByServer(input.serverId);
        
        return {
          success: true,
          credentials: credentials.map(c => ({
            id: c.id,
            server_id: c.server_id,
            storage_name: c.storage_name,
            pbs_ip: c.pbs_ip,
            pbs_datastore: c.pbs_datastore,
            pbs_fingerprint: c.pbs_fingerprint,
            // Don't return password for security
          })),
        };
      } catch (error) {
        console.error('Error in getAllCredentialsForServer:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch PBS credentials',
          credentials: [],
        };
      }
    }),

  // Save/update PBS credentials
  saveCredentials: publicProcedure
    .input(z.object({
      serverId: z.number(),
      storageName: z.string(),
      pbs_ip: z.string(),
      pbs_datastore: z.string(),
      pbs_password: z.string().optional(), // Optional to allow updating without changing password
      pbs_fingerprint: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        
        // If password is not provided, fetch existing credential to preserve password
        let passwordToSave = input.pbs_password;
        if (!passwordToSave) {
          const existing = await db.getPBSCredential(input.serverId, input.storageName);
          if (existing) {
            passwordToSave = existing.pbs_password;
          } else {
            return {
              success: false,
              error: 'Password is required for new credentials',
            };
          }
        }
        
        await db.createOrUpdatePBSCredential({
          server_id: input.serverId,
          storage_name: input.storageName,
          pbs_ip: input.pbs_ip,
          pbs_datastore: input.pbs_datastore,
          pbs_password: passwordToSave,
          pbs_fingerprint: input.pbs_fingerprint,
        });
        
        return {
          success: true,
          message: 'PBS credentials saved successfully',
        };
      } catch (error) {
        console.error('Error in saveCredentials:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save PBS credentials',
        };
      }
    }),

  // Delete PBS credentials
  deleteCredentials: publicProcedure
    .input(z.object({
      serverId: z.number(),
      storageName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDatabase();
        await db.deletePBSCredential(input.serverId, input.storageName);
        
        return {
          success: true,
          message: 'PBS credentials deleted successfully',
        };
      } catch (error) {
        console.error('Error in deleteCredentials:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete PBS credentials',
        };
      }
    }),
});

