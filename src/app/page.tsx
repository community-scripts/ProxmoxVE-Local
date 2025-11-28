"use client";

import { useState, useRef, useEffect } from "react";
import { ScriptsGrid } from "./_components/ScriptsGrid";
import { DownloadedScriptsTab } from "./_components/DownloadedScriptsTab";
import { InstalledScriptsTab } from "./_components/InstalledScriptsTab";
import { BackupsTab } from "./_components/BackupsTab";
import { ResyncButton } from "./_components/ResyncButton";
import { Terminal } from "./_components/Terminal";
import { ServerSettingsButton } from "./_components/ServerSettingsButton";
import { SettingsButton } from "./_components/SettingsButton";
import { HelpButton } from "./_components/HelpButton";
import { VersionDisplay } from "./_components/VersionDisplay";
import { ThemeToggle } from "./_components/ThemeToggle";
import { Button } from "./_components/ui/button";
import { ContextualHelpIcon } from "./_components/ContextualHelpIcon";
import {
  ReleaseNotesModal,
  getLastSeenVersion,
} from "./_components/ReleaseNotesModal";
import { Footer } from "./_components/Footer";
import { Package, HardDrive, FolderOpen, LogOut, Archive } from "lucide-react";
import { api } from "~/trpc/react";
import { useAuth } from "./_components/AuthProvider";
import type { Server } from "~/types/server";

