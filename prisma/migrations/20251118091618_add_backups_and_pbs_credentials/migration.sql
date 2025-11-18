-- CreateTable
CREATE TABLE IF NOT EXISTS "backups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "container_id" TEXT NOT NULL,
    "server_id" INTEGER NOT NULL,
    "hostname" TEXT NOT NULL,
    "backup_name" TEXT NOT NULL,
    "backup_path" TEXT NOT NULL,
    "size" BIGINT,
    "created_at" DATETIME,
    "storage_name" TEXT NOT NULL,
    "storage_type" TEXT NOT NULL,
    "discovered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backups_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pbs_storage_credentials" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "storage_name" TEXT NOT NULL,
    "pbs_ip" TEXT NOT NULL,
    "pbs_datastore" TEXT NOT NULL,
    "pbs_password" TEXT NOT NULL,
    "pbs_fingerprint" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pbs_storage_credentials_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "backups_container_id_idx" ON "backups"("container_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "backups_server_id_idx" ON "backups"("server_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pbs_storage_credentials_server_id_idx" ON "pbs_storage_credentials"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pbs_storage_credentials_server_id_storage_name_key" ON "pbs_storage_credentials"("server_id", "storage_name");
