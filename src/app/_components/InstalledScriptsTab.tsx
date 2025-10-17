'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '~/trpc/react';
import { Terminal } from './Terminal';
import { StatusBadge } from './Badge';
import { Button } from './ui/button';
import { ScriptInstallationCard } from './ScriptInstallationCard';
import { ConfirmationModal } from './ConfirmationModal';
import { ErrorModal } from './ErrorModal';
import { LoadingModal } from './LoadingModal';
import { LXCSettingsModal } from './LXCSettingsModal';
import { getContrastColor } from '../../lib/colorUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Settings } from 'lucide-react';

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
  server_auth_type: string | null;
  server_ssh_key: string | null;
  server_ssh_key_passphrase: string | null;
  server_ssh_port: number | null;
  server_color: string | null;
  installation_date: string;
  status: 'in_progress' | 'success' | 'failed';
  output_log: string | null;
  execution_mode: 'local' | 'ssh';
  container_status?: 'running' | 'stopped' | 'unknown';
  web_ui_ip: string | null;
  web_ui_port: number | null;
}

export function InstalledScriptsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'in_progress'>('all');
  const [serverFilter, setServerFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'script_name' | 'container_id' | 'server_name' | 'status' | 'installation_date'>('server_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [updatingScript, setUpdatingScript] = useState<{ id: number; containerId: string; server?: any } | null>(null);
  const [openingShell, setOpeningShell] = useState<{ id: number; containerId: string; server?: any } | null>(null);
  const [editingScriptId, setEditingScriptId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{ script_name: string; container_id: string; web_ui_ip: string; web_ui_port: string }>({ script_name: '', container_id: '', web_ui_ip: '', web_ui_port: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<{ script_name: string; container_id: string; server_id: string }>({ script_name: '', container_id: '', server_id: 'local' });
  const [showAutoDetectForm, setShowAutoDetectForm] = useState(false);
  const [autoDetectServerId, setAutoDetectServerId] = useState<string>('');
  const [autoDetectStatus, setAutoDetectStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [cleanupStatus, setCleanupStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const cleanupRunRef = useRef(false);

  // Container control state
  const [containerStatuses, setContainerStatuses] = useState<Map<number, 'running' | 'stopped' | 'unknown'>>(new Map());
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    variant: 'simple' | 'danger';
    title: string;
    message: string;
    confirmText?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [controllingScriptId, setControllingScriptId] = useState<number | null>(null);
  const scriptsRef = useRef<InstalledScript[]>([]);
  const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    type?: 'error' | 'success';
  } | null>(null);

  // Loading modal state
  const [loadingModal, setLoadingModal] = useState<{
    isOpen: boolean;
    action: string;
  } | null>(null);

  // LXC Settings modal state
  const [lxcSettingsModal, setLxcSettingsModal] = useState<{
    isOpen: boolean;
    script: InstalledScript | null;
  }>({ isOpen: false, script: null });

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
      setEditFormData({ script_name: '', container_id: '', web_ui_ip: '', web_ui_port: '' });
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

  // Get container statuses mutation
  const containerStatusMutation = api.installedScripts.getContainerStatuses.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        
        // Map container IDs to script IDs
        const currentScripts = scriptsRef.current;
        const statusMap = new Map<number, 'running' | 'stopped' | 'unknown'>();
        
        // For each script, find its container status
        currentScripts.forEach(script => {
          if (script.container_id && data.statusMap) {
            const containerStatus = (data.statusMap as Record<string, 'running' | 'stopped' | 'unknown'>)[script.container_id];
            if (containerStatus) {
              statusMap.set(script.id, containerStatus);
            } else {
              statusMap.set(script.id, 'unknown');
            }
          } else {
            statusMap.set(script.id, 'unknown');
          }
        });
        
        setContainerStatuses(statusMap);
      } else {
        console.error('Container status fetch failed:', data.error);
      }
    },
    onError: (error) => {
      console.error('Error fetching container statuses:', error);
    }
  });

  // Cleanup orphaned scripts mutation
  const cleanupMutation = api.installedScripts.cleanupOrphanedScripts.useMutation({
    onSuccess: (data) => {
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
      setTimeout(() => setCleanupStatus({ type: null, message: '' }), 8000);
    }
  });

  // Auto-detect Web UI mutation
  const autoDetectWebUIMutation = api.installedScripts.autoDetectWebUI.useMutation({
    onSuccess: (data) => {
      console.log('✅ Auto-detect WebUI success:', data);
      void refetchScripts();
      setAutoDetectStatus({ 
        type: 'success', 
        message: data.message ?? 'Web UI IP detected successfully!' 
      });
      // Clear status after 5 seconds
      setTimeout(() => setAutoDetectStatus({ type: null, message: '' }), 5000);
    },
    onError: (error) => {
      console.error('❌ Auto-detect Web UI error:', error);
      setAutoDetectStatus({ 
        type: 'error', 
        message: error.message ?? 'Auto-detect failed. Please try again.' 
      });
      // Clear status after 5 seconds
      setTimeout(() => setAutoDetectStatus({ type: null, message: '' }), 5000);
    }
  });

  // Container control mutations
  // Note: getStatusMutation removed - using direct API calls instead

  const controlContainerMutation = api.installedScripts.controlContainer.useMutation({
    onSuccess: (data, variables) => {
      setLoadingModal(null);
      setControllingScriptId(null);
      
      if (data.success) {
        // Update container status immediately in UI for instant feedback
        const newStatus = variables.action === 'start' ? 'running' : 'stopped';
        setContainerStatuses(prev => {
          const newMap = new Map(prev);
          // Find the script ID for this container using the container ID from the response
          const currentScripts = scriptsRef.current;
          const script = currentScripts.find(s => s.container_id === data.containerId);
          if (script) {
            newMap.set(script.id, newStatus);
          }
          return newMap;
        });

        // Show success modal
        setErrorModal({
          isOpen: true,
          title: `Container ${variables.action === 'start' ? 'Started' : 'Stopped'}`,
          message: data.message ?? `Container has been ${variables.action === 'start' ? 'started' : 'stopped'} successfully.`,
          details: undefined,
          type: 'success'
        });

        // Re-fetch status for all containers using bulk method (in background)
        fetchContainerStatuses();
      } else {
        // Show error message from backend
        const errorMessage = data.error ?? 'Unknown error occurred';
        setErrorModal({
          isOpen: true,
          title: 'Container Control Failed',
          message: 'Failed to control the container. Please check the error details below.',
          details: errorMessage
        });
      }
    },
    onError: (error) => {
      console.error('Container control error:', error);
      setLoadingModal(null);
      setControllingScriptId(null);
      
      // Show detailed error message
      const errorMessage = error.message ?? 'Unknown error occurred';
      setErrorModal({
        isOpen: true,
        title: 'Container Control Failed',
        message: 'An unexpected error occurred while controlling the container.',
        details: errorMessage
      });
    }
  });

  const destroyContainerMutation = api.installedScripts.destroyContainer.useMutation({
    onSuccess: (data) => {
      setLoadingModal(null);
      setControllingScriptId(null);
      
      if (data.success) {
        void refetchScripts();
        setErrorModal({
          isOpen: true,
          title: 'Container Destroyed',
          message: data.message ?? 'The container has been successfully destroyed and removed from the database.',
          details: undefined,
          type: 'success'
        });
      } else {
        // Show error message from backend
        const errorMessage = data.error ?? 'Unknown error occurred';
        setErrorModal({
          isOpen: true,
          title: 'Container Destroy Failed',
          message: 'Failed to destroy the container. Please check the error details below.',
          details: errorMessage
        });
      }
    },
    onError: (error) => {
      console.error('Container destroy error:', error);
      setLoadingModal(null);
      setControllingScriptId(null);
      
      // Show detailed error message
      const errorMessage = error.message ?? 'Unknown error occurred';
      setErrorModal({
        isOpen: true,
        title: 'Container Destroy Failed',
        message: 'An unexpected error occurred while destroying the container.',
        details: errorMessage
      });
    }
  });


  const scripts: InstalledScript[] = useMemo(() => (scriptsData?.scripts as InstalledScript[]) ?? [], [scriptsData?.scripts]);
  const stats = statsData?.stats;

  // Update ref when scripts change
  useEffect(() => {
    scriptsRef.current = scripts;
  }, [scripts]);

  // Function to fetch container statuses - simplified to just check all servers
  const fetchContainerStatuses = useCallback(() => {
    console.log('fetchContainerStatuses called, isPending:', containerStatusMutation.isPending);
    
    // Prevent multiple simultaneous status checks
    if (containerStatusMutation.isPending) {
      console.log('Status check already pending, skipping');
      return;
    }
    
    // Clear any existing timeout
    if (statusCheckTimeoutRef.current) {
      clearTimeout(statusCheckTimeoutRef.current);
    }
    
    // Debounce status checks by 500ms
    statusCheckTimeoutRef.current = setTimeout(() => {
      const currentScripts = scriptsRef.current;
      
      // Get unique server IDs from scripts
      const serverIds = [...new Set(currentScripts
        .filter(script => script.server_id)
        .map(script => script.server_id!))];

      console.log('Executing status check for server IDs:', serverIds);
      if (serverIds.length > 0) {
        containerStatusMutation.mutate({ serverIds });
      }
    }, 500);
  }, [containerStatusMutation]); 

  // Run cleanup when component mounts and scripts are loaded (only once)
  useEffect(() => {
    if (scripts.length > 0 && serversData?.servers && !cleanupMutation.isPending && !cleanupRunRef.current) {
      cleanupRunRef.current = true;
      void cleanupMutation.mutate();
    }
  }, [scripts.length, serversData?.servers, cleanupMutation]);


  useEffect(() => {
    if (scripts.length > 0) {
      console.log('Status check triggered - scripts length:', scripts.length);
      fetchContainerStatuses();
    }
  }, [scripts.length, fetchContainerStatuses]); 

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
      }
    };
  }, []);

  const scriptsWithStatus = scripts.map(script => ({
    ...script,
    container_status: script.container_id ? containerStatuses.get(script.id) ?? 'unknown' : undefined
  }));

  // Filter and sort scripts
  const filteredScripts = scriptsWithStatus
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
      // Default sorting: group by server, then by container ID
      if (sortField === 'server_name') {
        const aServer = a.server_name ?? 'Local';
        const bServer = b.server_name ?? 'Local';
        
        // First sort by server name
        if (aServer !== bServer) {
          return sortDirection === 'asc' ? 
            aServer.localeCompare(bServer) : 
            bServer.localeCompare(aServer);
        }
        
        // If same server, sort by container ID
        const aContainerId = a.container_id ?? '';
        const bContainerId = b.container_id ?? '';
        
        if (aContainerId !== bContainerId) {
          // Convert to numbers for proper numeric sorting
          const aNum = parseInt(aContainerId) || 0;
          const bNum = parseInt(bContainerId) || 0;
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        return 0;
      }

      // For other sort fields, use the original logic
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

  // Container control handlers
  const handleStartStop = (script: InstalledScript, action: 'start' | 'stop') => {
    if (!script.container_id) {
      alert('No Container ID available for this script');
      return;
    }

    setConfirmationModal({
      isOpen: true,
      variant: 'simple',
      title: `${action === 'start' ? 'Start' : 'Stop'} Container`,
      message: `Are you sure you want to ${action} container ${script.container_id} (${script.script_name})?`,
      onConfirm: () => {
        setControllingScriptId(script.id);
        setLoadingModal({ isOpen: true, action: `${action === 'start' ? 'Starting' : 'Stopping'} container ${script.container_id}...` });
        void controlContainerMutation.mutate({ id: script.id, action });
        setConfirmationModal(null);
      }
    });
  };

  const handleDestroy = (script: InstalledScript) => {
    if (!script.container_id) {
      alert('No Container ID available for this script');
      return;
    }

    setConfirmationModal({
      isOpen: true,
      variant: 'danger',
      title: 'Destroy Container',
      message: `This will permanently destroy the LXC container ${script.container_id} (${script.script_name}) and all its data. This action cannot be undone!`,
      confirmText: script.container_id,
      onConfirm: () => {
        setControllingScriptId(script.id);
        setLoadingModal({ isOpen: true, action: `Destroying container ${script.container_id}...` });
        void destroyContainerMutation.mutate({ id: script.id });
        setConfirmationModal(null);
      }
    });
  };

  const handleUpdateScript = (script: InstalledScript) => {
    if (!script.container_id) {
      setErrorModal({
        isOpen: true,
        title: 'Update Failed',
        message: 'No Container ID available for this script',
        details: 'This script does not have a valid container ID and cannot be updated.'
      });
      return;
    }
    
    // Show confirmation modal with type-to-confirm for update
    setConfirmationModal({
      isOpen: true,
      title: 'Confirm Script Update',
      message: `Are you sure you want to update "${script.script_name}"?\n\n⚠️ WARNING: This will update the script and may affect the container. Consider backing up your data beforehand.`,
      variant: 'danger',
      confirmText: script.container_id,
      confirmButtonText: 'Update Script',
      onConfirm: () => {
        // Get server info if it's SSH mode
        let server = null;
        if (script.server_id && script.server_user) {
          server = {
            id: script.server_id,
            name: script.server_name,
            ip: script.server_ip,
            user: script.server_user,
            password: script.server_password,
            auth_type: script.server_auth_type ?? 'password',
            ssh_key: script.server_ssh_key,
            ssh_key_passphrase: script.server_ssh_key_passphrase,
            ssh_port: script.server_ssh_port ?? 22
          };
        }
        
        setUpdatingScript({
          id: script.id,
          containerId: script.container_id!,
          server: server
        });
        setConfirmationModal(null);
      }
    });
  };

  const handleCloseUpdateTerminal = () => {
    setUpdatingScript(null);
  };

  const handleOpenShell = (script: InstalledScript) => {
    if (!script.container_id) {
      setErrorModal({
        isOpen: true,
        title: 'Shell Access Failed',
        message: 'No Container ID available for this script',
        details: 'This script does not have a valid container ID and cannot be accessed via shell.'
      });
      return;
    }
    
    // Get server info if it's SSH mode
    let server = null;
    if (script.server_id && script.server_user) {
      server = {
        id: script.server_id,
        name: script.server_name,
        ip: script.server_ip,
        user: script.server_user,
        password: script.server_password,
        auth_type: script.server_auth_type ?? 'password',
        ssh_key: script.server_ssh_key,
        ssh_key_passphrase: script.server_ssh_key_passphrase,
        ssh_port: script.server_ssh_port ?? 22
      };
    }
    
    setOpeningShell({
      id: script.id,
      containerId: script.container_id,
      server: server
    });
  };

  const handleCloseShellTerminal = () => {
    setOpeningShell(null);
  };

  // Auto-scroll to terminals when they open
  useEffect(() => {
    if (openingShell) {
      // Small delay to ensure the terminal is rendered
      setTimeout(() => {
        const terminalElement = document.querySelector('[data-terminal="shell"]');
        if (terminalElement) {
          // Scroll to the terminal with smooth animation
          terminalElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
          
          // Add a subtle highlight effect
          terminalElement.classList.add('animate-pulse');
          setTimeout(() => {
            terminalElement.classList.remove('animate-pulse');
          }, 2000);
        }
      }, 200);
    }
  }, [openingShell]);

  useEffect(() => {
    if (updatingScript) {
      // Small delay to ensure the terminal is rendered
      setTimeout(() => {
        const terminalElement = document.querySelector('[data-terminal="update"]');
        if (terminalElement) {
          // Scroll to the terminal with smooth animation
          terminalElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
          
          // Add a subtle highlight effect
          terminalElement.classList.add('animate-pulse');
          setTimeout(() => {
            terminalElement.classList.remove('animate-pulse');
          }, 2000);
        }
      }, 200);
    }
  }, [updatingScript]);

  const handleEditScript = (script: InstalledScript) => {
    setEditingScriptId(script.id);
    setEditFormData({
      script_name: script.script_name,
      container_id: script.container_id ?? '',
      web_ui_ip: script.web_ui_ip ?? '',
      web_ui_port: script.web_ui_port?.toString() ?? ''
    });
  };

  const handleCancelEdit = () => {
    setEditingScriptId(null);
    setEditFormData({ script_name: '', container_id: '', web_ui_ip: '', web_ui_port: '' });
  };

  const handleLXCSettings = (script: InstalledScript) => {
    setLxcSettingsModal({ isOpen: true, script });
  };

  const handleSaveEdit = () => {
    if (!editFormData.script_name.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Script name is required',
        details: 'Please enter a valid script name before saving.'
      });
      return;
    }

    if (editingScriptId) {
      updateScriptMutation.mutate({
        id: editingScriptId,
        script_name: editFormData.script_name.trim(),
        container_id: editFormData.container_id.trim() || undefined,
        web_ui_ip: editFormData.web_ui_ip.trim() || undefined,
        web_ui_port: editFormData.web_ui_port.trim() ? parseInt(editFormData.web_ui_port, 10) : undefined,
      });
    }
  };

  const handleInputChange = (field: 'script_name' | 'container_id' | 'web_ui_ip' | 'web_ui_port', value: string) => {
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

  const handleAutoDetectWebUI = (script: InstalledScript) => {
    console.log('🔍 Auto-detect WebUI clicked for script:', script);
    console.log('Script validation:', {
      hasContainerId: !!script.container_id,
      isSSHMode: script.execution_mode === 'ssh',
      containerId: script.container_id,
      executionMode: script.execution_mode
    });
    
    if (!script.container_id || script.execution_mode !== 'ssh') {
      console.log('❌ Auto-detect validation failed');
      setErrorModal({
        isOpen: true,
        title: 'Auto-Detect Failed',
        message: 'Auto-detect only works for SSH mode scripts with container ID',
        details: 'This script does not have a valid container ID or is not in SSH mode.'
      });
      return;
    }

    console.log('✅ Calling autoDetectWebUIMutation.mutate with id:', script.id);
    autoDetectWebUIMutation.mutate({ id: script.id });
  };

  const handleOpenWebUI = (script: InstalledScript) => {
    if (!script.web_ui_ip) {
      setErrorModal({
        isOpen: true,
        title: 'Web UI Access Failed',
        message: 'No IP address configured for this script',
        details: 'Please set the Web UI IP address before opening the interface.'
      });
      return;
    }

    const port = script.web_ui_port ?? 80;
    const url = `http://${script.web_ui_ip}:${port}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Helper function to check if a script has any actions available
  const hasActions = (script: InstalledScript) => {
    if (script.container_id && script.execution_mode === 'ssh') return true;
    if (script.web_ui_ip != null) return true;
    if (!script.container_id || script.execution_mode !== 'ssh') return true;
    return false;
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
        <div className="mb-8" data-terminal="update">
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

      {/* Shell Terminal */}
      {openingShell && (
        <div className="mb-8" data-terminal="shell">
          <Terminal
            scriptPath={`shell-${openingShell.containerId}`}
            onClose={handleCloseShellTerminal}
            mode={openingShell.server ? 'ssh' : 'local'}
            server={openingShell.server}
            isShell={true}
            containerId={openingShell.containerId}
          />
        </div>
      )}

      {/* Header with Stats */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Installed Scripts</h2>
        
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-info/10 border border-info/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-info">{stats.total}</div>
              <div className="text-sm text-info/80">Total Installations</div>
            </div>
            <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-success">{stats.byStatus.success}</div>
              <div className="text-sm text-success/80">Successful</div>
            </div>
            <div className="bg-error/10 border border-error/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-error">{stats.byStatus.failed}</div>
              <div className="text-sm text-error/80">Failed</div>
            </div>
            <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-warning">{stats.byStatus.in_progress}</div>
              <div className="text-sm text-warning/80">In Progress</div>
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
          <Button
            onClick={fetchContainerStatuses}
            disabled={containerStatusMutation.isPending ?? scripts.length === 0}
            variant="outline"
            size="default"
          >
            {containerStatusMutation.isPending ? '🔄 Checking...' : '🔄 Refresh Container Status'}
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
                  ? 'bg-success/10 border-success/20' 
                  : 'bg-error/10 border-error/20'
              }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {autoDetectStatus.type === 'success' ? (
                      <svg className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-error" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      autoDetectStatus.type === 'success' 
                        ? 'text-success-foreground' 
                        : 'text-error-foreground'
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
                  ? 'bg-muted/50 border-muted' 
                  : 'bg-error/10 border-error/20'
              }`}>
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {cleanupStatus.type === 'success' ? (
                      <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-error" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      cleanupStatus.type === 'success' 
                        ? 'text-foreground' 
                        : 'text-error-foreground'
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
              <div className="bg-muted/30 border border-muted rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-foreground">
                      How it works
                    </h4>
                    <div className="mt-2 text-sm text-muted-foreground">
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
                disabled={autoDetectMutation.isPending ?? !autoDetectServerId}
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
                  onShell={() => handleOpenShell(script)}
                  onDelete={() => handleDeleteScript(Number(script.id))}
                  isUpdating={updateScriptMutation.isPending}
                  isDeleting={deleteScriptMutation.isPending}
                  containerStatus={containerStatuses.get(script.id) ?? 'unknown'}
                  onStartStop={(action) => handleStartStop(script, action)}
                  onDestroy={() => handleDestroy(script)}
                  isControlling={controllingScriptId === script.id}
                  onOpenWebUI={() => handleOpenWebUI(script)}
                  onAutoDetectWebUI={() => handleAutoDetectWebUI(script)}
                  isAutoDetecting={autoDetectWebUIMutation.isPending}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Web UI
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
                          <div className="flex items-center min-h-[2.5rem]">
                            <input
                              type="text"
                              value={editFormData.script_name}
                              onChange={(e) => handleInputChange('script_name', e.target.value)}
                              className="w-full px-3 py-2 text-sm font-medium border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                              placeholder="Script name"
                            />
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
                          <div className="flex items-center min-h-[2.5rem]">
                            <input
                              type="text"
                              value={editFormData.container_id}
                              onChange={(e) => handleInputChange('container_id', e.target.value)}
                              className="w-full px-3 py-2 text-sm font-mono border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                              placeholder="Container ID"
                            />
                          </div>
                        ) : (
                          script.container_id ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-mono text-foreground">{String(script.container_id)}</span>
                              {script.container_status && (
                                <div className="flex items-center space-x-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    script.container_status === 'running' ? 'bg-success' : 
                                    script.container_status === 'stopped' ? 'bg-error' : 
                                    'bg-muted-foreground'
                                  }`}></div>
                                  <span className={`text-xs font-medium ${
                                    script.container_status === 'running' ? 'text-success' : 
                                    script.container_status === 'stopped' ? 'text-error' : 
                                    'text-muted-foreground'
                                  }`}>
                                    {script.container_status === 'running' ? 'Running' : 
                                     script.container_status === 'stopped' ? 'Stopped' : 
                                     'Unknown'}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <div className="flex items-center space-x-2 min-h-[2.5rem]">
                            <input
                              type="text"
                              value={editFormData.web_ui_ip}
                              onChange={(e) => handleInputChange('web_ui_ip', e.target.value)}
                              className="w-40 px-3 py-2 text-sm font-mono border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                              placeholder="IP"
                            />
                            <span className="text-muted-foreground">:</span>
                            <input
                              type="number"
                              value={editFormData.web_ui_port}
                              onChange={(e) => handleInputChange('web_ui_port', e.target.value)}
                              className="w-20 px-3 py-2 text-sm font-mono border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                              placeholder="Port"
                            />
                          </div>
                        ) : (
                          script.web_ui_ip ? (
                            <div className="flex items-center space-x-3">
                              <span className="text-sm text-foreground">
                                {script.web_ui_ip}:{script.web_ui_port ?? 80}
                              </span>
                              {containerStatuses.get(script.id) === 'running' && (
                                <button
                                  onClick={() => handleOpenWebUI(script)}
                                  className="text-xs px-2 py-1 bg-info/20 hover:bg-info/30 border border-info/50 text-info hover:text-info-foreground hover:border-info/60 transition-all duration-200 hover:scale-105 hover:shadow-md rounded disabled:opacity-50 flex-shrink-0"
                                  title="Open Web UI"
                                >
                                  Open UI
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-muted-foreground">-</span>
                              {script.container_id && script.execution_mode === 'ssh' && (
                                <button
                                  onClick={() => handleAutoDetectWebUI(script)}
                                  disabled={autoDetectWebUIMutation.isPending}
                                  className="text-xs px-2 py-1 bg-info hover:bg-info/90 text-info-foreground border border-info rounded disabled:opacity-50 transition-colors"
                                  title="Re-detect IP and port"
                                >
                                  {autoDetectWebUIMutation.isPending ? '...' : 'Re-detect'}
                                </button>
                              )}
                            </div>
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
                                variant="save"
                                size="sm"
                              >
                                {updateScriptMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                variant="cancel"
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleEditScript(script)}
                                variant="edit"
                                size="sm"
                              >
                                Edit
                              </Button>
                              {hasActions(script) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-muted/20 hover:bg-muted/30 border border-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all duration-200 hover:scale-105 hover:shadow-md"
                                    >
                                      Actions
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-48 bg-card border-border">
                                    {script.container_id && (
                                      <DropdownMenuItem
                                        onClick={() => handleUpdateScript(script)}
                                        disabled={containerStatuses.get(script.id) === 'stopped'}
                                        className="text-info hover:text-info-foreground hover:bg-info/20 focus:bg-info/20"
                                      >
                                        Update
                                      </DropdownMenuItem>
                                    )}
                                    {script.container_id && script.execution_mode === 'ssh' && (
                                      <DropdownMenuItem
                                        onClick={() => handleOpenShell(script)}
                                        disabled={containerStatuses.get(script.id) === 'stopped'}
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                      >
                                        Shell
                                      </DropdownMenuItem>
                                    )}
                                    {script.web_ui_ip && (
                                      <DropdownMenuItem
                                        onClick={() => handleOpenWebUI(script)}
                                        disabled={containerStatuses.get(script.id) === 'stopped'}
                                        className="text-info hover:text-info-foreground hover:bg-info/20 focus:bg-info/20"
                                      >
                                        Open UI
                                      </DropdownMenuItem>
                                    )}
                                    {script.container_id && script.execution_mode === 'ssh' && script.web_ui_ip && (
                                      <DropdownMenuItem
                                        onClick={() => handleAutoDetectWebUI(script)}
                                        disabled={autoDetectWebUIMutation.isPending ?? containerStatuses.get(script.id) === 'stopped'}
                                        className="text-info hover:text-info-foreground hover:bg-info/20 focus:bg-info/20"
                                      >
                                        {autoDetectWebUIMutation.isPending ? 'Re-detect...' : 'Re-detect IP/Port'}
                                      </DropdownMenuItem>
                                    )}
                                    {script.container_id && script.execution_mode === 'ssh' && (
                                      <>
                                        <DropdownMenuSeparator className="bg-border" />
                                        <DropdownMenuItem
                                          onClick={() => handleLXCSettings(script)}
                                          className="text-primary hover:text-primary-foreground hover:bg-primary/20 focus:bg-primary/20"
                                        >
                                          <Settings className="mr-2 h-4 w-4" />
                                          LXC Settings
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-border" />
                                        <DropdownMenuItem
                                          onClick={() => handleStartStop(script, (containerStatuses.get(script.id) ?? 'unknown') === 'running' ? 'stop' : 'start')}
                                          disabled={controllingScriptId === script.id || (containerStatuses.get(script.id) ?? 'unknown') === 'unknown'}
                                          className={(containerStatuses.get(script.id) ?? 'unknown') === 'running' 
                                            ? "text-error hover:text-error-foreground hover:bg-error/20 focus:bg-error/20"
                                            : "text-success hover:text-success-foreground hover:bg-success/20 focus:bg-success/20"
                                          }
                                        >
                                          {controllingScriptId === script.id ? 'Working...' : (containerStatuses.get(script.id) ?? 'unknown') === 'running' ? 'Stop' : 'Start'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleDestroy(script)}
                                          disabled={controllingScriptId === script.id}
                                          className="text-error hover:text-error-foreground hover:bg-error/20 focus:bg-error/20"
                                        >
                                          {controllingScriptId === script.id ? 'Working...' : 'Destroy'}
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {(!script.container_id || script.execution_mode !== 'ssh') && (
                                      <>
                                        <DropdownMenuSeparator className="bg-border" />
                                        <DropdownMenuItem
                                          onClick={() => handleDeleteScript(Number(script.id))}
                                          disabled={deleteScriptMutation.isPending}
                                          className="text-error hover:text-error-foreground hover:bg-error/20 focus:bg-error/20"
                                        >
                                          {deleteScriptMutation.isPending ? 'Deleting...' : 'Delete'}
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
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

        {/* Confirmation Modal */}
        {confirmationModal && (
          <ConfirmationModal
            isOpen={confirmationModal.isOpen}
            onClose={() => setConfirmationModal(null)}
            onConfirm={confirmationModal.onConfirm}
            title={confirmationModal.title}
            message={confirmationModal.message}
            variant={confirmationModal.variant}
            confirmText={confirmationModal.confirmText}
          />
        )}

        {/* Error/Success Modal */}
        {errorModal && (
          <ErrorModal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal(null)}
            title={errorModal.title}
            message={errorModal.message}
            details={errorModal.details}
            type={errorModal.type ?? 'error'}
          />
        )}

        {/* Loading Modal */}
        {loadingModal && (
          <LoadingModal
            isOpen={loadingModal.isOpen}
            action={loadingModal.action}
          />
        )}

        {/* LXC Settings Modal */}
        <LXCSettingsModal
          isOpen={lxcSettingsModal.isOpen}
          script={lxcSettingsModal.script}
          onClose={() => setLxcSettingsModal({ isOpen: false, script: null })}
          onSave={() => {
            setLxcSettingsModal({ isOpen: false, script: null });
            void refetchScripts();
          }}
        />
    </div>
  );
}
