"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  Upload,
  RotateCcw,
  Play,
  Shield,
  Network,
  Settings2,
  Search,
} from "lucide-react";
import type { ScriptCard } from "~/types/script";
import type { Server } from "~/types/server";
import { api } from "~/trpc/react";

/* ── Step definitions ── */
const CPU_STEPS = Array.from({ length: 16 }, (_, i) => i + 1);

const RAM_STEPS: number[] = (() => {
  const s: number[] = [];
  for (let v = 512; v <= 2048; v += 256) s.push(v);
  for (let v = 3072; v <= 8192; v += 1024) s.push(v);
  for (let v = 10240; v <= 40960; v += 2048) s.push(v);
  return s;
})();

const DISK_STEPS: number[] = (() => {
  const s: number[] = [];
  for (let v = 2; v <= 12; v += 2) s.push(v);
  for (let v = 16; v <= 24; v += 4) s.push(v);
  for (let v = 32; v <= 64; v += 8) s.push(v);
  for (let v = 80; v <= 128; v += 16) s.push(v);
  return s;
})();

function fmtRam(mb: number): string {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB`
    : `${mb} MB`;
}

function closestIdx(steps: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i]! - value) < Math.abs(steps[best]! - value)) best = i;
  }
  return best;
}

/* ── Validation helpers ── */
const VALIDATIONS = {
  mac: (v: string) =>
    !v || /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(v)
      ? null
      : "Invalid MAC (XX:XX:XX:XX:XX:XX)",
  vlan: (v: string) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 4094 ? null : "1–4094";
  },
  mtu: (v: string) => {
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 576 && n <= 65535 ? null : "576–65535";
  },
  ip: (v: string) => {
    if (!v) return null;
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(v);
    if (!m) return "IP/CIDR (e.g. 192.168.1.100/24)";
    const octets = [m[1], m[2], m[3], m[4]].map(Number);
    if (octets.some((o) => o < 0 || o > 255)) return "Invalid octet";
    const cidr = Number(m[5]);
    if (cidr < 0 || cidr > 32) return "CIDR 0–32";
    return null;
  },
  hostname: (v: string) => {
    if (!v) return null;
    if (v.length > 253) return "Max 253 chars";
    if (
      !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(
        v,
      )
    )
      return "Invalid hostname";
    return null;
  },
};

interface GeneratorTabProps {
  onInstallScript: (
    scriptPath: string,
    scriptName: string,
    mode?: "local" | "ssh",
    server?: Server,
    envVars?: Record<string, string | number | boolean>,
  ) => void;
}

export function GeneratorTab({ onInstallScript }: GeneratorTabProps) {
  const { data: scriptCardsData } =
    api.scripts.getScriptCardsWithCategories.useQuery();

  // Script selection
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Resources
  const [cpu, setCpu] = useState(2);
  const [ramIdx, setRamIdx] = useState(closestIdx(RAM_STEPS, 2048));
  const [diskIdx, setDiskIdx] = useState(closestIdx(DISK_STEPS, 8));
  const [privileged, setPrivileged] = useState(false);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ctid, setCtid] = useState("");
  const [hostname, setHostname] = useState("");
  const [bridge, setBridge] = useState("vmbr0");
  const [ip, setIp] = useState("");
  const [gateway, setGateway] = useState("");
  const [mac, setMac] = useState("");
  const [vlan, setVlan] = useState("");
  const [mtu, setMtu] = useState("");
  const [ssh, setSsh] = useState(false);
  const [nesting, setNesting] = useState(false);
  const [fuse, setFuse] = useState(false);
  const [gpu, setGpu] = useState(false);

  const [copied, setCopied] = useState(false);

  // Scripts list
  const allScripts = useMemo(() => {
    if (!scriptCardsData?.success || !scriptCardsData.cards) return [];
    const map = new Map<string, ScriptCard>();
    for (const s of scriptCardsData.cards) {
      if (s?.slug && !map.has(s.slug)) map.set(s.slug, s);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? ""),
    );
  }, [scriptCardsData]);

  const selectedScript = useMemo(
    () => allScripts.find((s) => s.slug === selectedSlug) ?? null,
    [allScripts, selectedSlug],
  );

  const filteredScripts = useMemo(() => {
    if (!searchQuery.trim()) return allScripts;
    const q = searchQuery.toLowerCase();
    return allScripts.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.slug?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q),
    );
  }, [allScripts, searchQuery]);

  // Defaults from selected script
  const defaults = useMemo(() => {
    if (!selectedScript)
      return { cpu: 2, ram: 2048, hdd: 8, privileged: false };
    // Try to find install_methods from scriptCardsData
    return { cpu: 2, ram: 2048, hdd: 8, privileged: false };
  }, [selectedScript]);

  const ram = RAM_STEPS[ramIdx] ?? 2048;
  const disk = DISK_STEPS[diskIdx] ?? 8;

  // Generate the command
  const generatedCommand = useMemo(() => {
    if (!selectedScript) return "";

    const slug = selectedScript.slug;
    const type = selectedScript.type ?? "ct";
    const pathPrefix =
      type === "pve"
        ? "tools/pve"
        : type === "addon"
          ? "tools/addon"
          : type === "vm"
            ? "vm"
            : type === "turnkey"
              ? "turnkey"
              : "ct";
    const url = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/${pathPrefix}/${slug}.sh`;
    const baseCmd = `bash -c "$(curl -fsSL ${url})"`;

    const overrides: string[] = [];
    if (cpu !== defaults.cpu) overrides.push(`var_cpu="${cpu}"`);
    if (ram !== defaults.ram) overrides.push(`var_ram="${ram}"`);
    if (disk !== defaults.hdd) overrides.push(`var_disk="${disk}"`);
    if (privileged !== defaults.privileged)
      overrides.push(`var_unprivileged="${privileged ? 0 : 1}"`);
    if (ctid.trim()) overrides.push(`var_ctid="${ctid.trim()}"`);
    if (hostname.trim()) overrides.push(`var_hostname="${hostname.trim()}"`);
    if (bridge !== "vmbr0") overrides.push(`var_bridge="${bridge}"`);
    if (ip.trim()) overrides.push(`var_net="static"`);
    if (ip.trim()) overrides.push(`var_ip="${ip.trim()}"`);
    if (gateway.trim()) overrides.push(`var_gateway="${gateway.trim()}"`);
    if (mac.trim()) overrides.push(`var_mac="${mac.trim()}"`);
    if (vlan.trim()) overrides.push(`var_vlan="${vlan.trim()}"`);
    if (mtu.trim()) overrides.push(`var_mtu="${mtu.trim()}"`);
    if (ssh) overrides.push('var_ssh="yes"');
    if (nesting) overrides.push('var_nesting="1"');
    if (fuse) overrides.push('var_fuse="1"');
    if (gpu) overrides.push('var_gpu="yes"');

    if (overrides.length === 0) return baseCmd;
    return `mode=generated ${overrides.join(" ")} ${baseCmd}`;
  }, [
    selectedScript,
    cpu,
    ram,
    disk,
    privileged,
    defaults,
    ctid,
    hostname,
    bridge,
    ip,
    gateway,
    mac,
    vlan,
    mtu,
    ssh,
    nesting,
    fuse,
    gpu,
  ]);

  const handleCopy = useCallback(() => {
    if (!generatedCommand) return;
    void navigator.clipboard.writeText(generatedCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedCommand]);

  const handleReset = useCallback(() => {
    setCpu(defaults.cpu);
    setRamIdx(closestIdx(RAM_STEPS, defaults.ram));
    setDiskIdx(closestIdx(DISK_STEPS, defaults.hdd));
    setPrivileged(defaults.privileged);
    setCtid("");
    setHostname("");
    setBridge("vmbr0");
    setIp("");
    setGateway("");
    setMac("");
    setVlan("");
    setMtu("");
    setSsh(false);
    setNesting(false);
    setFuse(false);
    setGpu(false);
  }, [defaults]);

  const handleExport = useCallback(() => {
    const config = {
      version: 1,
      timestamp: new Date().toISOString(),
      scriptSlug: selectedSlug,
      config: {
        cpu,
        ram,
        disk,
        privileged,
        ctid,
        hostname,
        bridge,
        ip,
        gateway,
        mac,
        vlan,
        mtu,
        ssh,
        nesting,
        fuse,
        gpu,
      },
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pve-generator-config${selectedSlug ? `-${selectedSlug}` : ""}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    selectedSlug,
    cpu,
    ram,
    disk,
    privileged,
    ctid,
    hostname,
    bridge,
    ip,
    gateway,
    mac,
    vlan,
    mtu,
    ssh,
    nesting,
    fuse,
    gpu,
  ]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as {
          scriptSlug?: string;
          config: {
            cpu?: number;
            ram?: number;
            disk?: number;
            privileged?: boolean;
            ctid?: string;
            hostname?: string;
            bridge?: string;
            ip?: string;
            gateway?: string;
            mac?: string;
            vlan?: string;
            mtu?: string;
            ssh?: boolean;
            nesting?: boolean;
            fuse?: boolean;
            gpu?: boolean;
          };
        };
        const c = parsed.config;
        if (parsed.scriptSlug) setSelectedSlug(parsed.scriptSlug);
        if (c.cpu != null) setCpu(c.cpu);
        if (c.ram != null) setRamIdx(closestIdx(RAM_STEPS, c.ram));
        if (c.disk != null) setDiskIdx(closestIdx(DISK_STEPS, c.disk));
        if (c.privileged != null) setPrivileged(c.privileged);
        if (c.ctid != null) setCtid(c.ctid);
        if (c.hostname != null) setHostname(c.hostname);
        if (c.bridge != null) setBridge(c.bridge);
        if (c.ip != null) setIp(c.ip);
        if (c.gateway != null) setGateway(c.gateway);
        if (c.mac != null) setMac(c.mac);
        if (c.vlan != null) setVlan(c.vlan);
        if (c.mtu != null) setMtu(c.mtu);
        if (c.ssh != null) setSsh(c.ssh);
        if (c.nesting != null) setNesting(c.nesting);
        if (c.fuse != null) setFuse(c.fuse);
        if (c.gpu != null) setGpu(c.gpu);
      } catch {
        // Silently fail on invalid JSON
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleExecute = useCallback(() => {
    if (!selectedScript?.slug) return;
    const type = selectedScript.type ?? "ct";
    const pathPrefix =
      type === "pve"
        ? "tools/pve"
        : type === "addon"
          ? "tools/addon"
          : type === "vm"
            ? "vm"
            : type === "turnkey"
              ? "turnkey"
              : "ct";
    const scriptPath = `scripts/${pathPrefix}/${selectedScript.slug}.sh`;

    const envVars: Record<string, string | number | boolean> = {};
    if (cpu !== defaults.cpu) envVars.var_cpu = cpu;
    if (ram !== defaults.ram) envVars.var_ram = ram;
    if (disk !== defaults.hdd) envVars.var_disk = disk;
    if (privileged !== defaults.privileged)
      envVars.var_unprivileged = privileged ? 0 : 1;
    if (ctid.trim()) envVars.var_ctid = ctid.trim();
    if (hostname.trim()) envVars.var_hostname = hostname.trim();
    if (bridge !== "vmbr0") envVars.var_bridge = bridge;
    if (ip.trim()) {
      envVars.var_net = "static";
      envVars.var_ip = ip.trim();
    }
    if (gateway.trim()) envVars.var_gateway = gateway.trim();
    if (mac.trim()) envVars.var_mac = mac.trim();
    if (vlan.trim()) envVars.var_vlan = vlan.trim();
    if (mtu.trim()) envVars.var_mtu = mtu.trim();
    if (ssh) envVars.var_ssh = "yes";
    if (nesting) envVars.var_nesting = "1";
    if (fuse) envVars.var_fuse = "1";
    if (gpu) envVars.var_gpu = "yes";
    envVars.mode = "generated";

    onInstallScript(
      scriptPath,
      selectedScript.name ?? "Script",
      undefined,
      undefined,
      envVars,
    );
  }, [
    selectedScript,
    cpu,
    ram,
    disk,
    privileged,
    defaults,
    ctid,
    hostname,
    bridge,
    ip,
    gateway,
    mac,
    vlan,
    mtu,
    ssh,
    nesting,
    fuse,
    gpu,
    onInstallScript,
  ]);

  // Validation errors
  const errors = useMemo(
    () => ({
      mac: VALIDATIONS.mac(mac),
      vlan: VALIDATIONS.vlan(vlan),
      mtu: VALIDATIONS.mtu(mtu),
      ip: VALIDATIONS.ip(ip),
      hostname: VALIDATIONS.hostname(hostname),
    }),
    [mac, vlan, mtu, ip, hostname],
  );

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Script Selector */}
      <div className="glass-card-static border p-6">
        <h2 className="text-foreground mb-4 text-lg font-semibold">
          Select Script
        </h2>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="border-input bg-background hover:border-primary/60 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors"
          >
            {selectedScript ? (
              <div className="flex items-center gap-3">
                {selectedScript.logo ? (
                  <Image
                    src={selectedScript.logo}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded object-contain"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded text-xs font-bold">
                    {selectedScript.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <span className="text-foreground font-medium">
                  {selectedScript.name}
                </span>
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                  {selectedScript.type}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                Choose a script to configure...
              </span>
            )}
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {dropdownOpen && (
            <div className="border-border bg-card absolute z-50 mt-2 w-full rounded-lg border shadow-xl">
              <div className="border-border/60 border-b p-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search scripts..."
                    className="border-input bg-background placeholder:text-muted-foreground focus:border-primary w-full rounded-md border py-2 pr-3 pl-9 text-sm outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {filteredScripts.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                    No scripts found
                  </div>
                ) : (
                  filteredScripts.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => {
                        setSelectedSlug(s.slug);
                        setDropdownOpen(false);
                        setSearchQuery("");
                        handleReset();
                      }}
                      className={`hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        s.slug === selectedSlug
                          ? "bg-primary/10 text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {s.logo ? (
                        <Image
                          src={s.logo}
                          alt=""
                          width={20}
                          height={20}
                          className="h-5 w-5 rounded object-contain"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">
                          {s.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <span className="flex-1 truncate text-left">
                        {s.name}
                      </span>
                      <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold">
                        {s.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedScript && (
        <>
          {/* Resource Configuration */}
          <div className="glass-card-static animate-card-in border p-6">
            <h2 className="text-foreground mb-6 flex items-center gap-2 text-lg font-semibold">
              <Settings2 className="text-primary h-5 w-5" />
              Resources
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              {/* CPU */}
              <div>
                <label className="text-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <Cpu className="text-primary h-4 w-4" />
                  CPU Cores
                  <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-bold">
                    {cpu}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={CPU_STEPS.length - 1}
                  value={cpu - 1}
                  onChange={(e) => setCpu(Number(e.target.value) + 1)}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                  <span>1</span>
                  <span>16</span>
                </div>
              </div>

              {/* RAM */}
              <div>
                <label className="text-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <MemoryStick className="text-primary h-4 w-4" />
                  RAM
                  <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-bold">
                    {fmtRam(ram)}
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={RAM_STEPS.length - 1}
                  value={ramIdx}
                  onChange={(e) => setRamIdx(Number(e.target.value))}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                  <span>512 MB</span>
                  <span>40 GB</span>
                </div>
              </div>

              {/* Disk */}
              <div>
                <label className="text-foreground mb-2 flex items-center gap-2 text-sm font-medium">
                  <HardDrive className="text-primary h-4 w-4" />
                  Disk
                  <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-bold">
                    {disk} GB
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={DISK_STEPS.length - 1}
                  value={diskIdx}
                  onChange={(e) => setDiskIdx(Number(e.target.value))}
                  className="accent-primary w-full"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                  <span>2 GB</span>
                  <span>128 GB</span>
                </div>
              </div>
            </div>

            {/* Privileged toggle */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setPrivileged(!privileged)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${privileged ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${privileged ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
              <div className="flex items-center gap-2">
                <Shield className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">
                  Privileged Container
                </span>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="glass-card-static animate-card-in border">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
                <Network className="text-primary h-5 w-5" />
                Advanced Settings
              </h2>
              {showAdvanced ? (
                <ChevronUp className="text-muted-foreground h-5 w-5" />
              ) : (
                <ChevronDown className="text-muted-foreground h-5 w-5" />
              )}
            </button>

            {showAdvanced && (
              <div className="animate-section-in border-border/60 space-y-6 border-t p-6">
                {/* Container ID & Hostname */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldInput
                    label="Container ID (CTID)"
                    value={ctid}
                    onChange={setCtid}
                    placeholder="Auto"
                  />
                  <FieldInput
                    label="Hostname"
                    value={hostname}
                    onChange={setHostname}
                    placeholder="Auto"
                    error={errors.hostname}
                  />
                </div>

                {/* Networking */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                    Networking
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FieldInput
                      label="Bridge"
                      value={bridge}
                      onChange={setBridge}
                      placeholder="vmbr0"
                    />
                    <FieldInput
                      label="IP Address (CIDR)"
                      value={ip}
                      onChange={setIp}
                      placeholder="DHCP"
                      error={errors.ip}
                    />
                    <FieldInput
                      label="Gateway"
                      value={gateway}
                      onChange={setGateway}
                      placeholder="Auto"
                    />
                    <FieldInput
                      label="MAC Address"
                      value={mac}
                      onChange={setMac}
                      placeholder="Auto"
                      error={errors.mac}
                    />
                    <FieldInput
                      label="VLAN Tag"
                      value={vlan}
                      onChange={setVlan}
                      placeholder="None"
                      error={errors.vlan}
                    />
                    <FieldInput
                      label="MTU"
                      value={mtu}
                      onChange={setMtu}
                      placeholder="Default"
                      error={errors.mtu}
                    />
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                    Features
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <ToggleSwitch
                      label="SSH Access"
                      checked={ssh}
                      onChange={setSsh}
                    />
                    <ToggleSwitch
                      label="Nesting"
                      checked={nesting}
                      onChange={setNesting}
                    />
                    <ToggleSwitch
                      label="FUSE"
                      checked={fuse}
                      onChange={setFuse}
                    />
                    <ToggleSwitch
                      label="GPU Passthrough"
                      checked={gpu}
                      onChange={setGpu}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generated Command */}
          <div className="glass-card-static animate-card-in border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-semibold">
                Generated Command
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <label className="cursor-pointer">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pointer-events-none gap-1.5 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" /> Import
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-[#0c0e14] p-4 font-mono text-sm leading-relaxed text-[#f0eeeb]">
                <code>
                  {generatedCommand ||
                    "Select a script to generate the command..."}
                </code>
              </pre>
              {generatedCommand && (
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 rounded-md border border-white/10 bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Execute button */}
            {generatedCommand && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleExecute}
                  disabled={hasErrors}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  <Play className="h-4 w-4" />
                  Execute on Server
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedScript && (
        <div className="glass-card-static animate-section-in border p-12 text-center">
          <Settings2 className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Script Configuration Generator
          </h3>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            Select a script above to customize its resource allocation,
            networking, and container features. Generate a one-liner command or
            execute directly on your server.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="border-border/60 hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`}
        />
      </button>
      <span className="text-foreground text-sm font-medium">{label}</span>
    </label>
  );
}
