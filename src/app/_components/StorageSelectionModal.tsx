"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Database, RefreshCw, CheckCircle } from "lucide-react";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import type { Storage } from "~/server/services/storageService";

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
  title = "Select Storage",
  description = "Select a storage to use.",
  filterFn,
  showBackupTag = true,
}: StorageSelectionModalProps) {
  const [selectedStorage, setSelectedStorage] = useState<Storage | null>(null);

  const zIndex = useRegisterModal(isOpen, {
    id: "storage-selection-modal",
    allowEscape: true,
    onClose,
  });

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
  const filteredStorages = filterFn
    ? storages.filter(filterFn)
    : storages.filter((s) => s.supportsBackup);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
      >
        <div className="bg-card border-border w-full max-w-2xl rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Database className="text-primary h-6 w-6" />
              <h2 className="text-card-foreground text-2xl font-bold">
                {title}
              </h2>
            </div>
            <Button
              onClick={handleClose}
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
          <div className="p-6">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
                <p className="text-muted-foreground">Loading storages...</p>
              </div>
            ) : filteredStorages.length === 0 ? (
              <div className="py-8 text-center">
                <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p className="text-foreground mb-2">
                  No backup-capable storages found
                </p>
                <p className="text-muted-foreground mb-4 text-sm">
                  Make sure your server has storages configured with backup
                  content type.
                </p>
                <Button onClick={onRefresh} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Storages
                </Button>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  {description}
                </p>

                {/* Storage List */}
                <div className="mb-4 max-h-96 space-y-2 overflow-y-auto">
                  {filteredStorages.map((storage) => (
                    <div
                      key={storage.name}
                      onClick={() => setSelectedStorage(storage)}
                      className={`cursor-pointer rounded-lg border p-4 transition-all ${
                        selectedStorage?.name === storage.name
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="text-foreground font-medium">
                              {storage.name}
                            </h3>
                            {showBackupTag && (
                              <span className="bg-success/20 text-success border-success/30 rounded border px-2 py-0.5 text-xs font-medium">
                                Backup
                              </span>
                            )}
                            <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium">
                              {storage.type}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-sm">
                            <span>Content: {storage.content.join(", ")}</span>
                            {storage.nodes && storage.nodes.length > 0 && (
                              <span className="ml-2">
                                • Nodes: {storage.nodes.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedStorage?.name === storage.name && (
                          <CheckCircle className="text-primary ml-2 h-5 w-5 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refresh Button */}
                <div className="mb-4 flex justify-end">
                  <Button onClick={onRefresh} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Fetch Storages
                  </Button>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col justify-end gap-3 sm:flex-row">
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
    </ModalPortal>
  );
}
