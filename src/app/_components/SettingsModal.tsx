'use client';

import { useState, useEffect } from 'react';
import type { Server, CreateServerData } from '../../types/server';
import { ServerForm } from './ServerForm';
import { ServerList } from './ServerList';
import { Button } from './ui/button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'servers' | 'general'>('servers');

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

  const handleCreateServer = async (serverData: CreateServerData) => {
    try {
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error('Failed to create server');
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    }
  };

  const handleUpdateServer = async (id: number, serverData: CreateServerData) => {
    try {
      const response = await fetch(`/api/servers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error('Failed to update server');
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update server');
    }
  };

  const handleDeleteServer = async (id: number) => {
    try {
      const response = await fetch(`/api/servers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete server');
      }

      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server');
    }
  };

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-xl sm:text-2xl font-bold text-card-foreground">Settings</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-8 px-4 sm:px-6">
            <Button
              onClick={() => setActiveTab('servers')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'servers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Server Settings
            </Button>
            <Button
              onClick={() => setActiveTab('general')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              General
            </Button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 sm:p-4 bg-destructive/10 border border-destructive rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2 sm:ml-3 min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-red-700 break-words">{error}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'servers' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Server Configurations</h3>
                <ServerForm onSubmit={handleCreateServer} />
              </div>
              
              <div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Saved Servers</h3>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading servers...</p>
                  </div>
                ) : (
                  <ServerList
                    servers={servers}
                    onUpdate={handleUpdateServer}
                    onDelete={handleDeleteServer}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">General Settings</h3>
              <p className="text-sm sm:text-base text-muted-foreground">General settings will be available in a future update.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

