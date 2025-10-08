'use client';

import { useState } from 'react';
import type { Server, CreateServerData } from '../../types/server';
import { ServerForm } from './ServerForm';
import { Button } from './ui/button';

interface ServerListProps {
  servers: Server[];
  onUpdate: (id: number, data: CreateServerData) => void;
  onDelete: (id: number) => void;
}

export function ServerList({ servers, onUpdate, onDelete }: ServerListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingConnections, setTestingConnections] = useState<Set<number>>(new Set());
  const [connectionResults, setConnectionResults] = useState<Map<number, { success: boolean; message: string }>>(new Map());

  const handleEdit = (server: Server) => {
    setEditingId(server.id);
  };

  const handleUpdate = (data: CreateServerData) => {
    if (editingId) {
      onUpdate(editingId, data);
      setEditingId(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this server configuration?')) {
      onDelete(id);
    }
  };

  const handleTestConnection = async (server: Server) => {
    setTestingConnections(prev => new Set(prev).add(server.id));
    setConnectionResults(prev => {
      const newMap = new Map(prev);
      newMap.delete(server.id);
      return newMap;
    });

    try {
      const response = await fetch(`/api/servers/${server.id}/test-connection`, {
        method: 'POST',
      });

      const result = await response.json();
      
      setConnectionResults(prev => new Map(prev).set(server.id, {
        success: result.success,
        message: result.message
      }));
    } catch {
      setConnectionResults(prev => new Map(prev).set(server.id, {
        success: false,
        message: 'Failed to test connection - network error'
      }));
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(server.id);
        return newSet;
      });
    }
  };

  if (servers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-foreground">No servers configured</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get started by adding a new server configuration above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {servers.map((server) => (
        <div key={server.id} className="bg-card border border-border rounded-lg p-4 shadow-sm">
          {editingId === server.id ? (
            <div>
              <h4 className="text-lg font-medium text-foreground mb-4">Edit Server</h4>
              <ServerForm
                initialData={{
                  name: server.name,
                  ip: server.ip,
                  user: server.user,
                  password: server.password,
                }}
                onSubmit={handleUpdate}
                isEditing={true}
                onCancel={handleCancel}
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-medium text-foreground truncate">{server.name}</h3>
                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                        </svg>
                        <span className="truncate">{server.ip}</span>
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="truncate">{server.user}</span>
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created: {new Date(server.created_at).toLocaleDateString()}
                      {server.updated_at !== server.created_at && (
                        <span> • Updated: {new Date(server.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    
                    {/* Connection Test Result */}
                    {connectionResults.has(server.id) && (
                      <div className={`mt-2 p-2 rounded-md text-xs ${
                        connectionResults.get(server.id)?.success 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <div className="flex items-center">
                          {connectionResults.get(server.id)?.success ? (
                            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className="font-medium">
                            {connectionResults.get(server.id)?.success ? 'Connection Successful' : 'Connection Failed'}
                          </span>
                        </div>
                        <p className="mt-1">{connectionResults.get(server.id)?.message}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Button
                  onClick={() => handleTestConnection(server)}
                  disabled={testingConnections.has(server.id)}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto border-green-500/20 text-green-400 bg-green-500/10 hover:bg-green-500/20"
                >
                  {testingConnections.has(server.id) ? (
                    <>
                      <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="hidden sm:inline">Testing...</span>
                      <span className="sm:hidden">Test...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="hidden sm:inline">Test Connection</span>
                      <span className="sm:hidden">Test</span>
                    </>
                  )}
                </Button>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleEdit(server)}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="hidden sm:inline">Edit</span>
                    <span className="sm:hidden">✏️</span>
                  </Button>
                  <Button
                    onClick={() => handleDelete(server.id)}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none border-destructive/20 text-destructive bg-destructive/10 hover:bg-destructive/20"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">🗑️</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

