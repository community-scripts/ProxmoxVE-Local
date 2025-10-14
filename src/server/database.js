import Database from 'better-sqlite3';
import { join } from 'path';

class DatabaseService {
  constructor() {
    const dbPath = join(process.cwd(), 'data', 'settings.db');
    this.db = new Database(dbPath);
    this.init();
  }

  init() {
    // Create servers table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        ip TEXT NOT NULL,
        user TEXT NOT NULL,
        password TEXT,
        auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key', 'both')),
        ssh_key TEXT,
        ssh_key_passphrase TEXT,
        ssh_port INTEGER DEFAULT 22,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add new columns to existing servers table
    try {
      this.db.exec(`
        ALTER TABLE servers ADD COLUMN auth_type TEXT DEFAULT 'password' CHECK(auth_type IN ('password', 'key', 'both'))
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

    // Update existing servers to have auth_type='password' if not set
    this.db.exec(`
      UPDATE servers SET auth_type = 'password' WHERE auth_type IS NULL
    `);

    // Update existing servers to have ssh_port=22 if not set
    this.db.exec(`
      UPDATE servers SET ssh_port = 22 WHERE ssh_port IS NULL
    `);

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
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color } = serverData;
    const stmt = this.db.prepare(`
      INSERT INTO servers (name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(name, ip, user, password, auth_type || 'password', ssh_key, ssh_key_passphrase, ssh_port || 22, color);
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
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color } = serverData;
    const stmt = this.db.prepare(`
      UPDATE servers 
      SET name = ?, ip = ?, user = ?, password = ?, auth_type = ?, ssh_key = ?, ssh_key_passphrase = ?, ssh_port = ?, color = ?
      WHERE id = ?
    `);
    return stmt.run(name, ip, user, password, auth_type || 'password', ssh_key, ssh_key_passphrase, ssh_port || 22, color, id);
  }

  /**
   * @param {number} id
   */
  deleteServer(id) {
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
   */
  createInstalledScript(scriptData) {
    const { script_name, script_path, container_id, server_id, execution_mode, status, output_log } = scriptData;
    const stmt = this.db.prepare(`
      INSERT INTO installed_scripts (script_name, script_path, container_id, server_id, execution_mode, status, output_log) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(script_name, script_path, container_id || null, server_id || null, execution_mode, status, output_log || null);
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
   */
  updateInstalledScript(id, updateData) {
    const { script_name, container_id, status, output_log } = updateData;
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

