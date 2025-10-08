'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';
import { Terminal } from './Terminal';
import { StatusBadge } from './Badge';
import { Button } from './ui/button';
import { ScriptInstallationCard } from './ScriptInstallationCard';

interface InstalledScript {
  id: number;
  script_name: string;
  script_path: string;
  container_id: string | null;
  server_id: number | null;
  server_name: string | null;
  server_ip: string | null;
  server_user: string | null;
  server_password: string | null;
  installation_date: string;
  status: 'in_progress' | 'success' | 'failed';
  output_log: string | null;
}

export function InstalledScriptsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'in_progress'>('all');
  const [serverFilter, setServerFilter] = useState<string>('all');
  const [updatingScript, setUpdatingScript] = useState<{ id: number; containerId: string; server?: any } | null>(null);
  const [editingScriptId, setEditingScriptId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{ script_name: string; container_id: string }>({ script_name: '', container_id: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<{ script_name: string; container_id: string; server_id: string }>({ script_name: '', container_id: '', server_id: 'local' });

  // Fetch installed scripts
  const { data: scriptsData, refetch: refetchScripts, isLoading } = api.installedScripts.getAllInstalledScripts.useQuery();
  const { data: statsData } = api.installedScripts.getInstallationStats.useQuery();
  const { data: serversData } = api.servers.getAllServers.useQuery();

  // Delete script mutation
  const deleteScriptMutation = api.installedScripts.deleteInstalledScript.useMutation({
    onSuccess: () => {
      void refetchScripts();
    }
  });

  // Update script mutation
  const updateScriptMutation = api.installedScripts.updateInstalledScript.useMutation({
    onSuccess: () => {
      void refetchScripts();
      setEditingScriptId(null);
      setEditFormData({ script_name: '', container_id: '' });
    },
    onError: (error) => {
      alert(`Error updating script: ${error.message}`);
    }
  });

  // Create script mutation
  const createScriptMutation = api.installedScripts.createInstalledScript.useMutation({
    onSuccess: () => {
      void refetchScripts();
      setShowAddForm(false);
      setAddFormData({ script_name: '', container_id: '', server_id: 'local' });
    },
    onError: (error) => {
      alert(`Error creating script: ${error.message}`);
    }
  });


  const scripts: InstalledScript[] = (scriptsData?.scripts as InstalledScript[]) ?? [];
  const stats = statsData?.stats;

  // Filter scripts based on search and filters
  const filteredScripts = scripts.filter((script: InstalledScript) => {
    const matchesSearch = script.script_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (script.container_id?.includes(searchTerm) ?? false) ||
                         (script.server_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || script.status === statusFilter;
    
    const matchesServer = serverFilter === 'all' || 
                         (serverFilter === 'local' && !script.server_name) ||
                         (script.server_name === serverFilter);
    
    return matchesSearch && matchesStatus && matchesServer;
  });

  // Get unique servers for filter
  const uniqueServers: string[] = [];
  const seen = new Set<string>();
  for (const script of scripts) {
    if (script.server_name && !seen.has(String(script.server_name))) {
      uniqueServers.push(String(script.server_name));
      seen.add(String(script.server_name));
    }
  }

  const handleDeleteScript = (id: number) => {
    if (confirm('Are you sure you want to delete this installation record?')) {
      void deleteScriptMutation.mutate({ id });
    }
  };

  const handleUpdateScript = (script: InstalledScript) => {
    if (!script.container_id) {
      alert('No Container ID available for this script');
      return;
    }
    
    if (confirm(`Are you sure you want to update ${script.script_name}?`)) {
      // Get server info if it's SSH mode
      let server = null;
      if (script.server_id && script.server_user && script.server_password) {
        server = {
          id: script.server_id,
          name: script.server_name,
          ip: script.server_ip,
          user: script.server_user,
          password: script.server_password
        };
      }
      
      setUpdatingScript({
        id: script.id,
        containerId: script.container_id,
        server: server
      });
    }
  };

  const handleCloseUpdateTerminal = () => {
    setUpdatingScript(null);
  };

  const handleEditScript = (script: InstalledScript) => {
    setEditingScriptId(script.id);
    setEditFormData({
      script_name: script.script_name,
      container_id: script.container_id ?? ''
    });
  };

  const handleCancelEdit = () => {
    setEditingScriptId(null);
    setEditFormData({ script_name: '', container_id: '' });
  };

  const handleSaveEdit = () => {
    if (!editFormData.script_name.trim()) {
      alert('Script name is required');
      return;
    }

    if (editingScriptId) {
      updateScriptMutation.mutate({
        id: editingScriptId,
        script_name: editFormData.script_name.trim(),
        container_id: editFormData.container_id.trim() || undefined,
      });
    }
  };

  const handleInputChange = (field: 'script_name' | 'container_id', value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddFormChange = (field: 'script_name' | 'container_id' | 'server_id', value: string) => {
    setAddFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddScript = () => {
    if (!addFormData.script_name.trim()) {
      alert('Script name is required');
      return;
    }

    createScriptMutation.mutate({
      script_name: addFormData.script_name.trim(),
      script_path: `manual/${addFormData.script_name.trim()}`,
      container_id: addFormData.container_id.trim() || undefined,
      server_id: addFormData.server_id === 'local' ? undefined : Number(addFormData.server_id),
      execution_mode: addFormData.server_id === 'local' ? 'local' : 'ssh',
      status: 'success'
    });
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setAddFormData({ script_name: '', container_id: '', server_id: 'local' });
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading installed scripts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Update Terminal */}
      {updatingScript && (
        <div className="mb-8">
          <Terminal
            scriptPath={`update-${updatingScript.containerId}`}
            onClose={handleCloseUpdateTerminal}
            mode={updatingScript.server ? 'ssh' : 'local'}
            server={updatingScript.server}
            isUpdate={true}
            containerId={updatingScript.containerId}
          />
        </div>
      )}

      {/* Header with Stats */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Installed Scripts</h2>
        
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
              <div className="text-sm text-blue-300">Total Installations</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{stats.byStatus.success}</div>
              <div className="text-sm text-green-300">Successful</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-400">{stats.byStatus.failed}</div>
              <div className="text-sm text-red-300">Failed</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{stats.byStatus.in_progress}</div>
              <div className="text-sm text-yellow-300">In Progress</div>
            </div>
          </div>
        )}

        {/* Add Script Button */}
        <div className="mb-4">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
            size="default"
          >
            {showAddForm ? 'Cancel Add Script' : '+ Add Manual Script Entry'}
          </Button>
        </div>

        {/* Add Script Form */}
        {showAddForm && (
          <div className="mb-6 p-4 sm:p-6 bg-card rounded-lg border border-border shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4 sm:mb-6">Add Manual Script Entry</h3>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Script Name *
                </label>
                <input
                  type="text"
                  value={addFormData.script_name}
                  onChange={(e) => handleAddFormChange('script_name', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter script name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Container ID
                </label>
                <input
                  type="text"
                  value={addFormData.container_id}
                  onChange={(e) => handleAddFormChange('container_id', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Enter container ID"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Server
                </label>
                <select
                  value={addFormData.server_id}
                  onChange={(e) => handleAddFormChange('server_id', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="local">Select Server</option>
                  {serversData?.servers?.map((server: any) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 sm:mt-6">
              <Button
                onClick={handleCancelAdd}
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddScript}
                disabled={createScriptMutation.isPending}
                variant="default"
                size="default"
                className="w-full sm:w-auto"
              >
                {createScriptMutation.isPending ? 'Adding...' : 'Add Script'}
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-4">
          {/* Search Input - Full Width on Mobile */}
          <div className="w-full">
            <input
              type="text"
              placeholder="Search scripts, container IDs, or servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          {/* Filter Dropdowns - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'failed' | 'in_progress')}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
            </select>

            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Servers</option>
              <option value="local">Local</option>
              {uniqueServers.map(server => (
                <option key={server} value={server}>{server}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scripts Display - Mobile Cards / Desktop Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        {filteredScripts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {scripts.length === 0 ? 'No installed scripts found.' : 'No scripts match your filters.'}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden p-4 space-y-4">
              {filteredScripts.map((script) => (
                <ScriptInstallationCard
                  key={script.id}
                  script={script}
                  isEditing={editingScriptId === script.id}
                  editFormData={editFormData}
                  onInputChange={handleInputChange}
                  onEdit={() => handleEditScript(script)}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                  onUpdate={() => handleUpdateScript(script)}
                  onDelete={() => handleDeleteScript(Number(script.id))}
                  isUpdating={updateScriptMutation.isPending}
                  isDeleting={deleteScriptMutation.isPending}
                />
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Script Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Container ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Installation Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {filteredScripts.map((script) => (
                    <tr key={script.id} className="hover:bg-accent">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editFormData.script_name}
                              onChange={(e) => handleInputChange('script_name', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Script name"
                            />
                            <div className="text-xs text-muted-foreground">{script.script_path}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-foreground">{script.script_name}</div>
                            <div className="text-sm text-muted-foreground">{script.script_path}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <input
                            type="text"
                            value={editFormData.container_id}
                            onChange={(e) => handleInputChange('container_id', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Container ID"
                          />
                        ) : (
                          script.container_id ? (
                            <span className="text-sm font-mono text-foreground">{String(script.container_id)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {script.server_name ?? 'Local'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={script.status}>
                          {script.status.replace('_', ' ').toUpperCase()}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(String(script.installation_date))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {editingScriptId === script.id ? (
                            <>
                              <Button
                                onClick={handleSaveEdit}
                                disabled={updateScriptMutation.isPending}
                                variant="default"
                                size="sm"
                              >
                                {updateScriptMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleEditScript(script)}
                                variant="default"
                                size="sm"
                              >
                                Edit
                              </Button>
                              {script.container_id && (
                                <Button
                                  onClick={() => handleUpdateScript(script)}
                                  variant="link"
                                  size="sm"
                                >
                                  Update
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteScript(Number(script.id))}
                                variant="destructive"
                                size="sm"
                                disabled={deleteScriptMutation.isPending}
                              >
                                {deleteScriptMutation.isPending ? 'Deleting...' : 'Delete'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
