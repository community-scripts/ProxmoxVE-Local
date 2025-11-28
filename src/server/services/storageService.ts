/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-optional-chain, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/prefer-regexp-exec, @typescript-eslint/prefer-for-of */
import { getSSHExecutionService } from '../ssh-execution-service';
import type { Server } from '~/types/server';

export interface Storage {
  name: string;
  type: string;
  content: string[];
  supportsBackup: boolean;
  nodes?: string[];
  [key: string]: any; // For additional storage-specific properties
}

interface CachedStorageData {
  storages: Storage[];
  lastFetched: Date;
}

class StorageService {
  private cache: Map<number, CachedStorageData> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Parse storage.cfg content and extract storage information
   */
  private parseStorageConfig(configContent: string): Storage[] {
    const storages: Storage[] = [];
    const lines = configContent.split('\n');
    
    let currentStorage: Partial<Storage> | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      
      // Check if line is indented (has leading whitespace/tabs) BEFORE trimming
      const isIndented = /^[\s\t]/.test(rawLine);
      const line = rawLine.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // Check if this is a storage definition line (format: "type: name")
      // Storage definitions are NOT indented
      if (!isIndented) {
        const storageMatch = line.match(/^(\w+):\s*(.+)$/);
        if (storageMatch && storageMatch[1] && storageMatch[2]) {
          // Save previous storage if exists
          if (currentStorage && currentStorage.name) {
            storages.push(this.finalizeStorage(currentStorage));
          }
          
          // Start new storage
          currentStorage = {
            type: storageMatch[1],
            name: storageMatch[2],
            content: [],
            supportsBackup: false,
          };
          continue;
        }
      }
      
      // Parse storage properties (indented lines - can be tabs or spaces)
      if (currentStorage && isIndented) {
        // Split on first whitespace (space or tab) to separate key and value
        const match = line.match(/^(\S+)\s+(.+)$/);
        
        if (match && match[1] && match[2]) {
          const key = match[1];
          const value = match[2].trim();
          
          switch (key) {
            case 'content':
              // Content can be comma-separated: "images,rootdir" or "backup"
              currentStorage.content = value.split(',').map(c => c.trim());
              currentStorage.supportsBackup = currentStorage.content.includes('backup');
              break;
            case 'nodes':
              // Nodes can be comma-separated: "prox5" or "prox5,prox6"
              currentStorage.nodes = value.split(',').map(n => n.trim());
              break;
            default:
              // Store other properties
              if (key) {
                (currentStorage as any)[key] = value;
              }
          }
        }
      }
    }
    
    // Don't forget the last storage
    if (currentStorage && currentStorage.name) {
      storages.push(this.finalizeStorage(currentStorage));
    }
    
    return storages;
  }

  /**
   * Finalize storage object with proper typing
   */
  private finalizeStorage(storage: Partial<Storage>): Storage {
    return {
      name: storage.name!,
      type: storage.type!,
      content: storage.content || [],
      supportsBackup: storage.supportsBackup || false,
      nodes: storage.nodes,
      ...Object.fromEntries(
        Object.entries(storage).filter(([key]) => 
          !['name', 'type', 'content', 'supportsBackup', 'nodes'].includes(key)
        )
      ),
    };
  }

  /**
   * Fetch storage configuration from server via SSH
   */
  async fetchStoragesFromServer(server: Server, forceRefresh = false): Promise<Storage[]> {
    const serverId = server.id;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && this.cache.has(serverId)) {
      const cached = this.cache.get(serverId)!;
      const age = Date.now() - cached.lastFetched.getTime();
      
      if (age < this.CACHE_TTL_MS) {
        return cached.storages;
      }
    }
    
    // Fetch from server
    const sshService = getSSHExecutionService();
    let configContent = '';
    
    await new Promise<void>((resolve, reject) => {
      sshService.executeCommand(
        server,
        'cat /etc/pve/storage.cfg',
        (data: string) => {
          configContent += data;
        },
        (error: string) => {
          reject(new Error(`Failed to read storage config: ${error}`));
        },
        (exitCode: number) => {
          if (exitCode === 0) {
            resolve();
          } else {
            reject(new Error(`Command failed with exit code ${exitCode}`));
          }
        }
      );
    });
    
    // Parse and cache
    const storages = this.parseStorageConfig(configContent);
    this.cache.set(serverId, {
      storages,
      lastFetched: new Date(),
    });
    
    return storages;
  }

  /**
   * Get all storages for a server (cached or fresh)
   */
  async getStorages(server: Server, forceRefresh = false): Promise<Storage[]> {
    return this.fetchStoragesFromServer(server, forceRefresh);
  }

  /**
   * Get only backup-capable storages
   */
  async getBackupStorages(server: Server, forceRefresh = false): Promise<Storage[]> {
    const allStorages = await this.getStorages(server, forceRefresh);
    return allStorages.filter(s => s.supportsBackup);
  }

  /**
   * Get PBS storage information (IP and datastore) from storage config
   */
  getPBSStorageInfo(storage: Storage): { pbs_ip: string | null; pbs_datastore: string | null } {
    if (storage.type !== 'pbs') {
      return { pbs_ip: null, pbs_datastore: null };
    }
    
    return {
      pbs_ip: (storage as any).server || null,
      pbs_datastore: (storage as any).datastore || null,
    };
  }

  /**
   * Clear cache for a specific server
   */
  clearCache(serverId: number): void {
    this.cache.delete(serverId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

