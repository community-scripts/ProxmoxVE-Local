"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Database,
  Server,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ConfirmationModal } from "./ConfirmationModal";
import { LoadingModal } from "./LoadingModal";
import { useShell } from "./ShellContext";
import type { Server as ServerType } from "~/types/server";

interface Backup {
  id: number;
  backup_name: string;
  backup_path: string;
  size: bigint | null;
  created_at: Date | null;
  storage_name: string;
  storage_type: string;
  discovered_at: Date;
  server_id?: number;
  server_name: string | null;
  server_color: string | null;
}

interface ContainerBackups {
  container_id: string;
  hostname: string;
  backups: Backup[];
}

export function BackupsTab() {
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(
    new Set(),
  );
  const shell = useShell();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [hasAutoDiscovered, setHasAutoDiscovered] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<{
    backup: Backup;
    containerId: string;
  } | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string[]>([]);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [shouldPollRestore, setShouldPollRestore] = useState(false);

  // Create-backup dialog state
  // mode "existing": opened from container row (serverId + containerId pre-filled, just pick storage)
  // mode "new":      opened from header button (pick server → container → storage)
  const [createDialog, setCreateDialog] = useState<{
    mode: "existing" | "new";
    serverId: number | null;
    containerId: string | null;
  } | null>(null);
  const [selectedStorage, setSelectedStorage] = useState("");

  const {
    data: backupsData,
    refetch: refetchBackups,
    isLoading,
  } = api.backups.getAllBackupsGrouped.useQuery();
  const discoverMutation = api.backups.discoverBackups.useMutation({
    onSuccess: () => {
      void refetchBackups();
    },
  });

  // Storages for create-backup dialog
  const storagesQuery = api.installedScripts.getBackupStorages.useQuery(
    { serverId: createDialog?.serverId ?? 0 },
    {
      enabled:
        (createDialog?.serverId ?? 0) > 0 && createDialog?.containerId != null,
    },
  );

  // Containers for new-backup dialog (when server is picked but container isn't yet)
  const containersQuery = api.installedScripts.listContainersOnServer.useQuery(
    { serverId: createDialog?.serverId ?? 0 },
    {
      enabled:
        createDialog?.mode === "new" &&
        (createDialog?.serverId ?? 0) > 0 &&
        createDialog?.containerId == null,
    },
  );

  // Poll for restore progress
  const { data: restoreLogsData } = api.backups.getRestoreProgress.useQuery(
    undefined,
    {
      enabled: shouldPollRestore,
      refetchInterval: 1000, // Poll every second
      refetchIntervalInBackground: true,
    },
  );

  // Update restore progress when log data changes
  useEffect(() => {
    if (restoreLogsData?.success && restoreLogsData.logs) {
      setRestoreProgress(restoreLogsData.logs);

      // Stop polling when restore is complete
      if (restoreLogsData.isComplete) {
        setShouldPollRestore(false);
        // Check if restore was successful or failed
        const lastLog =
          restoreLogsData.logs[restoreLogsData.logs.length - 1] ?? "";
        if (lastLog.includes("Restore completed successfully")) {
          setRestoreSuccess(true);
          setRestoreError(null);
        } else if (lastLog.includes("Error:") || lastLog.includes("failed")) {
          setRestoreError(lastLog);
          setRestoreSuccess(false);
        }
      }
    }
  }, [restoreLogsData]);

  const restoreMutation = api.backups.restoreBackup.useMutation({
    onMutate: () => {
      // Start polling for progress
      setShouldPollRestore(true);
      setRestoreProgress(["Starting restore..."]);
      setRestoreError(null);
      setRestoreSuccess(false);
    },
    onSuccess: (result) => {
      // Stop polling - progress will be updated from logs
      setShouldPollRestore(false);

      if (result.success) {
        // Update progress with all messages from backend (fallback if polling didn't work)
        const progressMessages =
          restoreProgress.length > 0
            ? restoreProgress
            : (result.progress?.map((p) => p.message) ?? [
                "Restore completed successfully",
              ]);
        setRestoreProgress(progressMessages);
        setRestoreSuccess(true);
        setRestoreError(null);
        setRestoreConfirmOpen(false);
        setSelectedBackup(null);
        // Keep success message visible - user can dismiss manually
      } else {
        setRestoreError(result.error ?? "Restore failed");
        setRestoreProgress(
          result.progress?.map((p) => p.message) ?? restoreProgress,
        );
        setRestoreSuccess(false);
        setRestoreConfirmOpen(false);
        setSelectedBackup(null);
        // Keep error message visible - user can dismiss manually
      }
    },
    onError: (error) => {
      // Stop polling on error
      setShouldPollRestore(false);
      setRestoreError(error.message ?? "Restore failed");
      setRestoreConfirmOpen(false);
      setSelectedBackup(null);
      setRestoreProgress([]);
    },
  });

  // Update progress text in modal based on current progress
  const currentProgressText =
    restoreProgress.length > 0
      ? restoreProgress[restoreProgress.length - 1]
      : "Restoring backup...";

  // Load servers for the create-backup dialog
  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: ServerType[]) => setServers(data))
      .catch(() => {
        /* ignore */
      });
  }, []);

  // Auto-discover backups when tab is first opened
  useEffect(() => {
    if (!hasAutoDiscovered && !isLoading && backupsData) {
      // Only auto-discover if there are no backups yet
      if (!backupsData.backups?.length) {
        void handleDiscoverBackups();
      }
      setHasAutoDiscovered(true);
    }
  }, [hasAutoDiscovered, isLoading, backupsData]);

  const handleDiscoverBackups = () => {
    discoverMutation.mutate();
  };

  const handleOpenCreateBackup = (containerId: string, serverId: number) => {
    setCreateDialog({ mode: "existing", serverId, containerId });
    setSelectedStorage("");
  };

  const handleStartBackup = () => {
    if (
      !createDialog?.containerId ||
      !createDialog?.serverId ||
      !selectedStorage
    )
      return;
    const server = servers.find((s) => s.id === createDialog.serverId);
    if (!server) return;
    shell.open({
      containerId: createDialog.containerId,
      server,
      containerType: "lxc",
      backupStorage: selectedStorage,
      onComplete: () => void refetchBackups(),
    });
    setCreateDialog(null);
    setSelectedStorage("");
  };

  const handleRestoreClick = (backup: Backup, containerId: string) => {
    setSelectedBackup({ backup, containerId });
    setRestoreConfirmOpen(true);
    setRestoreError(null);
    setRestoreSuccess(false);
    setRestoreProgress([]);
  };

  const handleRestoreConfirm = () => {
    if (!selectedBackup) return;

    setRestoreConfirmOpen(false);
    setRestoreError(null);
    setRestoreSuccess(false);

    restoreMutation.mutate({
      backupId: selectedBackup.backup.id,
      containerId: selectedBackup.containerId,
      serverId: selectedBackup.backup.server_id ?? 0,
    });
  };

  const toggleContainer = (containerId: string) => {
    const newExpanded = new Set(expandedContainers);
    if (newExpanded.has(containerId)) {
      newExpanded.delete(containerId);
    } else {
      newExpanded.add(containerId);
    }
    setExpandedContainers(newExpanded);
  };

  const formatFileSize = (bytes: bigint | null): string => {
    if (!bytes) return "Unknown size";
    const b = Number(bytes);
    if (b === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Unknown date";
    return new Date(date).toLocaleString();
  };

  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case "pbs":
        return <Database className="h-4 w-4" />;
      case "local":
        return <HardDrive className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const getStorageTypeBadgeVariant = (
    type: string,
  ): "default" | "secondary" | "outline" => {
    switch (type) {
      case "pbs":
        return "default";
      case "local":
        return "secondary";
      default:
        return "outline";
    }
  };

  const backups = backupsData?.success ? backupsData.backups : [];
  const isDiscovering = discoverMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-2xl font-bold">Backups</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Discovered backups grouped by container ID
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCreateDialog({
                mode: "new",
                serverId: null,
                containerId: null,
              });
              setSelectedStorage("");
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Backup
          </Button>
          <Button
            onClick={handleDiscoverBackups}
            disabled={isDiscovering}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isDiscovering ? "animate-spin" : ""}`}
            />
            {isDiscovering ? "Discovering..." : "Discover Backups"}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {(isLoading || isDiscovering) && backups.length === 0 && (
        <div className="bg-card border-border rounded-lg border p-8 text-center">
          <RefreshCw className="text-muted-foreground mx-auto mb-4 h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">
            {isDiscovering ? "Discovering backups..." : "Loading backups..."}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isDiscovering && backups.length === 0 && (
        <div className="bg-card border-border rounded-lg border p-8 text-center">
          <HardDrive className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            No backups found
          </h3>
          <p className="text-muted-foreground mb-4">
            Click &quot;Discover Backups&quot; to scan for backups on your
            servers.
          </p>
          <Button onClick={handleDiscoverBackups} disabled={isDiscovering}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isDiscovering ? "animate-spin" : ""}`}
            />
            Discover Backups
          </Button>
        </div>
      )}

      {/* Backups list */}
      {!isLoading && backups.length > 0 && (
        <div className="space-y-4">
          {backups.map((container: ContainerBackups) => {
            const isExpanded = expandedContainers.has(container.container_id);
            const backupCount = container.backups.length;

            return (
              <div
                key={container.container_id}
                className="bg-card border-border overflow-hidden rounded-lg border shadow-sm"
              >
                {/* Container header - collapsible */}
                <div className="hover:bg-accent/50 flex w-full items-center justify-between p-4 transition-colors">
                  <button
                    onClick={() => toggleContainer(container.container_id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="text-muted-foreground h-5 w-5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground font-semibold">
                          CT {container.container_id}
                        </span>
                        {container.hostname && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {container.hostname}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {backupCount} {backupCount === 1 ? "backup" : "backups"}
                      </p>
                    </div>
                  </button>
                  {/* Create Backup button — only shown when server is known */}
                  {(container.backups[0]?.server_id ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCreateBackup(
                          container.container_id,
                          container.backups[0]!.server_id!,
                        );
                      }}
                      className="ml-3 flex-shrink-0 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Backup
                    </Button>
                  )}
                </div>

                {/* Container content - backups list */}
                {isExpanded && (
                  <div className="border-border border-t">
                    <div className="space-y-3 p-4">
                      {container.backups.map((backup) => (
                        <div
                          key={backup.id}
                          className="bg-muted/50 border-border/50 rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-foreground font-medium break-all">
                                  {backup.backup_name}
                                </span>
                                <Badge
                                  variant={getStorageTypeBadgeVariant(
                                    backup.storage_type,
                                  )}
                                  className="flex items-center gap-1"
                                >
                                  {getStorageTypeIcon(backup.storage_type)}
                                  {backup.storage_name}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                                {backup.size && (
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="h-3 w-3" />
                                    {formatFileSize(backup.size)}
                                  </span>
                                )}
                                {backup.created_at && (
                                  <span>{formatDate(backup.created_at)}</span>
                                )}
                                {backup.server_name && (
                                  <span className="flex items-center gap-1">
                                    <Server className="h-3 w-3" />
                                    {backup.server_name}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2">
                                <code className="text-muted-foreground text-xs break-all">
                                  {backup.backup_path}
                                </code>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-muted/20 hover:bg-muted/30 border-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground border transition-all duration-200 hover:scale-105 hover:shadow-md"
                                  >
                                    Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-card border-border w-48">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRestoreClick(
                                        backup,
                                        container.container_id,
                                      )
                                    }
                                    disabled={restoreMutation.isPending}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                  >
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled
                                    className="text-muted-foreground opacity-50"
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {backupsData && !backupsData.success && (
        <div className="bg-destructive/10 border-destructive rounded-lg border p-4">
          <p className="text-destructive">
            Error loading backups: {backupsData.error ?? "Unknown error"}
          </p>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {selectedBackup && (
        <ConfirmationModal
          isOpen={restoreConfirmOpen}
          onClose={() => {
            setRestoreConfirmOpen(false);
            setSelectedBackup(null);
          }}
          onConfirm={handleRestoreConfirm}
          title="Restore Backup"
          message={`This will destroy the existing container and restore from backup. The container will be stopped during restore. This action cannot be undone and may result in data loss.`}
          variant="danger"
          confirmText={selectedBackup.containerId}
          confirmButtonText="Restore"
          cancelButtonText="Cancel"
        />
      )}

      {/* Restore Progress Modal */}
      {(restoreMutation.isPending ||
        (restoreSuccess && restoreProgress.length > 0)) && (
        <LoadingModal
          isOpen={true}
          action={currentProgressText}
          logs={restoreProgress}
          isComplete={restoreSuccess}
          title="Restore in progress"
          onClose={() => {
            setRestoreSuccess(false);
            setRestoreProgress([]);
          }}
        />
      )}

      {/* Restore Success */}
      {restoreSuccess && (
        <div className="bg-success/10 border-success/20 rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-success h-5 w-5" />
              <span className="text-success font-medium">
                Restore Completed Successfully
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRestoreSuccess(false);
                setRestoreProgress([]);
              }}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            The container has been restored from backup.
          </p>
        </div>
      )}

      {/* Restore Error */}
      {restoreError && (
        <div className="bg-error/10 border-error/20 rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-error h-5 w-5" />
              <span className="text-error font-medium">Restore Failed</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRestoreError(null);
                setRestoreProgress([]);
              }}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{restoreError}</p>
          {restoreProgress.length > 0 && (
            <div className="mt-2 space-y-1">
              {restoreProgress.map((message, index) => (
                <p key={index} className="text-muted-foreground text-sm">
                  {message}
                </p>
              ))}
            </div>
          )}
          <Button
            onClick={() => {
              setRestoreError(null);
              setRestoreProgress([]);
            }}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* ── Create Backup Dialog (unified: existing container or new) ── */}
      {createDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border-border w-full max-w-md rounded-xl border shadow-2xl">
            {/* Header */}
            <div className="border-border border-b p-5">
              <div className="flex items-center gap-2">
                {createDialog.mode === "new" &&
                  createDialog.serverId != null && (
                    <button
                      onClick={() =>
                        setCreateDialog((d) =>
                          d
                            ? d.containerId != null
                              ? { ...d, containerId: null }
                              : { ...d, serverId: null }
                            : null,
                        )
                      }
                      className="text-muted-foreground hover:text-foreground mr-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                <div>
                  <h3 className="text-foreground text-lg font-semibold">
                    {createDialog.mode === "existing"
                      ? "Create Backup"
                      : createDialog.serverId == null
                        ? "New Backup — Select Server"
                        : createDialog.containerId == null
                          ? "New Backup — Select Container"
                          : "New Backup — Select Storage"}
                  </h3>
                  {createDialog.mode === "existing" &&
                    createDialog.containerId && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        CT {createDialog.containerId} — select a backup storage
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              {/* Step: Server selection (new mode only) */}
              {createDialog.mode === "new" && createDialog.serverId == null && (
                <div className="space-y-2">
                  {servers.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No servers configured.
                    </p>
                  ) : (
                    servers.map((srv) => (
                      <button
                        key={srv.id}
                        onClick={() =>
                          setCreateDialog((d) =>
                            d ? { ...d, serverId: srv.id } : null,
                          )
                        }
                        className="border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground w-full rounded-lg border px-4 py-3 text-left transition-colors"
                      >
                        <span className="font-medium">{srv.name}</span>
                        <span className="ml-2 text-xs opacity-60">
                          {srv.ip}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Step: Container selection (new mode only) */}
              {createDialog.mode === "new" &&
                createDialog.serverId != null &&
                createDialog.containerId == null && (() => {
                  type CT = { id: string; name: string; status: string; type: string };
                  const lxcItems: CT[] = (containersQuery.data?.lxc ?? []).map(
                    (c) => ({ id: c.id, name: c.name, status: c.status, type: "CT" }),
                  );
                  const vmItems: CT[] = (containersQuery.data?.vm ?? []).map(
                    (c) => ({ id: c.id, name: c.name, status: c.status, type: "VM" }),
                  );
                  const allContainers = [...lxcItems, ...vmItems];
                  return (
                    <div className="space-y-2">
                      {containersQuery.isLoading ? (
                        <div className="flex items-center gap-2 py-4">
                          <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
                          <span className="text-muted-foreground text-sm">
                            Loading containers…
                          </span>
                        </div>
                      ) : allContainers.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                          No containers found on this server.
                        </p>
                      ) : (
                        allContainers.map((ct) => (
                          <button
                            key={ct.id}
                            onClick={() => {
                              setCreateDialog((d) =>
                                d ? { ...d, containerId: ct.id } : null,
                              );
                              setSelectedStorage("");
                            }}
                            className="border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground w-full rounded-lg border px-4 py-3 text-left transition-colors"
                          >
                            <span className="font-medium">
                              {ct.type} {ct.id}
                            </span>
                            {ct.name && ct.name !== ct.id && (
                              <span className="ml-2 text-xs opacity-60">
                                {ct.name}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })()}

              {/* Step: Storage selection */}
              {createDialog.containerId != null && (
                <div className="space-y-2">
                  {storagesQuery.isLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground text-sm">
                        Loading storages…
                      </span>
                    </div>
                  ) : (
                      storagesQuery.data?.storages?.filter(
                        (s) => s.supportsBackup,
                      ) ?? []
                    ).length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-sm">
                      No backup-capable storages found on this server.
                    </p>
                  ) : (
                    storagesQuery.data?.storages
                      ?.filter((s) => s.supportsBackup)
                      .map((storage) => (
                        <button
                          key={storage.name}
                          onClick={() => setSelectedStorage(storage.name)}
                          className={[
                            "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                            selectedStorage === storage.name
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground",
                          ].join(" ")}
                        >
                          <span className="font-medium">{storage.name}</span>
                          <span className="ml-2 text-xs opacity-60">
                            {storage.type}
                          </span>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-border flex justify-end gap-3 border-t p-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialog(null);
                  setSelectedStorage("");
                }}
              >
                Cancel
              </Button>
              {createDialog.containerId != null && (
                <Button
                  onClick={handleStartBackup}
                  disabled={!selectedStorage || storagesQuery.isLoading}
                >
                  Start Backup
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
