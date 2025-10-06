'use client';

import { useState, useEffect } from 'react';
import type { Server, CreateServerData } from '../../types/server';
import { ServerForm } from './ServerForm';
import { ServerList } from './ServerList';

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
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('servers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'servers'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Server Settings
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              General
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'servers' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Server Configurations</h3>
                <ServerForm onSubmit={handleCreateServer} />
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Saved Servers</h3>
                {loading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">General Settings</h3>
              <p className="text-gray-600 dark:text-gray-300">General settings will be available in a future update.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

