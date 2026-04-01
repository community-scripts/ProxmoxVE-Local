"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ScriptsGrid } from "./_components/ScriptsGrid";
import { ResyncButton } from "./_components/SyncModal";
import { Terminal } from "./_components/Terminal";
import { ServerSettingsButton } from "./_components/ServerSettingsButton";
import { SettingsButton } from "./_components/SettingsButton";
import { AppearanceButton } from "./_components/AppearanceButton";
import { HelpButton } from "./_components/HelpButton";
import { VersionDisplay } from "./_components/VersionDisplay";
import { ServerStatusIndicator } from "./_components/ServerStatusIndicator";
import { Button } from "./_components/ui/button";
import { ContextualHelpIcon } from "./_components/ContextualHelpIcon";
import {
  ReleaseNotesModal,
  getLastSeenVersion,
} from "./_components/ReleaseNotesModal";
import { Footer } from "./_components/Footer";
import {
  Package,
  HardDrive,
  FolderOpen,
  LogOut,
  Archive,
  Wand2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useAuth } from "./_components/AuthProvider";
import type { Server } from "~/types/server";
import type { ScriptCard } from "~/types/script";

// Lazy load heavy tab components — only the active tab is loaded
const DownloadedScriptsTab = dynamic(
  () =>
    import("./_components/DownloadedScriptsTab").then((m) => ({
      default: m.DownloadedScriptsTab,
    })),
  { loading: () => <TabSkeleton /> },
);
const InstalledScriptsTab = dynamic(
  () =>
    import("./_components/InstalledScriptsTab").then((m) => ({
      default: m.InstalledScriptsTab,
    })),
  { loading: () => <TabSkeleton /> },
);
const BackupsTab = dynamic(
  () =>
    import("./_components/BackupsTab").then((m) => ({ default: m.BackupsTab })),
  { loading: () => <TabSkeleton /> },
);
const GeneratorTab = dynamic(
  () =>
    import("./_components/GeneratorTab").then((m) => ({
      default: m.GeneratorTab,
    })),
  { loading: () => <TabSkeleton /> },
);

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, logout } = useAuth();
  const [runningScript, setRunningScript] = useState<{
    path: string;
    name: string;
    mode?: "local" | "ssh";
    server?: Server;
    envVars?: Record<string, string | number | boolean>;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "scripts" | "downloaded" | "installed" | "backups" | "generator"
  >(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("activeTab") as
        | "scripts"
        | "downloaded"
        | "installed"
        | "backups"
        | "generator";
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
      const scriptMap = new Map<string, ScriptCard>();

      scriptCardsData.cards?.forEach((script: ScriptCard) => {
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
      const scriptMap = new Map<string, ScriptCard>();

      scriptCardsData.cards?.forEach((script: ScriptCard) => {
        if (script?.name && script?.slug) {
          if (!scriptMap.has(script.slug)) {
            scriptMap.set(script.slug, script);
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
    envVars?: Record<string, string | number | boolean>,
  ) => {
    setRunningScript({
      path: scriptPath,
      name: scriptName,
      mode,
      server,
      envVars,
    });
    // Scroll to terminal after a short delay to ensure it's rendered
    setTimeout(scrollToTerminal, 100);
  };

  const handleCloseTerminal = () => {
    setRunningScript(null);
  };

  const tabs = useMemo(
    () => [
      {
        key: "scripts" as const,
        icon: Package,
        label: "Available Scripts",
        shortLabel: "Available",
        count: scriptCounts.available,
        help: "available-scripts",
      },
      {
        key: "downloaded" as const,
        icon: HardDrive,
        label: "Downloaded Scripts",
        shortLabel: "Downloaded",
        count: scriptCounts.downloaded,
        help: "downloaded-scripts",
      },
      {
        key: "installed" as const,
        icon: FolderOpen,
        label: "Installed Scripts",
        shortLabel: "Installed",
        count: scriptCounts.installed,
        help: "installed-scripts",
      },
      {
        key: "backups" as const,
        icon: Archive,
        label: "Backups",
        shortLabel: "Backups",
        count: scriptCounts.backups,
        help: undefined,
      },
      {
        key: "generator" as const,
        icon: Wand2,
        label: "Generator",
        shortLabel: "Generator",
        count: undefined,
        help: undefined,
      },
    ],
    [scriptCounts],
  );

  return (
    <main className="relative min-h-screen">
      {/* Sticky Navbar */}
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 h-16 border-b backdrop-blur-lg">
        <div className="mx-auto flex h-full max-w-[var(--layout-max-w)] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Logo/Brand + Version + Status */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
              <Image
                src="/favicon/android-chrome-192x192.png"
                alt="PVE Scripts Local"
                width={36}
                height={36}
                className="h-9 w-9"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-muted-foreground text-[0.6rem] font-bold tracking-[0.16em] uppercase">
                Community-Scripts ORG
              </span>
              <span className="text-foreground text-sm font-bold">
                PVE Scripts{" "}
                <span className="text-primary">Management</span>
              </span>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <ServerStatusIndicator />
              <VersionDisplay onOpenReleaseNotes={handleOpenReleaseNotes} />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <ServerSettingsButton />
            <SettingsButton />
            <AppearanceButton />
            <ResyncButton />
            <HelpButton />
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[var(--layout-max-w)] px-4 py-4 sm:px-6 sm:py-6">
        {/* Tab Navigation — pill style */}
        <div className="mb-6 sm:mb-8">
          <nav className="glass-card-static flex flex-col gap-1 border p-1.5 sm:flex-row sm:gap-0.5">
            {tabs.map(({ key, icon: Icon, label, shortLabel, count, help }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  activeTab === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
                {count !== undefined && (
                  <span
                    className={`ml-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      activeTab === key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {help && (
                  <ContextualHelpIcon
                    section={help}
                    tooltip={`Help with ${label}`}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Running Script Terminal */}
        {runningScript && (
          <div ref={terminalRef} className="animate-card-in mb-8">
            <Terminal
              scriptPath={runningScript.path}
              onClose={handleCloseTerminal}
              mode={runningScript.mode}
              server={runningScript.server}
              envVars={runningScript.envVars}
            />
          </div>
        )}

        {/* Tab Content */}
        <div className="animate-section-in">
          {activeTab === "scripts" && (
            <ScriptsGrid onInstallScript={handleRunScript} />
          )}

          {activeTab === "downloaded" && (
            <DownloadedScriptsTab onInstallScript={handleRunScript} />
          )}

          {activeTab === "installed" && <InstalledScriptsTab />}

          {activeTab === "backups" && <BackupsTab />}

          {activeTab === "generator" && (
            <GeneratorTab onInstallScript={handleRunScript} />
          )}
        </div>
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
