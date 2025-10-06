
'use client';

import { useState } from 'react';
import { ScriptsGrid } from './_components/ScriptsGrid';
import { InstalledScriptsTab } from './_components/InstalledScriptsTab';
import { ResyncButton } from './_components/ResyncButton';
import { Terminal } from './_components/Terminal';
import { SettingsButton } from './_components/SettingsButton';

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
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            🚀 PVE Scripts Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage and execute Proxmox helper scripts locally with live output streaming
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8">
          <div className="flex items-left pr-4 mb-6">
            <SettingsButton />
            <ResyncButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('scripts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scripts'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                📦 Available Scripts
              </button>
              <button
                onClick={() => setActiveTab('installed')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'installed'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                🗂️ Installed Scripts
              </button>
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
