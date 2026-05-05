"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import type { Script } from "~/types/script";
import type { Server } from "~/types/server";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";

export type EnvVars = Record<string, string | number | boolean>;

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (envVars: EnvVars) => void;
  script: Script | null;
  server: Server | null;
  mode: "default" | "advanced";
}

export function ConfigurationModal({
  isOpen,
  onClose,
  onConfirm,
  script,
  server,
  mode,
}: ConfigurationModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "configuration-modal",
    allowEscape: true,
    onClose,
  });

  // Fetch script data if we only have slug
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: script?.slug ?? "" },
    { enabled: !!script?.slug && isOpen },
  );

  const actualScript = script ?? scriptData?.script ?? null;

  // Fetch storages
  const { data: rootfsStoragesData } = api.scripts.getRootfsStorages.useQuery(
    { serverId: server?.id ?? 0, forceRefresh: false },
    { enabled: !!server?.id && isOpen },
  );

  const { data: templateStoragesData } =
    api.scripts.getTemplateStorages.useQuery(
      { serverId: server?.id ?? 0, forceRefresh: false },
      { enabled: !!server?.id && isOpen && mode === "advanced" },
    );

  // Get resources from JSON
  const resources = actualScript?.install_methods?.[0]?.resources;
  const slug = actualScript?.slug ?? "";

  // Default mode state
  const [containerStorage, setContainerStorage] = useState<string>("");

  // Advanced mode state
  const [advancedVars, setAdvancedVars] = useState<EnvVars>({});

  // Server presets
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const { data: presetsData, refetch: refetchPresets } =
    api.serverPresets.getByServerId.useQuery(
      { serverId: server?.id ?? 0 },
      { enabled: !!server?.id && isOpen && mode === "advanced" },
    );
  const createPresetMutation = api.serverPresets.create.useMutation({
    onSuccess: () => {
      void refetchPresets();
      setShowSavePreset(false);
      setPresetName("");
    },
  });
  const deletePresetMutation = api.serverPresets.delete.useMutation({
    onSuccess: () => void refetchPresets(),
  });

  // Discovered SSH keys on the Proxmox host (advanced mode only)
  const [discoveredSshKeys, setDiscoveredSshKeys] = useState<string[]>([]);
  const [discoveredSshKeysLoading, setDiscoveredSshKeysLoading] =
    useState(false);
  const [discoveredSshKeysError, setDiscoveredSshKeysError] = useState<
    string | null
  >(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize defaults when script/server data is available
  useEffect(() => {
    if (!actualScript || !server) return;

    if (mode === "default") {
      // Default mode: minimal vars
      setContainerStorage("");
    } else {
      // Advanced mode: all vars with defaults
      const defaults: EnvVars = {
        // Resources from JSON
        var_cpu: resources?.cpu ?? 1,
        var_ram: resources?.ram ?? 1024,
        var_disk: resources?.hdd ?? 4,
        var_unprivileged:
          script?.privileged === false
            ? 1
            : script?.privileged === true
              ? 0
              : 1,

        // Network defaults
        var_net: "dhcp",
        var_brg: "vmbr0",
        var_gateway: "",
        var_ipv6_method: "none",
        var_ipv6_static: "",
        var_vlan: "",
        var_mtu: 1500,
        var_mac: "",
        var_ns: "",

        // Identity
        var_ctid: "",
        var_hostname: slug,
        var_pw: "",
        var_tags: "community-script",

        // SSH
        var_ssh: "no",
        var_ssh_authorized_key: "",

        // Features
        var_nesting: 1,
        var_fuse: 0,
        var_keyctl: 0,
        var_mknod: 0,
        var_mount_fs: "",
        var_protection: "no",
        var_tun: "no",

        // System
        var_timezone: "",
        var_verbose: "no",
        var_apt_cacher: "no",
        var_apt_cacher_ip: "",
        var_github_token: "",

        // Storage
        var_container_storage: "",
        var_template_storage: "",
      };
      setAdvancedVars(defaults);
    }
  }, [actualScript, server, mode, resources, slug]);

  // Load persistent APT proxy settings for advanced mode
  useEffect(() => {
    if (!isOpen || mode !== "advanced") return;
    let cancelled = false;
    fetch("/api/settings/apt-proxy")
      .then((res) => res.json() as Promise<{ enabled: boolean; ip: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.enabled && data.ip) {
          setAdvancedVars((prev) => ({
            ...prev,
            var_apt_cacher: "yes",
            var_apt_cacher_ip: data.ip,
          }));
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode]);

  // Discover SSH keys on the Proxmox host when advanced mode is open
  useEffect(() => {
    if (!server?.id || !isOpen || mode !== "advanced") {
      setDiscoveredSshKeys([]);
      setDiscoveredSshKeysError(null);
      return;
    }
    let cancelled = false;
    setDiscoveredSshKeysLoading(true);
    setDiscoveredSshKeysError(null);
    fetch(`/api/servers/${server.id}/discover-ssh-keys`)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            res.status === 404 ? "Server not found" : res.statusText,
          );
        return res.json();
      })
      .then((data: { keys?: string[] }) => {
        if (!cancelled && Array.isArray(data.keys))
          setDiscoveredSshKeys(data.keys);
      })
      .catch((err) => {
        if (!cancelled) {
          setDiscoveredSshKeys([]);
          setDiscoveredSshKeysError(
            err instanceof Error ? err.message : "Could not detect keys",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDiscoveredSshKeysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [server?.id, isOpen, mode]);

  // Validation functions
  const validateIPv4 = (ip: string): boolean => {
    if (!ip) return true; // Empty is allowed (auto)
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    const parts = ip.split(".").map(Number);
    return parts.every((p) => p >= 0 && p <= 255);
  };

  const validateCIDR = (cidr: string): boolean => {
    if (!cidr) return true; // Empty is allowed
    const pattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!pattern.test(cidr)) return false;
    const parts = cidr.split("/");
    if (parts.length !== 2) return false;
    const [ip, prefix] = parts;
    if (!ip || !prefix) return false;
    const ipParts = ip.split(".").map(Number);
    if (!ipParts.every((p) => p >= 0 && p <= 255)) return false;
    const prefixNum = parseInt(prefix, 10);
    return prefixNum >= 0 && prefixNum <= 32;
  };

  const validateIPv6 = (ipv6: string): boolean => {
    if (!ipv6) return true; // Empty is allowed
    // Basic IPv6 validation (simplified - allows compressed format)
    const pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
    return pattern.test(ipv6);
  };

  const validateMAC = (mac: string): boolean => {
    if (!mac) return true; // Empty is allowed (auto)
    const pattern = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    return pattern.test(mac);
  };

  const validatePositiveInt = (value: string | number | undefined): boolean => {
    if (value === "" || value === undefined) return true;
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    return !isNaN(num) && num > 0;
  };

  const validateHostname = (hostname: string): boolean => {
    if (!hostname || hostname.length > 253) return false;
    const label = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
    const labels = hostname.split(".");
    return (
      labels.length >= 1 &&
      labels.every((l) => l.length >= 1 && l.length <= 63 && label.test(l))
    );
  };

  const validateAptCacherAddress = (value: string): boolean => {
    return validateIPv4(value) || validateHostname(value);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === "default") {
      // Default mode: only storage is optional
      // No validation needed
    } else {
      // Advanced mode: validate all fields
      if (
        advancedVars.var_gateway &&
        !validateIPv4(advancedVars.var_gateway as string) &&
        !validateIPv6(advancedVars.var_gateway as string)
      ) {
        newErrors.var_gateway = "Invalid IP address";
      }
      if (
        advancedVars.var_mac &&
        !validateMAC(advancedVars.var_mac as string)
      ) {
        newErrors.var_mac = "Invalid MAC address format (XX:XX:XX:XX:XX:XX)";
      }
      if (
        advancedVars.var_ns &&
        !validateIPv4(advancedVars.var_ns as string) &&
        !validateIPv6(advancedVars.var_ns as string)
      ) {
        newErrors.var_ns = "Invalid IP address";
      }
      if (
        advancedVars.var_apt_cacher_ip &&
        !validateAptCacherAddress(advancedVars.var_apt_cacher_ip as string)
      ) {
        newErrors.var_apt_cacher_ip = "Invalid IPv4 address or hostname";
      }
      // Validate IPv4 CIDR if network mode is static
      const netValue = advancedVars.var_net;
      const isStaticMode =
        netValue === "static" ||
        (typeof netValue === "string" && netValue.includes("/"));
      if (isStaticMode) {
        const cidrValue =
          typeof netValue === "string" && netValue.includes("/")
            ? netValue
            : ((advancedVars.var_ip as string) ?? "");
        if (cidrValue && !validateCIDR(cidrValue)) {
          newErrors.var_ip = "Invalid CIDR format (e.g., 10.10.10.1/24)";
        }
      }
      // Validate IPv6 static if IPv6 method is static
      if (
        advancedVars.var_ipv6_method === "static" &&
        advancedVars.var_ipv6_static
      ) {
        if (!validateIPv6(advancedVars.var_ipv6_static as string)) {
          newErrors.var_ipv6_static = "Invalid IPv6 address";
        }
      }
      if (
        !validatePositiveInt(
          advancedVars.var_cpu as string | number | undefined,
        )
      ) {
        newErrors.var_cpu = "Must be a positive integer";
      }
      if (
        !validatePositiveInt(
          advancedVars.var_ram as string | number | undefined,
        )
      ) {
        newErrors.var_ram = "Must be a positive integer";
      }
      if (
        !validatePositiveInt(
          advancedVars.var_disk as string | number | undefined,
        )
      ) {
        newErrors.var_disk = "Must be a positive integer";
      }
      if (
        advancedVars.var_mtu &&
        !validatePositiveInt(
          advancedVars.var_mtu as string | number | undefined,
        )
      ) {
        newErrors.var_mtu = "Must be a positive integer";
      }
      if (
        advancedVars.var_vlan &&
        !validatePositiveInt(
          advancedVars.var_vlan as string | number | undefined,
        )
      ) {
        newErrors.var_vlan = "Must be a positive integer";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) {
      return;
    }

    let envVars: EnvVars = {};

    if (mode === "default") {
      // Default mode: minimal vars
      envVars = {
        var_hostname: slug,
        var_brg: "vmbr0",
        var_net: "dhcp",
        var_ipv6_method: "auto",
        var_ssh: "no",
        var_nesting: 1,
        var_verbose: "no",
        var_cpu: resources?.cpu ?? 1,
        var_ram: resources?.ram ?? 1024,
        var_disk: resources?.hdd ?? 4,
        var_unprivileged:
          script?.privileged === false
            ? 1
            : script?.privileged === true
              ? 0
              : 1,
      };

      if (containerStorage) {
        envVars.var_container_storage = containerStorage;
      }
    } else {
      // Advanced mode: all vars
      envVars = { ...advancedVars };

      // If network mode is static and var_ip is set, replace var_net with the CIDR.
      // If var_ip is missing (user left it blank), remove var_net so the script
      // defaults to dhcp rather than receiving the literal string "static".
      if (envVars.var_net === "static") {
        if (envVars.var_ip) {
          envVars.var_net = envVars.var_ip as string;
        } else {
          delete envVars.var_net;
        }
        delete envVars.var_ip;
      }

      // Format password correctly: if var_pw is set, format it as "-password <password>"
      // build.func expects PW to be in "-password <password>" format when added to PCT_OPTIONS
      const rawPassword = envVars.var_pw;
      const hasPassword =
        rawPassword &&
        typeof rawPassword === "string" &&
        rawPassword.trim() !== "";
      const hasSSHKey =
        envVars.var_ssh_authorized_key &&
        typeof envVars.var_ssh_authorized_key === "string" &&
        envVars.var_ssh_authorized_key.trim() !== "";

      if (hasPassword) {
        // Remove any existing "-password" prefix to avoid double-formatting
        const cleanPassword = rawPassword.startsWith("-password ")
          ? rawPassword.substring(11)
          : rawPassword;
        // Format as "-password <password>" for build.func
        envVars.var_pw = `-password ${cleanPassword}`;
      } else {
        // Empty password means auto-login, clear var_pw
        envVars.var_pw = "";
      }

      if ((hasPassword || hasSSHKey) && envVars.var_ssh !== "no") {
        envVars.var_ssh = "yes";
      }

      // Normalize var_tags: accept both comma and semicolon, output comma-separated
      const rawTags = envVars.var_tags;
      if (typeof rawTags === "string" && rawTags.trim() !== "") {
        envVars.var_tags = rawTags
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",");
      }
    }

    // Remove empty string values (but keep 0, false, etc.)
    const cleaned: EnvVars = {};
    for (const [key, value] of Object.entries(envVars)) {
      if (value !== "" && value !== undefined) {
        cleaned[key] = value;
      }
    }

    // Always set mode to "default" (build.func line 1783 expects this)
    cleaned.mode = "default";

    onConfirm(cleaned);
  };

  const updateAdvancedVar = (key: string, value: string | number | boolean) => {
    setAdvancedVars((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const applyPreset = (
    preset: NonNullable<typeof presetsData>["presets"][number],
  ) => {
    setAdvancedVars((prev) => ({
      ...prev,
      ...(preset.cpu != null && { var_cpu: preset.cpu }),
      ...(preset.ram != null && { var_ram: preset.ram }),
      ...(preset.disk != null && { var_disk: preset.disk }),
      var_unprivileged: preset.privileged ? 0 : 1,
      ...(preset.bridge && { var_brg: preset.bridge }),
      ...(preset.vlan && { var_vlan: preset.vlan }),
      ...(preset.dns && { var_ns: preset.dns }),
      var_ssh: preset.ssh ? "yes" : "no",
      var_nesting: preset.nesting ? 1 : 0,
      var_fuse: preset.fuse ? 1 : 0,
      ...(preset.apt_proxy_on &&
        preset.apt_proxy_addr && {
          var_apt_cacher: "yes",
          var_apt_cacher_ip: preset.apt_proxy_addr,
        }),
    }));
  };

  const saveCurrentAsPreset = () => {
    if (!server?.id || !presetName.trim()) return;
    createPresetMutation.mutate({
      serverId: server.id,
      name: presetName.trim(),
      cpu:
        typeof advancedVars.var_cpu === "number"
          ? advancedVars.var_cpu
          : undefined,
      ram:
        typeof advancedVars.var_ram === "number"
          ? advancedVars.var_ram
          : undefined,
      disk:
        typeof advancedVars.var_disk === "number"
          ? advancedVars.var_disk
          : undefined,
      privileged: advancedVars.var_unprivileged === 0,
      bridge:
        typeof advancedVars.var_brg === "string"
          ? advancedVars.var_brg
          : undefined,
      vlan:
        typeof advancedVars.var_vlan === "string"
          ? advancedVars.var_vlan
          : undefined,
      dns:
        typeof advancedVars.var_ns === "string"
          ? advancedVars.var_ns
          : undefined,
      ssh: advancedVars.var_ssh === "yes",
      nesting: advancedVars.var_nesting === 1,
      fuse: advancedVars.var_fuse === 1,
      aptProxyAddr:
        typeof advancedVars.var_apt_cacher_ip === "string"
          ? advancedVars.var_apt_cacher_ip
          : undefined,
      aptProxyOn: advancedVars.var_apt_cacher === "yes",
    });
  };

  if (!isOpen) return null;

  const rootfsStorages = rootfsStoragesData?.storages ?? [];
  const templateStorages = templateStoragesData?.storages ?? [];

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
      >
        <div className="glass-card-static max-h-[90vh] w-full max-w-4xl overflow-y-auto border shadow-2xl">
          {/* Header */}
          <div className="border-border/60 flex items-center justify-between border-b p-6">
            <h2 className="text-foreground text-xl font-bold">
              {mode === "default"
                ? "Default Configuration"
                : "Advanced Configuration"}
            </h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close configuration"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {mode === "default" ? (
              /* Default Mode */
              <div className="space-y-6">
                <div>
                  <label className="text-foreground mb-2 block text-sm font-medium">
                    Container Storage
                  </label>
                  <select
                    value={containerStorage}
                    onChange={(e) => setContainerStorage(e.target.value)}
                    className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  >
                    <option value="">Auto (let script choose)</option>
                    {rootfsStorages.map((storage) => (
                      <option key={storage.name} value={storage.name}>
                        {storage.name} ({storage.type})
                      </option>
                    ))}
                  </select>
                  {rootfsStorages.length === 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Could not fetch storages. Script will use default
                      selection.
                    </p>
                  )}
                </div>

                <div className="bg-muted/50 border-border rounded-lg border p-4">
                  <h3 className="text-foreground mb-2 text-sm font-medium">
                    Default Values
                  </h3>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <p>Hostname: {slug}</p>
                    <p>Bridge: vmbr0</p>
                    <p>Network: DHCP</p>
                    <p>IPv6: Auto</p>
                    <p>SSH: Disabled</p>
                    <p>Nesting: Enabled</p>
                    <p>CPU: {resources?.cpu ?? 1}</p>
                    <p>RAM: {resources?.ram ?? 1024} MB</p>
                    <p>Disk: {resources?.hdd ?? 4} GB</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Advanced Mode */
              <div className="space-y-6">
                {/* Server Presets */}
                {(presetsData?.presets?.length ?? 0) > 0 && (
                  <div className="bg-muted/30 border-border rounded-lg border p-4">
                    <h3 className="text-foreground mb-3 text-sm font-medium">
                      Load Preset
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {presetsData?.presets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center gap-1"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => applyPreset(preset)}
                            title={`CPU: ${preset.cpu ?? "?"}, RAM: ${preset.ram ?? "?"}MB, Disk: ${preset.disk ?? "?"}GB`}
                          >
                            {preset.name}
                          </Button>
                          <button
                            type="button"
                            onClick={() =>
                              deletePresetMutation.mutate({ id: preset.id })
                            }
                            className="text-muted-foreground hover:text-destructive p-0.5 text-xs"
                            title="Delete preset"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save as Preset */}
                <div className="flex items-center gap-2">
                  {showSavePreset ? (
                    <>
                      <Input
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Preset name..."
                        className="max-w-[200px]"
                        onKeyDown={(e) =>
                          e.key === "Enter" && saveCurrentAsPreset()
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveCurrentAsPreset}
                        disabled={!presetName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowSavePreset(false);
                          setPresetName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSavePreset(true)}
                    >
                      Save Current as Preset
                    </Button>
                  )}
                </div>

                {/* Resources */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    Resources
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        CPU Cores *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          typeof advancedVars.var_cpu === "boolean"
                            ? ""
                            : (advancedVars.var_cpu ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_cpu",
                            parseInt(e.target.value) || 1,
                          )
                        }
                        className={errors.var_cpu ? "border-destructive" : ""}
                      />
                      {errors.var_cpu && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_cpu}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        RAM (MB) *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          typeof advancedVars.var_ram === "boolean"
                            ? ""
                            : (advancedVars.var_ram ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_ram",
                            parseInt(e.target.value) || 1024,
                          )
                        }
                        className={errors.var_ram ? "border-destructive" : ""}
                      />
                      {errors.var_ram && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_ram}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Disk Size (GB) *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          typeof advancedVars.var_disk === "boolean"
                            ? ""
                            : (advancedVars.var_disk ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_disk",
                            parseInt(e.target.value) || 4,
                          )
                        }
                        className={errors.var_disk ? "border-destructive" : ""}
                      />
                      {errors.var_disk && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_disk}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Unprivileged
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_unprivileged === "boolean"
                            ? advancedVars.var_unprivileged
                              ? 0
                              : 1
                            : (advancedVars.var_unprivileged ?? 1)
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_unprivileged",
                            parseInt(e.target.value),
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value={1}>Yes (Unprivileged)</option>
                        <option value={0}>No (Privileged)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Network */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    Network
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Network Mode
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_net === "string" &&
                          advancedVars.var_net.includes("/")
                            ? "static"
                            : typeof advancedVars.var_net === "boolean"
                              ? "dhcp"
                              : (advancedVars.var_net ?? "dhcp")
                        }
                        onChange={(e) => {
                          if (e.target.value === "static") {
                            updateAdvancedVar("var_net", "static");
                          } else {
                            updateAdvancedVar("var_net", e.target.value);
                            // Clear IPv4 IP when switching away from static
                            if (advancedVars.var_ip) {
                              updateAdvancedVar("var_ip", "");
                            }
                          }
                        }}
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="dhcp">DHCP</option>
                        <option value="static">Static</option>
                      </select>
                    </div>
                    {(advancedVars.var_net === "static" ||
                      (typeof advancedVars.var_net === "string" &&
                        advancedVars.var_net.includes("/"))) && (
                      <div>
                        <label className="text-foreground mb-2 block text-sm font-medium">
                          IPv4 Address (CIDR) *
                        </label>
                        <Input
                          type="text"
                          value={
                            typeof advancedVars.var_net === "string" &&
                            advancedVars.var_net.includes("/")
                              ? advancedVars.var_net
                              : ((advancedVars.var_ip as string | undefined) ??
                                "")
                          }
                          onChange={(e) => {
                            // Store in var_ip temporarily, will be moved to var_net on confirm
                            updateAdvancedVar("var_ip", e.target.value);
                          }}
                          placeholder="10.10.10.1/24"
                          className={errors.var_ip ? "border-destructive" : ""}
                        />
                        {errors.var_ip && (
                          <p className="text-destructive mt-1 text-xs">
                            {errors.var_ip}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Bridge
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_brg === "boolean"
                            ? ""
                            : String(advancedVars.var_brg ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_brg", e.target.value)
                        }
                        placeholder="vmbr0"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Gateway (IP)
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_gateway === "boolean"
                            ? ""
                            : String(advancedVars.var_gateway ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_gateway", e.target.value)
                        }
                        placeholder="Auto"
                        className={
                          errors.var_gateway ? "border-destructive" : ""
                        }
                      />
                      {errors.var_gateway && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_gateway}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        IPv6 Method
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_ipv6_method === "boolean"
                            ? "none"
                            : String(advancedVars.var_ipv6_method ?? "none")
                        }
                        onChange={(e) => {
                          updateAdvancedVar("var_ipv6_method", e.target.value);
                          // Clear IPv6 static when switching away from static
                          if (
                            e.target.value !== "static" &&
                            advancedVars.var_ipv6_static
                          ) {
                            updateAdvancedVar("var_ipv6_static", "");
                          }
                        }}
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="none">None</option>
                        <option value="auto">Auto</option>
                        <option value="dhcp">DHCP</option>
                        <option value="static">Static</option>
                        <option value="disable">Disable</option>
                      </select>
                    </div>
                    {advancedVars.var_ipv6_method === "static" && (
                      <div>
                        <label className="text-foreground mb-2 block text-sm font-medium">
                          IPv6 Static Address *
                        </label>
                        <Input
                          type="text"
                          value={
                            typeof advancedVars.var_ipv6_static === "boolean"
                              ? ""
                              : String(advancedVars.var_ipv6_static ?? "")
                          }
                          onChange={(e) =>
                            updateAdvancedVar("var_ipv6_static", e.target.value)
                          }
                          placeholder="2001:db8::1/64"
                          className={
                            errors.var_ipv6_static ? "border-destructive" : ""
                          }
                        />
                        {errors.var_ipv6_static && (
                          <p className="text-destructive mt-1 text-xs">
                            {errors.var_ipv6_static}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        VLAN Tag
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          typeof advancedVars.var_vlan === "boolean"
                            ? ""
                            : String(advancedVars.var_vlan ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_vlan",
                            e.target.value ? parseInt(e.target.value) : "",
                          )
                        }
                        placeholder="None"
                        className={errors.var_vlan ? "border-destructive" : ""}
                      />
                      {errors.var_vlan && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_vlan}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        MTU
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          typeof advancedVars.var_mtu === "boolean"
                            ? ""
                            : String(advancedVars.var_mtu ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_mtu",
                            e.target.value ? parseInt(e.target.value) : 1500,
                          )
                        }
                        placeholder="1500"
                        className={errors.var_mtu ? "border-destructive" : ""}
                      />
                      {errors.var_mtu && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_mtu}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        MAC Address
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_mac === "boolean"
                            ? ""
                            : String(advancedVars.var_mac ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_mac", e.target.value)
                        }
                        placeholder="Auto"
                        className={errors.var_mac ? "border-destructive" : ""}
                      />
                      {errors.var_mac && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_mac}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        DNS Nameserver (IP)
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_ns === "boolean"
                            ? ""
                            : String(advancedVars.var_ns ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_ns", e.target.value)
                        }
                        placeholder="Auto"
                        className={errors.var_ns ? "border-destructive" : ""}
                      />
                      {errors.var_ns && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_ns}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Identity & Metadata */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    Identity & Metadata
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Container ID
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_ctid === "boolean"
                            ? ""
                            : String(advancedVars.var_ctid ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_ctid", e.target.value)
                        }
                        placeholder="Auto (next available)"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Leave empty for auto-assignment
                      </p>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Hostname *
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_hostname === "boolean"
                            ? ""
                            : String(advancedVars.var_hostname ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_hostname", e.target.value)
                        }
                        placeholder={slug}
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Root Password
                      </label>
                      <Input
                        type="password"
                        value={
                          typeof advancedVars.var_pw === "boolean"
                            ? ""
                            : String(advancedVars.var_pw ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_pw", e.target.value)
                        }
                        placeholder="Random (empty = auto-login)"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Tags (comma or semicolon separated)
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_tags === "boolean"
                            ? ""
                            : String(advancedVars.var_tags ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_tags", e.target.value)
                        }
                        placeholder="e.g. tag1; tag2"
                      />
                    </div>
                  </div>
                </div>

                {/* SSH Access */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    SSH Access
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Enable SSH
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_ssh === "boolean"
                            ? advancedVars.var_ssh
                              ? "yes"
                              : "no"
                            : String(advancedVars.var_ssh ?? "no")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_ssh", e.target.value)
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        SSH Authorized Key
                      </label>
                      {discoveredSshKeysLoading && (
                        <p className="text-muted-foreground mb-2 text-sm">
                          Detecting SSH keys...
                        </p>
                      )}
                      {discoveredSshKeysError && !discoveredSshKeysLoading && (
                        <p className="text-muted-foreground mb-2 text-sm">
                          Could not detect keys on host
                        </p>
                      )}
                      {discoveredSshKeys.length > 0 &&
                        !discoveredSshKeysLoading && (
                          <div className="mb-2">
                            <label
                              htmlFor="discover-ssh-key"
                              className="sr-only"
                            >
                              Use detected key
                            </label>
                            <select
                              id="discover-ssh-key"
                              className="border-input bg-background text-foreground focus:ring-ring mb-2 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                              value=""
                              onChange={(e) => {
                                const idx = e.target.value;
                                if (idx === "") return;
                                const key = discoveredSshKeys[Number(idx)];
                                if (key)
                                  updateAdvancedVar(
                                    "var_ssh_authorized_key",
                                    key,
                                  );
                              }}
                            >
                              <option value="">
                                — Select or paste below —
                              </option>
                              {discoveredSshKeys.map((key, i) => (
                                <option key={i} value={i}>
                                  {key.length > 44
                                    ? `${key.slice(0, 44)}...`
                                    : key}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_ssh_authorized_key ===
                          "boolean"
                            ? ""
                            : String(advancedVars.var_ssh_authorized_key ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_ssh_authorized_key",
                            e.target.value,
                          )
                        }
                        placeholder="Or paste a public key: ssh-rsa AAAA..."
                      />
                    </div>
                  </div>
                </div>

                {/* Container Features */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    Container Features
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Nesting (Docker)
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_nesting === "boolean"
                            ? 1
                            : (advancedVars.var_nesting ?? 1)
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_nesting",
                            parseInt(e.target.value),
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value={1}>Enabled</option>
                        <option value={0}>Disabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        FUSE
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_fuse === "boolean"
                            ? 0
                            : (advancedVars.var_fuse ?? 0)
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_fuse",
                            parseInt(e.target.value),
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value={0}>Disabled</option>
                        <option value={1}>Enabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Keyctl
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_keyctl === "boolean"
                            ? 0
                            : (advancedVars.var_keyctl ?? 0)
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_keyctl",
                            parseInt(e.target.value),
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value={0}>Disabled</option>
                        <option value={1}>Enabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        TUN/TAP (VPN)
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_tun === "boolean"
                            ? advancedVars.var_tun
                              ? "yes"
                              : "no"
                            : String(advancedVars.var_tun ?? "no")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_tun", e.target.value)
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                      <p className="text-muted-foreground mt-1 text-xs">
                        For Tailscale, WireGuard, OpenVPN
                      </p>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Mknod
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_mknod === "boolean"
                            ? 0
                            : (advancedVars.var_mknod ?? 0)
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_mknod",
                            parseInt(e.target.value),
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value={0}>Disabled</option>
                        <option value={1}>Enabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Mount Filesystems
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_mount_fs === "boolean"
                            ? ""
                            : String(advancedVars.var_mount_fs ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_mount_fs", e.target.value)
                        }
                        placeholder="nfs,cifs"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Protection
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_protection === "boolean"
                            ? advancedVars.var_protection
                              ? "yes"
                              : "no"
                            : String(advancedVars.var_protection ?? "no")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_protection", e.target.value)
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* System Configuration */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    System Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Timezone
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_timezone === "boolean"
                            ? ""
                            : String(advancedVars.var_timezone ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_timezone", e.target.value)
                        }
                        placeholder="System"
                      />
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Verbose
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_verbose === "boolean"
                            ? advancedVars.var_verbose
                              ? "yes"
                              : "no"
                            : String(advancedVars.var_verbose ?? "no")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_verbose", e.target.value)
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        APT Cacher
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_apt_cacher === "boolean"
                            ? advancedVars.var_apt_cacher
                              ? "yes"
                              : "no"
                            : String(advancedVars.var_apt_cacher ?? "no")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_apt_cacher", e.target.value)
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        APT Cacher host or IP
                      </label>
                      <Input
                        type="text"
                        value={
                          typeof advancedVars.var_apt_cacher_ip === "boolean"
                            ? ""
                            : String(advancedVars.var_apt_cacher_ip ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar("var_apt_cacher_ip", e.target.value)
                        }
                        placeholder="192.168.1.10 or apt-cacher.internal"
                        className={
                          errors.var_apt_cacher_ip ? "border-destructive" : ""
                        }
                      />
                      {errors.var_apt_cacher_ip && (
                        <p className="text-destructive mt-1 text-xs">
                          {errors.var_apt_cacher_ip}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        GitHub Token
                      </label>
                      <Input
                        type="password"
                        value={String(advancedVars.var_github_token ?? "")}
                        onChange={(e) =>
                          updateAdvancedVar("var_github_token", e.target.value)
                        }
                        placeholder="ghp_... (optional)"
                        autoComplete="off"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Passed as GITHUB_TOKEN to avoid API rate limits
                      </p>
                    </div>
                  </div>
                </div>

                {/* Storage Selection */}
                <div>
                  <h3 className="text-foreground mb-4 text-lg font-medium">
                    Storage Selection
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Container Storage
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_container_storage ===
                          "boolean"
                            ? ""
                            : String(advancedVars.var_container_storage ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_container_storage",
                            e.target.value,
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="">Auto</option>
                        {rootfsStorages.map((storage) => (
                          <option key={storage.name} value={storage.name}>
                            {storage.name} ({storage.type})
                          </option>
                        ))}
                      </select>
                      {rootfsStorages.length === 0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Could not fetch storages. Leave empty for auto
                          selection.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        Template Storage
                      </label>
                      <select
                        value={
                          typeof advancedVars.var_template_storage === "boolean"
                            ? ""
                            : String(advancedVars.var_template_storage ?? "")
                        }
                        onChange={(e) =>
                          updateAdvancedVar(
                            "var_template_storage",
                            e.target.value,
                          )
                        }
                        className="border-input bg-background text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="">Auto</option>
                        {templateStorages.map((storage) => (
                          <option key={storage.name} value={storage.name}>
                            {storage.name} ({storage.type})
                          </option>
                        ))}
                      </select>
                      {templateStorages.length === 0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Could not fetch storages. Leave empty for auto
                          selection.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-border mt-6 flex justify-end space-x-3 border-t pt-6">
              <Button onClick={onClose} variant="outline" size="default">
                Cancel
              </Button>
              <Button onClick={handleConfirm} variant="default" size="default">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
