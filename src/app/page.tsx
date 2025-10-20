"use client";

import { useState, useRef, useEffect } from "react";
import { ScriptsGrid } from "./_components/ScriptsGrid";
import { DownloadedScriptsTab } from "./_components/DownloadedScriptsTab";
import { InstalledScriptsTab } from "./_components/InstalledScriptsTab";
import { ResyncButton } from "./_components/ResyncButton";
import { Terminal } from "./_components/Terminal";
import { ServerSettingsButton } from "./_components/ServerSettingsButton";
import { SettingsButton } from "./_components/SettingsButton";
import { HelpButton } from "./_components/HelpButton";
import { VersionDisplay } from "./_components/VersionDisplay";
import { ThemeToggle } from "./_components/ThemeToggle";
import { LanguageToggle } from "./_components/LanguageToggle";
import { Button } from "./_components/ui/button";
import { ContextualHelpIcon } from "./_components/ContextualHelpIcon";
import {
  ReleaseNotesModal,
  getLastSeenVersion,
} from "./_components/ReleaseNotesModal";
import { Footer } from "./_components/Footer";
import { Package, HardDrive, FolderOpen } from "lucide-react";
import { useTranslation } from "~/lib/i18n/useTranslation";
import { api } from "~/trpc/react";

export default function Home() {
  const { t } = useTranslation("layout");
  const [runningScript, setRunningScript] = useState<{
    path: string;
    name: string;
    mode?: "local" | "ssh";
    server?: any;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "scripts" | "downloaded" | "installed"
  >(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("activeTab") as
        | "scripts"
        | "downloaded"
        | "installed";
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

      // First deduplicate GitHub scripts using Map by slug
      const scriptMap = new Map<string, any>();

      scriptCardsData.cards?.forEach((script) => {
        if (script?.name && script?.slug) {
          if (!scriptMap.has(script.slug)) {
            scriptMap.set(script.slug, script);
          }
        }
      });

      const deduplicatedGithubScripts = Array.from(scriptMap.values());
      const localScripts = localScriptsData.scripts ?? [];

      // Count scripts that are both in deduplicated GitHub data and have local versions
      return deduplicatedGithubScripts.filter((script) => {
        if (!script?.name) return false;
        return localScripts.some((local) => {
          if (!local?.name) return false;
          const localName = local.name.replace(/\.sh$/, "");
          return (
            localName.toLowerCase() === script.name.toLowerCase() ||
            localName.toLowerCase() === (script.slug ?? "").toLowerCase()
          );
        });
      }).length;
    })(),
    installed: installedScriptsData?.scripts?.length ?? 0,
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
    server?: any,
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
              <span className="break-words">{t("title")}</span>
            </h1>
            <div className="flex flex-1 justify-end gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
          <p className="text-muted-foreground mb-4 px-2 text-sm sm:text-base">
            {t("tagline")}
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
                <span className="hidden sm:inline">{t("tabs.available")}</span>
                <span className="sm:hidden">{t("tabs.availableShort")}</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.available}
                </span>
                <ContextualHelpIcon
                  section="available-scripts"
                  tooltip={t("help.availableTooltip")}
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
                <span className="hidden sm:inline">{t("tabs.downloaded")}</span>
                <span className="sm:hidden">{t("tabs.downloadedShort")}</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.downloaded}
                </span>
                <ContextualHelpIcon
                  section="downloaded-scripts"
                  tooltip={t("help.downloadedTooltip")}
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
                <span className="hidden sm:inline">{t("tabs.installed")}</span>
                <span className="sm:hidden">{t("tabs.installedShort")}</span>
                <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-xs">
                  {scriptCounts.installed}
                </span>
                <ContextualHelpIcon
                  section="installed-scripts"
                  tooltip={t("help.installedTooltip")}
                />
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
