'use client';

import { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, ChevronDown, ChevronRight, HardDrive, Database, Server, CheckCircle, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ConfirmationModal } from './ConfirmationModal';
import { LoadingModal } from './LoadingModal';

interface Backup {
  id: number;
  backup_name: string;
  backup_path: string;
  size: bigint | null;
  created_at: Date | null;
  storage_name: string;
  storage_type: string;
  discovered_at: Date;
  server_id: number;
  server_name: string | null;
  server_color: string | null;
}

interface ContainerBackups {
  container_id: string;
  hostname: string;
  backups: Backup[];
}

export function BackupsTab() {
  const [expandedContainers, setExpandedContainers] = useState<Set<string>>(new Set());
  const [hasAutoDiscovered, setHasAutoDiscovered] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<{ backup: Backup; containerId: string } | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string[]>([]);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const { data: backupsData, refetch: refetchBackups, isLoading } = api.backups.getAllBackupsGrouped.useQuery();
  const discoverMutation = api.backups.discoverBackups.useMutation({
    onSuccess: () => {
      void refetchBackups();
    },
  });

  const restoreMutation = api.backups.restoreBackup.useMutation({
    onMutate: () => {
      // Show progress immediately when mutation starts
      setRestoreProgress(['Starting restore...']);
      setRestoreError(null);
      setRestoreSuccess(false);
    },
    onSuccess: (result) => {
      if (result.success) {
        setRestoreSuccess(true);
        // Update progress with all messages from backend
        const progressMessages = result.progress?.map(p => p.message) || ['Restore completed successfully'];
        setRestoreProgress(progressMessages);
        setRestoreConfirmOpen(false);
        setSelectedBackup(null);
        // Clear success message after 5 seconds
        setTimeout(() => {
          setRestoreSuccess(false);
          setRestoreProgress([]);
        }, 5000);
      } else {
        setRestoreError(result.error || 'Restore failed');
        setRestoreProgress(result.progress?.map(p => p.message) || []);
      }
    },
    onError: (error) => {
      setRestoreError(error.message || 'Restore failed');
      setRestoreConfirmOpen(false);
      setSelectedBackup(null);
      setRestoreProgress([]);
    },
  });
  
  // Update progress text in modal based on current progress
  const currentProgressText = restoreProgress.length > 0 
    ? restoreProgress[restoreProgress.length - 1] 
    : 'Restoring backup...';

  // Auto-discover backups when tab is first opened
  useEffect(() => {
    if (!hasAutoDiscovered && !isLoading && backupsData) {
      // Only auto-discover if there are no backups yet
      if (!backupsData.backups || backupsData.backups.length === 0) {
        handleDiscoverBackups();
      }
      setHasAutoDiscovered(true);
    }
  }, [hasAutoDiscovered, isLoading, backupsData]);

  const handleDiscoverBackups = () => {
    discoverMutation.mutate();
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
      serverId: selectedBackup.backup.server_id,
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
    if (!bytes) return 'Unknown size';
    const b = Number(bytes);
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleString();
  };

  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case 'pbs':
        return <Database className="h-4 w-4" />;
      case 'local':
        return <HardDrive className="h-4 w-4" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const getStorageTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'pbs':
        return 'default';
      case 'local':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const backups = backupsData?.success ? backupsData.backups : [];
  const isDiscovering = discoverMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Backups</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Discovered backups grouped by container ID
          </p>
        </div>
        <Button
          onClick={handleDiscoverBackups}
          disabled={isDiscovering}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isDiscovering ? 'animate-spin' : ''}`} />
          {isDiscovering ? 'Discovering...' : 'Discover Backups'}
        </Button>
      </div>

      {/* Loading state */}
      {(isLoading || isDiscovering) && backups.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {isDiscovering ? 'Discovering backups...' : 'Loading backups...'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isDiscovering && backups.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <HardDrive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No backups found</h3>
          <p className="text-muted-foreground mb-4">
            Click "Discover Backups" to scan for backups on your servers.
          </p>
          <Button onClick={handleDiscoverBackups} disabled={isDiscovering}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isDiscovering ? 'animate-spin' : ''}`} />
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
                className="bg-card rounded-lg border border-border shadow-sm overflow-hidden"
              >
                {/* Container header - collapsible */}
                <button
                  onClick={() => toggleContainer(container.container_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          CT {container.container_id}
                        </span>
                        {container.hostname && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">{container.hostname}</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {backupCount} {backupCount === 1 ? 'backup' : 'backups'}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Container content - backups list */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="p-4 space-y-3">
                      {container.backups.map((backup) => (
                        <div
                          key={backup.id}
                          className="bg-muted/50 rounded-lg p-4 border border-border/50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-medium text-foreground break-all">
                                  {backup.backup_name}
                                </span>
                                <Badge
                                  variant={getStorageTypeBadgeVariant(backup.storage_type)}
                                  className="flex items-center gap-1"
                                >
                                  {getStorageTypeIcon(backup.storage_type)}
                                  {backup.storage_name}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                                <code className="text-xs text-muted-foreground break-all">
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
                                    className="bg-muted/20 hover:bg-muted/30 border border-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all duration-200 hover:scale-105 hover:shadow-md"
                                  >
                                    Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-48 bg-card border-border">
                                  <DropdownMenuItem
                                    onClick={() => handleRestoreClick(backup, container.container_id)}
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
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-destructive">
            Error loading backups: {backupsData.error || 'Unknown error'}
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
      {restoreMutation.isPending && (
        <LoadingModal
          isOpen={true}
          action={currentProgressText}
        />
      )}

      {/* Restore Progress Details - Show during restore */}
      {restoreMutation.isPending && (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span className="font-medium text-foreground">Restoring backup...</span>
          </div>
          {restoreProgress.length > 0 && (
            <div className="space-y-1">
              {restoreProgress.map((message, index) => (
                <p key={index} className="text-sm text-muted-foreground">
                  {message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restore Success */}
      {restoreSuccess && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="font-medium text-success">Restore completed successfully!</span>
          </div>
          {restoreProgress.length > 0 && (
            <div className="space-y-1 mt-2">
              {restoreProgress.map((message, index) => (
                <p key={index} className="text-sm text-muted-foreground">
                  {message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restore Error */}
      {restoreError && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="font-medium text-destructive">Restore failed</span>
          </div>
          <p className="text-sm text-destructive">{restoreError}</p>
          {restoreProgress.length > 0 && (
            <div className="space-y-1 mt-2">
              {restoreProgress.map((message, index) => (
                <p key={index} className="text-sm text-muted-foreground">
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
    </div>
  );
}

