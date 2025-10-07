
'use client';

import { useState } from 'react';
import { ScriptsGrid } from './_components/ScriptsGrid';
import { InstalledScriptsTab } from './_components/InstalledScriptsTab';
import { ResyncButton } from './_components/ResyncButton';
import { Terminal } from './_components/Terminal';
import { SettingsButton } from './_components/SettingsButton';
import { Button } from './_components/ui/button';

export default function Home() {
  const [runningScript, setRunningScript] = useState<{ path: string; name: string; mode?: 'local' | 'ssh'; server?: any } | null>(null);
  const [activeTab, setActiveTab] = useState<'scripts' | 'installed'>('scripts');

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
          <h1 className="text-4xl font-bold text-foreground mb-2">
            🚀 PVE Scripts Management
          </h1>
          <p className="text-muted-foreground">
            Manage and execute Proxmox helper scripts locally with live output streaming
          </p>
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
                className={`px-3 py-1 text-sm ${
                  activeTab === 'scripts'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}> 
                📦 Available Scripts
              </Button>
              <Button
                variant="ghost"
                size="null"
                onClick={() => setActiveTab('installed')}
                className={`px-3 py-1 text-sm ${
                  activeTab === 'installed'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}>
                🗂️ Installed Scripts
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
        
        {activeTab === 'installed' && (
          <InstalledScriptsTab />
        )}
      </div>
    </main>
  );
}
