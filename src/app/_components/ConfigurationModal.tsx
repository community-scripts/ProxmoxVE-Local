'use client';

import { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import type { Script } from '~/types/script';
import type { Server } from '~/types/server';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useRegisterModal } from './modal/ModalStackProvider';

export type EnvVars = Record<string, string | number | boolean>;

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (envVars: EnvVars) => void;
  script: Script | null;
  server: Server | null;
  mode: 'default' | 'advanced';
}

export function ConfigurationModal({
  isOpen,
  onClose,
  onConfirm,
  script,
  server,
  mode,
}: ConfigurationModalProps) {
  useRegisterModal(isOpen, { id: 'configuration-modal', allowEscape: true, onClose });

  // Fetch script data if we only have slug
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: script?.slug ?? '' },
    { enabled: !!script?.slug && isOpen }
  );

  const actualScript = script ?? (scriptData?.script ?? null);

  // Fetch storages
  const { data: rootfsStoragesData } = api.scripts.getRootfsStorages.useQuery(
    { serverId: server?.id ?? 0, forceRefresh: false },
    { enabled: !!server?.id && isOpen }
  );

  const { data: templateStoragesData } = api.scripts.getTemplateStorages.useQuery(
    { serverId: server?.id ?? 0, forceRefresh: false },
    { enabled: !!server?.id && isOpen && mode === 'advanced' }
  );

  // Get resources from JSON
  const resources = actualScript?.install_methods?.[0]?.resources;
  const slug = actualScript?.slug ?? '';

  // Default mode state
  const [containerStorage, setContainerStorage] = useState<string>('');

  // Advanced mode state
  const [advancedVars, setAdvancedVars] = useState<EnvVars>({});

  // Discovered SSH keys on the Proxmox host (advanced mode only)
  const [discoveredSshKeys, setDiscoveredSshKeys] = useState<string[]>([]);
  const [discoveredSshKeysLoading, setDiscoveredSshKeysLoading] = useState(false);
  const [discoveredSshKeysError, setDiscoveredSshKeysError] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize defaults when script/server data is available
  useEffect(() => {
    if (!actualScript || !server) return;

    if (mode === 'default') {
      // Default mode: minimal vars
      setContainerStorage('');
    } else {
      // Advanced mode: all vars with defaults
      const defaults: EnvVars = {
        // Resources from JSON
        var_cpu: resources?.cpu ?? 1,
        var_ram: resources?.ram ?? 1024,
        var_disk: resources?.hdd ?? 4,
        var_unprivileged: script?.privileged === false ? 1 : (script?.privileged === true ? 0 : 1),

        // Network defaults
        var_net: 'dhcp',
        var_brg: 'vmbr0',
        var_gateway: '',
        var_ipv6_method: 'none',
        var_ipv6_static: '',
        var_vlan: '',
        var_mtu: 1500,
        var_mac: '',
        var_ns: '',

        // Identity
        var_hostname: slug,
        var_pw: '',
        var_tags: 'community-script',

        // SSH
        var_ssh: 'no',
        var_ssh_authorized_key: '',

        // Features
        var_nesting: 1,
        var_fuse: 0,
        var_keyctl: 0,
        var_mknod: 0,
        var_mount_fs: '',
        var_protection: 'no',

        // System
        var_timezone: '',
        var_verbose: 'no',
        var_apt_cacher: 'no',
        var_apt_cacher_ip: '',

        // Storage
        var_container_storage: '',
        var_template_storage: '',
      };
      setAdvancedVars(defaults);
    }
  }, [actualScript, server, mode, resources, slug]);

  // Discover SSH keys on the Proxmox host when advanced mode is open
  useEffect(() => {
    if (!server?.id || !isOpen || mode !== 'advanced') {
      setDiscoveredSshKeys([]);
      setDiscoveredSshKeysError(null);
      return;
    }
    let cancelled = false;
    setDiscoveredSshKeysLoading(true);
    setDiscoveredSshKeysError(null);
    fetch(`/api/servers/${server.id}/discover-ssh-keys`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Server not found' : res.statusText);
        return res.json();
      })
      .then((data: { keys?: string[] }) => {
        if (!cancelled && Array.isArray(data.keys)) setDiscoveredSshKeys(data.keys);
      })
      .catch((err) => {
        if (!cancelled) {
          setDiscoveredSshKeys([]);
          setDiscoveredSshKeysError(err instanceof Error ? err.message : 'Could not detect keys');
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
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  };

  const validateCIDR = (cidr: string): boolean => {
    if (!cidr) return true; // Empty is allowed
    const pattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!pattern.test(cidr)) return false;
    const parts = cidr.split('/');
    if (parts.length !== 2) return false;
    const [ip, prefix] = parts;
    if (!ip || !prefix) return false;
    const ipParts = ip.split('.').map(Number);
    if (!ipParts.every(p => p >= 0 && p <= 255)) return false;
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
    if (value === '' || value === undefined) return true;
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    return !isNaN(num) && num > 0;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === 'default') {
      // Default mode: only storage is optional
      // No validation needed
    } else {
      // Advanced mode: validate all fields
      if (advancedVars.var_gateway && !validateIPv4(advancedVars.var_gateway as string)) {
        newErrors.var_gateway = 'Invalid IPv4 address';
      }
      if (advancedVars.var_mac && !validateMAC(advancedVars.var_mac as string)) {
        newErrors.var_mac = 'Invalid MAC address format (XX:XX:XX:XX:XX:XX)';
      }
      if (advancedVars.var_ns && !validateIPv4(advancedVars.var_ns as string)) {
        newErrors.var_ns = 'Invalid IPv4 address';
      }
      if (advancedVars.var_apt_cacher_ip && !validateIPv4(advancedVars.var_apt_cacher_ip as string)) {
        newErrors.var_apt_cacher_ip = 'Invalid IPv4 address';
      }
      // Validate IPv4 CIDR if network mode is static
      const netValue = advancedVars.var_net;
      const isStaticMode = netValue === 'static' || (typeof netValue === 'string' && netValue.includes('/'));
      if (isStaticMode) {
        const cidrValue = (typeof netValue === 'string' && netValue.includes('/')) ? netValue : (advancedVars.var_ip as string ?? '');
        if (cidrValue && !validateCIDR(cidrValue)) {
          newErrors.var_ip = 'Invalid CIDR format (e.g., 10.10.10.1/24)';
        }
      }
      // Validate IPv6 static if IPv6 method is static
      if (advancedVars.var_ipv6_method === 'static' && advancedVars.var_ipv6_static) {
        if (!validateIPv6(advancedVars.var_ipv6_static as string)) {
          newErrors.var_ipv6_static = 'Invalid IPv6 address';
        }
      }
      if (!validatePositiveInt(advancedVars.var_cpu as string | number | undefined)) {
        newErrors.var_cpu = 'Must be a positive integer';
      }
      if (!validatePositiveInt(advancedVars.var_ram as string | number | undefined)) {
        newErrors.var_ram = 'Must be a positive integer';
      }
      if (!validatePositiveInt(advancedVars.var_disk as string | number | undefined)) {
        newErrors.var_disk = 'Must be a positive integer';
      }
      if (advancedVars.var_mtu && !validatePositiveInt(advancedVars.var_mtu as string | number | undefined)) {
        newErrors.var_mtu = 'Must be a positive integer';
      }
      if (advancedVars.var_vlan && !validatePositiveInt(advancedVars.var_vlan as string | number | undefined)) {
        newErrors.var_vlan = 'Must be a positive integer';
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

    if (mode === 'default') {
      // Default mode: minimal vars
      envVars = {
        var_hostname: slug,
        var_brg: 'vmbr0',
        var_net: 'dhcp',
        var_ipv6_method: 'auto',
        var_ssh: 'no',
        var_nesting: 1,
        var_verbose: 'no',
        var_cpu: resources?.cpu ?? 1,
        var_ram: resources?.ram ?? 1024,
        var_disk: resources?.hdd ?? 4,
        var_unprivileged: script?.privileged === false ? 1 : (script?.privileged === true ? 0 : 1),
      };

      if (containerStorage) {
        envVars.var_container_storage = containerStorage;
      }
    } else {
      // Advanced mode: all vars
      envVars = { ...advancedVars };
      
      // If network mode is static and var_ip is set, replace var_net with the CIDR
      if (envVars.var_net === 'static' && envVars.var_ip) {
        envVars.var_net = envVars.var_ip as string;
        delete envVars.var_ip; // Remove the temporary var_ip
      }

      // Format password correctly: if var_pw is set, format it as "-password <password>"
      // build.func expects PW to be in "-password <password>" format when added to PCT_OPTIONS
      const rawPassword = envVars.var_pw;
      const hasPassword = rawPassword && typeof rawPassword === 'string' && rawPassword.trim() !== '';
      const hasSSHKey = envVars.var_ssh_authorized_key && typeof envVars.var_ssh_authorized_key === 'string' && envVars.var_ssh_authorized_key.trim() !== '';
      
      if (hasPassword) {
        // Remove any existing "-password" prefix to avoid double-formatting
        const cleanPassword = rawPassword.startsWith('-password ') 
          ? rawPassword.substring(11) 
          : rawPassword;
        // Format as "-password <password>" for build.func
        envVars.var_pw = `-password ${cleanPassword}`;
      } else {
        // Empty password means auto-login, clear var_pw
        envVars.var_pw = '';
      }
      

      if ((hasPassword || hasSSHKey) && envVars.var_ssh !== 'no') {
        envVars.var_ssh = 'yes';
      }

      // Normalize var_tags: accept both comma and semicolon, output comma-separated
      const rawTags = envVars.var_tags;
      if (typeof rawTags === 'string' && rawTags.trim() !== '') {
        envVars.var_tags = rawTags
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(',');
      }
    }

    // Remove empty string values (but keep 0, false, etc.)
    const cleaned: EnvVars = {};
    for (const [key, value] of Object.entries(envVars)) {
      if (value !== '' && value !== undefined) {
        cleaned[key] = value;
      }
    }

    // Always set mode to "default" (build.func line 1783 expects this)
    cleaned.mode = 'default';

    onConfirm(cleaned);
  };

  const updateAdvancedVar = (key: string, value: string | number | boolean) => {
    setAdvancedVars(prev => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  const rootfsStorages = rootfsStoragesData?.storages ?? [];
  const templateStorages = templateStoragesData?.storages ?? [];

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full border border-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {mode === 'default' ? 'Default Configuration' : 'Advanced Configuration'}
          </h2>
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
          {mode === 'default' ? (
            /* Default Mode */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Container Storage
                </label>
                <select
                  value={containerStorage}
                  onChange={(e) => setContainerStorage(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  <option value="">Auto (let script choose)</option>
                  {rootfsStorages.map((storage) => (
                    <option key={storage.name} value={storage.name}>
                      {storage.name} ({storage.type})
                    </option>
                  ))}
                </select>
                {rootfsStorages.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Could not fetch storages. Script will use default selection.
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">Default Values</h3>
                <div className="text-xs text-muted-foreground space-y-1">
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
              {/* Resources */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Resources</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      CPU Cores *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={typeof advancedVars.var_cpu === 'boolean' ? '' : (advancedVars.var_cpu ?? '')}
                      onChange={(e) => updateAdvancedVar('var_cpu', parseInt(e.target.value) || 1)}
                      className={errors.var_cpu ? 'border-destructive' : ''}
                    />
                    {errors.var_cpu && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_cpu}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      RAM (MB) *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={typeof advancedVars.var_ram === 'boolean' ? '' : (advancedVars.var_ram ?? '')}
                      onChange={(e) => updateAdvancedVar('var_ram', parseInt(e.target.value) || 1024)}
                      className={errors.var_ram ? 'border-destructive' : ''}
                    />
                    {errors.var_ram && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_ram}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Disk Size (GB) *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={typeof advancedVars.var_disk === 'boolean' ? '' : (advancedVars.var_disk ?? '')}
                      onChange={(e) => updateAdvancedVar('var_disk', parseInt(e.target.value) || 4)}
                      className={errors.var_disk ? 'border-destructive' : ''}
                    />
                    {errors.var_disk && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_disk}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Unprivileged
                    </label>
                    <select
                      value={typeof advancedVars.var_unprivileged === 'boolean' ? (advancedVars.var_unprivileged ? 0 : 1) : (advancedVars.var_unprivileged ?? 1)}
                      onChange={(e) => updateAdvancedVar('var_unprivileged', parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value={1}>Yes (Unprivileged)</option>
                      <option value={0}>No (Privileged)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Network</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Network Mode
                    </label>
                    <select
                      value={(typeof advancedVars.var_net === 'string' && advancedVars.var_net.includes('/')) ? 'static' : (typeof advancedVars.var_net === 'boolean' ? 'dhcp' : (advancedVars.var_net ?? 'dhcp'))}
                      onChange={(e) => {
                        if (e.target.value === 'static') {
                          updateAdvancedVar('var_net', 'static');
                        } else {
                          updateAdvancedVar('var_net', e.target.value);
                          // Clear IPv4 IP when switching away from static
                          if (advancedVars.var_ip) {
                            updateAdvancedVar('var_ip', '');
                          }
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="dhcp">DHCP</option>
                      <option value="static">Static</option>
                    </select>
                  </div>
                  {(advancedVars.var_net === 'static' || (typeof advancedVars.var_net === 'string' && advancedVars.var_net.includes('/'))) && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        IPv4 Address (CIDR) *
                      </label>
                      <Input
                        type="text"
                        value={(typeof advancedVars.var_net === 'string' && advancedVars.var_net.includes('/')) ? advancedVars.var_net : (advancedVars.var_ip as string | undefined ?? '')}
                        onChange={(e) => {
                          // Store in var_ip temporarily, will be moved to var_net on confirm
                          updateAdvancedVar('var_ip', e.target.value);
                        }}
                        placeholder="10.10.10.1/24"
                        className={errors.var_ip ? 'border-destructive' : ''}
                      />
                      {errors.var_ip && (
                        <p className="mt-1 text-xs text-destructive">{errors.var_ip}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Bridge
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_brg === 'boolean' ? '' : String(advancedVars.var_brg ?? '')}
                      onChange={(e) => updateAdvancedVar('var_brg', e.target.value)}
                      placeholder="vmbr0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Gateway (IP)
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_gateway === 'boolean' ? '' : String(advancedVars.var_gateway ?? '')}
                      onChange={(e) => updateAdvancedVar('var_gateway', e.target.value)}
                      placeholder="Auto"
                      className={errors.var_gateway ? 'border-destructive' : ''}
                    />
                    {errors.var_gateway && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_gateway}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      IPv6 Method
                    </label>
                    <select
                      value={typeof advancedVars.var_ipv6_method === 'boolean' ? 'none' : String(advancedVars.var_ipv6_method ?? 'none')}
                      onChange={(e) => {
                        updateAdvancedVar('var_ipv6_method', e.target.value);
                        // Clear IPv6 static when switching away from static
                        if (e.target.value !== 'static' && advancedVars.var_ipv6_static) {
                          updateAdvancedVar('var_ipv6_static', '');
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="auto">Auto</option>
                      <option value="dhcp">DHCP</option>
                      <option value="static">Static</option>
                      <option value="disable">Disable</option>
                    </select>
                  </div>
                  {advancedVars.var_ipv6_method === 'static' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        IPv6 Static Address *
                      </label>
                      <Input
                        type="text"
                        value={typeof advancedVars.var_ipv6_static === 'boolean' ? '' : String(advancedVars.var_ipv6_static ?? '')}
                        onChange={(e) => updateAdvancedVar('var_ipv6_static', e.target.value)}
                        placeholder="2001:db8::1/64"
                        className={errors.var_ipv6_static ? 'border-destructive' : ''}
                      />
                      {errors.var_ipv6_static && (
                        <p className="mt-1 text-xs text-destructive">{errors.var_ipv6_static}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      VLAN Tag
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={typeof advancedVars.var_vlan === 'boolean' ? '' : String(advancedVars.var_vlan ?? '')}
                      onChange={(e) => updateAdvancedVar('var_vlan', e.target.value ? parseInt(e.target.value) : '')}
                      placeholder="None"
                      className={errors.var_vlan ? 'border-destructive' : ''}
                    />
                    {errors.var_vlan && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_vlan}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      MTU
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={typeof advancedVars.var_mtu === 'boolean' ? '' : String(advancedVars.var_mtu ?? '')}
                      onChange={(e) => updateAdvancedVar('var_mtu', e.target.value ? parseInt(e.target.value) : 1500)}
                      placeholder="1500"
                      className={errors.var_mtu ? 'border-destructive' : ''}
                    />
                    {errors.var_mtu && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_mtu}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      MAC Address
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_mac === 'boolean' ? '' : String(advancedVars.var_mac ?? '')}
                      onChange={(e) => updateAdvancedVar('var_mac', e.target.value)}
                      placeholder="Auto"
                      className={errors.var_mac ? 'border-destructive' : ''}
                    />
                    {errors.var_mac && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_mac}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      DNS Nameserver (IP)
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_ns === 'boolean' ? '' : String(advancedVars.var_ns ?? '')}
                      onChange={(e) => updateAdvancedVar('var_ns', e.target.value)}
                      placeholder="Auto"
                      className={errors.var_ns ? 'border-destructive' : ''}
                    />
                    {errors.var_ns && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_ns}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Identity & Metadata */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Identity & Metadata</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Hostname *
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_hostname === 'boolean' ? '' : String(advancedVars.var_hostname ?? '')}
                      onChange={(e) => updateAdvancedVar('var_hostname', e.target.value)}
                      placeholder={slug}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Root Password
                    </label>
                    <Input
                      type="password"
                      value={typeof advancedVars.var_pw === 'boolean' ? '' : String(advancedVars.var_pw ?? '')}
                      onChange={(e) => updateAdvancedVar('var_pw', e.target.value)}
                      placeholder="Random (empty = auto-login)"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tags (comma or semicolon separated)
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_tags === 'boolean' ? '' : String(advancedVars.var_tags ?? '')}
                      onChange={(e) => updateAdvancedVar('var_tags', e.target.value)}
                      placeholder="e.g. tag1; tag2"
                    />
                  </div>
                </div>
              </div>

              {/* SSH Access */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">SSH Access</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Enable SSH
                    </label>
                    <select
                      value={typeof advancedVars.var_ssh === 'boolean' ? (advancedVars.var_ssh ? 'yes' : 'no') : String(advancedVars.var_ssh ?? 'no')}
                      onChange={(e) => updateAdvancedVar('var_ssh', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      SSH Authorized Key
                    </label>
                    {discoveredSshKeysLoading && (
                      <p className="text-sm text-muted-foreground mb-2">Detecting SSH keys...</p>
                    )}
                    {discoveredSshKeysError && !discoveredSshKeysLoading && (
                      <p className="text-sm text-muted-foreground mb-2">Could not detect keys on host</p>
                    )}
                    {discoveredSshKeys.length > 0 && !discoveredSshKeysLoading && (
                      <div className="mb-2">
                        <label htmlFor="discover-ssh-key" className="sr-only">Use detected key</label>
                        <select
                          id="discover-ssh-key"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none mb-2"
                          value=""
                          onChange={(e) => {
                            const idx = e.target.value;
                            if (idx === '') return;
                            const key = discoveredSshKeys[Number(idx)];
                            if (key) updateAdvancedVar('var_ssh_authorized_key', key);
                          }}
                        >
                          <option value="">— Select or paste below —</option>
                          {discoveredSshKeys.map((key, i) => (
                            <option key={i} value={i}>
                              {key.length > 44 ? `${key.slice(0, 44)}...` : key}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <Input
                      type="text"
                      value={typeof advancedVars.var_ssh_authorized_key === 'boolean' ? '' : String(advancedVars.var_ssh_authorized_key ?? '')}
                      onChange={(e) => updateAdvancedVar('var_ssh_authorized_key', e.target.value)}
                      placeholder="Or paste a public key: ssh-rsa AAAA..."
                    />
                  </div>
                </div>
              </div>

              {/* Container Features */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Container Features</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nesting (Docker)
                    </label>
                    <select
                      value={typeof advancedVars.var_nesting === 'boolean' ? 1 : (advancedVars.var_nesting ?? 1)}
                      onChange={(e) => updateAdvancedVar('var_nesting', parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value={1}>Enabled</option>
                      <option value={0}>Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      FUSE
                    </label>
                    <select
                      value={typeof advancedVars.var_fuse === 'boolean' ? 0 : (advancedVars.var_fuse ?? 0)}
                      onChange={(e) => updateAdvancedVar('var_fuse', parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Keyctl
                    </label>
                    <select
                      value={typeof advancedVars.var_keyctl === 'boolean' ? 0 : (advancedVars.var_keyctl ?? 0)}
                      onChange={(e) => updateAdvancedVar('var_keyctl', parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Mknod
                    </label>
                    <select
                      value={typeof advancedVars.var_mknod === 'boolean' ? 0 : (advancedVars.var_mknod ?? 0)}
                      onChange={(e) => updateAdvancedVar('var_mknod', parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value={0}>Disabled</option>
                      <option value={1}>Enabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Mount Filesystems
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_mount_fs === 'boolean' ? '' : String(advancedVars.var_mount_fs ?? '')}
                      onChange={(e) => updateAdvancedVar('var_mount_fs', e.target.value)}
                      placeholder="nfs,cifs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Protection
                    </label>
                    <select
                      value={typeof advancedVars.var_protection === 'boolean' ? (advancedVars.var_protection ? 'yes' : 'no') : String(advancedVars.var_protection ?? 'no')}
                      onChange={(e) => updateAdvancedVar('var_protection', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* System Configuration */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">System Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Timezone
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_timezone === 'boolean' ? '' : String(advancedVars.var_timezone ?? '')}
                      onChange={(e) => updateAdvancedVar('var_timezone', e.target.value)}
                      placeholder="System"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Verbose
                    </label>
                    <select
                      value={typeof advancedVars.var_verbose === 'boolean' ? (advancedVars.var_verbose ? 'yes' : 'no') : String(advancedVars.var_verbose ?? 'no')}
                      onChange={(e) => updateAdvancedVar('var_verbose', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      APT Cacher
                    </label>
                    <select
                      value={typeof advancedVars.var_apt_cacher === 'boolean' ? (advancedVars.var_apt_cacher ? 'yes' : 'no') : String(advancedVars.var_apt_cacher ?? 'no')}
                      onChange={(e) => updateAdvancedVar('var_apt_cacher', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      APT Cacher IP
                    </label>
                    <Input
                      type="text"
                      value={typeof advancedVars.var_apt_cacher_ip === 'boolean' ? '' : String(advancedVars.var_apt_cacher_ip ?? '')}
                      onChange={(e) => updateAdvancedVar('var_apt_cacher_ip', e.target.value)}
                      placeholder="192.168.1.10"
                      className={errors.var_apt_cacher_ip ? 'border-destructive' : ''}
                    />
                    {errors.var_apt_cacher_ip && (
                      <p className="mt-1 text-xs text-destructive">{errors.var_apt_cacher_ip}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Storage Selection */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Storage Selection</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Container Storage
                    </label>
                    <select
                      value={typeof advancedVars.var_container_storage === 'boolean' ? '' : String(advancedVars.var_container_storage ?? '')}
                      onChange={(e) => updateAdvancedVar('var_container_storage', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="">Auto</option>
                      {rootfsStorages.map((storage) => (
                        <option key={storage.name} value={storage.name}>
                          {storage.name} ({storage.type})
                        </option>
                      ))}
                    </select>
                    {rootfsStorages.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Could not fetch storages. Leave empty for auto selection.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Template Storage
                    </label>
                    <select
                      value={typeof advancedVars.var_template_storage === 'boolean' ? '' : String(advancedVars.var_template_storage ?? '')}
                      onChange={(e) => updateAdvancedVar('var_template_storage', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="">Auto</option>
                      {templateStorages.map((storage) => (
                        <option key={storage.name} value={storage.name}>
                          {storage.name} ({storage.type})
                        </option>
                      ))}
                    </select>
                    {templateStorages.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Could not fetch storages. Leave empty for auto selection.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-border">
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
  );
}

