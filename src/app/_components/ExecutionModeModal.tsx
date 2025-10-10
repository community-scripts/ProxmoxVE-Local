'use client';

import { useState, useEffect } from 'react';
import type { Server } from '../../types/server';
import { Button } from './ui/button';
import { ColorCodedDropdown } from './ColorCodedDropdown';

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
  const [selectedMode, setSelectedMode] = useState<'local' | 'ssh'>('ssh');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchServers();
    }
  }, [isOpen]);

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
    if (selectedMode === 'ssh' && !selectedServer) {
      setError('Please select a server for SSH execution');
      return;
    }
    
    onExecute(selectedMode, selectedServer ?? undefined);
    onClose();
  };

  const handleServerSelect = (server: Server | null) => {
    setSelectedServer(server);
  };

  const handleModeChange = (mode: 'local' | 'ssh') => {
    setSelectedMode(mode);
    if (mode === 'local') {
      setSelectedServer(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Execution Mode</h2>
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
              Where would you like to execute &quot;{scriptName}&quot;?
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

          {/* Execution Mode Selection */}
          <div className="space-y-4 mb-6">


            {/* SSH Execution */}
            <div 
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedMode === 'ssh' 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleModeChange('ssh')}
            >
              <div className="flex items-center">
                <input
                  type="radio"
                  id="ssh"
                  name="executionMode"
                  value="ssh"
                  checked={selectedMode === 'ssh'}
                  onChange={() => handleModeChange('ssh')}
                  className="h-4 w-4 text-primary focus:ring-primary border-border"
                />
                <label htmlFor="ssh" className="ml-3 flex-1 cursor-pointer">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-foreground">SSH Execution</h4>
                      <p className="text-sm text-muted-foreground">Run the script on a remote server</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Server Selection (only for SSH mode) */}
          {selectedMode === 'ssh' && (
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
                  <p className="text-xs mt-1">Add servers in Settings to use SSH execution</p>
                </div>
              ) : (
                <ColorCodedDropdown
                  servers={servers}
                  selectedServer={selectedServer}
                  onServerSelect={handleServerSelect}
                  placeholder="Select a server..."
                />
              )}
            </div>
          )}

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
              disabled={selectedMode === 'ssh' && !selectedServer}
              variant="default"
              size="default"
              className={selectedMode === 'ssh' && !selectedServer ? 'bg-gray-400 cursor-not-allowed' : ''}
            >
              {selectedMode === 'local' ? 'Run Locally' : 'Run on Server'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
