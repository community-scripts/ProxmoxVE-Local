'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '~/trpc/react';
import { Terminal } from './Terminal';
import { StatusBadge } from './Badge';
import { Button } from './ui/button';
import { ScriptInstallationCard } from './ScriptInstallationCard';
import { getContrastColor } from '../../lib/colorUtils';

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
  server_color: string | null;
  installation_date: string;
  status: 'in_progress' | 'success' | 'failed';
  output_log: string | null;
}

export function InstalledScriptsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'in_progress'>('all');
  const [serverFilter, setServerFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'script_name' | 'container_id' | 'server_name' | 'status' | 'installation_date'>('script_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [updatingScript, setUpdatingScript] = useState<{ id: number; containerId: string; server?: any } | null>(null);
  const [editingScriptId, setEditingScriptId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{ script_name: string; container_id: string }>({ script_name: '', container_id: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<{ script_name: string; container_id: string; server_id: string }>({ script_name: '', container_id: '', server_id: 'local' });
  const [showAutoDetectForm, setShowAutoDetectForm] = useState(false);
  const [autoDetectServerId, setAutoDetectServerId] = useState<string>('');
  const [autoDetectStatus, setAutoDetectStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [cleanupStatus, setCleanupStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const cleanupRunRef = useRef(false);

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

  // Auto-detect LXC containers mutation
  const autoDetectMutation = api.installedScripts.autoDetectLXCContainers.useMutation({
    onSuccess: (data) => {
      console.log('Auto-detect success:', data);
      void refetchScripts();
      setShowAutoDetectForm(false);
      setAutoDetectServerId('');
      
      // Show detailed message about what was added/skipped
      let statusMessage = data.message ?? 'Auto-detection completed successfully!';
      if (data.skippedContainers && data.skippedContainers.length > 0) {
        const skippedNames = data.skippedContainers.map((c: any) => String(c.hostname)).join(', ');
        statusMessage += ` Skipped duplicates: ${skippedNames}`;
      }
      
      setAutoDetectStatus({ 
        type: 'success', 
        message: statusMessage
      });
      // Clear status after 8 seconds (longer for detailed info)
      setTimeout(() => setAutoDetectStatus({ type: null, message: '' }), 8000);
    },
    onError: (error) => {
      console.error('Auto-detect mutation error:', error);
      console.error('Error details:', {
        message: error.message,
        data: error.data
      });
      setAutoDetectStatus({ 
        type: 'error', 
        message: error.message ?? 'Auto-detection failed. Please try again.' 
      });
      // Clear status after 5 seconds
      setTimeout(() => setAutoDetectStatus({ type: null, message: '' }), 5000);
    }
  });

  // Cleanup orphaned scripts mutation
  const cleanupMutation = api.installedScripts.cleanupOrphanedScripts.useMutation({
    onSuccess: (data) => {
      console.log('Cleanup success:', data);
      void refetchScripts();
      
      if (data.deletedCount > 0) {
        setCleanupStatus({ 
          type: 'success', 
          message: `Cleanup completed! Removed ${data.deletedCount} orphaned script(s): ${data.deletedScripts.join(', ')}` 
        });
      } else {
        setCleanupStatus({ 
          type: 'success', 
          message: 'Cleanup completed! No orphaned scripts found.' 
        });
      }
      // Clear status after 8 seconds (longer for cleanup info)
      setTimeout(() => setCleanupStatus({ type: null, message: '' }), 8000);
    },
    onError: (error) => {
      console.error('Cleanup mutation error:', error);
      setCleanupStatus({ 
        type: 'error', 
        message: error.message ?? 'Cleanup failed. Please try again.' 
      });
      // Clear status after 5 seconds
      setTimeout(() => setCleanupStatus({ type: null, message: '' }), 5000);
    }
  });


  const scripts: InstalledScript[] = (scriptsData?.scripts as InstalledScript[]) ?? [];
  const stats = statsData?.stats;

  // Run cleanup when component mounts and scripts are loaded (only once)
  useEffect(() => {
    if (scripts.length > 0 && serversData?.servers && !cleanupMutation.isPending && !cleanupRunRef.current) {
      console.log('Running automatic cleanup check...');
      cleanupRunRef.current = true;
      void cleanupMutation.mutate();
    }
  }, [scripts.length, serversData?.servers, cleanupMutation]);

  // Filter and sort scripts
  const filteredScripts = scripts
    .filter((script: InstalledScript) => {
      const matchesSearch = script.script_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (script.container_id?.includes(searchTerm) ?? false) ||
                           (script.server_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'all' || script.status === statusFilter;
      
      const matchesServer = serverFilter === 'all' || 
                           (serverFilter === 'local' && !script.server_name) ||
                           (script.server_name === serverFilter);
      
      return matchesSearch && matchesStatus && matchesServer;
    })
    .sort((a: InstalledScript, b: InstalledScript) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'script_name':
          aValue = a.script_name.toLowerCase();
          bValue = b.script_name.toLowerCase();
          break;
        case 'container_id':
          aValue = a.container_id ?? '';
          bValue = b.container_id ?? '';
          break;
        case 'server_name':
          aValue = a.server_name ?? 'Local';
          bValue = b.server_name ?? 'Local';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'installation_date':
          aValue = new Date(a.installation_date).getTime();
          bValue = new Date(b.installation_date).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
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

  const handleAutoDetect = () => {
    if (!autoDetectServerId) {
      return;
    }

    if (autoDetectMutation.isPending) {
      return;
    }

    setAutoDetectStatus({ type: null, message: '' });
    console.log('Starting auto-detect for server ID:', autoDetectServerId);
    autoDetectMutation.mutate({ serverId: Number(autoDetectServerId) });
  };

  const handleCancelAutoDetect = () => {
    setShowAutoDetectForm(false);
    setAutoDetectServerId('');
  };

  const handleSort = (field: 'script_name' | 'container_id' | 'server_name' | 'status' | 'installation_date') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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

        {/* Add Script and Auto-Detect Buttons */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
            size="default"
          >
            {showAddForm ? 'Cancel Add Script' : '+ Add Manual Script Entry'}
          </Button>
          <Button
            onClick={() => setShowAutoDetectForm(!showAutoDetectForm)}
            variant={showAutoDetectForm ? "outline" : "secondary"}
            size="default"
          >
            {showAutoDetectForm ? 'Cancel Auto-Detect' : '🔍 Auto-Detect LXC Containers (Must contain a tag with "community-script")'}
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

        {/* Status Messages */}
        {(autoDetectStatus.type ?? cleanupStatus.type) && (
          <div className="mb-4 space-y-2">
            {/* Auto-Detect Status Message */}
            {autoDetectStatus.type && (
              <div className={`p-4 rounded-lg border ${
                autoDetectStatus.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {autoDetectStatus.type === 'success' ? (
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      autoDetectStatus.type === 'success' 
                        ? 'text-green-800 dark:text-green-200' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {autoDetectStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cleanup Status Message */}
            {cleanupStatus.type && (
              <div className={`p-4 rounded-lg border ${
                cleanupStatus.type === 'success' 
                  ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {cleanupStatus.type === 'success' ? (
                      <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      cleanupStatus.type === 'success' 
                        ? 'text-slate-700 dark:text-slate-300' 
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {cleanupStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auto-Detect LXC Containers Form */}
        {showAutoDetectForm && (
          <div className="mb-6 p-4 sm:p-6 bg-card rounded-lg border border-border shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4 sm:mb-6">Auto-Detect LXC Containers (Must contain a tag with &quot;community-script&quot;)</h3>
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      How it works
                    </h4>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      <p>This feature will:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Connect to the selected server via SSH</li>
                        <li>Scan all LXC config files in /etc/pve/lxc/</li>
                        <li>Find containers with &quot;community-script&quot; in their tags</li>
                        <li>Extract the container ID and hostname</li>
                        <li>Add them as installed script entries</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Select Server *
                </label>
                <select
                  value={autoDetectServerId}
                  onChange={(e) => setAutoDetectServerId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="">Choose a server...</option>
                  {serversData?.servers?.map((server: any) => (
                    <option key={server.id} value={server.id}>
                      {server.name} ({server.ip})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 sm:mt-6">
              <Button
                onClick={handleCancelAutoDetect}
                variant="outline"
                size="default"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAutoDetect}
                disabled={autoDetectMutation.isPending || !autoDetectServerId}
                variant="default"
                size="default"
                className="w-full sm:w-auto"
              >
                {autoDetectMutation.isPending ? '🔍 Scanning...' : '🔍 Start Auto-Detection'}
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
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort('script_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Script Name</span>
                        {sortField === 'script_name' && (
                          <span className="text-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort('container_id')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Container ID</span>
                        {sortField === 'container_id' && (
                          <span className="text-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort('server_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Server</span>
                        {sortField === 'server_name' && (
                          <span className="text-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortField === 'status' && (
                          <span className="text-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => handleSort('installation_date')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Installation Date</span>
                        {sortField === 'installation_date' && (
                          <span className="text-primary">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {filteredScripts.map((script) => (
                    <tr 
                      key={script.id} 
                      className="hover:bg-accent"
                      style={{ borderLeft: `4px solid ${script.server_color ?? 'transparent'}` }}
                    >
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
                      <td className="px-6 py-4 whitespace-nowrap text-left">
                        <span 
                          className="text-sm px-3 py-1 rounded inline-block"
                          style={{
                            backgroundColor: script.server_color ?? 'transparent',
                            color: script.server_color ? getContrastColor(script.server_color) : 'inherit'
                          }}
                        >
                          {script.server_name ?? '-'}
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
                                variant="outline"
                                size="sm"
                                className="bg-green-900/20 hover:bg-green-900/30 border-green-700/50 text-green-300 hover:text-green-200 hover:border-green-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              >
                                {updateScriptMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                variant="outline"
                                size="sm"
                                className="bg-gray-800/20 hover:bg-gray-800/30 border-gray-600/50 text-gray-300 hover:text-gray-200 hover:border-gray-500/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleEditScript(script)}
                                variant="outline"
                                size="sm"
                                className="bg-blue-900/20 hover:bg-blue-900/30 border-blue-700/50 text-blue-300 hover:text-blue-200 hover:border-blue-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
                              >
                                Edit
                              </Button>
                              {script.container_id && (
                                <Button
                                  onClick={() => handleUpdateScript(script)}
                                  variant="outline"
                                  size="sm"
                                  className="bg-cyan-900/20 hover:bg-cyan-900/30 border-cyan-700/50 text-cyan-300 hover:text-cyan-200 hover:border-cyan-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md"
                                >
                                  Update
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteScript(Number(script.id))}
                                variant="outline"
                                size="sm"
                                disabled={deleteScriptMutation.isPending}
                                className="bg-red-900/20 hover:bg-red-900/30 border-red-700/50 text-red-300 hover:text-red-200 hover:border-red-600/60 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
