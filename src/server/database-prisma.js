import { prisma } from './db.js';
import { join } from 'path';
import { writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'fs';
import { existsSync } from 'fs';

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
  async createServer(serverData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    
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
        ssh_port: ssh_port ?? 22,
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

  async getServerById(id) {
    return await prisma.server.findUnique({
      where: { id }
    });
  }

  async updateServer(id, serverData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    
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
        ssh_port: ssh_port ?? 22,
        ssh_key_path,
        key_generated: key_generated !== undefined ? Boolean(key_generated) : (existingServer?.key_generated ?? false),
        color,
      }
    });
  }

  async deleteServer(id) {
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
  async createInstalledScript(scriptData) {
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

  async getInstalledScriptById(id) {
    return await prisma.installedScript.findUnique({
      where: { id },
      include: {
        server: true
      }
    });
  }

  async getInstalledScriptsByServer(server_id) {
    return await prisma.installedScript.findMany({
      where: { server_id },
      include: {
        server: true
      },
      orderBy: { installation_date: 'desc' }
    });
  }

  async updateInstalledScript(id, updateData) {
    const { script_name, container_id, status, output_log, web_ui_ip, web_ui_port } = updateData;
    
    const updateFields = {};
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

  async deleteInstalledScript(id) {
    return await prisma.installedScript.delete({
      where: { id }
    });
  }

  async deleteInstalledScriptsByServer(server_id) {
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

  createSSHKeyFile(serverId, sshKey) {
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    const keyPath = join(sshKeysDir, `server_${serverId}_key`);
    
    // Normalize the key: trim any trailing whitespace and ensure exactly one newline at the end
    const normalizedKey = sshKey.trimEnd() + '\n';
    writeFileSync(keyPath, normalizedKey);
    chmodSync(keyPath, 0o600); // Set proper permissions
    
    return keyPath;
  }

  // LXC Config CRUD operations
  async createLXCConfig(scriptId, configData) {
    return await prisma.lXCConfig.create({
      data: {
        installed_script_id: scriptId,
        ...configData
      }
    });
  }

  async updateLXCConfig(scriptId, configData) {
    return await prisma.lXCConfig.upsert({
      where: { installed_script_id: scriptId },
      update: configData,
      create: {
        installed_script_id: scriptId,
        ...configData
      }
    });
  }

  async getLXCConfigByScriptId(scriptId) {
    return await prisma.lXCConfig.findUnique({
      where: { installed_script_id: scriptId }
    });
  }

  async deleteLXCConfig(scriptId) {
    return await prisma.lXCConfig.delete({
      where: { installed_script_id: scriptId }
    });
  }

  async close() {
    await prisma.$disconnect();
  }
}

// Singleton instance
let dbInstance = null;

export function getDatabase() {
  dbInstance ??= new DatabaseServicePrisma();
  return dbInstance;
}

export default DatabaseServicePrisma;