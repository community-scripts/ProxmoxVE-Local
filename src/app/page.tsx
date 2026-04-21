"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ScriptsGrid } from "./_components/ScriptsGrid";
import { ResyncButton } from "./_components/SyncModal";
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
import { ShellProvider } from "./_components/ShellContext";
import { FloatingShell } from "./_components/FloatingShell";
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

function Home() {
  const { isAuthenticated, logout } = useAuth();
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
  // Core queries – always needed (fast, DB-only)
  const { data: scriptCardsData } =
    api.scripts.getScriptCardsWithCategories.useQuery();
  const { data: localScriptsData } =
    api.scripts.getAllDownloadedScripts.useQuery();
  const { data: versionData } = api.version.getCurrentVersion.useQuery();

  // Deferred queries – only fetch when their tab is active or has been visited
  const [installedVisited, setInstalledVisited] = useState(false);
  const [backupsVisited, setBackupsVisited] = useState(false);

  useEffect(() => {
    if (activeTab === "installed") setInstalledVisited(true);
    if (activeTab === "backups") setBackupsVisited(true);
  }, [activeTab]);

  // Installed scripts: deferred + routed through separate non-batched link
  const { data: installedScriptsData } =
    api.installedScripts.getAllInstalledScripts.useQuery(undefined, {
      enabled: activeTab === "installed" || installedVisited,
    });

  // Backups: deferred until tab visited
  const { data: backupsData } = api.backups.getAllBackupsGrouped.useQuery(
    undefined,
    {
      enabled: activeTab === "backups" || backupsVisited,
    },
  );

  // --- Cached badge counts for tabs that haven't been visited yet ---
  const [cachedInstalledCount, setCachedInstalledCount] = useState<number>(
    () => {
      if (typeof window !== "undefined") {
        const v = localStorage.getItem("badge:installed");
        return v ? Number(v) : 0;
      }
      return 0;
    },
  );
  const [cachedBackupsCount, setCachedBackupsCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const v = localStorage.getItem("badge:backups");
      return v ? Number(v) : 0;
    }
    return 0;
  });

  // Persist counts whenever fresh data arrives
  useEffect(() => {
    if (installedScriptsData?.scripts) {
      const count = installedScriptsData.scripts.length;
      setCachedInstalledCount(count);
      localStorage.setItem("badge:installed", String(count));
    }
  }, [installedScriptsData]);

  useEffect(() => {
    if (backupsData?.success) {
      const count = backupsData.backups.length;
      setCachedBackupsCount(count);
      localStorage.setItem("badge:backups", String(count));
    }
  }, [backupsData]);

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

  // Calculate script counts — memoize to avoid O(n²) on every render
  const scriptCounts = useMemo(() => {
    // Build local-slug lookup set once for O(1) matching
    const normalizeId = (s?: string): string =>
      (s ?? "")
        .toLowerCase()
        .replace(/\.(sh|bash|py|js|ts)$/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // Deduplicate GitHub scripts
    const scriptMap = new Map<string, ScriptCard>();
    if (scriptCardsData?.success) {
      scriptCardsData.cards?.forEach((script: ScriptCard) => {
        if (script?.name && script?.slug && !scriptMap.has(script.slug)) {
          scriptMap.set(script.slug, script);
        }
      });
    }

    const available = scriptMap.size;

    // Build local lookup sets for O(1) matching
    const localScripts = (localScriptsData?.scripts ?? []) as Array<{
      name?: string;
      slug?: string;
    }>;
    const localSlugs = new Set<string>();
    const localNormSlugs = new Set<string>();
    const localNormNames = new Set<string>();
    for (const local of localScripts) {
      if (local.slug) {
        localSlugs.add(local.slug.toLowerCase());
        localNormSlugs.add(normalizeId(local.slug));
      }
      if (local.name) {
        localNormNames.add(normalizeId(local.name));
      }
    }

    let downloaded = 0;
    if (scriptCardsData?.success && localScriptsData?.scripts) {
      for (const script of scriptMap.values()) {
        if (!script?.name) continue;
        const slug = script.slug;
        // Primary: exact slug match
        if (slug && localSlugs.has(slug.toLowerCase())) {
          downloaded++;
          continue;
        }
        // Normalized slug match
        if (slug && localNormSlugs.has(normalizeId(slug))) {
          downloaded++;
          continue;
        }
        // Secondary: install basenames
        if (
          script.install_basenames?.some((base) =>
            localNormNames.has(normalizeId(String(base))),
          )
        ) {
          downloaded++;
          continue;
        }
        // Tertiary: normalized slug vs local names
        if (slug && localNormNames.has(normalizeId(slug))) {
          downloaded++;
        }
      }
    }

    return {
      available,
      downloaded,
      installed: installedScriptsData?.scripts?.length ?? cachedInstalledCount,
      backups: backupsData?.success
        ? backupsData.backups.length
        : cachedBackupsCount,
    };
  }, [
    scriptCardsData,
    localScriptsData,
    installedScriptsData,
    backupsData,
    cachedInstalledCount,
    cachedBackupsCount,
  ]);

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
                PVE Scripts <span className="text-primary">Management</span>
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

        {/* Tab Content */}
        <div className="animate-section-in">
          {activeTab === "scripts" && <ScriptsGrid />}

          {activeTab === "downloaded" && <DownloadedScriptsTab />}

          {activeTab === "installed" && <InstalledScriptsTab />}

          {activeTab === "backups" && <BackupsTab />}

          {activeTab === "generator" && <GeneratorTab />}
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

export default function HomeWithShell() {
  return (
    <ShellProvider>
      <Home />
      <FloatingShell />
    </ShellProvider>
  );
}
