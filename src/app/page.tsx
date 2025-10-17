
'use client';

import { useState, useRef, useEffect } from 'react';
import { ScriptsGrid } from './_components/ScriptsGrid';
import { DownloadedScriptsTab } from './_components/DownloadedScriptsTab';
import { InstalledScriptsTab } from './_components/InstalledScriptsTab';
import { ResyncButton } from './_components/ResyncButton';
import { Terminal } from './_components/Terminal';
import { ServerSettingsButton } from './_components/ServerSettingsButton';
import { SettingsButton } from './_components/SettingsButton';
import { HelpButton } from './_components/HelpButton';
import { VersionDisplay } from './_components/VersionDisplay';
import { ThemeToggle } from './_components/ThemeToggle';
import { Button } from './_components/ui/button';
import { ContextualHelpIcon } from './_components/ContextualHelpIcon';
import { ReleaseNotesModal, getLastSeenVersion } from './_components/ReleaseNotesModal';
import { Footer } from './_components/Footer';
import { Package, HardDrive, FolderOpen } from 'lucide-react';
import { api } from '~/trpc/react';

export default function Home() {
  const [runningScript, setRunningScript] = useState<{ path: string; name: string; mode?: 'local' | 'ssh'; server?: any } | null>(null);
  const [activeTab, setActiveTab] = useState<'scripts' | 'downloaded' | 'installed'>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('activeTab') as 'scripts' | 'downloaded' | 'installed';
      return savedTab || 'scripts';
    }
    return 'scripts';
  });
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [highlightVersion, setHighlightVersion] = useState<string | undefined>(undefined);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch data for script counts
  const { data: scriptCardsData } = api.scripts.getScriptCardsWithCategories.useQuery();
  const { data: localScriptsData } = api.scripts.getAllDownloadedScripts.useQuery();
  const { data: installedScriptsData } = api.installedScripts.getAllInstalledScripts.useQuery();
  const { data: versionData } = api.version.getCurrentVersion.useQuery();

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab]);

  // Auto-show release notes modal after update
  useEffect(() => {
    if (versionData?.success && versionData.version) {
      const currentVersion = versionData.version;
      const lastSeenVersion = getLastSeenVersion();
      
      // If we have a current version and either no last seen version or versions don't match
      if (currentVersion && (!lastSeenVersion || currentVersion !== lastSeenVersion)) {
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
      
      scriptCardsData.cards?.forEach(script => {
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
      
      scriptCardsData.cards?.forEach(script => {
        if (script?.name && script?.slug) {
          if (!scriptMap.has(script.slug)) {
            scriptMap.set(script.slug, script);
          }
        }
      });
      
      const deduplicatedGithubScripts = Array.from(scriptMap.values());
      const localScripts = localScriptsData.scripts ?? [];
      
      // Count scripts that are both in deduplicated GitHub data and have local versions
      return deduplicatedGithubScripts.filter(script => {
        if (!script?.name) return false;
        return localScripts.some(local => {
          if (!local?.name) return false;
          const localName = local.name.replace(/\.sh$/, '');
          return localName.toLowerCase() === script.name.toLowerCase() || 
                 localName.toLowerCase() === (script.slug ?? '').toLowerCase();
        });
      }).length;
    })(),
    installed: installedScriptsData?.scripts?.length ?? 0
  };

  const scrollToTerminal = () => {
    if (terminalRef.current) {
      // Get the element's position and scroll with a small offset for better mobile experience
      const elementTop = terminalRef.current.offsetTop;
      const offset = window.innerWidth < 768 ? 20 : 0; // Small offset on mobile
      
      window.scrollTo({
        top: elementTop - offset,
        behavior: 'smooth'
      });
    }
  };

  const handleRunScript = (scriptPath: string, scriptName: string, mode?: 'local' | 'ssh', server?: any) => {
    setRunningScript({ path: scriptPath, name: scriptName, mode, server });
    // Scroll to terminal after a short delay to ensure it's rendered
    setTimeout(scrollToTerminal, 100);
  };

  const handleCloseTerminal = () => {
    setRunningScript(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1"></div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground flex items-center justify-center gap-2 sm:gap-3 flex-1">
              <span className="break-words">PVE Scripts Management</span>
            </h1>
            <div className="flex-1 flex justify-end">
              <ThemeToggle />
            </div>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 px-2">
            Manage and execute Proxmox helper scripts locally with live output streaming
          </p>
          <div className="flex justify-center px-2">
            <VersionDisplay onOpenReleaseNotes={handleOpenReleaseNotes} />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 p-4 sm:p-6 bg-card rounded-lg shadow-sm border border-border">
            <ServerSettingsButton />
            <SettingsButton />
            <ResyncButton />
            <HelpButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-1">
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('scripts')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'scripts'
                    ? 'bg-accent text-accent-foreground rounded-t-md rounded-b-none'
                    : 'hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none'
                }`}>
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Available Scripts</span>
                <span className="sm:hidden">Available</span>
                <span className="ml-1 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                  {scriptCounts.available}
                </span>
                <ContextualHelpIcon section="available-scripts" tooltip="Help with Available Scripts" />
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('downloaded')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'downloaded'
                    ? 'bg-accent text-accent-foreground rounded-t-md rounded-b-none'
                    : 'hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none'
                }`}>
                <HardDrive className="h-4 w-4" />
                <span className="hidden sm:inline">Downloaded Scripts</span>
                <span className="sm:hidden">Downloaded</span>
                <span className="ml-1 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                  {scriptCounts.downloaded}
                </span>
                <ContextualHelpIcon section="downloaded-scripts" tooltip="Help with Downloaded Scripts" />
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('installed')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'installed'
                    ? 'bg-accent text-accent-foreground rounded-t-md rounded-b-none'
                    : 'hover:bg-accent hover:text-accent-foreground hover:rounded-t-md hover:rounded-b-none'
                }`}>
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Installed Scripts</span>
                <span className="sm:hidden">Installed</span>
                <span className="ml-1 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                  {scriptCounts.installed}
                </span>
                <ContextualHelpIcon section="installed-scripts" tooltip="Help with Installed Scripts" />
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
        {activeTab === 'scripts' && (
          <ScriptsGrid onInstallScript={handleRunScript} />
        )}
        
        {activeTab === 'downloaded' && (
          <DownloadedScriptsTab onInstallScript={handleRunScript} />
        )}
        
        {activeTab === 'installed' && (
          <InstalledScriptsTab />
        )}
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
