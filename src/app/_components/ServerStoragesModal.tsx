'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Database, RefreshCw, CheckCircle, Lock, AlertCircle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import { api } from '~/trpc/react';
import { PBSCredentialsModal } from './PBSCredentialsModal';
import type { Storage } from '~/server/services/storageService';

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
  serverName
}: ServerStoragesModalProps) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [selectedPBSStorage, setSelectedPBSStorage] = useState<Storage | null>(null);
  
  const { data, isLoading, refetch } = api.installedScripts.getBackupStorages.useQuery(
    { serverId, forceRefresh },
    { enabled: isOpen }
  );
  
  // Fetch all PBS credentials for this server to show status indicators
  const { data: allCredentials } = api.pbsCredentials.getAllCredentialsForServer.useQuery(
    { serverId },
    { enabled: isOpen }
  );
  
  const credentialsMap = new Map<string, boolean>();
  if (allCredentials?.success) {
    allCredentials.credentials.forEach(c => {
      credentialsMap.set(c.storage_name, true);
    });
  }

  useRegisterModal(isOpen, { id: 'server-storages-modal', allowEscape: true, onClose });

  const handleRefresh = () => {
    setForceRefresh(true);
    void refetch();
    setTimeout(() => setForceRefresh(false), 1000);
  };

  if (!isOpen) return null;

  const storages = data?.success ? data.storages : [];
  const backupStorages = storages.filter(s => s.supportsBackup);

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-card-foreground">
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
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading storages...</p>
            </div>
          ) : !data?.success ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground mb-2">Failed to load storages</p>
              <p className="text-sm text-muted-foreground mb-4">
                {data?.error ?? 'Unknown error occurred'}
              </p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : storages.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground mb-2">No storages found</p>
              <p className="text-sm text-muted-foreground">
                Make sure your server has storages configured.
              </p>
            </div>
          ) : (
            <>
              {data.cached && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  Showing cached data. Click Refresh to fetch latest from server.
                </div>
              )}
              
              <div className="space-y-3">
                {storages.map((storage) => {
                  const isBackupCapable = storage.supportsBackup;
                  
                  return (
                    <div
                      key={storage.name}
                      className={`p-4 border rounded-lg ${
                        isBackupCapable
                          ? 'border-success/50 bg-success/5'
                          : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{storage.name}</h3>
                          {isBackupCapable && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-success/20 text-success border border-success/30 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Backup
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                            {storage.type}
                          </span>
                          {storage.type === 'pbs' && (
                            credentialsMap.has(storage.name) ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-success/20 text-success border border-success/30 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Credentials Configured
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-warning/20 text-warning border border-warning/30 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Credentials Needed
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>
                            <span className="font-medium">Content:</span> {storage.content.join(', ')}
                          </div>
                          {storage.nodes && storage.nodes.length > 0 && (
                            <div>
                              <span className="font-medium">Nodes:</span> {storage.nodes.join(', ')}
                            </div>
                          )}
                          {Object.entries(storage)
                            .filter(([key]) => !['name', 'type', 'content', 'supportsBackup', 'nodes'].includes(key))
                            .map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}
                              </div>
                            ))}
                        </div>
                        {storage.type === 'pbs' && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <Button
                              onClick={() => setSelectedPBSStorage(storage)}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Lock className="h-4 w-4" />
                              {credentialsMap.has(storage.name) ? 'Edit' : 'Configure'} Credentials
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {backupStorages.length > 0 && (
                <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg">
                  <p className="text-sm text-success font-medium">
                    {backupStorages.length} storage{backupStorages.length !== 1 ? 's' : ''} available for backups
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

