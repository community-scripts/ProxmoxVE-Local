'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Database, RefreshCw, CheckCircle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import type { Storage } from '~/server/services/storageService';

interface StorageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (storage: Storage) => void;
  storages: Storage[];
  isLoading: boolean;
  onRefresh: () => void;
  title?: string;
  description?: string;
  filterFn?: (storage: Storage) => boolean;
  showBackupTag?: boolean;
}

export function StorageSelectionModal({
  isOpen,
  onClose,
  onSelect,
  storages,
  isLoading,
  onRefresh,
  title = 'Select Storage',
  description = 'Select a storage to use.',
  filterFn,
  showBackupTag = true
}: StorageSelectionModalProps) {
  const [selectedStorage, setSelectedStorage] = useState<Storage | null>(null);
  
  useRegisterModal(isOpen, { id: 'storage-selection-modal', allowEscape: true, onClose });

  if (!isOpen) return null;

  const handleSelect = () => {
    if (selectedStorage) {
      onSelect(selectedStorage);
      setSelectedStorage(null);
    }
  };

  const handleClose = () => {
    setSelectedStorage(null);
    onClose();
  };

  // Filter storages using filterFn if provided, otherwise filter to show only backup-capable storages
  const filteredStorages = filterFn ? storages.filter(filterFn) : storages.filter(s => s.supportsBackup);

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-card-foreground">{title}</h2>
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading storages...</p>
            </div>
          ) : filteredStorages.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground mb-2">No backup-capable storages found</p>
              <p className="text-sm text-muted-foreground mb-4">
                Make sure your server has storages configured with backup content type.
              </p>
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Storages
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {description}
              </p>

              {/* Storage List */}
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {filteredStorages.map((storage) => (
                  <div
                    key={storage.name}
                    onClick={() => setSelectedStorage(storage)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedStorage?.name === storage.name
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{storage.name}</h3>
                          {showBackupTag && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-success/20 text-success border border-success/30">
                              Backup
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                            {storage.type}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>Content: {storage.content.join(', ')}</span>
                          {storage.nodes && storage.nodes.length > 0 && (
                            <span className="ml-2">• Nodes: {storage.nodes.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      {selectedStorage?.name === storage.name && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Refresh Button */}
              <div className="flex justify-end mb-4">
                <Button onClick={onRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Storages
                </Button>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!selectedStorage}
              variant="default"
              size="default"
              className="w-full sm:w-auto"
            >
              Select Storage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



