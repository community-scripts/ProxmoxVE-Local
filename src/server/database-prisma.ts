/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { prisma } from './db';
import { join } from 'path';
import { writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'fs';
import { existsSync } from 'fs';
import type { CreateServerData } from '../types/server';

class DatabaseServicePrisma {
  constructor() {
    this.init();
  }

  init() {
    // Ensure data/ssh-keys directory exists
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    if (!existsSync(sshKeysDir)) {
      mkdirSync(sshKeysDir, { mode: 0o700 });
    }
  }

  // Server CRUD operations
  async createServer(serverData: CreateServerData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    const normalizedPort = ssh_port !== undefined ? parseInt(String(ssh_port), 10) : 22;
    
    let ssh_key_path = null;
    
    // If using SSH key authentication, create persistent key file
    if (auth_type === 'key' && ssh_key) {
      const serverId = await this.getNextServerId();
      ssh_key_path = this.createSSHKeyFile(serverId, ssh_key);
    }
    
    return await prisma.server.create({
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
  }

  async getAllServers() {
    return await prisma.server.findMany({
      orderBy: { created_at: 'desc' }
    });
  }

  async getServerById(id: number) {
    return await prisma.server.findUnique({
      where: { id }
    });
  }

  async updateServer(id: number, serverData: CreateServerData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    const normalizedPort = ssh_port !== undefined ? parseInt(String(ssh_port), 10) : undefined;
    
    // Get existing server to check for key changes
    const existingServer = await this.getServerById(id);
    let ssh_key_path = existingServer?.ssh_key_path;
    
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
    
    return await prisma.server.update({
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
  }

  async deleteServer(id: number) {
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
    
    return await prisma.server.delete({
      where: { id }
    });
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
  }) {
    const { script_name, script_path, container_id, server_id, execution_mode, status, output_log, web_ui_ip, web_ui_port } = scriptData;
    
    return await prisma.installedScript.create({
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
  }

  async getAllInstalledScripts() {
    return await prisma.installedScript.findMany({
      include: {
        server: true
      },
      orderBy: { installation_date: 'desc' }
    });
  }

  async getInstalledScriptById(id: number) {
    return await prisma.installedScript.findUnique({
      where: { id },
      include: {
        server: true
      }
    });
  }

  async getInstalledScriptsByServer(server_id: number) {
    return await prisma.installedScript.findMany({
      where: { server_id },
      include: {
        server: true
      },
      orderBy: { installation_date: 'desc' }
    });
  }

  async updateInstalledScript(id: number, updateData: {
    script_name?: string;
    container_id?: string;
    status?: 'in_progress' | 'success' | 'failed';
    output_log?: string;
    web_ui_ip?: string;
    web_ui_port?: number;
  }) {
    const { script_name, container_id, status, output_log, web_ui_ip, web_ui_port } = updateData;
    
    const updateFields: {
      script_name?: string;
      container_id?: string;
      status?: 'in_progress' | 'success' | 'failed';
      output_log?: string;
      web_ui_ip?: string;
      web_ui_port?: number;
    } = {};
    if (script_name !== undefined) updateFields.script_name = script_name;
    if (container_id !== undefined) updateFields.container_id = container_id;
    if (status !== undefined) updateFields.status = status;
    if (output_log !== undefined) updateFields.output_log = output_log;
    if (web_ui_ip !== undefined) updateFields.web_ui_ip = web_ui_ip;
    if (web_ui_port !== undefined) updateFields.web_ui_port = web_ui_port;

    if (Object.keys(updateFields).length === 0) {
      return { changes: 0 };
    }

    return await prisma.installedScript.update({
      where: { id },
      data: updateFields
    });
  }

  async deleteInstalledScript(id: number) {
    return await prisma.installedScript.delete({
      where: { id }
    });
  }

  async deleteInstalledScriptsByServer(server_id: number) {
    return await prisma.installedScript.deleteMany({
      where: { server_id }
    });
  }

  async getNextServerId() {
    const result = await prisma.server.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true }
    });
    return (result?.id ?? 0) + 1;
  }

  createSSHKeyFile(serverId: number, sshKey: string) {
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    const keyPath = join(sshKeysDir, `server_${serverId}_key`);
    
    // Normalize the key: trim any trailing whitespace and ensure exactly one newline at the end
    const normalizedKey = sshKey.trimEnd() + '\n';
    writeFileSync(keyPath, normalizedKey);
    chmodSync(keyPath, 0o600); // Set proper permissions
    
    return keyPath;
  }

  // LXC Config CRUD operations
  async createLXCConfig(scriptId: number, configData: any) {
    return await prisma.lXCConfig.create({
      data: {
        installed_script_id: scriptId,
        ...configData
      }
    });
  }

  async updateLXCConfig(scriptId: number, configData: any) {
    return await prisma.lXCConfig.upsert({
      where: { installed_script_id: scriptId },
      update: configData,
      create: {
        installed_script_id: scriptId,
        ...configData
      }
    });
  }

  async getLXCConfigByScriptId(scriptId: number) {
    return await prisma.lXCConfig.findUnique({
      where: { installed_script_id: scriptId }
    });
  }

  async deleteLXCConfig(scriptId: number) {
    return await prisma.lXCConfig.delete({
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
  }) {
    // Find existing backup by container_id, server_id, and backup_path
    const existing = await prisma.backup.findFirst({
      where: {
        container_id: backupData.container_id,
        server_id: backupData.server_id,
        backup_path: backupData.backup_path,
      },
    });

    if (existing) {
      // Update existing backup
      return await prisma.backup.update({
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
    } else {
      // Create new backup
      return await prisma.backup.create({
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
    }
  }

  async getAllBackups() {
    return await prisma.backup.findMany({
      include: {
        server: true,
      },
      orderBy: [
        { container_id: 'asc' },
        { created_at: 'desc' },
      ],
    });
  }

  async getBackupById(id: number) {
    return await prisma.backup.findUnique({
      where: { id },
      include: {
        server: true,
      },
    });
  }

  async getBackupsByContainerId(containerId: string) {
    return await prisma.backup.findMany({
      where: { container_id: containerId },
      include: {
        server: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async deleteBackupsForContainer(containerId: string, serverId: number) {
    return await prisma.backup.deleteMany({
      where: {
        container_id: containerId,
        server_id: serverId,
      },
    });
  }

  async getBackupsGroupedByContainer(): Promise<Map<string, Array<{
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
    server: {
      id: number;
      name: string;
      ip: string;
      user: string;
      color: string | null;
    } | null;
  }>>> {
    const backups = await this.getAllBackups();
    const grouped = new Map<string, typeof backups>();
    
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
  }) {
    return await prisma.pBSStorageCredential.upsert({
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
  }

  async getPBSCredential(serverId: number, storageName: string) {
    return await prisma.pBSStorageCredential.findUnique({
      where: {
        server_id_storage_name: {
          server_id: serverId,
          storage_name: storageName,
        },
      },
    });
  }

  async getPBSCredentialsByServer(serverId: number) {
    return await prisma.pBSStorageCredential.findMany({
      where: { server_id: serverId },
      orderBy: { storage_name: 'asc' },
    });
  }

  async deletePBSCredential(serverId: number, storageName: string) {
    return await prisma.pBSStorageCredential.delete({
      where: {
        server_id_storage_name: {
          server_id: serverId,
          storage_name: storageName,
        },
      },
    });
  }

  async close() {
    await prisma.$disconnect();
  }
}

// Singleton instance
let dbInstance: DatabaseServicePrisma | null = null;

export function getDatabase() {
  dbInstance ??= new DatabaseServicePrisma();
  return dbInstance;
}

export default DatabaseServicePrisma;
