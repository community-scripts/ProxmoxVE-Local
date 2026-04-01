-- CreateTable
CREATE TABLE "script_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "script_slug" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "server_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "server_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cpu" INTEGER,
    "ram" INTEGER,
    "disk" INTEGER,
    "privileged" BOOLEAN NOT NULL DEFAULT false,
    "bridge" TEXT,
    "vlan" TEXT,
    "dns" TEXT,
    "ssh" BOOLEAN NOT NULL DEFAULT false,
    "nesting" BOOLEAN NOT NULL DEFAULT true,
    "fuse" BOOLEAN NOT NULL DEFAULT false,
    "apt_proxy_addr" TEXT,
    "apt_proxy_on" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "script_notes_script_slug_idx" ON "script_notes"("script_slug");

-- CreateIndex
CREATE INDEX "server_presets_server_id_idx" ON "server_presets"("server_id");
