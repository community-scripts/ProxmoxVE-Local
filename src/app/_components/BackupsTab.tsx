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
  // mode "existing": opened from container row (serverId + containerIds pre-filled)
  // mode "new":      opened from header button (pick server → containers → storage)
  const [createDialog, setCreateDialog] = useState<{
    mode: "existing" | "new";
    serverId: number | null;
    containerIds: string[]; // multi-select
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

  // Storages for create-backup dialog (shown once at least one container is selected)
  const storagesQuery = api.installedScripts.getBackupStorages.useQuery(
    { serverId: createDialog?.serverId ?? 0 },
    {
      enabled:
        (createDialog?.serverId ?? 0) > 0 &&
        (createDialog?.containerIds.length ?? 0) > 0,
    },
  );

  // Containers for new-backup dialog (shown when server is picked)
  const containersQuery = api.installedScripts.listContainersOnServer.useQuery(
    { serverId: createDialog?.serverId ?? 0 },
    {
      enabled:
        createDialog?.mode === "new" &&
        (createDialog?.serverId ?? 0) > 0,
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
    setCreateDialog({ mode: "existing", serverId, containerIds: [containerId] });
    setSelectedStorage("");
  };

  const handleStartBackup = () => {
    if (
      !createDialog?.containerIds.length ||
      !createDialog?.serverId ||
      !selectedStorage
    )
      return;
    const server = servers.find((s) => s.id === createDialog.serverId);
    if (!server) return;
    for (const cid of createDialog.containerIds) {
      shell.open({
        containerId: cid,
        server,
        containerType: "lxc",
        backupStorage: selectedStorage,
        onComplete: () => discoverMutation.mutate(),
      });
    }
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
                containerIds: [],
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

      {/* ── Create Backup Dialog ── */}
      {createDialog && (() => {
        // Build typed container list once
        type CT = { id: string; name: string; status: string; type: "CT" | "VM" };
        const lxcItems: CT[] = (containersQuery.data?.lxc ?? []).map((c) => ({
          id: c.id, name: c.name, status: c.status, type: "CT" as const,
        }));
        const vmItems: CT[] = (containersQuery.data?.vm ?? []).map((c) => ({
          id: c.id, name: c.name, status: c.status, type: "VM" as const,
        }));
        const allContainers: CT[] = [...lxcItems, ...vmItems];

        const isContainerStep =
          createDialog.mode === "new" && createDialog.serverId != null;
        const isStorageStep = createDialog.containerIds.length > 0;

        const stepLabel =
          createDialog.mode === "existing"
            ? `Backup CT ${createDialog.containerIds[0]} — select storage`
            : createDialog.serverId == null
              ? "Select Server"
              : isStorageStep
                ? `${createDialog.containerIds.length} container${createDialog.containerIds.length > 1 ? "s" : ""} selected — select storage`
                : "Select Containers";

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
            <div className="bg-card border-border w-full max-w-2xl rounded-2xl border shadow-2xl">
              {/* Header */}
              <div className="border-border flex items-center gap-3 border-b px-6 py-4">
                {createDialog.mode === "new" && createDialog.serverId != null && (
                  <button
                    onClick={() =>
                      setCreateDialog((d) => {
                        if (!d) return null;
                        if (isStorageStep)
                          return { ...d, containerIds: [] };
                        return { ...d, serverId: null, containerIds: [] };
                      })
                    }
                    className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="flex-1">
                  <h3 className="text-foreground text-lg font-semibold">
                    {createDialog.mode === "existing" ? "Create Backup" : "New Backup"}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-sm">{stepLabel}</p>
                </div>
                <button
                  onClick={() => { setCreateDialog(null); setSelectedStorage(""); }}
                  className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Step 1: Server selection (new mode only) */}
                {createDialog.mode === "new" && createDialog.serverId == null && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      Choose a server
                    </p>
                    {servers.length === 0 ? (
                      <p className="text-muted-foreground py-6 text-center text-sm">
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
                          className="border-border hover:border-primary/60 hover:bg-primary/5 group flex w-full items-center rounded-xl border px-5 py-4 text-left transition-colors"
                        >
                          <div className="bg-primary/10 mr-4 flex h-9 w-9 items-center justify-center rounded-lg">
                            <Server className="text-primary h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-foreground font-medium">{srv.name}</p>
                            <p className="text-muted-foreground text-sm">{srv.ip}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Step 2: Container multi-select (new mode, server chosen, no storage yet) */}
                {isContainerStep && !isStorageStep && (
                  <div>
                    <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      Select containers (multiple allowed)
                    </p>
                    {containersQuery.isLoading ? (
                      <div className="flex items-center gap-2 py-6">
                        <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground text-sm">Loading containers…</span>
                      </div>
                    ) : allContainers.length === 0 ? (
                      <p className="text-muted-foreground py-6 text-center text-sm">
                        No containers found on this server.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {allContainers.map((ct) => {
                          const selected = createDialog.containerIds.includes(ct.id);
                          return (
                            <button
                              key={ct.id}
                              onClick={() =>
                                setCreateDialog((d) => {
                                  if (!d) return null;
                                  const ids = d.containerIds.includes(ct.id)
                                    ? d.containerIds.filter((id) => id !== ct.id)
                                    : [...d.containerIds, ct.id];
                                  return { ...d, containerIds: ids };
                                })
                              }
                              className={[
                                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                                selected
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/40 hover:bg-accent/50",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                                  selected
                                    ? "border-primary bg-primary"
                                    : "border-border bg-background",
                                ].join(" ")}
                              >
                                {selected && (
                                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={[
                                      "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                      ct.type === "VM"
                                        ? "bg-blue-500/10 text-blue-500"
                                        : "bg-green-500/10 text-green-500",
                                    ].join(" ")}
                                  >
                                    {ct.type}
                                  </span>
                                  <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                                    {ct.id}
                                  </span>
                                </div>
                                {ct.name && ct.name !== ct.id && (
                                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {ct.name}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Storage selection (once containers are chosen) */}
                {isStorageStep && (
                  <div>
                    {createDialog.mode === "new" && (
                      <div className="border-border bg-primary/5 mb-4 flex flex-wrap gap-2 rounded-lg border px-4 py-3">
                        {createDialog.containerIds.map((id) => (
                          <span
                            key={id}
                            className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium"
                          >
                            CT {id}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                      Select backup storage
                    </p>
                    {storagesQuery.isLoading ? (
                      <div className="flex items-center gap-2 py-6">
                        <RefreshCw className="text-muted-foreground h-4 w-4 animate-spin" />
                        <span className="text-muted-foreground text-sm">Loading storages…</span>
                      </div>
                    ) : (storagesQuery.data?.storages?.filter((s) => s.supportsBackup) ?? []).length === 0 ? (
                      <p className="text-muted-foreground py-6 text-center text-sm">
                        No backup-capable storages found on this server.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {storagesQuery.data?.storages
                          ?.filter((s) => s.supportsBackup)
                          .map((storage) => (
                            <button
                              key={storage.name}
                              onClick={() => setSelectedStorage(storage.name)}
                              className={[
                                "flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors",
                                selectedStorage === storage.name
                                  ? "border-primary bg-primary/10"
                                  : "border-border hover:border-primary/40 hover:bg-accent/50",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                                  selectedStorage === storage.name
                                    ? "border-primary"
                                    : "border-border",
                                ].join(" ")}
                              >
                                {selectedStorage === storage.name && (
                                  <div className="bg-primary h-2.5 w-2.5 rounded-full" />
                                )}
                              </div>
                              <div>
                                <p className={`font-medium ${selectedStorage === storage.name ? "text-primary" : "text-foreground"}`}>
                                  {storage.name}
                                </p>
                                <p className="text-muted-foreground text-xs">{storage.type}</p>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-border flex justify-between gap-3 border-t px-6 py-4">
                <Button
                  variant="ghost"
                  onClick={() => { setCreateDialog(null); setSelectedStorage(""); }}
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-3">
                  {/* "Continue" button when containers are chosen but no storage yet */}
                  {isContainerStep && !isStorageStep && (
                    <Button
                      disabled={createDialog.containerIds.length === 0}
                      onClick={() => {
                        /* containerIds already set — UI will show storage step automatically */
                        setCreateDialog((d) =>
                          d
                            ? { ...d, containerIds: [...d.containerIds] }
                            : null,
                        );
                      }}
                    >
                      Continue ({createDialog.containerIds.length} selected)
                    </Button>
                  )}
                  {isStorageStep && (
                    <Button
                      onClick={handleStartBackup}
                      disabled={!selectedStorage || storagesQuery.isLoading}
                    >
                      Start Backup{createDialog.containerIds.length > 1 ? ` (${createDialog.containerIds.length})` : ""}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
