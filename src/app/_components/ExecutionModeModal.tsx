"use client";

import { useState, useEffect } from "react";
import type { Server } from "../../types/server";
import { Button } from "./ui/button";
import { ColorCodedDropdown } from "./ColorCodedDropdown";
import { SettingsModal } from "./SettingsModal";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ExecutionModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (mode: "local" | "ssh", server?: Server) => void;
  scriptName: string;
}

export function ExecutionModeModal({
  isOpen,
  onClose,
  onExecute,
  scriptName,
}: ExecutionModeModalProps) {
  const { t } = useTranslation("executionModeModal");
  useRegisterModal(isOpen, {
    id: "execution-mode-modal",
    allowEscape: true,
    onClose,
  });
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Refresh servers when settings modal closes
  const handleSettingsModalClose = () => {
    setSettingsModalOpen(false);
    // Refetch servers to reflect any changes made in settings
    void fetchServers();
  };

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/servers");
      if (!response.ok) {
        throw new Error(t("errors.fetchFailed"));
      }
      const data = await response.json();
      // Sort servers by name alphabetically
      const sortedServers = (data as Server[]).sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      );
      setServers(sortedServers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchServers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-select server when exactly one server is available
  useEffect(() => {
    if (isOpen && !loading && servers.length === 1) {
      setSelectedServer(servers[0] ?? null);
    }
  }, [isOpen, loading, servers]);

  const handleExecute = () => {
    if (!selectedServer) {
      setError(t("errors.noServerSelected"));
      return;
    }

    onExecute("ssh", selectedServer);
    onClose();
  };

  const handleServerSelect = (server: Server | null) => {
    setSelectedServer(server);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b p-6">
            <h2 className="text-foreground text-xl font-bold">{t("title")}</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg
                className="h-6 w-6"
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
            {error && (
              <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-md border p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="text-destructive h-5 w-5"
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
                  <div className="ml-3">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-8 text-center">
                <div className="border-primary inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("loadingServers")}
                </p>
              </div>
            ) : servers.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <p className="text-sm">{t("noServersConfigured")}</p>
                <p className="mt-1 text-xs">{t("addServersHint")}</p>
                <Button
                  onClick={() => setSettingsModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  {t("openServerSettings")}
                </Button>
              </div>
            ) : servers.length === 1 ? (
              /* Single Server Confirmation View */
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-foreground mb-2 text-lg font-medium">
                    {t("installConfirmation.title")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("installConfirmation.description", {
                      values: { scriptName },
                    })}
                  </p>
                </div>

                <div className="bg-muted/50 border-border rounded-lg border p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="bg-success h-3 w-3 rounded-full"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {selectedServer?.name ?? t("unnamedServer")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {selectedServer?.ip}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button onClick={onClose} variant="outline" size="default">
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    onClick={handleExecute}
                    variant="default"
                    size="default"
                  >
                    {t("actions.install")}
                  </Button>
                </div>
              </div>
            ) : (
              /* Multiple Servers Selection View */
              <div className="space-y-6">
                <div className="mb-6">
                  <h3 className="text-foreground mb-2 text-lg font-medium">
                    {t("multipleServers.title", { values: { scriptName } })}
                  </h3>
                </div>

                {/* Server Selection */}
                <div className="mb-6">
                  <label
                    htmlFor="server"
                    className="text-foreground mb-2 block text-sm font-medium"
                  >
                    {t("multipleServers.selectServerLabel")}
                  </label>
                  <ColorCodedDropdown
                    servers={servers}
                    selectedServer={selectedServer}
                    onServerSelect={handleServerSelect}
                    placeholder={t("multipleServers.placeholder")}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button onClick={onClose} variant="outline" size="default">
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    onClick={handleExecute}
                    disabled={!selectedServer}
                    variant="default"
                    size="default"
                    className={
                      !selectedServer
                        ? "bg-muted-foreground cursor-not-allowed"
                        : ""
                    }
                  >
                    {t("actions.runOnServer")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Server Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={handleSettingsModalClose}
      />
    </>
  );
}
