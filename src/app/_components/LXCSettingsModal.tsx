"use client";

import { useState, useEffect, startTransition } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { LoadingModal } from "./LoadingModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";

interface InstalledScript {
  id: number;
  script_name: string;
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
}

interface LXCSettingsModalProps {
  isOpen: boolean;
  script: InstalledScript | null;
  onClose: () => void;
  onSave: () => void;
}

export function LXCSettingsModal({
  isOpen,
  script,
  onClose,
  onSave: _onSave,
}: LXCSettingsModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "lxc-settings-modal",
    allowEscape: true,
    onClose,
  });
  const [activeTab, setActiveTab] = useState<string>("common");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultType, setResultType] = useState<"success" | "error" | null>(
    null,
  );
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [forceSync] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<any>({
    arch: "",
    cores: 0,
    memory: 0,
    hostname: "",
    swap: 0,
    onboot: false,
    ostype: "",
    unprivileged: false,
    net_name: "",
    net_bridge: "",
    net_hwaddr: "",
    net_ip_type: "dhcp",
    net_ip: "",
    net_gateway: "",
    net_type: "",
    net_vlan: 0,
    rootfs_storage: "",
    rootfs_size: "",
    feature_keyctl: false,
    feature_nesting: false,
    feature_fuse: false,
    feature_mount: "",
    tags: "",
    advanced_config: "",
  });

  // tRPC hooks
  const {
    data: configData,
    isLoading,
    refetch,
  } = api.installedScripts.getLXCConfig.useQuery(
    { scriptId: script?.id ?? 0, forceSync },
    { enabled: !!script && isOpen },
  );

  const saveMutation = api.installedScripts.saveLXCConfig.useMutation({
    onSuccess: (data) => {
      setIsSaving(false);
      setShowConfirmation(false);

      if (data.success) {
        setResultType("success");
        setResultMessage(
          data.message ?? "LXC configuration saved successfully",
        );
        setHasChanges(false);
      } else {
        setResultType("error");
        setResultMessage(data.error ?? "Failed to save configuration");
      }
      setShowResultModal(true);
    },
    onError: (err) => {
      setIsSaving(false);
      setShowConfirmation(false);
      setResultType("error");
      setResultMessage(`Failed to save configuration: ${err.message}`);
      setShowResultModal(true);
    },
  });

  const syncMutation = api.installedScripts.syncLXCConfig.useMutation({
    onSuccess: (result) => {
      populateFormData(result);
      setHasChanges(false);
    },
    onError: (err) => {
      setError(`Failed to sync configuration: ${err.message}`);
    },
  });

  // Populate form data helper
  const populateFormData = (result: any) => {
    if (!result?.success) return;
    const config = result.config;
    setFormData({
      arch: config.arch ?? "",
      cores: config.cores ?? 0,
      memory: config.memory ?? 0,
      hostname: config.hostname ?? "",
      swap: config.swap ?? 0,
      onboot: config.onboot === 1,
      ostype: config.ostype ?? "",
      unprivileged: config.unprivileged === 1,
      net_name: config.net_name ?? "",
      net_bridge: config.net_bridge ?? "",
      net_hwaddr: config.net_hwaddr ?? "",
      net_ip_type: config.net_ip_type ?? "dhcp",
      net_ip: config.net_ip ?? "",
      net_gateway: config.net_gateway ?? "",
      net_type: config.net_type ?? "",
      net_vlan: config.net_vlan ?? 0,
      rootfs_storage: config.rootfs_storage ?? "",
      rootfs_size: config.rootfs_size ?? "",
      feature_keyctl: config.feature_keyctl === 1,
      feature_nesting: config.feature_nesting === 1,
      feature_fuse: config.feature_fuse === 1,
      feature_mount: config.feature_mount ?? "",
      tags: config.tags ?? "",
      advanced_config: config.advanced_config ?? "",
    });
  };

  // Load config when data arrives
  useEffect(() => {
    if (configData?.success) {
      populateFormData(configData);
      startTransition(() => {
        setHasChanges(false);
      });
    } else if (configData && !configData.success) {
      startTransition(() => {
        setError(String(configData.error ?? "Failed to load configuration"));
      });
    }
  }, [configData]);

  const handleInputChange = (field: string, value: any): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSyncFromServer = () => {
    if (!script) return;
    setError(null);
    syncMutation.mutate({ scriptId: script.id });
  };

  const validateForm = () => {
    // Check required fields
    if (!formData.arch?.trim()) {
      setError("Architecture is required");
      return false;
    }
    if (!formData.cores || formData.cores < 1) {
      setError("Cores must be at least 1");
      return false;
    }
    if (!formData.memory || formData.memory < 128) {
      setError("Memory must be at least 128 MB");
      return false;
    }
    if (!formData.hostname?.trim()) {
      setError("Hostname is required");
      return false;
    }
    if (!formData.ostype?.trim()) {
      setError("OS Type is required");
      return false;
    }
    if (!formData.rootfs_storage?.trim()) {
      setError("Root filesystem storage is required");
      return false;
    }

    // Check if trying to decrease disk size
    const currentSize = configData?.config?.rootfs_size ?? "0G";
    const newSize = formData.rootfs_size ?? "0G";
    const currentSizeGB = parseFloat(String(currentSize));
    const newSizeGB = parseFloat(String(newSize));

    if (newSizeGB < currentSizeGB) {
      setError(
        "Disk size cannot be decreased. Only increases are allowed for safety.",
      );
      return false;
    }

    return true;
  };

  const handleSave = () => {
    setError(null);

    // Validate form - only show confirmation modal if no errors
    if (validateForm()) {
      setShowConfirmation(true);
    }
  };

  const handleConfirmSave = () => {
    if (!script) return;
    setError(null);
    setIsSaving(true);
    setShowConfirmation(false);

    saveMutation.mutate({
      scriptId: script.id,
      config: {
        ...formData,
        onboot: formData.onboot ? 1 : 0,
        unprivileged: formData.unprivileged ? 1 : 0,
        feature_keyctl: formData.feature_keyctl ? 1 : 0,
        feature_nesting: formData.feature_nesting ? 1 : 0,
        feature_fuse: formData.feature_fuse ? 1 : 0,
      },
    });
  };

  const handleResultModalClose = () => {
    setShowResultModal(false);
    setResultType(null);
    setResultMessage(null);
    // Refresh the data to show updated values
    void refetch();
  };

  if (!isOpen || !script) return null;

  return (
    <>
      <ModalPortal>
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          style={{ zIndex }}
        >
          <div className="bg-card flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg shadow-xl">
            {/* Header */}
            <div className="border-border flex items-center justify-between border-b p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <h2 className="text-foreground text-2xl font-bold">
                  LXC Settings
                </h2>
                <Badge variant="outline">{script.container_id}</Badge>
                <ContextualHelpIcon
                  section="lxc-settings"
                  tooltip="Help with LXC Settings"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSyncFromServer}
                  disabled={
                    syncMutation.isPending ??
                    isLoading ??
                    saveMutation.isPending
                  }
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                  />
                  Sync from Server
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  aria-label="Close LXC settings"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Warning Banner */}
            {configData?.has_changes && (
              <div className="bg-warning/10 border-warning/20 border-b p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-warning-foreground text-sm font-medium">
                      Configuration Mismatch Detected
                    </p>
                    <p className="text-warning/80 mt-1 text-sm">
                      The cached configuration differs from the server. Click
                      &quot;Sync from Server&quot; to get the latest version.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-error/10 border-error/20 border-b p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-error mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-error-foreground text-sm font-medium">
                      Error
                    </p>
                    <p className="text-error/80 mt-1 text-sm">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-error hover:text-error/80"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Tab Navigation */}
              <div className="border-border mb-6 border-b">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab("common")}
                    className={`border-b-2 px-1 py-2 text-sm font-medium ${
                      activeTab === "common"
                        ? "border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
                    }`}
                  >
                    Common Settings
                  </button>
                  <button
                    onClick={() => setActiveTab("advanced")}
                    className={`border-b-2 px-1 py-2 text-sm font-medium ${
                      activeTab === "advanced"
                        ? "border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
                    }`}
                  >
                    Advanced Settings
                  </button>
                </nav>
              </div>

              {/* Common Settings Tab */}
              {activeTab === "common" && (
                <div className="space-y-6">
                  {/* Basic Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-foreground text-lg font-semibold">
                      Basic Configuration
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="arch"
                          className="text-foreground block text-sm font-medium"
                        >
                          Architecture *
                        </label>
                        <Input
                          id="arch"
                          value={formData.arch}
                          onChange={(e) =>
                            handleInputChange("arch", e.target.value)
                          }
                          placeholder="amd64"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="cores"
                          className="text-foreground block text-sm font-medium"
                        >
                          Cores *
                        </label>
                        <Input
                          id="cores"
                          type="number"
                          value={formData.cores}
                          onChange={(e) =>
                            handleInputChange(
                              "cores",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="memory"
                          className="text-foreground block text-sm font-medium"
                        >
                          Memory (MB) *
                        </label>
                        <Input
                          id="memory"
                          type="number"
                          value={formData.memory}
                          onChange={(e) =>
                            handleInputChange(
                              "memory",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          min="128"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="swap"
                          className="text-foreground block text-sm font-medium"
                        >
                          Swap (MB)
                        </label>
                        <Input
                          id="swap"
                          type="number"
                          value={formData.swap}
                          onChange={(e) =>
                            handleInputChange(
                              "swap",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="hostname"
                          className="text-foreground block text-sm font-medium"
                        >
                          Hostname *
                        </label>
                        <Input
                          id="hostname"
                          value={formData.hostname}
                          onChange={(e) =>
                            handleInputChange("hostname", e.target.value)
                          }
                          placeholder="container-hostname"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="ostype"
                          className="text-foreground block text-sm font-medium"
                        >
                          OS Type *
                        </label>
                        <Input
                          id="ostype"
                          value={formData.ostype}
                          onChange={(e) =>
                            handleInputChange("ostype", e.target.value)
                          }
                          placeholder="debian"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="onboot"
                          checked={formData.onboot}
                          onChange={(e) =>
                            handleInputChange("onboot", e.target.checked)
                          }
                          className="text-primary focus:ring-primary border-border h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="onboot"
                          className="text-foreground text-sm font-medium"
                        >
                          Start on Boot
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="unprivileged"
                          checked={formData.unprivileged}
                          onChange={(e) =>
                            handleInputChange("unprivileged", e.target.checked)
                          }
                          className="text-primary focus:ring-primary border-border h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="unprivileged"
                          className="text-foreground text-sm font-medium"
                        >
                          Unprivileged Container
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Network Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-foreground text-lg font-semibold">
                      Network Configuration
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="net_name"
                          className="text-foreground block text-sm font-medium"
                        >
                          Interface Name
                        </label>
                        <Input
                          id="net_name"
                          value={formData.net_name}
                          onChange={(e) =>
                            handleInputChange("net_name", e.target.value)
                          }
                          placeholder="eth0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="net_bridge"
                          className="text-foreground block text-sm font-medium"
                        >
                          Bridge
                        </label>
                        <Input
                          id="net_bridge"
                          value={formData.net_bridge}
                          onChange={(e) =>
                            handleInputChange("net_bridge", e.target.value)
                          }
                          placeholder="vmbr0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="net_hwaddr"
                          className="text-foreground block text-sm font-medium"
                        >
                          MAC Address
                        </label>
                        <Input
                          id="net_hwaddr"
                          value={formData.net_hwaddr}
                          onChange={(e) =>
                            handleInputChange("net_hwaddr", e.target.value)
                          }
                          placeholder="BC:24:11:2D:2D:AB"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="net_type"
                          className="text-foreground block text-sm font-medium"
                        >
                          Type
                        </label>
                        <Input
                          id="net_type"
                          value={formData.net_type}
                          onChange={(e) =>
                            handleInputChange("net_type", e.target.value)
                          }
                          placeholder="veth"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="net_ip_type"
                          className="text-foreground block text-sm font-medium"
                        >
                          IP Configuration
                        </label>
                        <select
                          id="net_ip_type"
                          value={formData.net_ip_type}
                          onChange={(e) =>
                            handleInputChange("net_ip_type", e.target.value)
                          }
                          className="border-input bg-background w-full rounded-md border px-3 py-2"
                        >
                          <option value="dhcp">DHCP</option>
                          <option value="static">Static IP</option>
                        </select>
                      </div>
                      {formData.net_ip_type === "static" && (
                        <>
                          <div className="space-y-2">
                            <label
                              htmlFor="net_ip"
                              className="text-foreground block text-sm font-medium"
                            >
                              IP Address with CIDR *
                            </label>
                            <Input
                              id="net_ip"
                              value={formData.net_ip}
                              onChange={(e) =>
                                handleInputChange("net_ip", e.target.value)
                              }
                              placeholder="10.10.10.164/24"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor="net_gateway"
                              className="text-foreground block text-sm font-medium"
                            >
                              Gateway
                            </label>
                            <Input
                              id="net_gateway"
                              value={formData.net_gateway}
                              onChange={(e) =>
                                handleInputChange("net_gateway", e.target.value)
                              }
                              placeholder="10.10.10.254"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <label
                          htmlFor="net_vlan"
                          className="text-foreground block text-sm font-medium"
                        >
                          VLAN Tag
                        </label>
                        <Input
                          id="net_vlan"
                          type="number"
                          value={formData.net_vlan}
                          onChange={(e) =>
                            handleInputChange(
                              "net_vlan",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="space-y-4">
                    <h3 className="text-foreground text-lg font-semibold">
                      Storage
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="rootfs_storage"
                          className="text-foreground block text-sm font-medium"
                        >
                          Root Filesystem *
                        </label>
                        <Input
                          id="rootfs_storage"
                          value={formData.rootfs_storage}
                          onChange={(e) =>
                            handleInputChange("rootfs_storage", e.target.value)
                          }
                          placeholder="PROX2-STORAGE2:vm-109-disk-0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="rootfs_size"
                          className="text-foreground block text-sm font-medium"
                        >
                          Size
                          <span className="text-muted-foreground ml-2 text-xs">
                            (can only be increased)
                          </span>
                        </label>
                        <Input
                          id="rootfs_size"
                          value={formData.rootfs_size}
                          onChange={(e) =>
                            handleInputChange("rootfs_size", e.target.value)
                          }
                          placeholder="4G"
                        />
                        <p className="text-muted-foreground text-xs">
                          Disk size can only be increased for safety. Format:
                          4G, 8G, 16G, etc.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4">
                    <h3 className="text-foreground text-lg font-semibold">
                      Features
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="feature_keyctl"
                          checked={formData.feature_keyctl}
                          onChange={(e) =>
                            handleInputChange(
                              "feature_keyctl",
                              e.target.checked,
                            )
                          }
                          className="text-primary focus:ring-primary border-border h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="feature_keyctl"
                          className="text-foreground text-sm font-medium"
                        >
                          Keyctl
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="feature_nesting"
                          checked={formData.feature_nesting}
                          onChange={(e) =>
                            handleInputChange(
                              "feature_nesting",
                              e.target.checked,
                            )
                          }
                          className="text-primary focus:ring-primary border-border h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="feature_nesting"
                          className="text-foreground text-sm font-medium"
                        >
                          Nesting
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="feature_fuse"
                          checked={formData.feature_fuse}
                          onChange={(e) =>
                            handleInputChange("feature_fuse", e.target.checked)
                          }
                          className="text-primary focus:ring-primary border-border h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="feature_fuse"
                          className="text-foreground text-sm font-medium"
                        >
                          FUSE
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="feature_mount"
                        className="text-foreground block text-sm font-medium"
                      >
                        Additional Mount Features
                      </label>
                      <Input
                        id="feature_mount"
                        value={formData.feature_mount}
                        onChange={(e) =>
                          handleInputChange("feature_mount", e.target.value)
                        }
                        placeholder="Additional features (comma-separated)"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-4">
                    <h3 className="text-foreground text-lg font-semibold">
                      Tags
                    </h3>
                    <div className="space-y-2">
                      <label
                        htmlFor="tags"
                        className="text-foreground block text-sm font-medium"
                      >
                        Tags
                      </label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) =>
                          handleInputChange("tags", e.target.value)
                        }
                        placeholder="community-script;pve-scripts-local"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Settings Tab */}
              {activeTab === "advanced" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="advanced_config"
                      className="text-foreground block text-sm font-medium"
                    >
                      Advanced Configuration
                    </label>
                    <textarea
                      id="advanced_config"
                      value={formData.advanced_config}
                      onChange={(e) =>
                        handleInputChange("advanced_config", e.target.value)
                      }
                      placeholder="lxc.* entries, comments, and other advanced settings..."
                      className="border-input bg-background resize-vertical min-h-[400px] w-full rounded-md border px-3 py-2 font-mono text-sm"
                    />
                    <p className="text-muted-foreground text-xs">
                      This section contains lxc.* entries, comments, and other
                      advanced settings that are not covered in the Common
                      Settings tab.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-border bg-muted/30 flex items-center justify-end border-t p-4 sm:p-6">
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || saveMutation.isPending || !hasChanges}
                  variant="default"
                >
                  {isSaving
                    ? "Saving & Resizing..."
                    : saveMutation.isPending
                      ? "Saving..."
                      : "Save Configuration"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false);
        }}
        onConfirm={handleConfirmSave}
        title="Confirm LXC Configuration Changes"
        message={`Modifying LXC configuration can break your container and may require manual recovery. Ensure you understand these changes before proceeding.${
          formData.rootfs_size &&
          configData?.config?.rootfs_size &&
          parseFloat(String(formData.rootfs_size)) >
            parseFloat(String(configData.config.rootfs_size ?? "0"))
            ? `\n\n⚠️ DISK RESIZE DETECTED: The disk size will be increased from ${configData.config.rootfs_size} to ${formData.rootfs_size}. This operation will automatically resize the underlying storage and filesystem.`
            : ""
        }\n\nThe container may need to be restarted for changes to take effect.`}
        variant="danger"
        confirmText={script.container_id ?? ""}
        confirmButtonText={
          formData.rootfs_size &&
          configData?.config?.rootfs_size &&
          parseFloat(String(formData.rootfs_size)) >
            parseFloat(String(configData.config.rootfs_size ?? "0"))
            ? "Save & Resize Disk"
            : "Save Configuration"
        }
      />

      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoading || isSaving}
        action={
          isSaving
            ? "Saving configuration and resizing disk..."
            : "Loading LXC configuration..."
        }
      />

      {/* Result Modal */}
      {showResultModal && resultType && resultMessage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ zIndex: zIndex + 10 }}
        >
          <div className="bg-card text-card-foreground border-border mx-4 w-full max-w-md rounded-lg border shadow-xl">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                {resultType === "success" ? (
                  <CheckCircle className="text-success h-6 w-6" />
                ) : (
                  <AlertTriangle className="text-error h-6 w-6" />
                )}
                <h3 className="text-card-foreground text-lg font-semibold">
                  {resultType === "success" ? "Success" : "Error"}
                </h3>
              </div>
              <p className="text-muted-foreground mb-6">{resultMessage}</p>
              <div className="flex justify-end">
                <button
                  onClick={handleResultModalClose}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
