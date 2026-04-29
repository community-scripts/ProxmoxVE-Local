-- AlterTable: add pbs_username to pbs_storage_credentials with default 'root@pam'
ALTER TABLE "pbs_storage_credentials" ADD COLUMN "pbs_username" TEXT NOT NULL DEFAULT 'root@pam';
