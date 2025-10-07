
'use client';

import { useState } from 'react';
import { ScriptsGrid } from './_components/ScriptsGrid';
import { DownloadedScriptsTab } from './_components/DownloadedScriptsTab';
import { InstalledScriptsTab } from './_components/InstalledScriptsTab';
import { ResyncButton } from './_components/ResyncButton';
import { Terminal } from './_components/Terminal';
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
            <Rocket className="h-9 w-9" />
            PVE Scripts Management
          </h1>
          <p className="text-muted-foreground mb-4">
            Manage and execute Proxmox helper scripts locally with live output streaming
          </p>
          <div className="flex justify-center">
            <VersionDisplay />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 p-6 bg-card rounded-lg shadow-sm border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <SettingsButton />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <ResyncButton />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('scripts')}
                className={`px-3 py-1 text-sm flex items-center gap-2 ${
                  activeTab === 'scripts'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}> 
                <Package className="h-4 w-4" />
                Available Scripts
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('downloaded')}
                className={`px-3 py-1 text-sm flex items-center gap-2 ${
                  activeTab === 'downloaded'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}>
                <HardDrive className="h-4 w-4" />
                Downloaded Scripts
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('installed')}
                className={`px-3 py-1 text-sm flex items-center gap-2 ${
                  activeTab === 'installed'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}>
                <FolderOpen className="h-4 w-4" />
                Installed Scripts
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
