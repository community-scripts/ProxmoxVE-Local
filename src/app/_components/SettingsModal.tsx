"use client";

import { useState, useEffect } from "react";
import type { Server, CreateServerData } from "../../types/server";
import { ServerForm } from "./ServerForm";
import { ServerList } from "./ServerList";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import { X } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "settings-modal",
    allowEscape: true,
    onClose,
  });
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchServers();
    }
  }, [isOpen]);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/servers");
      if (!response.ok) {
        throw new Error("Failed to fetch servers");
      }
      const data = await response.json();
      // Sort servers by name alphabetically
      const sortedServers = (data as Server[]).sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      );
      setServers(sortedServers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateServer = async (serverData: CreateServerData) => {
    try {
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error("Failed to create server");
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create server");
    }
  };

  const handleUpdateServer = async (
    id: number,
    serverData: CreateServerData,
  ) => {
    try {
      const response = await fetch(`/api/servers/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error("Failed to update server");
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update server");
    }
  };

  const handleDeleteServer = async (id: number) => {
    try {
      const response = await fetch(`/api/servers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete server");
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete server");
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4"
        style={{ zIndex }}
      >
        <div className="bg-card max-h-[95vh] w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl sm:max-h-[90vh]">
          {/* Header */}
          <div className="border-border/60 flex items-center justify-between border-b px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                Server Settings
              </h2>
              <ContextualHelpIcon
                section="server-settings"
                tooltip="Help with Server Settings"
              />
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="max-h-[calc(95vh-100px)] overflow-y-auto p-4 sm:max-h-[calc(90vh-100px)] sm:p-6">
            {error && (
              <div className="bg-destructive/10 border-destructive mb-4 rounded-md border p-3 sm:p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="text-error h-4 w-4 sm:h-5 sm:w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-2 min-w-0 flex-1 sm:ml-3">
                    <h3 className="text-error-foreground text-xs font-medium sm:text-sm">
                      Error
                    </h3>
                    <div className="text-error/80 mt-1 text-xs break-words sm:mt-2 sm:text-sm">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-foreground mb-3 text-base font-medium sm:mb-4 sm:text-lg">
                  Server Configurations
                </h3>
                <ServerForm onSubmit={handleCreateServer} />
              </div>

              <div>
                <h3 className="text-foreground mb-3 text-base font-medium sm:mb-4 sm:text-lg">
                  Saved Servers
                </h3>
                {loading ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <div className="border-primary inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
                    <p className="text-muted-foreground mt-2">
                      Loading servers...
                    </p>
                  </div>
                ) : (
                  <ServerList
                    servers={servers}
                    onUpdate={handleUpdateServer}
                    onDelete={handleDeleteServer}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
