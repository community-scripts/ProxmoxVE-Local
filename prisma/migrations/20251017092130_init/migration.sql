-- CreateTable
CREATE TABLE "installed_scripts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "script_name" TEXT NOT NULL,
    "script_path" TEXT NOT NULL,
    "container_id" TEXT,
    "server_id" INTEGER,
    "execution_mode" TEXT NOT NULL,
    "installation_date" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "output_log" TEXT,
    "web_ui_ip" TEXT,
    "web_ui_port" INTEGER,
    CONSTRAINT "installed_scripts_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "servers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT,
    "auth_type" TEXT DEFAULT 'password',
    "ssh_key" TEXT,
    "ssh_key_passphrase" TEXT,
    "ssh_port" INTEGER DEFAULT 22,
    "color" TEXT,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    "ssh_key_path" TEXT,
    "key_generated" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "lxc_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "installed_script_id" INTEGER NOT NULL,
    "arch" TEXT,
    "cores" INTEGER,
    "memory" INTEGER,
    "hostname" TEXT,
    "swap" INTEGER,
    "onboot" INTEGER,
    "ostype" TEXT,
    "unprivileged" INTEGER,
    "net_name" TEXT,
    "net_bridge" TEXT,
    "net_hwaddr" TEXT,
    "net_ip_type" TEXT,
    "net_ip" TEXT,
    "net_gateway" TEXT,
    "net_type" TEXT,
    "net_vlan" INTEGER,
    "rootfs_storage" TEXT,
    "rootfs_size" TEXT,
    "feature_keyctl" INTEGER,
    "feature_nesting" INTEGER,
    "feature_fuse" INTEGER,
    "feature_mount" TEXT,
    "tags" TEXT,
    "advanced_config" TEXT,
    "synced_at" DATETIME,
    "config_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lxc_configs_installed_script_id_fkey" FOREIGN KEY ("installed_script_id") REFERENCES "installed_scripts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_name_key" ON "servers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lxc_configs_installed_script_id_key" ON "lxc_configs"("installed_script_id");
