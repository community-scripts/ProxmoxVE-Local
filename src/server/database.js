import Database from 'better-sqlite3';
import { join } from 'path';
import { writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'fs';
import { existsSync } from 'fs';

class DatabaseService {
  constructor() {
    const dbPath = join(process.cwd(), 'data', 'settings.db');
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    // Ensure data/ssh-keys directory exists
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    if (!existsSync(sshKeysDir)) {
      mkdirSync(sshKeysDir, { mode: 0o700 });
    }

    // Create servers table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        ip TEXT NOT NULL,
        user TEXT NOT NULL,
        password TEXT,
        auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key')),
        ssh_key TEXT,
        ssh_key_passphrase TEXT,
        ssh_port INTEGER DEFAULT 22,
        ssh_key_path TEXT,
        key_generated INTEGER DEFAULT 0,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add new columns to existing servers table
    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key'))
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN ssh_key TEXT
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN ssh_key_passphrase TEXT
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN ssh_port INTEGER DEFAULT 22
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN color TEXT
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN ssh_key_path TEXT
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN key_generated INTEGER DEFAULT 0
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    // Update existing servers to have auth_type='password' if not set
    this.db.exec(`
      UPDATE servers SET auth_type = 'password' WHERE auth_type IS NULL
    `);

    // Update existing servers to have ssh_port=22 if not set
    this.db.exec(`
      UPDATE servers SET ssh_port = 22 WHERE ssh_port IS NULL
    `);

    // Migration: Convert 'both' auth_type to 'key'
    this.db.exec(`
      UPDATE servers SET auth_type = 'key' WHERE auth_type = 'both'
    `);

    // Update existing servers to have key_generated=0 if not set
    this.db.exec(`
      UPDATE servers SET key_generated = 0 WHERE key_generated IS NULL
    `);

    // Migration: Add web_ui_ip column to existing installed_scripts table
    try {
      this.db.exec(`
        ALTER TABLE installed_scripts ADD COLUMN web_ui_ip TEXT
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    // Migration: Add web_ui_port column to existing installed_scripts table
    try {
      this.db.exec(`
        ALTER TABLE installed_scripts ADD COLUMN web_ui_port INTEGER
      `);
    } catch (e) {
      // Column already exists, ignore error
    }

    // Create installed_scripts table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installed_scripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script_name TEXT NOT NULL,
        script_path TEXT NOT NULL,
        container_id TEXT,
        server_id INTEGER,
        execution_mode TEXT NOT NULL CHECK(execution_mode IN ('local', 'ssh')),
        installation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL CHECK(status IN ('in_progress', 'success', 'failed')),
        output_log TEXT,
        web_ui_ip TEXT,
        web_ui_port INTEGER,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
      )
    `);

    // Create trigger to update updated_at on row update
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_servers_timestamp 
      AFTER UPDATE ON servers
      BEGIN
        UPDATE servers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);
  }

  // Server CRUD operations
  /**
   * @param {import('../types/server').CreateServerData} serverData
   */
  createServer(serverData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    
    let ssh_key_path = null;
    
    // If using SSH key authentication, create persistent key file
    if (auth_type === 'key' && ssh_key) {
      const serverId = this.getNextServerId();
      ssh_key_path = this.createSSHKeyFile(serverId, ssh_key);
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO servers (name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, ssh_key_path, key_generated, color) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(name, ip, user, password, auth_type || 'password', ssh_key, ssh_key_passphrase, ssh_port || 22, ssh_key_path, key_generated || 0, color);
  }

  getAllServers() {
    const stmt = this.db.prepare('SELECT * FROM servers ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * @param {number} id
   */
  getServerById(id) {
    const stmt = this.db.prepare('SELECT * FROM servers WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * @param {number} id
   * @param {import('../types/server').CreateServerData} serverData
   */
  updateServer(id, serverData) {
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated } = serverData;
    
    // Get existing server to check for key changes
    const existingServer = this.getServerById(id);
    // @ts-ignore - Database migration adds this column
    let ssh_key_path = existingServer?.ssh_key_path;
    
    // Handle SSH key changes
    if (auth_type === 'key' && ssh_key) {
      // Delete old key file if it exists
      // @ts-ignore - Database migration adds this column
      if (existingServer?.ssh_key_path && existsSync(existingServer.ssh_key_path)) {
        try {
          // @ts-ignore - Database migration adds this column
          unlinkSync(existingServer.ssh_key_path);
          // Also delete public key file if it exists
          // @ts-ignore - Database migration adds this column
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
      // @ts-ignore - Database migration adds this column
      if (existingServer?.ssh_key_path && existsSync(existingServer.ssh_key_path)) {
        try {
          // @ts-ignore - Database migration adds this column
          unlinkSync(existingServer.ssh_key_path);
          // @ts-ignore - Database migration adds this column
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
    
    const stmt = this.db.prepare(`
      UPDATE servers 
      SET name = ?, ip = ?, user = ?, password = ?, auth_type = ?, ssh_key = ?, ssh_key_passphrase = ?, ssh_port = ?, ssh_key_path = ?, key_generated = ?, color = ?
      WHERE id = ?
    `);
    // @ts-ignore - Database migration adds this column
    return stmt.run(name, ip, user, password, auth_type || 'password', ssh_key, ssh_key_passphrase, ssh_port || 22, ssh_key_path, key_generated !== undefined ? key_generated : (existingServer?.key_generated || 0), color, id);
  }

  /**
   * @param {number} id
   */
  deleteServer(id) {
    // Get server info before deletion to clean up key files
    const server = this.getServerById(id);
    
    // Delete SSH key files if they exist
    // @ts-ignore - Database migration adds this column
    if (server?.ssh_key_path && existsSync(server.ssh_key_path)) {
      try {
        // @ts-ignore - Database migration adds this column
        unlinkSync(server.ssh_key_path);
        // @ts-ignore - Database migration adds this column
        const pubKeyPath = server.ssh_key_path + '.pub';
        if (existsSync(pubKeyPath)) {
          unlinkSync(pubKeyPath);
        }
      } catch (error) {
        console.warn('Failed to delete SSH key file:', error);
      }
    }
    
    const stmt = this.db.prepare('DELETE FROM servers WHERE id = ?');
    return stmt.run(id);
  }

  // Installed Scripts CRUD operations
  /**
   * @param {Object} scriptData
   * @param {string} scriptData.script_name
   * @param {string} scriptData.script_path
   * @param {string} [scriptData.container_id]
   * @param {number} [scriptData.server_id]
   * @param {string} scriptData.execution_mode
   * @param {string} scriptData.status
   * @param {string} [scriptData.output_log]
   * @param {string} [scriptData.web_ui_ip]
   * @param {number} [scriptData.web_ui_port]
   */
  createInstalledScript(scriptData) {
    const { script_name, script_path, container_id, server_id, execution_mode, status, output_log, web_ui_ip, web_ui_port } = scriptData;
    const stmt = this.db.prepare(`
      INSERT INTO installed_scripts (script_name, script_path, container_id, server_id, execution_mode, status, output_log, web_ui_ip, web_ui_port) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(script_name, script_path, container_id || null, server_id || null, execution_mode, status, output_log || null, web_ui_ip || null, web_ui_port || null);
  }

  getAllInstalledScripts() {
    const stmt = this.db.prepare(`
      SELECT 
        inst.*,
        s.name as server_name,
        s.ip as server_ip,
        s.user as server_user,
        s.password as server_password,
        s.auth_type as server_auth_type,
        s.ssh_key as server_ssh_key,
        s.ssh_key_passphrase as server_ssh_key_passphrase,
        s.ssh_port as server_ssh_port,
        s.color as server_color
      FROM installed_scripts inst
      LEFT JOIN servers s ON inst.server_id = s.id
      ORDER BY inst.installation_date DESC
    `);
    return stmt.all();
  }

  /**
   * @param {number} id
   */
  getInstalledScriptById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        inst.*,
        s.name as server_name,
        s.ip as server_ip
      FROM installed_scripts inst
      LEFT JOIN servers s ON inst.server_id = s.id
      WHERE inst.id = ?
    `);
    return stmt.get(id);
  }

  /**
   * @param {number} server_id
   */
  getInstalledScriptsByServer(server_id) {
    const stmt = this.db.prepare(`
      SELECT 
        inst.*,
        s.name as server_name,
        s.ip as server_ip
      FROM installed_scripts inst
      LEFT JOIN servers s ON inst.server_id = s.id
      WHERE inst.server_id = ?
      ORDER BY inst.installation_date DESC
    `);
    return stmt.all(server_id);
  }

  /**
   * @param {number} id
   * @param {Object} updateData
   * @param {string} [updateData.script_name]
   * @param {string} [updateData.container_id]
   * @param {string} [updateData.status]
   * @param {string} [updateData.output_log]
   * @param {string} [updateData.web_ui_ip]
   * @param {number} [updateData.web_ui_port]
   */
  updateInstalledScript(id, updateData) {
    const { script_name, container_id, status, output_log, web_ui_ip, web_ui_port } = updateData;
    const updates = [];
    const values = [];

    if (script_name !== undefined) {
      updates.push('script_name = ?');
      values.push(script_name);
    }
    if (container_id !== undefined) {
      updates.push('container_id = ?');
      values.push(container_id);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (output_log !== undefined) {
      updates.push('output_log = ?');
      values.push(output_log);
    }
    if (web_ui_ip !== undefined) {
      updates.push('web_ui_ip = ?');
      values.push(web_ui_ip);
    }
    if (web_ui_port !== undefined) {
      updates.push('web_ui_port = ?');
      values.push(web_ui_port);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE installed_scripts 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    return stmt.run(...values);
  }

  /**
   * @param {number} id
   */
  deleteInstalledScript(id) {
    const stmt = this.db.prepare('DELETE FROM installed_scripts WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * @param {number} server_id
   */
  deleteInstalledScriptsByServer(server_id) {
    const stmt = this.db.prepare('DELETE FROM installed_scripts WHERE server_id = ?');
    return stmt.run(server_id);
  }

  /**
   * Get the next available server ID for key file naming
   * @returns {number}
   */
  getNextServerId() {
    const stmt = this.db.prepare('SELECT MAX(id) as maxId FROM servers');
    const result = stmt.get();
    // @ts-ignore - SQL query result type
    return (result?.maxId || 0) + 1;
  }

  /**
   * Create SSH key file and return the path
   * @param {number} serverId 
   * @param {string} sshKey 
   * @returns {string}
   */
  createSSHKeyFile(serverId, sshKey) {
    const sshKeysDir = join(process.cwd(), 'data', 'ssh-keys');
    const keyPath = join(sshKeysDir, `server_${serverId}_key`);
    
    // Normalize the key: trim any trailing whitespace and ensure exactly one newline at the end
    const normalizedKey = sshKey.trimEnd() + '\n';
    writeFileSync(keyPath, normalizedKey);
    chmodSync(keyPath, 0o600); // Set proper permissions
    
    return keyPath;
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
/** @type {DatabaseService | null} */
let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

export default DatabaseService;

