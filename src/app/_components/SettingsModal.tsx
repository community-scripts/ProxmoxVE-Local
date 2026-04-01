"use client";

import { useState, useEffect } from "react";
import type { Server, CreateServerData } from "../../types/server";
import { ServerForm } from "./ServerForm";
import { ServerList } from "./ServerList";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon, Type, Maximize2, Minimize2 } from "lucide-react";

type TextSize = "small" | "medium" | "large";
type LayoutWidth = "default" | "full";

function loadAppearance(): { textSize: TextSize; layoutWidth: LayoutWidth } {
  if (typeof window === "undefined")
    return { textSize: "medium", layoutWidth: "default" };
  try {
    const ts = localStorage.getItem("pve-text-size");
    const lw = localStorage.getItem("pve-layout-width");
    return {
      textSize:
        ts === "small" || ts === "medium" || ts === "large" ? ts : "medium",
      layoutWidth: lw === "full" ? "full" : "default",
    };
  } catch {
    return { textSize: "medium", layoutWidth: "default" };
  }
}

function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  root.classList.remove(
    "text-size-small",
    "text-size-medium",
    "text-size-large",
  );
  root.classList.add(`text-size-${size}`);
  localStorage.setItem("pve-text-size", size);
}

function applyLayoutWidth(width: LayoutWidth) {
  const root = document.documentElement;
  root.style.setProperty(
    "--layout-max-w",
    width === "full" ? "1800px" : "1440px",
  );
  localStorage.setItem("pve-layout-width", width);
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  useRegisterModal(isOpen, {
    id: "settings-modal",
    allowEscape: true,
    onClose,
  });
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"servers" | "appearance">(
    "servers",
  );

  // Appearance state
  const { theme, setTheme } = useTheme();
  const [textSize, setTextSize] = useState<TextSize>("medium");
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidth>("default");

  useEffect(() => {
    if (isOpen) {
      void fetchServers();
      const a = loadAppearance();
      setTextSize(a.textSize);
      setLayoutWidth(a.layoutWidth);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="bg-card max-h-[95vh] w-full max-w-4xl overflow-hidden rounded-lg shadow-xl sm:max-h-[90vh]">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-card-foreground text-xl font-bold sm:text-2xl">
              Settings
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
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
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

        {/* Tabs */}
        <div className="border-border flex border-b px-4 sm:px-6">
          <button
            onClick={() => setActiveTab("servers")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "servers"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Servers
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "appearance"
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            Appearance
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(95vh-180px)] overflow-y-auto p-4 sm:max-h-[calc(90vh-200px)] sm:p-6">
          {activeTab === "servers" && (
            <>
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
            </>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              {/* Theme */}
              <div>
                <h3 className="text-foreground mb-3 text-base font-medium">
                  Theme
                </h3>
                <div className="flex gap-2">
                  {[
                    { value: "light" as const, label: "Light", Icon: Sun },
                    { value: "dark" as const, label: "Dark", Icon: Moon },
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        theme === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Size */}
              <div>
                <h3 className="text-foreground mb-3 flex items-center gap-2 text-base font-medium">
                  <Type className="h-4 w-4" />
                  Text Size
                </h3>
                <div className="flex gap-2">
                  {[
                    { value: "small" as const, label: "Small" },
                    { value: "medium" as const, label: "Medium" },
                    { value: "large" as const, label: "Large" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setTextSize(value);
                        applyTextSize(value);
                      }}
                      className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        textSize === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Width */}
              <div>
                <h3 className="text-foreground mb-3 text-base font-medium">
                  Layout Width
                </h3>
                <div className="flex gap-2">
                  {[
                    {
                      value: "default" as const,
                      label: "Default (1440px)",
                      Icon: Minimize2,
                    },
                    {
                      value: "full" as const,
                      label: "Wide (1800px)",
                      Icon: Maximize2,
                    },
                  ].map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setLayoutWidth(value);
                        applyLayoutWidth(value);
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        layoutWidth === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
