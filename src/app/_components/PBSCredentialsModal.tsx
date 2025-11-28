"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { api } from "~/trpc/react";
import type { Storage } from "~/server/services/storageService";

interface PBSCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: number;
  serverName: string;
  storage: Storage;
}

export function PBSCredentialsModal({
  isOpen,
  onClose,
  serverId,
  serverName: _serverName,
  storage,
}: PBSCredentialsModalProps) {
  const [pbsIp, setPbsIp] = useState("");
  const [pbsDatastore, setPbsDatastore] = useState("");
  const [pbsPassword, setPbsPassword] = useState("");
  const [pbsFingerprint, setPbsFingerprint] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Extract PBS info from storage object
  const pbsIpFromStorage = (storage as { server?: string }).server ?? null;
  const pbsDatastoreFromStorage =
    (storage as { datastore?: string }).datastore ?? null;

  // Fetch existing credentials
  const { data: credentialData, refetch } =
    api.pbsCredentials.getCredentialsForStorage.useQuery(
      { serverId, storageName: storage.name },
      { enabled: isOpen },
    );

  // Initialize form with storage config values or existing credentials
  useEffect(() => {
    if (isOpen) {
      if (credentialData?.success && credentialData.credential) {
        // Load existing credentials
        setPbsIp(credentialData.credential.pbs_ip);
        setPbsDatastore(credentialData.credential.pbs_datastore);
        setPbsPassword(""); // Don't show password
        setPbsFingerprint(credentialData.credential.pbs_fingerprint ?? "");
      } else {
        // Initialize with storage config values
        setPbsIp(pbsIpFromStorage ?? "");
        setPbsDatastore(pbsDatastoreFromStorage ?? "");
        setPbsPassword("");
        setPbsFingerprint("");
      }
    }
  }, [isOpen, credentialData, pbsIpFromStorage, pbsDatastoreFromStorage]);

  const saveCredentials = api.pbsCredentials.saveCredentials.useMutation({
    onSuccess: () => {
      void refetch();
      onClose();
    },
    onError: (error) => {
      console.error("Failed to save PBS credentials:", error);
      alert(`Failed to save credentials: ${error.message}`);
    },
  });

  const deleteCredentials = api.pbsCredentials.deleteCredentials.useMutation({
    onSuccess: () => {
      void refetch();
      onClose();
    },
    onError: (error) => {
      console.error("Failed to delete PBS credentials:", error);
      alert(`Failed to delete credentials: ${error.message}`);
    },
  });

  useRegisterModal(isOpen, {
    id: "pbs-credentials-modal",
    allowEscape: true,
    onClose,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pbsIp || !pbsDatastore || !pbsFingerprint) {
      alert("Please fill in all required fields (IP, Datastore, Fingerprint)");
      return;
    }

    // Password is optional when updating existing credentials
    setIsLoading(true);
    try {
      await saveCredentials.mutateAsync({
        serverId,
        storageName: storage.name,
        pbs_ip: pbsIp,
        pbs_datastore: pbsDatastore,
        pbs_password: pbsPassword || undefined, // Undefined means keep existing password
        pbs_fingerprint: pbsFingerprint,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete the PBS credentials for this storage?",
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteCredentials.mutateAsync({
        serverId,
        storageName: storage.name,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasCredentials = credentialData?.success && credentialData.credential;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <Lock className="text-primary h-6 w-6" />
            <h2 className="text-card-foreground text-2xl font-bold">
              PBS Credentials - {storage.name}
            </h2>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Storage Name (read-only) */}
            <div>
              <label
                htmlFor="storage-name"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Storage Name
              </label>
              <input
                type="text"
                id="storage-name"
                value={storage.name}
                disabled
                className="bg-muted text-muted-foreground border-border w-full cursor-not-allowed rounded-md border px-3 py-2 shadow-sm"
              />
            </div>

            {/* PBS IP */}
            <div>
              <label
                htmlFor="pbs-ip"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                PBS Server IP <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-ip"
                value={pbsIp}
                onChange={(e) => setPbsIp(e.target.value)}
                required
                disabled={isLoading}
                className="bg-card text-foreground placeholder-muted-foreground focus:ring-ring focus:border-ring border-border w-full rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:outline-none"
                placeholder="e.g., 10.10.10.226"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                IP address of the Proxmox Backup Server
              </p>
            </div>

            {/* PBS Datastore */}
            <div>
              <label
                htmlFor="pbs-datastore"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                PBS Datastore <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-datastore"
                value={pbsDatastore}
                onChange={(e) => setPbsDatastore(e.target.value)}
                required
                disabled={isLoading}
                className="bg-card text-foreground placeholder-muted-foreground focus:ring-ring focus:border-ring border-border w-full rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:outline-none"
                placeholder="e.g., NAS03-ISCSI-BACKUP"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Name of the datastore on the PBS server
              </p>
            </div>

            {/* PBS Password */}
            <div>
              <label
                htmlFor="pbs-password"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Password{" "}
                {!hasCredentials && <span className="text-error">*</span>}
              </label>
              <input
                type="password"
                id="pbs-password"
                value={pbsPassword}
                onChange={(e) => setPbsPassword(e.target.value)}
                required={!hasCredentials}
                disabled={isLoading}
                className="bg-card text-foreground placeholder-muted-foreground focus:ring-ring focus:border-ring border-border w-full rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:outline-none"
                placeholder={
                  hasCredentials
                    ? "Enter new password (leave empty to keep existing)"
                    : "Enter PBS password"
                }
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Password for root@pam user on PBS server
              </p>
            </div>

            {/* PBS Fingerprint */}
            <div>
              <label
                htmlFor="pbs-fingerprint"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Fingerprint <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="pbs-fingerprint"
                value={pbsFingerprint}
                onChange={(e) => setPbsFingerprint(e.target.value)}
                required
                disabled={isLoading}
                className="bg-card text-foreground placeholder-muted-foreground focus:ring-ring focus:border-ring border-border w-full rounded-md border px-3 py-2 shadow-sm focus:ring-2 focus:outline-none"
                placeholder="e.g., 7b:e5:87:38:5e:16:05:d1:12:22:7f:73:d2:e2:d0:cf:8c:cb:28:e2:74:0c:78:91:1a:71:74:2e:79:20:5a:02"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Server fingerprint for auto-acceptance. You can find this on
                your PBS dashboard by clicking the &quot;Show Fingerprint&quot;
                button.
              </p>
            </div>

            {/* Status indicator */}
            {hasCredentials && (
              <div className="bg-success/10 border-success/20 flex items-center gap-2 rounded-lg border p-3">
                <CheckCircle className="text-success h-4 w-4" />
                <span className="text-success text-sm font-medium">
                  Credentials are configured for this storage
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col justify-end gap-3 pt-4 sm:flex-row">
              {hasCredentials && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  variant="outline"
                  disabled={isLoading}
                  className="order-3 w-full sm:w-auto"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Delete Credentials
                </Button>
              )}
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isLoading}
                className="order-2 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isLoading}
                className="order-1 w-full sm:w-auto"
              >
                {isLoading
                  ? "Saving..."
                  : hasCredentials
                    ? "Update Credentials"
                    : "Save Credentials"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
