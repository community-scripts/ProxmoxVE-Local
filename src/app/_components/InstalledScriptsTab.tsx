"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { Terminal } from "./Terminal";
import { StatusBadge } from "./Badge";
import { Button } from "./ui/button";
import { ScriptInstallationCard } from "./ScriptInstallationCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { ErrorModal } from "./ErrorModal";
import { LoadingModal } from "./LoadingModal";
import { LXCSettingsModal } from "./LXCSettingsModal";
import { StorageSelectionModal } from "./StorageSelectionModal";
import { BackupWarningModal } from "./BackupWarningModal";
import type { Storage } from "~/server/services/storageService";
import { getContrastColor } from "../../lib/colorUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Settings } from "lucide-react";

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
  status: "in_progress" | "success" | "failed";
  output_log: string | null;
  execution_mode: "local" | "ssh";
  container_status?: "running" | "stopped" | "unknown";
  web_ui_ip: string | null;
  web_ui_port: number | null;
  is_vm?: boolean;
}

export function InstalledScriptsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "success" | "failed" | "in_progress"
  >("all");
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<
    | "script_name"
    | "container_id"
    | "server_name"
    | "status"
    | "installation_date"
  >("server_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [updatingScript, setUpdatingScript] = useState<{
    id: number;
    containerId: string;
    server?: any;
    backupStorage?: string;
    isBackupOnly?: boolean;
  } | null>(null);
  const [openingShell, setOpeningShell] = useState<{
    id: number;
    containerId: string;
    server?: any;
  } | null>(null);
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [showStorageSelection, setShowStorageSelection] = useState(false);
  const [pendingUpdateScript, setPendingUpdateScript] =
    useState<InstalledScript | null>(null);
  const [backupStorages, setBackupStorages] = useState<Storage[]>([]);
  const [isLoadingStorages, setIsLoadingStorages] = useState(false);
  const [showBackupWarning, setShowBackupWarning] = useState(false);
  const [isPreUpdateBackup, setIsPreUpdateBackup] = useState(false); // Track if storage selection is for pre-update backup
  const [editingScriptId, setEditingScriptId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{
    script_name: string;
    container_id: string;
    web_ui_ip: string;
    web_ui_port: string;
  }>({ script_name: "", container_id: "", web_ui_ip: "", web_ui_port: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState<{
    script_name: string;
    container_id: string;
    server_id: string;
  }>({ script_name: "", container_id: "", server_id: "local" });
  const [showAutoDetectForm, setShowAutoDetectForm] = useState(false);
  const [autoDetectServerId, setAutoDetectServerId] = useState<string>("");
  const [autoDetectStatus, setAutoDetectStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [cleanupStatus, setCleanupStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const cleanupRunRef = useRef(false);

  // Container control state
  const [containerStatuses, setContainerStatuses] = useState<
    Map<number, "running" | "stopped" | "unknown">
  >(new Map());
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    variant: "simple" | "danger";
    title: string;
    message: string;
    confirmText?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    onConfirm: () => void;
  } | null>(null);
  const [controllingScriptId, setControllingScriptId] = useState<number | null>(
    null,
  );
  const scriptsRef = useRef<InstalledScript[]>([]);
  const statusCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    type?: "error" | "success";
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
  const {
    data: scriptsData,
    refetch: refetchScripts,
    isLoading,
  } = api.installedScripts.getAllInstalledScripts.useQuery();
  const { data: statsData } =
    api.installedScripts.getInstallationStats.useQuery();
  const { data: serversData } = api.servers.getAllServers.useQuery();

  // Delete script mutation
  const deleteScriptMutation =
    api.installedScripts.deleteInstalledScript.useMutation({
      onSuccess: () => {
        void refetchScripts();
      },
    });

  // Update script mutation
  const updateScriptMutation =
    api.installedScripts.updateInstalledScript.useMutation({
      onSuccess: () => {
        void refetchScripts();
        setEditingScriptId(null);
        setEditFormData({
          script_name: "",
          container_id: "",
          web_ui_ip: "",
          web_ui_port: "",
        });
      },
      onError: (error) => {
        alert(`Error updating script: ${error.message}`);
      },
    });

  // Create script mutation
  const createScriptMutation =
    api.installedScripts.createInstalledScript.useMutation({
      onSuccess: () => {
        void refetchScripts();
        setShowAddForm(false);
        setAddFormData({
          script_name: "",
          container_id: "",
          server_id: "local",
        });
      },
      onError: (error) => {
        alert(`Error creating script: ${error.message}`);
      },
    });

  // Auto-detect LXC containers mutation
  const autoDetectMutation =
    api.installedScripts.autoDetectLXCContainers.useMutation({
      onSuccess: (data) => {
        void refetchScripts();
        setShowAutoDetectForm(false);
        setAutoDetectServerId("");

        // Show detailed message about what was added/skipped
        let statusMessage =
          data.message ?? "Auto-detection completed successfully!";
        if (data.skippedContainers && data.skippedContainers.length > 0) {
          const skippedNames = data.skippedContainers
            .map((c: any) => String(c.hostname))
            .join(", ");
          statusMessage += ` Skipped duplicates: ${skippedNames}`;
        }

        setAutoDetectStatus({
          type: "success",
          message: statusMessage,
        });
        // Clear status after 8 seconds (longer for detailed info)
        setTimeout(
          () => setAutoDetectStatus({ type: null, message: "" }),
          8000,
        );
      },
      onError: (error) => {
        console.error("Auto-detect mutation error:", error);
        console.error("Error details:", {
          message: error.message,
          data: error.data,
        });
        setAutoDetectStatus({
          type: "error",
          message: error.message ?? "Auto-detection failed. Please try again.",
        });
        // Clear status after 5 seconds
        setTimeout(
          () => setAutoDetectStatus({ type: null, message: "" }),
          5000,
        );
      },
    });

  // Get container statuses mutation
  const containerStatusMutation =
    api.installedScripts.getContainerStatuses.useMutation({
      onSuccess: (data) => {
        if (data.success) {
          // Map container IDs to script IDs
          const currentScripts = scriptsRef.current;
          const statusMap = new Map<
            number,
            "running" | "stopped" | "unknown"
          >();

          // For each script, find its container status
          currentScripts.forEach((script) => {
            if (script.container_id && data.statusMap) {
              const containerStatus = (
                data.statusMap as Record<
                  string,
                  "running" | "stopped" | "unknown"
                >
              )[script.container_id];
              if (containerStatus) {
                statusMap.set(script.id, containerStatus);
              } else {
                statusMap.set(script.id, "unknown");
              }
            } else {
              statusMap.set(script.id, "unknown");
            }
          });

          setContainerStatuses(statusMap);
        } else {
          console.error("Container status fetch failed:", data.error);
        }
      },
      onError: (error) => {
        console.error("Error fetching container statuses:", error);
      },
    });

  // Ref for container status mutation to avoid dependency loops
  const containerStatusMutationRef = useRef(containerStatusMutation);

  // Cleanup orphaned scripts mutation
  const cleanupMutation =
    api.installedScripts.cleanupOrphanedScripts.useMutation({
      onSuccess: (data) => {
        void refetchScripts();

        if (data.deletedCount > 0) {
          setCleanupStatus({
            type: "success",
            message: `Cleanup completed! Removed ${data.deletedCount} orphaned script(s): ${data.deletedScripts.join(", ")}`,
          });
        } else {
          setCleanupStatus({
            type: "success",
            message: "Cleanup completed! No orphaned scripts found.",
          });
        }
        // Clear status after 8 seconds (longer for cleanup info)
        setTimeout(() => setCleanupStatus({ type: null, message: "" }), 8000);
      },
      onError: (error) => {
        console.error("Cleanup mutation error:", error);
        setCleanupStatus({
          type: "error",
          message: error.message ?? "Cleanup failed. Please try again.",
        });
        // Clear status after 5 seconds
        setTimeout(() => setCleanupStatus({ type: null, message: "" }), 8000);
      },
    });

  // Auto-detect Web UI mutation
  const autoDetectWebUIMutation =
    api.installedScripts.autoDetectWebUI.useMutation({
      onSuccess: (data) => {
        console.log("✅ Auto-detect WebUI success:", data);
        void refetchScripts();
        setAutoDetectStatus({
          type: "success",
          message: data.success
            ? `Detected IP: ${data.ip}`
            : (data.error ?? "Failed to detect Web UI"),
        });
        setTimeout(
          () => setAutoDetectStatus({ type: null, message: "" }),
          5000,
        );
      },
      onError: (error) => {
        console.error("❌ Auto-detect WebUI error:", error);
        setAutoDetectStatus({
          type: "error",
          message: error.message ?? "Failed to detect Web UI",
        });
        setTimeout(
          () => setAutoDetectStatus({ type: null, message: "" }),
          8000,
        );
      },
    });

  // Get backup storages query
  const getBackupStoragesQuery =
    api.installedScripts.getBackupStorages.useQuery(
      { serverId: pendingUpdateScript?.server_id ?? 0, forceRefresh: false },
      { enabled: false }, // Only fetch when explicitly called
    );

  const fetchStorages = async (serverId: number, forceRefresh = false) => {
    setIsLoadingStorages(true);
    try {
      const result = await getBackupStoragesQuery.refetch({
        queryKey: [
          "installedScripts.getBackupStorages",
          { serverId, forceRefresh },
        ],
      });
      if (result.data?.success) {
        setBackupStorages(result.data.storages);
      } else {
        setErrorModal({
          isOpen: true,
          title: "Failed to Fetch Storages",
          message: result.data?.error ?? "Unknown error occurred",
          type: "error",
        });
      }
    } catch (error) {
      setErrorModal({
        isOpen: true,
        title: "Failed to Fetch Storages",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        type: "error",
      });
    } finally {
      setIsLoadingStorages(false);
    }
  };

  // Container control mutations
  // Note: getStatusMutation removed - using direct API calls instead

  const controlContainerMutation =
    api.installedScripts.controlContainer.useMutation({
      onSuccess: (data, variables) => {
        setLoadingModal(null);
        setControllingScriptId(null);

        if (data.success) {
          // Update container status immediately in UI for instant feedback
          const newStatus =
            variables.action === "start" ? "running" : "stopped";
          setContainerStatuses((prev) => {
            const newMap = new Map(prev);
            // Find the script ID for this container using the container ID from the response
            const currentScripts = scriptsRef.current;
            const script = currentScripts.find(
              (s) => s.container_id === data.containerId,
            );
            if (script) {
              newMap.set(script.id, newStatus);
            }
            return newMap;
          });

          // Show success modal
          setErrorModal({
            isOpen: true,
            title: `Container ${variables.action === "start" ? "Started" : "Stopped"}`,
            message:
              data.message ??
              `Container has been ${variables.action === "start" ? "started" : "stopped"} successfully.`,
            details: undefined,
            type: "success",
          });

          // Re-fetch status for all containers using bulk method (in background)
          // Trigger status check by updating scripts length dependency
          // This will be handled by the useEffect that watches scripts.length
        } else {
          // Show error message from backend
          const errorMessage = data.error ?? "Unknown error occurred";
          setErrorModal({
            isOpen: true,
            title: "Container Control Failed",
            message:
              "Failed to control the container. Please check the error details below.",
            details: errorMessage,
          });
        }
      },
      onError: (error) => {
        console.error("Container control error:", error);
        setLoadingModal(null);
        setControllingScriptId(null);

        // Show detailed error message
        const errorMessage = error.message ?? "Unknown error occurred";
        setErrorModal({
          isOpen: true,
          title: "Container Control Failed",
          message:
            "An unexpected error occurred while controlling the container.",
          details: errorMessage,
        });
      },
    });

  const destroyContainerMutation =
    api.installedScripts.destroyContainer.useMutation({
      onSuccess: (data) => {
        setLoadingModal(null);
        setControllingScriptId(null);

        if (data.success) {
          void refetchScripts();
          setErrorModal({
            isOpen: true,
            title: "Container Destroyed",
            message:
              data.message ??
              "The container has been successfully destroyed and removed from the database.",
            details: undefined,
            type: "success",
          });
        } else {
          // Show error message from backend
          const errorMessage = data.error ?? "Unknown error occurred";
          setErrorModal({
            isOpen: true,
            title: "Container Destroy Failed",
            message:
              "Failed to destroy the container. Please check the error details below.",
            details: errorMessage,
          });
        }
      },
      onError: (error) => {
        console.error("Container destroy error:", error);
        setLoadingModal(null);
        setControllingScriptId(null);

        // Show detailed error message
        const errorMessage = error.message ?? "Unknown error occurred";
        setErrorModal({
          isOpen: true,
          title: "Container Destroy Failed",
          message:
            "An unexpected error occurred while destroying the container.",
          details: errorMessage,
        });
      },
    });

  const scripts: InstalledScript[] = useMemo(
    () => (scriptsData?.scripts as InstalledScript[]) ?? [],
    [scriptsData?.scripts],
  );
  const stats = statsData?.stats;

  // Update refs when data changes
  useEffect(() => {
    scriptsRef.current = scripts;
  }, [scripts]);

  useEffect(() => {
    containerStatusMutationRef.current = containerStatusMutation;
  }, [containerStatusMutation]);

  // Run cleanup when component mounts and scripts are loaded (only once)
  useEffect(() => {
    if (
      scripts.length > 0 &&
      serversData?.servers &&
      !cleanupMutation.isPending &&
      !cleanupRunRef.current
    ) {
      cleanupRunRef.current = true;
      void cleanupMutation.mutate();
    }
  }, [scripts.length, serversData?.servers, cleanupMutation]);

  useEffect(() => {
    if (scripts.length > 0) {
      console.log("Status check triggered - scripts length:", scripts.length);

      // Clear any existing timeout
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
      }

      // Debounce status checks by 500ms
      statusCheckTimeoutRef.current = setTimeout(() => {
        // Prevent multiple simultaneous status checks
        if (containerStatusMutationRef.current.isPending) {
          console.log("Status check already pending, skipping");
          return;
        }

        const currentScripts = scriptsRef.current;

        // Get unique server IDs from scripts
        const serverIds = [
          ...new Set(
            currentScripts
              .filter((script) => script.server_id)
              .map((script) => script.server_id!),
          ),
        ];

        console.log("Executing status check for server IDs:", serverIds);
        if (serverIds.length > 0) {
          containerStatusMutationRef.current.mutate({ serverIds });
        }
      }, 500);
    }
  }, [scripts.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (statusCheckTimeoutRef.current) {
        clearTimeout(statusCheckTimeoutRef.current);
      }
    };
  }, []);

  const scriptsWithStatus = scripts.map((script) => ({
    ...script,
    container_status: script.container_id
      ? (containerStatuses.get(script.id) ?? "unknown")
      : undefined,
  }));

  // Filter and sort scripts
  const filteredScripts = scriptsWithStatus
    .filter((script: InstalledScript) => {
      const matchesSearch =
        script.script_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (script.container_id?.includes(searchTerm) ?? false) ||
        (script.server_name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
          false);

      const matchesStatus =
        statusFilter === "all" || script.status === statusFilter;

      const matchesServer =
        serverFilter === "all" ||
        (serverFilter === "local" && !script.server_name) ||
        script.server_name === serverFilter;

      return matchesSearch && matchesStatus && matchesServer;
    })
    .sort((a: InstalledScript, b: InstalledScript) => {
      // Default sorting: group by server, then by container ID
      if (sortField === "server_name") {
        const aServer = a.server_name ?? "Local";
        const bServer = b.server_name ?? "Local";

        // First sort by server name
        if (aServer !== bServer) {
          return sortDirection === "asc"
            ? aServer.localeCompare(bServer)
            : bServer.localeCompare(aServer);
        }

        // If same server, sort by container ID
        const aContainerId = a.container_id ?? "";
        const bContainerId = b.container_id ?? "";

        if (aContainerId !== bContainerId) {
          // Convert to numbers for proper numeric sorting
          const aNum = parseInt(aContainerId) || 0;
          const bNum = parseInt(bContainerId) || 0;
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }

        return 0;
      }

      // For other sort fields, use the original logic
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "script_name":
          aValue = a.script_name.toLowerCase();
          bValue = b.script_name.toLowerCase();
          break;
        case "container_id":
          aValue = a.container_id ?? "";
          bValue = b.container_id ?? "";
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "installation_date":
          aValue = new Date(a.installation_date).getTime();
          bValue = new Date(b.installation_date).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === "asc" ? 1 : -1;
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

  const handleDeleteScript = (id: number, script?: InstalledScript) => {
    const scriptToDelete = script ?? scripts.find((s) => s.id === id);

    if (
      scriptToDelete?.container_id &&
      scriptToDelete.execution_mode === "ssh"
    ) {
      // For SSH scripts with container_id, use confirmation modal
      setConfirmationModal({
        isOpen: true,
        variant: "simple",
        title: "Delete Database Record Only",
        message: `This will only delete the database record for "${scriptToDelete.script_name}" (Container ID: ${scriptToDelete.container_id}).\n\nThe container will remain intact and can be re-detected later via auto-detect.`,
        onConfirm: () => {
          void deleteScriptMutation.mutate({ id });
          setConfirmationModal(null);
        },
      });
    } else {
      // For non-SSH scripts or scripts without container_id, use simple confirm
      if (
        confirm("Are you sure you want to delete this installation record?")
      ) {
        void deleteScriptMutation.mutate({ id });
      }
    }
  };

  // Container control handlers
  const handleStartStop = (
    script: InstalledScript,
    action: "start" | "stop",
  ) => {
    if (!script.container_id) {
      alert("No Container ID available for this script");
      return;
    }

    setConfirmationModal({
      isOpen: true,
      variant: "simple",
      title: `${action === "start" ? "Start" : "Stop"} Container`,
      message: `Are you sure you want to ${action} container ${script.container_id} (${script.script_name})?`,
      onConfirm: () => {
        setControllingScriptId(script.id);
        setLoadingModal({
          isOpen: true,
          action: `${action === "start" ? "Starting" : "Stopping"} container ${script.container_id}...`,
        });
        void controlContainerMutation.mutate({ id: script.id, action });
        setConfirmationModal(null);
      },
    });
  };

  const handleDestroy = (script: InstalledScript) => {
    if (!script.container_id) {
      alert("No Container ID available for this script");
      return;
    }

    setConfirmationModal({
      isOpen: true,
      variant: "danger",
      title: "Destroy Container",
      message: `This will permanently destroy the LXC container ${script.container_id} (${script.script_name}) and all its data. This action cannot be undone!`,
      confirmText: script.container_id,
      onConfirm: () => {
        setControllingScriptId(script.id);
        setLoadingModal({
          isOpen: true,
          action: `Destroying container ${script.container_id}...`,
        });
        void destroyContainerMutation.mutate({ id: script.id });
        setConfirmationModal(null);
      },
    });
  };

  const handleUpdateScript = (script: InstalledScript) => {
    if (!script.container_id) {
      setErrorModal({
        isOpen: true,
        title: "Update Failed",
        message: "No Container ID available for this script",
        details:
          "This script does not have a valid container ID and cannot be updated.",
      });
      return;
    }

    // Show confirmation modal with type-to-confirm for update
    setConfirmationModal({
      isOpen: true,
      title: "Confirm Script Update",
      message: `Are you sure you want to update "${script.script_name}"?\n\n⚠️ WARNING: This will update the script and may affect the container. Consider backing up your data beforehand.`,
      variant: "danger",
      confirmText: script.container_id,
      confirmButtonText: "Continue",
      onConfirm: () => {
        setConfirmationModal(null);
        // Store the script for backup flow
        setPendingUpdateScript(script);
        // Show backup prompt
        setShowBackupPrompt(true);
      },
    });
  };

  const handleBackupPromptResponse = (wantsBackup: boolean) => {
    setShowBackupPrompt(false);

    if (!pendingUpdateScript) return;

    if (wantsBackup) {
      // User wants backup - fetch storages and show selection
      if (pendingUpdateScript.server_id) {
        setIsPreUpdateBackup(true); // Mark that this is for pre-update backup
        void fetchStorages(pendingUpdateScript.server_id, false);
        setShowStorageSelection(true);
      } else {
        setErrorModal({
          isOpen: true,
          title: "Backup Not Available",
          message:
            "Backup is only available for SSH scripts with a configured server.",
          type: "error",
        });
        // Proceed without backup
        proceedWithUpdate(null);
      }
    } else {
      // User doesn't want backup - proceed directly to update
      proceedWithUpdate(null);
    }
  };

  const handleStorageSelected = (storage: Storage) => {
    setShowStorageSelection(false);

    // Check if this is for a standalone backup or pre-update backup
    if (isPreUpdateBackup) {
      // Pre-update backup - proceed with update
      setIsPreUpdateBackup(false); // Reset flag
      proceedWithUpdate(storage.name);
    } else if (pendingUpdateScript) {
      // Standalone backup - execute backup directly
      executeStandaloneBackup(pendingUpdateScript, storage.name);
    }
  };

  const executeStandaloneBackup = (
    script: InstalledScript,
    storageName: string,
  ) => {
    // Get server info
    let server = null;
    if (script.server_id && script.server_user) {
      server = {
        id: script.server_id,
        name: script.server_name,
        ip: script.server_ip,
        user: script.server_user,
        password: script.server_password,
        auth_type: script.server_auth_type ?? "password",
        ssh_key: script.server_ssh_key,
        ssh_key_passphrase: script.server_ssh_key_passphrase,
        ssh_port: script.server_ssh_port ?? 22,
      };
    }

    // Start backup terminal
    setUpdatingScript({
      id: script.id,
      containerId: script.container_id!,
      server: server,
      backupStorage: storageName,
      isBackupOnly: true,
    });

    // Reset state
    setIsPreUpdateBackup(false); // Reset flag
    setPendingUpdateScript(null);
    setBackupStorages([]);
  };

  const proceedWithUpdate = (backupStorage: string | null) => {
    if (!pendingUpdateScript) return;

    // Get server info if it's SSH mode
    let server = null;
    if (pendingUpdateScript.server_id && pendingUpdateScript.server_user) {
      server = {
        id: pendingUpdateScript.server_id,
        name: pendingUpdateScript.server_name,
        ip: pendingUpdateScript.server_ip,
        user: pendingUpdateScript.server_user,
        password: pendingUpdateScript.server_password,
        auth_type: pendingUpdateScript.server_auth_type ?? "password",
        ssh_key: pendingUpdateScript.server_ssh_key,
        ssh_key_passphrase: pendingUpdateScript.server_ssh_key_passphrase,
        ssh_port: pendingUpdateScript.server_ssh_port ?? 22,
      };
    }

    setUpdatingScript({
      id: pendingUpdateScript.id,
      containerId: pendingUpdateScript.container_id!,
      server: server,
      backupStorage: backupStorage ?? undefined,
      isBackupOnly: false, // Explicitly set to false for update operations
    });

    // Reset state
    setPendingUpdateScript(null);
    setBackupStorages([]);
  };

  const handleCloseUpdateTerminal = () => {
    setUpdatingScript(null);
  };

  const handleBackupScript = (script: InstalledScript) => {
    if (!script.container_id) {
      setErrorModal({
        isOpen: true,
        title: "Backup Failed",
        message: "No Container ID available for this script",
        details:
          "This script does not have a valid container ID and cannot be backed up.",
      });
      return;
    }

    if (!script.server_id) {
      setErrorModal({
        isOpen: true,
        title: "Backup Not Available",
        message:
          "Backup is only available for SSH scripts with a configured server.",
        type: "error",
      });
      return;
    }

    // Store the script and fetch storages
    setIsPreUpdateBackup(false); // This is a standalone backup, not pre-update
    setPendingUpdateScript(script);
    void fetchStorages(script.server_id, false);
    setShowStorageSelection(true);
  };

  const handleOpenShell = (script: InstalledScript) => {
    if (!script.container_id) {
      setErrorModal({
        isOpen: true,
        title: "Shell Access Failed",
        message: "No Container ID available for this script",
        details:
          "This script does not have a valid container ID and cannot be accessed via shell.",
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
        auth_type: script.server_auth_type ?? "password",
        ssh_key: script.server_ssh_key,
        ssh_key_passphrase: script.server_ssh_key_passphrase,
        ssh_port: script.server_ssh_port ?? 22,
      };
    }

    setOpeningShell({
      id: script.id,
      containerId: script.container_id,
      server: server,
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
        const terminalElement = document.querySelector(
          '[data-terminal="shell"]',
        );
        if (terminalElement) {
          // Scroll to the terminal with smooth animation
          terminalElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });

          // Add a subtle highlight effect
          terminalElement.classList.add("animate-pulse");
          setTimeout(() => {
            terminalElement.classList.remove("animate-pulse");
          }, 2000);
        }
      }, 200);
    }
  }, [openingShell]);

  useEffect(() => {
    if (updatingScript) {
      // Small delay to ensure the terminal is rendered
      setTimeout(() => {
        const terminalElement = document.querySelector(
          '[data-terminal="update"]',
        );
        if (terminalElement) {
          // Scroll to the terminal with smooth animation
          terminalElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          });

          // Add a subtle highlight effect
          terminalElement.classList.add("animate-pulse");
          setTimeout(() => {
            terminalElement.classList.remove("animate-pulse");
          }, 2000);
        }
      }, 200);
    }
  }, [updatingScript]);

  const handleEditScript = (script: InstalledScript) => {
    setEditingScriptId(script.id);
    setEditFormData({
      script_name: script.script_name,
      container_id: script.container_id ?? "",
      web_ui_ip: script.web_ui_ip ?? "",
      web_ui_port: script.web_ui_port?.toString() ?? "",
    });
  };

  const handleCancelEdit = () => {
    setEditingScriptId(null);
    setEditFormData({
      script_name: "",
      container_id: "",
      web_ui_ip: "",
      web_ui_port: "",
    });
  };

  const handleLXCSettings = (script: InstalledScript) => {
    setLxcSettingsModal({ isOpen: true, script });
  };

  const handleSaveEdit = () => {
    if (!editFormData.script_name.trim()) {
      setErrorModal({
        isOpen: true,
        title: "Validation Error",
        message: "Script name is required",
        details: "Please enter a valid script name before saving.",
      });
      return;
    }

    if (editingScriptId) {
      updateScriptMutation.mutate({
        id: editingScriptId,
        script_name: editFormData.script_name.trim(),
        container_id: editFormData.container_id.trim() || undefined,
        web_ui_ip: editFormData.web_ui_ip.trim() || undefined,
        web_ui_port: editFormData.web_ui_port.trim()
          ? parseInt(editFormData.web_ui_port, 10)
          : undefined,
      });
    }
  };

  const handleInputChange = (
    field: "script_name" | "container_id" | "web_ui_ip" | "web_ui_port",
    value: string,
  ) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddFormChange = (
    field: "script_name" | "container_id" | "server_id",
    value: string,
  ) => {
    setAddFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddScript = () => {
    if (!addFormData.script_name.trim()) {
      alert("Script name is required");
      return;
    }

    createScriptMutation.mutate({
      script_name: addFormData.script_name.trim(),
      script_path: `manual/${addFormData.script_name.trim()}`,
      container_id: addFormData.container_id.trim() || undefined,
      server_id:
        addFormData.server_id === "local"
          ? undefined
          : Number(addFormData.server_id),
      execution_mode: addFormData.server_id === "local" ? "local" : "ssh",
      status: "success",
    });
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setAddFormData({ script_name: "", container_id: "", server_id: "local" });
  };

  const handleAutoDetect = () => {
    if (!autoDetectServerId) {
      return;
    }

    if (autoDetectMutation.isPending) {
      return;
    }

    setAutoDetectStatus({ type: null, message: "" });
    autoDetectMutation.mutate({ serverId: Number(autoDetectServerId) });
  };

  const handleCancelAutoDetect = () => {
    setShowAutoDetectForm(false);
    setAutoDetectServerId("");
  };

  const handleSort = (
    field:
      | "script_name"
      | "container_id"
      | "server_name"
      | "status"
      | "installation_date",
  ) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleAutoDetectWebUI = (script: InstalledScript) => {
    console.log("🔍 Auto-detect WebUI clicked for script:", script);
    console.log("Script validation:", {
      hasContainerId: !!script.container_id,
      isSSHMode: script.execution_mode === "ssh",
      containerId: script.container_id,
      executionMode: script.execution_mode,
    });

    if (!script.container_id || script.execution_mode !== "ssh") {
      console.log("❌ Auto-detect validation failed");
      setErrorModal({
        isOpen: true,
        title: "Auto-Detect Failed",
        message:
          "Auto-detect only works for SSH mode scripts with container ID",
        details:
          "This script does not have a valid container ID or is not in SSH mode.",
      });
      return;
    }

    console.log(
      "✅ Calling autoDetectWebUIMutation.mutate with id:",
      script.id,
    );
    autoDetectWebUIMutation.mutate({ id: script.id });
  };

  const handleOpenWebUI = (script: InstalledScript) => {
    if (!script.web_ui_ip) {
      setErrorModal({
        isOpen: true,
        title: "Web UI Access Failed",
        message: "No IP address configured for this script",
        details:
          "Please set the Web UI IP address before opening the interface.",
      });
      return;
    }

    const port = script.web_ui_port ?? 80;
    const url = `http://${script.web_ui_ip}:${port}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Helper function to check if a script has any actions available
  const hasActions = (script: InstalledScript) => {
    if (script.container_id && script.execution_mode === "ssh") return true;
    if (script.web_ui_ip != null) return true;
    if (!script.container_id || script.execution_mode !== "ssh") return true;
    return false;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">
          Loading installed scripts...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Update Terminal */}
      {updatingScript && (
        <div className="mb-8" data-terminal="update">
          <Terminal
            scriptPath={
              updatingScript.isBackupOnly
                ? `backup-${updatingScript.containerId}`
                : `update-${updatingScript.containerId}`
            }
            onClose={handleCloseUpdateTerminal}
            mode={updatingScript.server ? "ssh" : "local"}
            server={updatingScript.server}
            isUpdate={!updatingScript.isBackupOnly}
            isBackup={updatingScript.isBackupOnly}
            containerId={updatingScript.containerId}
            storage={
              updatingScript.isBackupOnly
                ? updatingScript.backupStorage
                : undefined
            }
            backupStorage={
              !updatingScript.isBackupOnly
                ? updatingScript.backupStorage
                : undefined
            }
          />
        </div>
      )}

      {/* Shell Terminal */}
      {openingShell && (
        <div className="mb-8" data-terminal="shell">
          <Terminal
            scriptPath={`shell-${openingShell.containerId}`}
            onClose={handleCloseShellTerminal}
            mode={openingShell.server ? "ssh" : "local"}
            server={openingShell.server}
            isShell={true}
            containerId={openingShell.containerId}
          />
        </div>
      )}

      {/* Header with Stats */}
      <div className="bg-card rounded-lg p-6 shadow">
        <h2 className="text-foreground mb-4 text-2xl font-bold">
          Installed Scripts
        </h2>

        {stats && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="bg-info/10 border-info/20 rounded-lg border p-4 text-center">
              <div className="text-info text-2xl font-bold">{stats.total}</div>
              <div className="text-info/80 text-sm">Total Installations</div>
            </div>
            <div className="bg-success/10 border-success/20 rounded-lg border p-4 text-center">
              <div className="text-success text-2xl font-bold">
                {
                  scriptsWithStatus.filter(
                    (script) =>
                      script.container_status === "running" && !script.is_vm,
                  ).length
                }
              </div>
              <div className="text-success/80 text-sm">Running LXC</div>
            </div>
            <div className="bg-success/10 border-success/20 rounded-lg border p-4 text-center">
              <div className="text-success text-2xl font-bold">
                {
                  scriptsWithStatus.filter(
                    (script) =>
                      script.container_status === "running" && script.is_vm,
                  ).length
                }
              </div>
              <div className="text-success/80 text-sm">Running VMs</div>
            </div>
            <div className="bg-error/10 border-error/20 rounded-lg border p-4 text-center">
              <div className="text-error text-2xl font-bold">
                {
                  scriptsWithStatus.filter(
                    (script) =>
                      script.container_status === "stopped" && !script.is_vm,
                  ).length
                }
              </div>
              <div className="text-error/80 text-sm">Stopped LXC</div>
            </div>
            <div className="bg-error/10 border-error/20 rounded-lg border p-4 text-center">
              <div className="text-error text-2xl font-bold">
                {
                  scriptsWithStatus.filter(
                    (script) =>
                      script.container_status === "stopped" && script.is_vm,
                  ).length
                }
              </div>
              <div className="text-error/80 text-sm">Stopped VMs</div>
            </div>
          </div>
        )}

        {/* Add Script and Auto-Detect Buttons */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
            size="default"
          >
            {showAddForm ? "Cancel Add Script" : "+ Add Manual Script Entry"}
          </Button>
          <Button
            onClick={() => setShowAutoDetectForm(!showAutoDetectForm)}
            variant={showAutoDetectForm ? "outline" : "secondary"}
            size="default"
          >
            {showAutoDetectForm
              ? "Cancel Auto-Detect"
              : '🔍 Auto-Detect LXC Containers (Must contain a tag with "community-script")'}
          </Button>
          <Button
            onClick={() => {
              cleanupRunRef.current = false; // Allow cleanup to run again
              void cleanupMutation.mutate();
            }}
            disabled={cleanupMutation.isPending}
            variant="outline"
            size="default"
            className="border-warning/30 text-warning hover:bg-warning/10"
          >
            {cleanupMutation.isPending
              ? "🧹 Cleaning up..."
              : "🧹 Cleanup Orphaned Scripts"}
          </Button>
          <Button
            onClick={() => {
              // Trigger status check by calling the mutation directly
              const serverIds = [
                ...new Set(
                  scripts
                    .filter((script) => script.server_id)
                    .map((script) => script.server_id!),
                ),
              ];
              if (serverIds.length > 0) {
                containerStatusMutation.mutate({ serverIds });
              }
            }}
            disabled={containerStatusMutation.isPending ?? scripts.length === 0}
            variant="outline"
            size="default"
          >
            {containerStatusMutation.isPending
              ? "🔄 Checking..."
              : "🔄 Refresh Container Status"}
          </Button>
        </div>

        {/* Add Script Form */}
        {showAddForm && (
          <div className="bg-card border-border mb-6 rounded-lg border p-4 shadow-sm sm:p-6">
            <h3 className="text-foreground mb-4 text-lg font-semibold sm:mb-6">
              Add Manual Script Entry
            </h3>
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <label className="text-foreground block text-sm font-medium">
                  Script Name *
                </label>
                <input
                  type="text"
                  value={addFormData.script_name}
                  onChange={(e) =>
                    handleAddFormChange("script_name", e.target.value)
                  }
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                  placeholder="Enter script name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-foreground block text-sm font-medium">
                  Container ID
                </label>
                <input
                  type="text"
                  value={addFormData.container_id}
                  onChange={(e) =>
                    handleAddFormChange("container_id", e.target.value)
                  }
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                  placeholder="Enter container ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-foreground block text-sm font-medium">
                  Server
                </label>
                <select
                  value={addFormData.server_id}
                  onChange={(e) =>
                    handleAddFormChange("server_id", e.target.value)
                  }
                  className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
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
            <div className="mt-4 flex flex-col justify-end gap-3 sm:mt-6 sm:flex-row">
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
                {createScriptMutation.isPending ? "Adding..." : "Add Script"}
              </Button>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {(autoDetectStatus.type ?? cleanupStatus.type) && (
          <div className="mb-4 space-y-2">
            {/* Auto-Detect Status Message */}
            {autoDetectStatus.type && (
              <div
                className={`rounded-lg border p-4 ${
                  autoDetectStatus.type === "success"
                    ? "bg-success/10 border-success/20"
                    : "bg-error/10 border-error/20"
                }`}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {autoDetectStatus.type === "success" ? (
                      <svg
                        className="text-success h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="text-error h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        autoDetectStatus.type === "success"
                          ? "text-success-foreground"
                          : "text-error-foreground"
                      }`}
                    >
                      {autoDetectStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cleanup Status Message */}
            {cleanupStatus.type && (
              <div
                className={`rounded-lg border p-4 ${
                  cleanupStatus.type === "success"
                    ? "bg-muted/50 border-muted"
                    : "bg-error/10 border-error/20"
                }`}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {cleanupStatus.type === "success" ? (
                      <svg
                        className="text-muted-foreground h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="text-error h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        cleanupStatus.type === "success"
                          ? "text-foreground"
                          : "text-error-foreground"
                      }`}
                    >
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
          <div className="bg-card border-border mb-6 rounded-lg border p-4 shadow-sm sm:p-6">
            <h3 className="text-foreground mb-4 text-lg font-semibold sm:mb-6">
              Auto-Detect LXC Containers (Must contain a tag with
              &quot;community-script&quot;)
            </h3>
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-muted/30 border-muted rounded-lg border p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="text-muted-foreground h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-foreground text-sm font-medium">
                      How it works
                    </h4>
                    <div className="text-muted-foreground mt-2 text-sm">
                      <p>This feature will:</p>
                      <ul className="mt-1 list-inside list-disc space-y-1">
                        <li>Connect to the selected server via SSH</li>
                        <li>Scan all LXC config files in /etc/pve/lxc/</li>
                        <li>
                          Find containers with &quot;community-script&quot; in
                          their tags
                        </li>
                        <li>Extract the container ID and hostname</li>
                        <li>Add them as installed script entries</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-foreground block text-sm font-medium">
                  Select Server *
                </label>
                <select
                  value={autoDetectServerId}
                  onChange={(e) => setAutoDetectServerId(e.target.value)}
                  className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
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
            <div className="mt-4 flex flex-col justify-end gap-3 sm:mt-6 sm:flex-row">
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
                {autoDetectMutation.isPending
                  ? "🔍 Scanning..."
                  : "🔍 Start Auto-Detection"}
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
              className="border-border bg-card text-foreground placeholder-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Filter Dropdowns - Responsive Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "all"
                    | "success"
                    | "failed"
                    | "in_progress",
                )
              }
              className="border-border bg-card text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
            </select>

            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="border-border bg-card text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
            >
              <option value="all">All Servers</option>
              <option value="local">Local</option>
              {uniqueServers.map((server) => (
                <option key={server} value={server}>
                  {server}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scripts Display - Mobile Cards / Desktop Table */}
      <div className="bg-card overflow-hidden rounded-lg shadow">
        {filteredScripts.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            {scripts.length === 0
              ? "No installed scripts found."
              : "No scripts match your filters."}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block space-y-4 p-4 md:hidden">
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
                  onBackup={() => handleBackupScript(script)}
                  onShell={() => handleOpenShell(script)}
                  onDelete={() => handleDeleteScript(Number(script.id))}
                  isUpdating={updateScriptMutation.isPending}
                  isDeleting={deleteScriptMutation.isPending}
                  containerStatus={
                    containerStatuses.get(script.id) ?? "unknown"
                  }
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
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted">
                  <tr>
                    <th
                      className="text-muted-foreground hover:bg-muted/80 cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider uppercase select-none"
                      onClick={() => handleSort("script_name")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Script Name</span>
                        {sortField === "script_name" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-muted-foreground hover:bg-muted/80 cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider uppercase select-none"
                      onClick={() => handleSort("container_id")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Container ID</span>
                        {sortField === "container_id" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      Web UI
                    </th>
                    <th
                      className="text-muted-foreground hover:bg-muted/80 cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider uppercase select-none"
                      onClick={() => handleSort("server_name")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Server</span>
                        {sortField === "server_name" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-muted-foreground hover:bg-muted/80 cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider uppercase select-none"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Status</span>
                        {sortField === "status" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-muted-foreground hover:bg-muted/80 cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider uppercase select-none"
                      onClick={() => handleSort("installation_date")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Installation Date</span>
                        {sortField === "installation_date" && (
                          <span className="text-primary">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-gray-200">
                  {filteredScripts.map((script) => (
                    <tr
                      key={script.id}
                      className="hover:bg-accent"
                      style={{
                        borderLeft: `4px solid ${script.server_color ?? "transparent"}`,
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <div className="flex min-h-[2.5rem] items-center">
                            <input
                              type="text"
                              value={editFormData.script_name}
                              onChange={(e) =>
                                handleInputChange("script_name", e.target.value)
                              }
                              className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 text-sm font-medium focus:ring-2 focus:outline-none"
                              placeholder="Script name"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              {script.container_id && (
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                                    script.is_vm
                                      ? "border border-purple-500/30 bg-purple-500/20 text-purple-600 dark:text-purple-400"
                                      : "border border-blue-500/30 bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                  }`}
                                >
                                  {script.is_vm ? "VM" : "LXC"}
                                </span>
                              )}
                              <div className="text-foreground text-sm font-medium">
                                {script.script_name}
                              </div>
                            </div>
                            <div className="text-muted-foreground text-sm">
                              {script.script_path}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <div className="flex min-h-[2.5rem] items-center">
                            <input
                              type="text"
                              value={editFormData.container_id}
                              onChange={(e) =>
                                handleInputChange(
                                  "container_id",
                                  e.target.value,
                                )
                              }
                              className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                              placeholder="Container ID"
                            />
                          </div>
                        ) : script.container_id ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-foreground font-mono text-sm">
                              {String(script.container_id)}
                            </span>
                            {script.container_status && (
                              <div className="flex items-center space-x-1">
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    script.container_status === "running"
                                      ? "bg-success"
                                      : script.container_status === "stopped"
                                        ? "bg-error"
                                        : "bg-muted-foreground"
                                  }`}
                                ></div>
                                <span
                                  className={`text-xs font-medium ${
                                    script.container_status === "running"
                                      ? "text-success"
                                      : script.container_status === "stopped"
                                        ? "text-error"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {script.container_status === "running"
                                    ? "Running"
                                    : script.container_status === "stopped"
                                      ? "Stopped"
                                      : "Unknown"}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingScriptId === script.id ? (
                          <div className="flex min-h-[2.5rem] items-center space-x-2">
                            <input
                              type="text"
                              value={editFormData.web_ui_ip}
                              onChange={(e) =>
                                handleInputChange("web_ui_ip", e.target.value)
                              }
                              className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-40 rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                              placeholder="IP"
                            />
                            <span className="text-muted-foreground">:</span>
                            <input
                              type="number"
                              value={editFormData.web_ui_port}
                              onChange={(e) =>
                                handleInputChange("web_ui_port", e.target.value)
                              }
                              className="border-input bg-background text-foreground focus:ring-ring focus:border-ring w-20 rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                              placeholder="Port"
                            />
                          </div>
                        ) : script.web_ui_ip ? (
                          <div className="flex items-center space-x-3">
                            <span className="text-foreground text-sm">
                              {script.web_ui_ip}:{script.web_ui_port ?? 80}
                            </span>
                            {containerStatuses.get(script.id) === "running" && (
                              <button
                                onClick={() => handleOpenWebUI(script)}
                                className="bg-info/20 hover:bg-info/30 border-info/50 text-info hover:text-info-foreground hover:border-info/60 flex-shrink-0 rounded border px-2 py-1 text-xs transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50"
                                title="Open Web UI"
                              >
                                Open UI
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                            {script.container_id &&
                              script.execution_mode === "ssh" && (
                                <button
                                  onClick={() => handleAutoDetectWebUI(script)}
                                  disabled={autoDetectWebUIMutation.isPending}
                                  className="bg-info hover:bg-info/90 text-info-foreground border-info rounded border px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                  title="Re-detect IP and port"
                                >
                                  {autoDetectWebUIMutation.isPending
                                    ? "..."
                                    : "Re-detect"}
                                </button>
                              )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-left whitespace-nowrap">
                        <span
                          className="inline-block rounded px-3 py-1 text-sm"
                          style={{
                            backgroundColor:
                              script.server_color ?? "transparent",
                            color: script.server_color
                              ? getContrastColor(script.server_color)
                              : "inherit",
                          }}
                        >
                          {script.server_name ?? "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={script.status}>
                          {script.status.replace("_", " ").toUpperCase()}
                        </StatusBadge>
                      </td>
                      <td className="text-muted-foreground px-6 py-4 text-sm whitespace-nowrap">
                        {formatDate(String(script.installation_date))}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        <div className="flex space-x-2">
                          {editingScriptId === script.id ? (
                            <>
                              <Button
                                onClick={handleSaveEdit}
                                disabled={updateScriptMutation.isPending}
                                variant="save"
                                size="sm"
                              >
                                {updateScriptMutation.isPending
                                  ? "Saving..."
                                  : "Save"}
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
                                      className="bg-muted/20 hover:bg-muted/30 border-muted text-muted-foreground hover:text-foreground hover:border-muted-foreground border transition-all duration-200 hover:scale-105 hover:shadow-md"
                                    >
                                      Actions
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="bg-card border-border w-48">
                                    {script.container_id && !script.is_vm && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleUpdateScript(script)
                                        }
                                        disabled={
                                          containerStatuses.get(script.id) ===
                                          "stopped"
                                        }
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                      >
                                        Update
                                      </DropdownMenuItem>
                                    )}
                                    {script.container_id &&
                                      script.execution_mode === "ssh" && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleBackupScript(script)
                                          }
                                          disabled={
                                            containerStatuses.get(script.id) ===
                                            "stopped"
                                          }
                                          className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                        >
                                          Backup
                                        </DropdownMenuItem>
                                      )}
                                    {script.container_id &&
                                      script.execution_mode === "ssh" &&
                                      !script.is_vm && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleOpenShell(script)
                                          }
                                          disabled={
                                            containerStatuses.get(script.id) ===
                                            "stopped"
                                          }
                                          className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                        >
                                          Shell
                                        </DropdownMenuItem>
                                      )}
                                    {script.web_ui_ip && (
                                      <DropdownMenuItem
                                        onClick={() => handleOpenWebUI(script)}
                                        disabled={
                                          containerStatuses.get(script.id) ===
                                          "stopped"
                                        }
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                      >
                                        Open UI
                                      </DropdownMenuItem>
                                    )}
                                    {script.container_id &&
                                      script.execution_mode === "ssh" &&
                                      script.web_ui_ip && (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleAutoDetectWebUI(script)
                                          }
                                          disabled={
                                            autoDetectWebUIMutation.isPending ??
                                            containerStatuses.get(script.id) ===
                                              "stopped"
                                          }
                                          className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                        >
                                          {autoDetectWebUIMutation.isPending
                                            ? "Re-detect..."
                                            : "Re-detect IP/Port"}
                                        </DropdownMenuItem>
                                      )}
                                    {script.container_id &&
                                      script.execution_mode === "ssh" &&
                                      !script.is_vm && (
                                        <>
                                          <DropdownMenuSeparator className="bg-border" />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleLXCSettings(script)
                                            }
                                            className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                          >
                                            <Settings className="mr-2 h-4 w-4" />
                                            LXC Settings
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator className="bg-border" />
                                        </>
                                      )}
                                    {script.container_id &&
                                      script.execution_mode === "ssh" && (
                                        <>
                                          {script.is_vm && (
                                            <DropdownMenuSeparator className="bg-border" />
                                          )}
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleStartStop(
                                                script,
                                                (containerStatuses.get(
                                                  script.id,
                                                ) ?? "unknown") === "running"
                                                  ? "stop"
                                                  : "start",
                                              )
                                            }
                                            disabled={
                                              controllingScriptId ===
                                                script.id ||
                                              (containerStatuses.get(
                                                script.id,
                                              ) ?? "unknown") === "unknown"
                                            }
                                            className={
                                              (containerStatuses.get(
                                                script.id,
                                              ) ?? "unknown") === "running"
                                                ? "text-error hover:text-error-foreground hover:bg-error/20 focus:bg-error/20"
                                                : "text-success hover:text-success-foreground hover:bg-success/20 focus:bg-success/20"
                                            }
                                          >
                                            {controllingScriptId === script.id
                                              ? "Working..."
                                              : (containerStatuses.get(
                                                    script.id,
                                                  ) ?? "unknown") === "running"
                                                ? "Stop"
                                                : "Start"}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDestroy(script)
                                            }
                                            disabled={
                                              controllingScriptId === script.id
                                            }
                                            className="text-error hover:text-error-foreground hover:bg-error/20 focus:bg-error/20"
                                          >
                                            {controllingScriptId === script.id
                                              ? "Working..."
                                              : "Destroy"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator className="bg-border" />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteScript(
                                                script.id,
                                                script,
                                              )
                                            }
                                            disabled={
                                              deleteScriptMutation.isPending
                                            }
                                            className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                          >
                                            {deleteScriptMutation.isPending
                                              ? "Deleting..."
                                              : "Delete only from DB"}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    {(!script.container_id ||
                                      script.execution_mode !== "ssh") && (
                                      <>
                                        <DropdownMenuSeparator className="bg-border" />
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDeleteScript(
                                              Number(script.id),
                                            )
                                          }
                                          disabled={
                                            deleteScriptMutation.isPending
                                          }
                                          className="text-muted-foreground hover:text-foreground hover:bg-muted/20 focus:bg-muted/20"
                                        >
                                          {deleteScriptMutation.isPending
                                            ? "Deleting..."
                                            : "Delete"}
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
          type={errorModal.type ?? "error"}
        />
      )}

      {/* Loading Modal */}
      {loadingModal && (
        <LoadingModal
          isOpen={loadingModal.isOpen}
          action={loadingModal.action}
        />
      )}

      {/* Backup Prompt Modal */}
      {showBackupPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
            <div className="border-border flex items-center justify-center border-b p-6">
              <div className="flex items-center gap-3">
                <svg
                  className="text-info h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <h2 className="text-card-foreground text-2xl font-bold">
                  Backup Before Update?
                </h2>
              </div>
            </div>
            <div className="p-6">
              <p className="text-muted-foreground mb-6 text-sm">
                Would you like to create a backup before updating the container?
              </p>
              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <Button
                  onClick={() => {
                    setShowBackupPrompt(false);
                    handleBackupPromptResponse(false);
                  }}
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto"
                >
                  No, Update Without Backup
                </Button>
                <Button
                  onClick={() => handleBackupPromptResponse(true)}
                  variant="default"
                  size="default"
                  className="w-full sm:w-auto"
                >
                  Yes, Backup First
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Selection Modal */}
      <StorageSelectionModal
        isOpen={showStorageSelection}
        onClose={() => {
          setShowStorageSelection(false);
          setPendingUpdateScript(null);
          setBackupStorages([]);
        }}
        onSelect={handleStorageSelected}
        storages={backupStorages}
        isLoading={isLoadingStorages}
        onRefresh={() => {
          if (pendingUpdateScript?.server_id) {
            void fetchStorages(pendingUpdateScript.server_id, true);
          }
        }}
      />

      {/* Backup Warning Modal */}
      <BackupWarningModal
        isOpen={showBackupWarning}
        onClose={() => setShowBackupWarning(false)}
        onProceed={() => {
          setShowBackupWarning(false);
          // Proceed with update even though backup failed
          if (pendingUpdateScript) {
            proceedWithUpdate(null);
          }
        }}
      />

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
