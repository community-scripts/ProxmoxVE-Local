'use client';

import { useState, useEffect } from 'react';
import type { Server } from '../../types/server';
import { Button } from './ui/button';
import { SettingsModal } from './SettingsModal';

interface ExecutionModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (mode: 'local' | 'ssh', server?: Server) => void;
  scriptName: string;
}

export function ExecutionModeModal({ isOpen, onClose, onExecute, scriptName }: ExecutionModeModalProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [hasAutoExecuted, setHasAutoExecuted] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasAutoExecuted(false);
      void fetchServers();
    }
  }, [isOpen]);

  // Auto-execute when exactly one server is available
  useEffect(() => {
    if (isOpen && !loading && servers.length === 1 && !hasAutoExecuted) {
      setHasAutoExecuted(true);
      onExecute('ssh', servers[0]);
      onClose();
    }
  }, [isOpen, loading, servers, hasAutoExecuted, onExecute, onClose]);

  // Refresh servers when settings modal closes
  const handleSettingsModalClose = () => {
    setSettingsModalOpen(false);
    // Refetch servers to reflect any changes made in settings
    void fetchServers();
  };

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/servers');
      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }
      const data = await response.json();
      setServers(data as Server[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = () => {
    if (!selectedServer) {
      setError('Please select a server for SSH execution');
      return;
    }
    
    onExecute('ssh', selectedServer);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Select Server</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Select server to execute &quot;{scriptName}&quot;
              </h3>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Server Selection */}
            <div className="mb-6">
              <label htmlFor="server" className="block text-sm font-medium text-foreground mb-2">
                Select Server
              </label>
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading servers...</p>
                </div>
              ) : servers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No servers configured</p>
                  <p className="text-xs mt-1">Add servers in Settings to execute scripts</p>
                  <Button
                    onClick={() => setSettingsModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Open Server Settings
                  </Button>
                </div>
              ) : (
                <select
                  id="server"
                  value={selectedServer?.id ?? ''}
                  onChange={(e) => {
                    const serverId = parseInt(e.target.value);
                    const server = servers.find(s => s.id === serverId);
                    setSelectedServer(server ?? null);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
                >
                  <option value="">Select a server...</option>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip}) - {server.user}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button
                onClick={onClose}
                variant="outline"
                size="default"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!selectedServer}
                variant="default"
                size="default"
                className={!selectedServer ? 'bg-gray-400 cursor-not-allowed' : ''}
              >
                Run on Server
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Server Settings Modal */}
      <SettingsModal 
        isOpen={settingsModalOpen} 
        onClose={handleSettingsModalClose} 
      />
    </>
  );
}
