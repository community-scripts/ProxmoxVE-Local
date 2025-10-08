
'use client';

import { useState } from 'react';
import { ScriptsGrid } from './_components/ScriptsGrid';
import { DownloadedScriptsTab } from './_components/DownloadedScriptsTab';
import { InstalledScriptsTab } from './_components/InstalledScriptsTab';
import { ResyncButton } from './_components/ResyncButton';
import { Terminal } from './_components/Terminal';
import { ServerSettingsButton } from './_components/ServerSettingsButton';
import { SettingsButton } from './_components/SettingsButton';
import { VersionDisplay } from './_components/VersionDisplay';
import { Button } from './_components/ui/button';
import { Rocket, Package, HardDrive, FolderOpen } from 'lucide-react';

export default function Home() {
  const [runningScript, setRunningScript] = useState<{ path: string; name: string; mode?: 'local' | 'ssh'; server?: any } | null>(null);
  const [activeTab, setActiveTab] = useState<'scripts' | 'downloaded' | 'installed'>('scripts');

  const handleRunScript = (scriptPath: string, scriptName: string, mode?: 'local' | 'ssh', server?: any) => {
    setRunningScript({ path: scriptPath, name: scriptName, mode, server });
  };

  const handleCloseTerminal = () => {
    setRunningScript(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 flex items-center justify-center gap-2 sm:gap-3">
            <Rocket className="h-6 w-6 sm:h-8 w-8 lg:h-9 lg:w-9" />
            <span className="break-words">PVE Scripts Management</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 px-2">
            Manage and execute Proxmox helper scripts locally with live output streaming
          </p>
          <div className="flex justify-center px-2">
            <VersionDisplay />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 p-4 sm:p-6 bg-card rounded-lg shadow-sm border border-border">
            <ServerSettingsButton />
            <SettingsButton />
            <ResyncButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 lg:space-x-8">
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('scripts')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'scripts'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}> 
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Available Scripts</span>
                <span className="sm:hidden">Available</span>
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('downloaded')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'downloaded'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}>
                <HardDrive className="h-4 w-4" />
                <span className="hidden sm:inline">Downloaded Scripts</span>
                <span className="sm:hidden">Downloaded</span>
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('installed')}
                className={`px-3 py-2 text-sm flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                  activeTab === 'installed'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}>
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Installed Scripts</span>
                <span className="sm:hidden">Installed</span>
              </Button>
            </nav>
          </div>
        </div>



        {/* Running Script Terminal */}
        {runningScript && (
          <div className="mb-8">
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
          <DownloadedScriptsTab />
        )}
        
        {activeTab === 'installed' && (
          <InstalledScriptsTab />
        )}
      </div>
    </main>
  );
}
