"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Database,
  RefreshCw,
  CheckCircle,
  Lock,
  AlertCircle,
} from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { api } from "~/trpc/react";
import { PBSCredentialsModal } from "./PBSCredentialsModal";
import type { Storage } from "~/server/services/storageService";

interface ServerStoragesModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: number;
  serverName: string;
}

export function ServerStoragesModal({
  isOpen,
  onClose,
  serverId,
  serverName,
}: ServerStoragesModalProps) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [selectedPBSStorage, setSelectedPBSStorage] = useState<Storage | null>(
    null,
  );

  const { data, isLoading, refetch } =
    api.installedScripts.getBackupStorages.useQuery(
      { serverId, forceRefresh },
      { enabled: isOpen },
    );

  // Fetch all PBS credentials for this server to show status indicators
  const { data: allCredentials } =
    api.pbsCredentials.getAllCredentialsForServer.useQuery(
      { serverId },
      { enabled: isOpen },
    );

  const credentialsMap = new Map<string, boolean>();
  if (allCredentials?.success) {
    allCredentials.credentials.forEach((c) => {
      credentialsMap.set(String(c.storage_name), true);
    });
  }

  useRegisterModal(isOpen, {
    id: "server-storages-modal",
    allowEscape: true,
    onClose,
  });

  const handleRefresh = () => {
    setForceRefresh(true);
    void refetch();
    setTimeout(() => setForceRefresh(false), 1000);
  };

  if (!isOpen) return null;

  const storages = data?.success ? data.storages : [];
  const backupStorages = storages.filter((s) => s.supportsBackup);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <Database className="text-primary h-6 w-6" />
            <h2 className="text-card-foreground text-2xl font-bold">
              Storages for {serverName}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground">Loading storages...</p>
            </div>
          ) : !data?.success ? (
            <div className="py-8 text-center">
              <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-foreground mb-2">Failed to load storages</p>
              <p className="text-muted-foreground mb-4 text-sm">
                {data?.error ?? "Unknown error occurred"}
              </p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : storages.length === 0 ? (
            <div className="py-8 text-center">
              <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-foreground mb-2">No storages found</p>
              <p className="text-muted-foreground text-sm">
                Make sure your server has storages configured.
              </p>
            </div>
          ) : (
            <>
              {data.cached && (
                <div className="bg-muted/50 text-muted-foreground mb-4 rounded-lg p-3 text-sm">
                  Showing cached data. Click Refresh to fetch latest from
                  server.
                </div>
              )}

              <div className="space-y-3">
                {storages.map((storage) => {
                  const isBackupCapable = storage.supportsBackup;

                  return (
                    <div
                      key={storage.name}
                      className={`rounded-lg border p-4 ${
                        isBackupCapable
                          ? "border-success/50 bg-success/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-foreground font-medium">
                            {storage.name}
                          </h3>
                          {isBackupCapable && (
                            <span className="bg-success/20 text-success border-success/30 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium">
                              <CheckCircle className="h-3 w-3" />
                              Backup
                            </span>
                          )}
                          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium">
                            {storage.type}
                          </span>
                          {storage.type === "pbs" &&
                            (credentialsMap.has(storage.name) ? (
                              <span className="bg-success/20 text-success border-success/30 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium">
                                <CheckCircle className="h-3 w-3" />
                                Credentials Configured
                              </span>
                            ) : (
                              <span className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium">
                                <AlertCircle className="h-3 w-3" />
                                Credentials Needed
                              </span>
                            ))}
                        </div>
                        <div className="text-muted-foreground space-y-1 text-sm">
                          <div>
                            <span className="font-medium">Content:</span>{" "}
                            {storage.content.join(", ")}
                          </div>
                          {storage.nodes && storage.nodes.length > 0 && (
                            <div>
                              <span className="font-medium">Nodes:</span>{" "}
                              {storage.nodes.join(", ")}
                            </div>
                          )}
                          {Object.entries(storage)
                            .filter(
                              ([key]) =>
                                ![
                                  "name",
                                  "type",
                                  "content",
                                  "supportsBackup",
                                  "nodes",
                                ].includes(key),
                            )
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium capitalize">
                                  {key.replace(/_/g, " ")}:
                                </span>{" "}
                                {String(value)}
                              </div>
                            ))}
                        </div>
                        {storage.type === "pbs" && (
                          <div className="border-border mt-3 border-t pt-3">
                            <Button
                              onClick={() => setSelectedPBSStorage(storage)}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Lock className="h-4 w-4" />
                              {credentialsMap.has(storage.name)
                                ? "Edit"
                                : "Configure"}{" "}
                              Credentials
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {backupStorages.length > 0 && (
                <div className="bg-success/10 border-success/20 mt-6 rounded-lg border p-4">
                  <p className="text-success text-sm font-medium">
                    {backupStorages.length} storage
                    {backupStorages.length !== 1 ? "s" : ""} available for
                    backups
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* PBS Credentials Modal */}
      {selectedPBSStorage && (
        <PBSCredentialsModal
          isOpen={!!selectedPBSStorage}
          onClose={() => setSelectedPBSStorage(null)}
          serverId={serverId}
          serverName={serverName}
          storage={selectedPBSStorage}
        />
      )}
    </div>
  );
}
