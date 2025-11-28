import { prisma } from './db';
import { join } from 'path';
import { writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'fs';
import { existsSync } from 'fs';
import type { CreateServerData } from '../types/server';
import type { Prisma } from '../../prisma/generated/prisma/client';

// Type definitions based on Prisma schema
type Server = {
  id: number;
  name: string;
  ip: string;
  user: string;
  password: string | null;
  auth_type: string | null;
  ssh_key: string | null;
  ssh_key_passphrase: string | null;
  ssh_port: number | null;
  color: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  ssh_key_path: string | null;
  key_generated: boolean | null;
};

type InstalledScript = {
  id: number;
  script_name: string;
  script_path: string;
  container_id: string | null;
  server_id: number | null;
  execution_mode: string;
  installation_date: Date | null;
  status: string;
  output_log: string | null;
  web_ui_ip: string | null;
  web_ui_port: number | null;
};

type InstalledScriptWithServer = InstalledScript & {
  server: Server | null;
};

type LXCConfig = {
  id: number;
  installed_script_id: number;
  arch: string | null;
  cores: number | null;
  memory: number | null;
  hostname: string | null;
  swap: number | null;
  onboot: number | null;
  ostype: string | null;
  unprivileged: number | null;
  net_name: string | null;
  net_bridge: string | null;
  net_hwaddr: string | null;
  net_ip_type: string | null;
  net_ip: string | null;
  net_gateway: string | null;
  net_type: string | null;
  net_vlan: number | null;
  rootfs_storage: string | null;
  rootfs_size: string | null;
  feature_keyctl: number | null;
  feature_nesting: number | null;
  feature_fuse: number | null;
  feature_mount: string | null;
  tags: string | null;
  advanced_config: string | null;
  synced_at: Date | null;
  config_hash: string | null;
  created_at: Date;
  updated_at: Date;
};

type Backup = {
  id: number;
  container_id: string;
  server_id: number;
  hostname: string;
  backup_name: string;
  backup_path: string;
  size: bigint | null;
  created_at: Date | null;
  storage_name: string;
  storage_type: string;
  discovered_at: Date;
};

type BackupWithServer = Backup & {
  server: Server | null;
};

type PBSStorageCredential = {
  id: number;
  server_id: number;
  storage_name: string;
  pbs_ip: string;
  pbs_datastore: string;
  pbs_password: string;
  pbs_fingerprint: string;
  created_at: Date;
  updated_at: Date;
};

type LXCConfigInput = Partial<Omit<LXCConfig, 'id' | 'installed_script_id' | 'created_at' | 'updated_at'>>;

class DatabaseServicePrisma {
  constructor() {
    this.init();
  }

  init(): void {
    // Ensure data/ssh-keys directory exists (recursive to create parent dirs)
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    if (!existsSync(sshKeysDir)) {
      mkdirSync(sshKeysDir, { recursive: true, mode: 0o700 });
    }
  }

  // Server CRUD operations
  async createServer(serverData: CreateServerData): Promise<Server> {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    const normalizedPort = ssh_port !== undefined ? parseInt(String(ssh_port), 10) : 22;
    
    let ssh_key_path: string | null = null;
    
    // If using SSH key authentication, create persistent key file
    if (auth_type === 'key' && ssh_key) {
      const serverId = await this.getNextServerId();
      ssh_key_path = this.createSSHKeyFile(serverId, ssh_key);
    }
    
    const result = await prisma.server.create({
      data: {
        name,
        ip,
        user,
        password,
        auth_type: auth_type ?? 'password',
        ssh_key,
        ssh_key_passphrase,
        ssh_port: Number.isNaN(normalizedPort) ? 22 : normalizedPort,
        ssh_key_path,
        key_generated: Boolean(key_generated),
        color,
      }
    });
    return result as Server;
  }

  async getAllServers(): Promise<Server[]> {
    const result = await prisma.server.findMany({
      orderBy: { created_at: 'desc' }
    });
    return result as Server[];
  }

  async getServerById(id: number): Promise<Server | null> {
    const result = await prisma.server.findUnique({
      where: { id }
    });
    return result as Server | null;
  }

  async updateServer(id: number, serverData: CreateServerData): Promise<Server> {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    const normalizedPort = ssh_port !== undefined ? parseInt(String(ssh_port), 10) : undefined;
    
    // Get existing server to check for key changes
    const existingServer = await this.getServerById(id);
    let ssh_key_path = existingServer?.ssh_key_path ?? null;
    
    // Handle SSH key changes
    if (auth_type === 'key' && ssh_key) {
      // Delete old key file if it exists
      if (existingServer?.ssh_key_path && existsSync(existingServer.ssh_key_path)) {
        try {
          unlinkSync(existingServer.ssh_key_path);
          // Also delete public key file if it exists
          const pubKeyPath = existingServer.ssh_key_path + '.pub';
          if (existsSync(pubKeyPath)) {
            unlinkSync(pubKeyPath);
          }
        } catch (error) {
          console.warn('Failed to delete old SSH key file:', error);
        }
      }
      
      // Create new key file
      ssh_key_path = this.createSSHKeyFile(id, ssh_key);
    } else if (auth_type !== 'key') {
      // If switching away from key auth, delete key files
      if (existingServer?.ssh_key_path && existsSync(existingServer.ssh_key_path)) {
        try {
          unlinkSync(existingServer.ssh_key_path);
          const pubKeyPath = existingServer.ssh_key_path + '.pub';
          if (existsSync(pubKeyPath)) {
            unlinkSync(pubKeyPath);
          }
        } catch (error) {
          console.warn('Failed to delete SSH key file:', error);
        }
      }
      ssh_key_path = null;
    }
    
    const result = await prisma.server.update({
      where: { id },
      data: {
        name,
        ip,
        user,
        password,
        auth_type: auth_type ?? 'password',
        ssh_key,
        ssh_key_passphrase,
        ssh_port: normalizedPort ?? 22,
        ssh_key_path,
        key_generated: key_generated !== undefined ? Boolean(key_generated) : (existingServer?.key_generated ?? false),
        color,
      }
    });
    return result as Server;
  }

  async deleteServer(id: number): Promise<Server> {
    // Get server info before deletion to clean up key files
    const server = await this.getServerById(id);
    
    // Delete SSH key files if they exist
    if (server?.ssh_key_path && existsSync(server.ssh_key_path)) {
      try {
        unlinkSync(server.ssh_key_path);
        const pubKeyPath = server.ssh_key_path + '.pub';
        if (existsSync(pubKeyPath)) {
          unlinkSync(pubKeyPath);
        }
      } catch (error) {
        console.warn('Failed to delete SSH key file:', error);
      }
    }
    
    const result = await prisma.server.delete({
      where: { id }
    });
    return result as Server;
  }

  // Installed Scripts CRUD operations
  async createInstalledScript(scriptData: {
    script_name: string;
    script_path: string;
    container_id?: string;
    server_id?: number;
    execution_mode: string;
    status: 'in_progress' | 'success' | 'failed';
    output_log?: string;
    web_ui_ip?: string;
    web_ui_port?: number;
  }): Promise<InstalledScript> {
    const { script_name, script_path, container_id, server_id, execution_mode, status, output_log, web_ui_ip, web_ui_port } = scriptData;
    
    const result = await prisma.installedScript.create({
      data: {
        script_name,
        script_path,
        container_id: container_id ?? null,
        server_id: server_id ?? null,
        execution_mode,
        status,
        output_log: output_log ?? null,
        web_ui_ip: web_ui_ip ?? null,
        web_ui_port: web_ui_port ?? null,
      }
    });
    return result as InstalledScript;
  }

  async getAllInstalledScripts(): Promise<InstalledScriptWithServer[]> {
    const result = await prisma.installedScript.findMany({
      include: {
        server: true
      },
      orderBy: { installation_date: 'desc' }
    });
    return result as InstalledScriptWithServer[];
  }

  async getInstalledScriptById(id: number): Promise<InstalledScriptWithServer | null> {
    const result = await prisma.installedScript.findUnique({
      where: { id },
      include: {
        server: true
      }
    });
    return result as InstalledScriptWithServer | null;
  }

  async getInstalledScriptsByServer(server_id: number): Promise<InstalledScriptWithServer[]> {
    const result = await prisma.installedScript.findMany({
      where: { server_id },
      include: {
        server: true
      },
      orderBy: { installation_date: 'desc' }
    });
    return result as InstalledScriptWithServer[];
  }

  async updateInstalledScript(id: number, updateData: {
    script_name?: string;
    container_id?: string;
    status?: 'in_progress' | 'success' | 'failed';
    output_log?: string;
    web_ui_ip?: string;
    web_ui_port?: number;
  }): Promise<InstalledScript | { changes: number }> {
    const { script_name, container_id, status, output_log, web_ui_ip, web_ui_port } = updateData;
    
    const updateFields: Prisma.InstalledScriptUpdateInput = {};
    if (script_name !== undefined) updateFields.script_name = script_name;
    if (container_id !== undefined) updateFields.container_id = container_id;
    if (status !== undefined) updateFields.status = status;
    if (output_log !== undefined) updateFields.output_log = output_log;
    if (web_ui_ip !== undefined) updateFields.web_ui_ip = web_ui_ip;
    if (web_ui_port !== undefined) updateFields.web_ui_port = web_ui_port;

    if (Object.keys(updateFields).length === 0) {
      return { changes: 0 };
    }

    const result = await prisma.installedScript.update({
      where: { id },
      data: updateFields
    });
    return result as InstalledScript;
  }

  async deleteInstalledScript(id: number): Promise<InstalledScript> {
    const result = await prisma.installedScript.delete({
      where: { id }
    });
    return result as InstalledScript;
  }

  async deleteInstalledScriptsByServer(server_id: number): Promise<{ count: number }> {
    const result = await prisma.installedScript.deleteMany({
      where: { server_id }
    });
    return result as { count: number };
  }

  async getNextServerId(): Promise<number> {
    const result = await prisma.server.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    return ((result as { id: number } | null)?.id ?? 0) + 1;
  }

  createSSHKeyFile(serverId: number, sshKey: string): string {
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    const keyPath = join(sshKeysDir, `server_${serverId}_key`);
    
    // Normalize the key: trim any trailing whitespace and ensure exactly one newline at the end
    const normalizedKey = sshKey.trimEnd() + '\n';
    writeFileSync(keyPath, normalizedKey);
    chmodSync(keyPath, 0o600); // Set proper permissions
    
    return keyPath;
  }

  // LXC Config CRUD operations
  async createLXCConfig(scriptId: number, configData: LXCConfigInput): Promise<LXCConfig> {
    const result = await prisma.lXCConfig.create({
      data: {
        installed_script_id: scriptId,
        ...configData
      }
    });
    return result as LXCConfig;
  }

  async updateLXCConfig(scriptId: number, configData: LXCConfigInput): Promise<LXCConfig> {
    const result = await prisma.lXCConfig.upsert({
      where: { installed_script_id: scriptId },
      update: configData,
      create: {
        installed_script_id: scriptId,
        ...configData
      }
    });
    return result as LXCConfig;
  }

  async getLXCConfigByScriptId(scriptId: number): Promise<LXCConfig | null> {
    const result = await prisma.lXCConfig.findUnique({
      where: { installed_script_id: scriptId }
    });
    return result as LXCConfig | null;
  }

  async deleteLXCConfig(scriptId: number): Promise<void> {
    await prisma.lXCConfig.delete({
      where: { installed_script_id: scriptId }
    });
  }

  // Backup CRUD operations
  async createOrUpdateBackup(backupData: {
    container_id: string;
    server_id: number;
    hostname: string;
    backup_name: string;
    backup_path: string;
    size?: bigint;
    created_at?: Date;
    storage_name: string;
    storage_type: 'local' | 'storage' | 'pbs';
  }): Promise<Backup> {
    // Find existing backup by container_id, server_id, and backup_path
    const existing = await prisma.backup.findFirst({
      where: {
        container_id: backupData.container_id,
        server_id: backupData.server_id,
        backup_path: backupData.backup_path,
      },
    }) as Backup | null;

    if (existing) {
      // Update existing backup
      const result = await prisma.backup.update({
        where: { id: existing.id },
        data: {
          hostname: backupData.hostname,
          backup_name: backupData.backup_name,
          size: backupData.size,
          created_at: backupData.created_at,
          storage_name: backupData.storage_name,
          storage_type: backupData.storage_type,
          discovered_at: new Date(),
        },
      });
      return result as Backup;
    } else {
      // Create new backup
      const result = await prisma.backup.create({
        data: {
          container_id: backupData.container_id,
          server_id: backupData.server_id,
          hostname: backupData.hostname,
          backup_name: backupData.backup_name,
          backup_path: backupData.backup_path,
          size: backupData.size,
          created_at: backupData.created_at,
          storage_name: backupData.storage_name,
          storage_type: backupData.storage_type,
          discovered_at: new Date(),
        },
      });
      return result as Backup;
    }
  }

  async getAllBackups(): Promise<BackupWithServer[]> {
    const result = await prisma.backup.findMany({
      include: {
        server: true,
      },
      orderBy: [
        { container_id: 'asc' },
        { created_at: 'desc' },
      ],
    });
    return result as BackupWithServer[];
  }

  async getBackupById(id: number): Promise<BackupWithServer | null> {
    const result = await prisma.backup.findUnique({
      where: { id },
      include: {
        server: true,
      },
    });
    return result as BackupWithServer | null;
  }

  async getBackupsByContainerId(containerId: string): Promise<BackupWithServer[]> {
    const result = await prisma.backup.findMany({
      where: { container_id: containerId },
      include: {
        server: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return result as BackupWithServer[];
  }

  async deleteBackupsForContainer(containerId: string, serverId: number): Promise<{ count: number }> {
    const result = await prisma.backup.deleteMany({
      where: {
        container_id: containerId,
        server_id: serverId,
      },
    });
    return result as { count: number };
  }

  async getBackupsGroupedByContainer(): Promise<Map<string, BackupWithServer[]>> {
    const backups = await this.getAllBackups();
    const grouped = new Map<string, BackupWithServer[]>();
    
    for (const backup of backups) {
      const key = backup.container_id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(backup);
    }
    
    return grouped;
  }

  // PBS Credentials CRUD operations
  async createOrUpdatePBSCredential(credentialData: {
    server_id: number;
    storage_name: string;
    pbs_ip: string;
    pbs_datastore: string;
    pbs_password: string;
    pbs_fingerprint: string;
  }): Promise<PBSStorageCredential> {
    const result = await prisma.pBSStorageCredential.upsert({
      where: {
        server_id_storage_name: {
          server_id: credentialData.server_id,
          storage_name: credentialData.storage_name,
        },
      },
      update: {
        pbs_ip: credentialData.pbs_ip,
        pbs_datastore: credentialData.pbs_datastore,
        pbs_password: credentialData.pbs_password,
        pbs_fingerprint: credentialData.pbs_fingerprint,
        updated_at: new Date(),
      },
      create: {
        server_id: credentialData.server_id,
        storage_name: credentialData.storage_name,
        pbs_ip: credentialData.pbs_ip,
        pbs_datastore: credentialData.pbs_datastore,
        pbs_password: credentialData.pbs_password,
        pbs_fingerprint: credentialData.pbs_fingerprint,
      },
    });
    return result as PBSStorageCredential;
  }

  async getPBSCredential(serverId: number, storageName: string): Promise<PBSStorageCredential | null> {
    const result = await prisma.pBSStorageCredential.findUnique({
      where: {
        server_id_storage_name: {
          server_id: serverId,
          storage_name: storageName,
        },
      },
    });
    return result as PBSStorageCredential | null;
  }

  async getPBSCredentialsByServer(serverId: number): Promise<PBSStorageCredential[]> {
    const result = await prisma.pBSStorageCredential.findMany({
      where: { server_id: serverId },
      orderBy: { storage_name: 'asc' },
    });
    return result as PBSStorageCredential[];
  }

  async deletePBSCredential(serverId: number, storageName: string): Promise<PBSStorageCredential> {
    const result = await prisma.pBSStorageCredential.delete({
      where: {
        server_id_storage_name: {
          server_id: serverId,
          storage_name: storageName,
        },
      },
    });
    return result as PBSStorageCredential;
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
  }
}

// Singleton instance
let dbInstance: DatabaseServicePrisma | null = null;

export function getDatabase(): DatabaseServicePrisma {
  dbInstance ??= new DatabaseServicePrisma();
  return dbInstance;
}

export default DatabaseServicePrisma;