export default function Home() {
  const { isAuthenticated, logout } = useAuth();
  const [runningScript, setRunningScript] = useState<{
    path: string;
    name: string;
    mode?: "local" | "ssh";
    server?: Server;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "scripts" | "downloaded" | "installed" | "backups"
  >(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("activeTab") as
        | "scripts"
        | "downloaded"
        | "installed"
        | "backups";
      return savedTab || "scripts";
    }
    return "scripts";
  });
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [highlightVersion, setHighlightVersion] = useState<string | undefined>(
    undefined,
  );
  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch data for script counts
  const { data: scriptCardsData } =
    api.scripts.getScriptCardsWithCategories.useQuery();
  const { data: localScriptsData } =
    api.scripts.getAllDownloadedScripts.useQuery();
  const { data: installedScriptsData } =
    api.installedScripts.getAllInstalledScripts.useQuery();
  const { data: backupsData } = api.backups.getAllBackupsGrouped.useQuery();
  const { data: versionData } = api.version.getCurrentVersion.useQuery();

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeTab", activeTab);
    }
  }, [activeTab]);

  // Auto-show release notes modal after update
  useEffect(() => {
    if (versionData?.success && versionData.version) {
      const currentVersion = versionData.version;
      const lastSeenVersion = getLastSeenVersion();

      // If we have a current version and either no last seen version or versions don't match
      if (
        currentVersion &&
        (!lastSeenVersion || currentVersion !== lastSeenVersion)
      ) {
        setHighlightVersion(currentVersion);
        setReleaseNotesOpen(true);
      }
    }
  }, [versionData]);

  const handleOpenReleaseNotes = () => {
    setHighlightVersion(undefined);
    setReleaseNotesOpen(true);
  };

  const handleCloseReleaseNotes = () => {
    setReleaseNotesOpen(false);
    setHighlightVersion(undefined);
  };

  // Calculate script counts
  const scriptCounts = {
    available: (() => {
      if (!scriptCardsData?.success) return 0;

      // Deduplicate scripts using Map by slug (same logic as ScriptsGrid.tsx)
      const scriptMap = new Map<string, any>();

      scriptCardsData.cards?.forEach((script) => {
        if (script?.name && script?.slug) {
          // Use slug as unique identifier, only keep first occurrence
          if (!scriptMap.has(script.slug)) {
            scriptMap.set(script.slug, script);
          }
        }
      });

      return scriptMap.size;
    })(),
    downloaded: (() => {
      if (!scriptCardsData?.success || !localScriptsData?.scripts) return 0;

      // Helper to normalize identifiers for robust matching
      const normalizeId = (s?: string): string =>
        (s ?? "")
          .toLowerCase()
          .replace(/\.(sh|bash|py|js|ts)$/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      // First deduplicate GitHub scripts using Map by slug
      interface ScriptCard {
        name?: string;
        slug?: string;
        install_basenames?: string[];
      }
      const scriptMap = new Map<string, ScriptCard>();

      scriptCardsData.cards?.forEach((script) => {
        if (script?.name && script?.slug) {
          if (!scriptMap.has(script.slug)) {
            scriptMap.set(script.slug, script as ScriptCard);
          }
        }
      });

      const deduplicatedGithubScripts = Array.from(scriptMap.values());
      const localScripts = (localScriptsData.scripts ?? []) as Array<{
        name?: string;
        slug?: string;
      }>;

      // Count scripts that are both in deduplicated GitHub data and have local versions
      // Use the same matching logic as DownloadedScriptsTab and ScriptsGrid
      return deduplicatedGithubScripts.filter((script) => {
        if (!script?.name) return false;

        // Check if there's a corresponding local script
        return localScripts.some((local) => {
          if (!local?.name) return false;

          // Primary: Exact slug-to-slug matching (most reliable)
          if (local.slug && script.slug) {
            if (local.slug.toLowerCase() === script.slug.toLowerCase()) {
              return true;
            }
            // Also try normalized slug matching (handles filename-based slugs vs JSON slugs)
            if (
              normalizeId(local.slug ?? undefined) ===
              normalizeId(script.slug ?? undefined)
            ) {
              return true;
            }
          }

          // Secondary: Check install basenames (for edge cases where install script names differ from slugs)
          const normalizedLocal = normalizeId(local.name ?? undefined);
          const matchesInstallBasename =
            script.install_basenames?.some(
              (base) => normalizeId(String(base)) === normalizedLocal,
            ) ?? false;
          if (matchesInstallBasename) return true;

          // Tertiary: Normalized filename to normalized slug matching
          if (
            script.slug &&
            normalizeId(local.name ?? undefined) ===
              normalizeId(script.slug ?? undefined)
          ) {
            return true;
          }

          return false;
        });
      }).length;
    })(),
    installed: installedScriptsData?.scripts?.length ?? 0,
    backups: backupsData?.success ? backupsData.backups.length : 0,
  };

  const scrollToTerminal = () => {
    if (terminalRef.current) {
      // Get the element's position and scroll with a small offset for better mobile experience
      const elementTop = terminalRef.current.offsetTop;
      const offset = window.innerWidth < 768 ? 20 : 0; // Small offset on mobile

      window.scrollTo({
        top: elementTop - offset,
        behavior: "smooth",
      });
    }
  };

  const handleRunScript = (
    scriptPath: string,
    scriptName: string,
    mode?: "local" | "ssh",
    server?: Server,
  ) => {
    setRunningScript({ path: scriptPath, name: scriptName, mode, server });
    // Scroll to terminal after a short delay to ensure it's rendered
    setTimeout(scrollToTerminal, 100);
  };

  const handleCloseTerminal = () => {
    setRunningScript(null);
  };

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex-1"></div>
            <h1 className="text-foreground flex flex-1 items-center justify-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl lg:text-4xl">
              <span className="break-words">PVE Scripts Management</span>
            </h1>
            <div className="flex flex-1 items-center justify-end gap-2">
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
          <p className="text-muted-foreground mb-4 px-2 text-sm sm:text-base">
            Manage and execute Proxmox helper scripts locally with live output
            streaming
          </p>
          <div className="flex justify-center px-2">
            <VersionDisplay onOpenReleaseNotes={handleOpenReleaseNotes} />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-card border-border flex flex-col gap-4 rounded-lg border p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:p-6">
            <ServerSettingsButton />
            <SettingsButton />
            <ResyncButton />
            <HelpButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="border-border border-b">
            <nav className="-mb-px flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-1">
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab("scripts")}
                className={`flex w-full items-center justify-center gap-2 px-3 py-2 text-sm sm:w-auto sm:justify-start ${
                  activeTab === "scripts"
                    ? "bg-accent text-accent-foreground rounded-t-md rounded-b-none"
                    : "hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none"
                }`}
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Available Scripts</span>
                <span className="sm:hidden">Available</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.available}
                </span>
                <ContextualHelpIcon
                  section="available-scripts"
                  tooltip="Help with Available Scripts"
                />
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab("downloaded")}
                className={`flex w-full items-center justify-center gap-2 px-3 py-2 text-sm sm:w-auto sm:justify-start ${
                  activeTab === "downloaded"
                    ? "bg-accent text-accent-foreground rounded-t-md rounded-b-none"
                    : "hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none"
                }`}
              >
                <HardDrive className="h-4 w-4" />
                <span className="hidden sm:inline">Downloaded Scripts</span>
                <span className="sm:hidden">Downloaded</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.downloaded}
                </span>
                <ContextualHelpIcon
                  section="downloaded-scripts"
                  tooltip="Help with Downloaded Scripts"
                />
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab("installed")}
                className={`flex w-full items-center justify-center gap-2 px-3 py-2 text-sm sm:w-auto sm:justify-start ${
                  activeTab === "installed"
                    ? "bg-accent text-accent-foreground rounded-t-md rounded-b-none"
                    : "hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none"
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Installed Scripts</span>
                <span className="sm:hidden">Installed</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.installed}
                </span>
                <ContextualHelpIcon
                  section="installed-scripts"
                  tooltip="Help with Installed Scripts"
                />
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab("backups")}
                className={`flex w-full items-center justify-center gap-2 px-3 py-2 text-sm sm:w-auto sm:justify-start ${
                  activeTab === "backups"
                    ? "bg-accent text-accent-foreground rounded-t-md rounded-b-none"
                    : "hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none"
                }`}
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Backups</span>
                <span className="sm:hidden">Backups</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.backups}
                </span>
              </Button>
            </nav>
          </div>
        </div>

        {/* Running Script Terminal */}
        {runningScript && (
          <div ref={terminalRef} className="mb-8">
            <Terminal
              scriptPath={runningScript.path}
              onClose={handleCloseTerminal}
              mode={runningScript.mode}
              server={runningScript.server}
            />
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "scripts" && (
          <ScriptsGrid onInstallScript={handleRunScript} />
        )}

        {activeTab === "downloaded" && (
          <DownloadedScriptsTab onInstallScript={handleRunScript} />
        )}

        {activeTab === "installed" && <InstalledScriptsTab />}

        {activeTab === "backups" && <BackupsTab />}
      </div>

      {/* Footer */}
      <Footer onOpenReleaseNotes={handleOpenReleaseNotes} />

      {/* Release Notes Modal */}
      <ReleaseNotesModal
        isOpen={releaseNotesOpen}
        onClose={handleCloseReleaseNotes}
        highlightVersion={highlightVersion}
      />
    </main>
  );
}
