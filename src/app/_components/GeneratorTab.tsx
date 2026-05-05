"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
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
  Loader2,
  AlertTriangle,
  Server as ServerIcon,
  Box,
} from "lucide-react";
import type { ScriptCard } from "~/types/script";
import type { Script } from "~/types/script";
import type { Server } from "~/types/server";
import { api } from "~/trpc/react";
import { useShell } from "./ShellContext";

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

export function GeneratorTab() {
  const { open: openShell } = useShell();
  const { data: scriptCardsData } =
    api.scripts.getScriptCardsWithCategories.useQuery();

  // Downloaded scripts check
  const { data: localScriptsData } =
    api.scripts.getAllDownloadedScripts.useQuery();

  const utils = api.useUtils();

  // Servers for execution target
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null,
  );
  const [selectedContainerIsVm, setSelectedContainerIsVm] = useState(false);
  const [serversLoading, setServersLoading] = useState(false);

  useEffect(() => {
    setServersLoading(true);
    fetch("/api/servers")
      .then((r) => r.json())
      .then((data: Server[]) => {
        const sorted = [...data].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? ""),
        );
        setServers(sorted);
        // Auto-select single server
        if (sorted.length === 1) setSelectedServer(sorted[0] ?? null);
      })
      .catch(() => {
        /* non-critical */
      })
      .finally(() => setServersLoading(false));
  }, []);

  const loadScriptMutation = api.scripts.loadScript.useMutation({
    onSuccess: () => {
      void utils.scripts.getAllDownloadedScripts.invalidate();
    },
  });

  // Set of downloaded slugs for O(1) lookup
  const downloadedSlugs = useMemo(() => {
    const set = new Set<string>();
    const localScripts = localScriptsData?.scripts ?? [];
    for (const local of localScripts) {
      if (local.slug) set.add(local.slug.toLowerCase());
      // Also add normalized name without extension
      const normalized = (local.name ?? "")
        .toLowerCase()
        .replace(/\.(sh|bash)$/, "");
      if (normalized) set.add(normalized);
    }
    return set;
  }, [localScriptsData]);

  const isScriptDownloaded = useCallback(
    (slug: string) => downloadedSlugs.has(slug.toLowerCase()),
    [downloadedSlugs],
  );

  // Download confirmation dialog state
  const [downloadDialogSlug, setDownloadDialogSlug] = useState<string | null>(
    null,
  );
  const downloadDialogScript = useMemo(
    () =>
      downloadDialogSlug
        ? ((scriptCardsData?.cards ?? []).find(
            (s) => s.slug === downloadDialogSlug,
          ) ?? null)
        : null,
    [downloadDialogSlug, scriptCardsData],
  );

  // Script selection
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Reset container selection when server or script changes
  useEffect(() => {
    setSelectedContainerId(null);
    setSelectedContainerIsVm(false);
  }, [selectedServer?.id, selectedSlug]);

  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Resources
  const [cpu, setCpu] = useState(2);
  const [ramIdx, setRamIdx] = useState(closestIdx(RAM_STEPS, 2048));
  const [diskIdx, setDiskIdx] = useState(closestIdx(DISK_STEPS, 8));
  const [privileged, setPrivileged] = useState(false);
  const [installMode, setInstallMode] = useState<
    "default" | "mydefaults" | "appdefaults" | "advanced"
  >("default");

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ctid, setCtid] = useState("");
  const [hostname, setHostname] = useState("");
  const [bridge, setBridge] = useState("vmbr0");
  const [ipMode, setIpMode] = useState<"dhcp" | "static">("dhcp");
  const [ip, setIp] = useState("");
  const [gateway, setGateway] = useState("");
  const [mac, setMac] = useState("");
  const [vlan, setVlan] = useState("");
  const [mtu, setMtu] = useState("");
  const [ssh, setSsh] = useState(false);
  const [nesting, setNesting] = useState(false);
  const [fuse, setFuse] = useState(false);
  const [gpu, setGpu] = useState(false);

  // Container identity extras
  const [password, setPassword] = useState("");
  const [tags, setTags] = useState("");
  const [timezone, setTimezone] = useState("");
  const [containerStorage, setContainerStorage] = useState("");
  const [templateStorage, setTemplateStorage] = useState("");
  const [protection, setProtection] = useState(false);

  // Network extras
  const [ipv6Method, setIpv6Method] = useState<
    "auto" | "dhcp" | "static" | "none"
  >("auto");
  const [ipv6Ip, setIpv6Ip] = useState("");
  const [ipv6Gateway, setIpv6Gateway] = useState("");
  const [searchdomain, setSearchdomain] = useState("");
  const [ns, setNs] = useState("");

  // Feature extras
  const [tun, setTun] = useState(false);
  const [keyctl, setKeyctl] = useState(false);
  const [mknod, setMknod] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [aptCacher, setAptCacher] = useState(false);
  const [aptCacherIp, setAptCacherIp] = useState("");
  const [mountFs, setMountFs] = useState("");
  const [sshAuthorizedKey, setSshAuthorizedKey] = useState("");

  const [copied, setCopied] = useState(false);

  // Scripts list
  const allScripts = useMemo(() => {
    if (!scriptCardsData?.success || !scriptCardsData.cards) return [];
    const map = new Map<string, ScriptCard>();
    for (const s of scriptCardsData.cards) {
      const t = (s?.type ?? "").toLowerCase();
      // Generator only supports LXC scripts in pre9.
      if (!(t === "ct" || t === "lxc")) continue;
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

  const selectedType = (selectedScript?.type ?? "").toLowerCase();
  const isLxcType = selectedType === "ct" || selectedType === "lxc";

  useEffect(() => {
    if (
      !isLxcType &&
      (installMode === "mydefaults" || installMode === "appdefaults")
    ) {
      setInstallMode("default");
    }
  }, [isLxcType, installMode]);

  // Fetch full script detail (with install_methods) when a script is selected
  const { data: scriptDetailData } = api.scripts.getScriptBySlug.useQuery(
    { slug: selectedSlug ?? "" },
    { enabled: !!selectedSlug },
  );

  const executeIn = useMemo((): string[] => {
    if (!scriptDetailData?.success || !scriptDetailData.script) return [];
    return scriptDetailData.script.execute_in ?? [];
  }, [scriptDetailData]);

  const executionPolicy = useMemo(() => {
    const has = (v: string) => executeIn.includes(v);
    const allowVm = has("vm");
    const allowLxcByMode =
      has("pbs") || has("pmg") || (has("lxc") && !isLxcType);
    const requiresContainer = allowVm || allowLxcByMode;
    const pinMode = has("pbs") ? "pbs" : has("pmg") ? "pmg" : null;
    return { requiresContainer, allowVm, allowLxcByMode, pinMode };
  }, [executeIn, isLxcType]);

  const needsContainerPicker = executionPolicy.requiresContainer;

  const { data: containersData, isLoading: containersLoading } =
    api.installedScripts.listContainersOnServer.useQuery(
      { serverId: selectedServer?.id ?? 0 },
      { enabled: needsContainerPicker && !!selectedServer },
    );

  const containerPickerOptions = useMemo(() => {
    if (!containersData) return [];
    const opts: Array<{
      id: string;
      name: string;
      isVm: boolean;
      status: string;
      pinned: boolean;
    }> = [];
    const wantLxc = executionPolicy.allowLxcByMode;
    const wantVm = executionPolicy.allowVm;
    if (wantLxc) {
      for (const c of containersData.lxc) {
        const pinned =
          (executionPolicy.pinMode === "pbs" &&
            c.name.toLowerCase().includes("proxmox-backup-server")) ||
          (executionPolicy.pinMode === "pmg" &&
            c.name.toLowerCase().includes("proxmox-mail-gateway"));
        opts.push({ ...c, isVm: false, pinned });
      }
    }
    if (wantVm) {
      for (const v of containersData.vm) {
        opts.push({ ...v, isVm: true, pinned: false });
      }
    }
    return opts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return parseInt(a.id, 10) - parseInt(b.id, 10);
    });
  }, [executionPolicy, containersData]);

  const scriptDetail: Script | null = useMemo(
    () =>
      scriptDetailData?.success ? (scriptDetailData.script ?? null) : null,
    [scriptDetailData],
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

  // App defaults from selected script's install_methods
  const appDefaults = useMemo(() => {
    const fallback = { cpu: 2, ram: 2048, hdd: 8, privileged: false };
    if (!scriptDetail?.install_methods?.length) return fallback;
    const m = scriptDetail.install_methods[0];
    if (!m?.resources) return fallback;
    return {
      cpu: m.resources.cpu || fallback.cpu,
      ram: m.resources.ram || fallback.ram,
      hdd: m.resources.hdd || fallback.hdd,
      privileged: scriptDetail.privileged ?? false,
    };
  }, [scriptDetail]);

  const selectedContainerTemplateQuery =
    api.installedScripts.getContainersResourceTemplates.useQuery(
      {
        serverId: selectedServer?.id ?? 0,
        containerIds: selectedContainerId ? [selectedContainerId] : [],
      },
      {
        enabled: !!selectedServer && !!selectedContainerId,
      },
    );

  const templateDefaults = useMemo(() => {
    if (!selectedContainerId) return appDefaults;
    const t =
      selectedContainerTemplateQuery.data?.templates?.[selectedContainerId];
    if (!t) return appDefaults;
    return {
      cpu: t.cpu ?? appDefaults.cpu,
      ram: t.ramMB ?? appDefaults.ram,
      hdd: t.diskGB ?? appDefaults.hdd,
      privileged: appDefaults.privileged,
    };
  }, [selectedContainerId, selectedContainerTemplateQuery.data, appDefaults]);

  // Apply template defaults when script/container context changes
  useEffect(() => {
    setCpu(templateDefaults.cpu);
    setRamIdx(closestIdx(RAM_STEPS, templateDefaults.ram));
    setDiskIdx(closestIdx(DISK_STEPS, templateDefaults.hdd));
    setPrivileged(templateDefaults.privileged);
  }, [templateDefaults]);

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

    const localPath = `scripts/${pathPrefix}/${slug}.sh`;
    const baseCmd = `bash ${localPath}`;
    const overrides: string[] = [];
    if (cpu !== templateDefaults.cpu) overrides.push(`var_cpu="${cpu}"`);
    if (ram !== templateDefaults.ram) overrides.push(`var_ram="${ram}"`);
    if (disk !== templateDefaults.hdd) overrides.push(`var_disk="${disk}"`);
    if (privileged !== templateDefaults.privileged)
      overrides.push(`var_unprivileged="${privileged ? 0 : 1}"`);
    if (installMode === "advanced") {
      if (ctid.trim()) overrides.push(`var_ctid="${ctid.trim()}"`);
      if (hostname.trim()) overrides.push(`var_hostname="${hostname.trim()}"`);
      if (password.trim()) overrides.push(`var_pw="${password.trim()}"`);
      if (tags.trim()) overrides.push(`var_tags="${tags.trim()}"`);
      if (timezone.trim()) overrides.push(`var_timezone="${timezone.trim()}"`);
      if (containerStorage.trim())
        overrides.push(`var_container_storage="${containerStorage.trim()}"`);
      if (templateStorage.trim())
        overrides.push(`var_template_storage="${templateStorage.trim()}"`);
      if (protection) overrides.push('var_protection="yes"');
      if (bridge !== "vmbr0") overrides.push(`var_brg="${bridge}"`);
      if (ipMode === "static" && ip.trim())
        overrides.push(`var_net="${ip.trim()}"`);
      if (ipMode === "static" && gateway.trim())
        overrides.push(`var_gateway="${gateway.trim()}"`);
      if (mac.trim()) overrides.push(`var_mac="${mac.trim()}"`);
      if (vlan.trim()) overrides.push(`var_vlan="${vlan.trim()}"`);
      if (mtu.trim()) overrides.push(`var_mtu="${mtu.trim()}"`);
      if (ipv6Method !== "auto")
        overrides.push(`var_ipv6_method="${ipv6Method}"`);
      if (ipv6Method === "static" && ipv6Ip.trim())
        overrides.push(`var_ipv6="${ipv6Ip.trim()}"`);
      if (ipv6Method === "static" && ipv6Gateway.trim())
        overrides.push(`var_ipv6_gateway="${ipv6Gateway.trim()}"`);
      if (searchdomain.trim())
        overrides.push(`var_searchdomain="${searchdomain.trim()}"`);
      if (ns.trim()) overrides.push(`var_ns="${ns.trim()}"`);
      if (ssh) overrides.push('var_ssh="yes"');
      if (ssh && sshAuthorizedKey.trim())
        overrides.push(`var_ssh_authorized_key="${sshAuthorizedKey.trim()}"`);
      if (nesting) overrides.push('var_nesting="1"');
      if (fuse) overrides.push('var_fuse="1"');
      if (tun) overrides.push('var_tun="yes"');
      if (gpu) overrides.push('var_gpu="yes"');
      if (keyctl) overrides.push('var_keyctl="1"');
      if (mknod) overrides.push('var_mknod="1"');
      if (verbose) overrides.push('var_verbose="yes"');
      if (aptCacher) overrides.push('var_apt_cacher="yes"');
      if (aptCacher && aptCacherIp.trim())
        overrides.push(`var_apt_cacher_ip="${aptCacherIp.trim()}"`);
      if (mountFs.trim()) overrides.push(`var_mount_fs="${mountFs.trim()}"`);
      if (overrides.length === 0) return `mode=generated ${baseCmd}`;
      return `mode=generated ${overrides.join(" ")} ${baseCmd}`;
    }

    return `mode=${installMode} ${baseCmd}`;
  }, [
    selectedScript,
    installMode,
    cpu,
    ram,
    disk,
    privileged,
    templateDefaults,
    ctid,
    hostname,
    password,
    tags,
    timezone,
    containerStorage,
    templateStorage,
    protection,
    bridge,
    ipMode,
    ip,
    gateway,
    mac,
    vlan,
    mtu,
    ipv6Method,
    ipv6Ip,
    ipv6Gateway,
    searchdomain,
    ns,
    ssh,
    sshAuthorizedKey,
    nesting,
    fuse,
    tun,
    gpu,
    keyctl,
    mknod,
    verbose,
    aptCacher,
    aptCacherIp,
    mountFs,
  ]);

  const handleCopy = useCallback(() => {
    if (!generatedCommand) return;
    void navigator.clipboard.writeText(generatedCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedCommand]);

  const handleReset = useCallback(() => {
    setCpu(templateDefaults.cpu);
    setRamIdx(closestIdx(RAM_STEPS, templateDefaults.ram));
    setDiskIdx(closestIdx(DISK_STEPS, templateDefaults.hdd));
    setPrivileged(templateDefaults.privileged);
    setCtid("");
    setHostname("");
    setPassword("");
    setTags("");
    setTimezone("");
    setContainerStorage("");
    setTemplateStorage("");
    setProtection(false);
    setBridge("vmbr0");
    setIpMode("dhcp");
    setIp("");
    setGateway("");
    setMac("");
    setVlan("");
    setMtu("");
    setIpv6Method("auto");
    setIpv6Ip("");
    setIpv6Gateway("");
    setSearchdomain("");
    setNs("");
    setSsh(false);
    setSshAuthorizedKey("");
    setNesting(false);
    setFuse(false);
    setTun(false);
    setGpu(false);
    setKeyctl(false);
    setMknod(false);
    setVerbose(false);
    setAptCacher(false);
    setAptCacherIp("");
    setMountFs("");
  }, [templateDefaults]);

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
        password,
        tags,
        timezone,
        containerStorage,
        templateStorage,
        protection,
        bridge,
        ipMode,
        ip,
        gateway,
        mac,
        vlan,
        mtu,
        ipv6Method,
        ipv6Ip,
        ipv6Gateway,
        searchdomain,
        ns,
        ssh,
        sshAuthorizedKey,
        nesting,
        fuse,
        tun,
        gpu,
        keyctl,
        mknod,
        verbose,
        aptCacher,
        aptCacherIp,
        mountFs,
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
            password?: string;
            tags?: string;
            timezone?: string;
            containerStorage?: string;
            templateStorage?: string;
            protection?: boolean;
            bridge?: string;
            ipMode?: "dhcp" | "static";
            ip?: string;
            gateway?: string;
            mac?: string;
            vlan?: string;
            mtu?: string;
            ipv6Method?: "auto" | "dhcp" | "static" | "none";
            ipv6Ip?: string;
            ipv6Gateway?: string;
            searchdomain?: string;
            ns?: string;
            ssh?: boolean;
            sshAuthorizedKey?: string;
            nesting?: boolean;
            fuse?: boolean;
            tun?: boolean;
            gpu?: boolean;
            keyctl?: boolean;
            mknod?: boolean;
            verbose?: boolean;
            aptCacher?: boolean;
            aptCacherIp?: string;
            mountFs?: string;
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
        if (c.password != null) setPassword(c.password);
        if (c.tags != null) setTags(c.tags);
        if (c.timezone != null) setTimezone(c.timezone);
        if (c.containerStorage != null) setContainerStorage(c.containerStorage);
        if (c.templateStorage != null) setTemplateStorage(c.templateStorage);
        if (c.protection != null) setProtection(c.protection);
        if (c.bridge != null) setBridge(c.bridge);
        if (c.ipMode != null) setIpMode(c.ipMode);
        if (c.ip != null) setIp(c.ip);
        if (c.gateway != null) setGateway(c.gateway);
        if (c.mac != null) setMac(c.mac);
        if (c.vlan != null) setVlan(c.vlan);
        if (c.mtu != null) setMtu(c.mtu);
        if (c.ipv6Method != null) setIpv6Method(c.ipv6Method);
        if (c.ipv6Ip != null) setIpv6Ip(c.ipv6Ip);
        if (c.ipv6Gateway != null) setIpv6Gateway(c.ipv6Gateway);
        if (c.searchdomain != null) setSearchdomain(c.searchdomain);
        if (c.ns != null) setNs(c.ns);
        if (c.ssh != null) setSsh(c.ssh);
        if (c.sshAuthorizedKey != null) setSshAuthorizedKey(c.sshAuthorizedKey);
        if (c.nesting != null) setNesting(c.nesting);
        if (c.fuse != null) setFuse(c.fuse);
        if (c.tun != null) setTun(c.tun);
        if (c.gpu != null) setGpu(c.gpu);
        if (c.keyctl != null) setKeyctl(c.keyctl);
        if (c.mknod != null) setMknod(c.mknod);
        if (c.verbose != null) setVerbose(c.verbose);
        if (c.aptCacher != null) setAptCacher(c.aptCacher);
        if (c.aptCacherIp != null) setAptCacherIp(c.aptCacherIp);
        if (c.mountFs != null) setMountFs(c.mountFs);
      } catch {
        // Silently fail on invalid JSON
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleExecute = useCallback(() => {
    if (!selectedScript?.slug) return;
    if (!selectedServer) return;
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
    if (installMode === "advanced") {
      if (cpu !== templateDefaults.cpu) envVars.var_cpu = cpu;
      if (ram !== templateDefaults.ram) envVars.var_ram = ram;
      if (disk !== templateDefaults.hdd) envVars.var_disk = disk;
      if (privileged !== templateDefaults.privileged)
        envVars.var_unprivileged = privileged ? 0 : 1;
      if (ctid.trim()) envVars.var_ctid = ctid.trim();
      if (hostname.trim()) envVars.var_hostname = hostname.trim();
      if (password.trim()) envVars.var_pw = password.trim();
      if (tags.trim()) envVars.var_tags = tags.trim();
      if (timezone.trim()) envVars.var_timezone = timezone.trim();
      if (containerStorage.trim())
        envVars.var_container_storage = containerStorage.trim();
      if (templateStorage.trim())
        envVars.var_template_storage = templateStorage.trim();
      if (protection) envVars.var_protection = "yes";
      if (bridge !== "vmbr0") envVars.var_brg = bridge;
      if (ipMode === "static" && ip.trim()) envVars.var_net = ip.trim();
      if (ipMode === "static" && gateway.trim())
        envVars.var_gateway = gateway.trim();
      if (mac.trim()) envVars.var_mac = mac.trim();
      if (vlan.trim()) envVars.var_vlan = vlan.trim();
      if (mtu.trim()) envVars.var_mtu = mtu.trim();
      if (ipv6Method !== "auto") envVars.var_ipv6_method = ipv6Method;
      if (ipv6Method === "static" && ipv6Ip.trim())
        envVars.var_ipv6 = ipv6Ip.trim();
      if (ipv6Method === "static" && ipv6Gateway.trim())
        envVars.var_ipv6_gateway = ipv6Gateway.trim();
      if (searchdomain.trim()) envVars.var_searchdomain = searchdomain.trim();
      if (ns.trim()) envVars.var_ns = ns.trim();
      if (ssh) envVars.var_ssh = "yes";
      if (ssh && sshAuthorizedKey.trim())
        envVars.var_ssh_authorized_key = sshAuthorizedKey.trim();
      if (nesting) envVars.var_nesting = "1";
      if (fuse) envVars.var_fuse = "1";
      if (tun) envVars.var_tun = "yes";
      if (gpu) envVars.var_gpu = "yes";
      if (keyctl) envVars.var_keyctl = "1";
      if (mknod) envVars.var_mknod = "1";
      if (verbose) envVars.var_verbose = "yes";
      if (aptCacher) envVars.var_apt_cacher = "yes";
      if (aptCacher && aptCacherIp.trim())
        envVars.var_apt_cacher_ip = aptCacherIp.trim();
      if (mountFs.trim()) envVars.var_mount_fs = mountFs.trim();
      envVars.mode = "generated";
    } else {
      envVars.mode = installMode;
    }

    // Determine whether to execute inside the container.
    // execute_in: ["lxc"] (or vm/pbs/pmg) means the script runs INSIDE the
    // selected container rather than on the PVE host.
    const execInContainer =
      executionPolicy.requiresContainer && !!selectedContainerId;

    openShell({
      sessionKey: `generator-${selectedScript.slug}-${Date.now()}`,
      title: `${selectedScript.name ?? "Script"} (${selectedServer.name})`,
      containerId: execInContainer
        ? (selectedContainerId ?? undefined)
        : undefined,
      containerType: selectedContainerIsVm ? "vm" : "lxc",
      terminal: {
        scriptPath,
        mode: "ssh",
        server: selectedServer,
        envVars,
        executeInContainer: execInContainer,
        containerId: execInContainer
          ? (selectedContainerId ?? undefined)
          : undefined,
        containerType: selectedContainerIsVm ? "vm" : "lxc",
      },
    });
  }, [
    openShell,
    selectedScript,
    selectedServer,
    selectedContainerId,
    executionPolicy,
    installMode,
    cpu,
    ram,
    disk,
    privileged,
    templateDefaults,
    ctid,
    hostname,
    password,
    tags,
    timezone,
    containerStorage,
    templateStorage,
    protection,
    bridge,
    ipMode,
    ip,
    gateway,
    mac,
    vlan,
    mtu,
    ipv6Method,
    ipv6Ip,
    ipv6Gateway,
    searchdomain,
    ns,
    ssh,
    sshAuthorizedKey,
    nesting,
    fuse,
    tun,
    gpu,
    keyctl,
    mknod,
    verbose,
    aptCacher,
    aptCacherIp,
    mountFs,
    selectedContainerIsVm,
  ]);

  // Validation errors
  const errors = useMemo(
    () => ({
      mac: VALIDATIONS.mac(mac),
      vlan: VALIDATIONS.vlan(vlan),
      mtu: VALIDATIONS.mtu(mtu),
      ip: ipMode === "static" ? VALIDATIONS.ip(ip) : null,
      hostname: VALIDATIONS.hostname(hostname),
    }),
    [mac, vlan, mtu, ipMode, ip, hostname],
  );

  const hasErrors = Object.values(errors).some(Boolean);

  // Dropdown positioning: portal to body to escape stacking contexts
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (dropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div className="space-y-6">
      {/* Script Selector */}
      <div className="glass-card-static border p-6">
        <h2 className="text-foreground mb-4 text-lg font-semibold">
          Select Script
        </h2>
        <div className="relative">
          <button
            ref={triggerRef}
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

          {dropdownOpen &&
            createPortal(
              <div
                ref={dropdownRef}
                className="border-border bg-card rounded-lg border shadow-xl"
                style={{
                  position: "fixed",
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  zIndex: 9999,
                }}
              >
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
                    filteredScripts.map((s) => {
                      const downloaded = isScriptDownloaded(s.slug);
                      return (
                        <button
                          key={s.slug}
                          onClick={() => {
                            if (downloaded) {
                              setSelectedSlug(s.slug);
                              setDropdownOpen(false);
                              setSearchQuery("");
                              handleReset();
                            } else {
                              setDownloadDialogSlug(s.slug);
                              setDropdownOpen(false);
                              setSearchQuery("");
                            }
                          }}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            s.slug === selectedSlug
                              ? "bg-primary/10 text-primary"
                              : downloaded
                                ? "text-foreground hover:bg-accent"
                                : "text-muted-foreground/60 hover:bg-accent/50"
                          }`}
                        >
                          {s.logo ? (
                            <Image
                              src={s.logo}
                              alt=""
                              width={20}
                              height={20}
                              className={`h-5 w-5 rounded object-contain ${!downloaded ? "opacity-40 grayscale" : ""}`}
                            />
                          ) : (
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                                downloaded
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-muted/50 text-muted-foreground/40"
                              }`}
                            >
                              {s.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`flex-1 truncate text-left ${!downloaded ? "opacity-50" : ""}`}
                          >
                            {s.name}
                          </span>
                          {!downloaded && (
                            <Download className="h-3.5 w-3.5 shrink-0 opacity-40" />
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              downloaded
                                ? "bg-secondary text-muted-foreground"
                                : "bg-secondary/50 text-muted-foreground/40"
                            }`}
                          >
                            {s.type}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>,
              document.body,
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

            <div className="bg-muted/40 mb-5 flex flex-wrap rounded-lg p-0.5">
              {[
                { key: "default", label: "Default" },
                ...(isLxcType
                  ? [
                      { key: "mydefaults", label: "My Defaults" },
                      { key: "appdefaults", label: "App Defaults" },
                    ]
                  : []),
                { key: "advanced", label: "⚙ Advanced" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() =>
                    setInstallMode(
                      m.key as
                        | "default"
                        | "mydefaults"
                        | "appdefaults"
                        | "advanced",
                    )
                  }
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    installMode === m.key
                      ? "bg-primary/15 text-primary ring-primary/30 ring-1"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

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

            {/* Script Defaults Info */}
            {scriptDetail?.install_methods &&
              scriptDetail.install_methods.length > 0 && (
                <div className="bg-primary/5 border-primary/20 mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-xs">
                  <span className="text-muted-foreground font-medium">
                    App Defaults:
                  </span>
                  <span className="bg-background rounded px-2 py-0.5 font-mono">
                    {appDefaults.cpu} CPU
                  </span>
                  <span className="bg-background rounded px-2 py-0.5 font-mono">
                    {fmtRam(appDefaults.ram)}
                  </span>
                  <span className="bg-background rounded px-2 py-0.5 font-mono">
                    {appDefaults.hdd} GB
                  </span>
                  {scriptDetail.install_methods[0]?.resources?.os && (
                    <span className="bg-background rounded px-2 py-0.5 font-mono">
                      {scriptDetail.install_methods[0].resources.os}{" "}
                      {scriptDetail.install_methods[0].resources.version}
                    </span>
                  )}
                  {scriptDetail.install_methods.length > 1 && (
                    <span className="text-primary font-medium">
                      +{scriptDetail.install_methods.length - 1} variant
                      {scriptDetail.install_methods.length > 2 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}

            {selectedContainerId && (
              <div className="bg-muted/30 border-border mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Template from CT/VM:
                </span>
                <span className="bg-background rounded px-2 py-0.5 font-mono">
                  {templateDefaults.cpu} CPU
                </span>
                <span className="bg-background rounded px-2 py-0.5 font-mono">
                  {fmtRam(templateDefaults.ram)}
                </span>
                <span className="bg-background rounded px-2 py-0.5 font-mono">
                  {templateDefaults.hdd} GB
                </span>
              </div>
            )}

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
          {installMode === "advanced" && (
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
                  {/* Container */}
                  <div>
                    <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                      Container
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      <FieldInput
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        placeholder="leave empty for auto"
                        type="password"
                      />
                      <FieldInput
                        label="Tags"
                        value={tags}
                        onChange={setTags}
                        placeholder="community-scripts"
                        hint="Semicolon-separated"
                      />
                      <FieldInput
                        label="Timezone"
                        value={timezone}
                        onChange={setTimezone}
                        placeholder="auto (host timezone)"
                      />
                      <FieldInput
                        label="Container Storage"
                        value={containerStorage}
                        onChange={setContainerStorage}
                        placeholder="local-lvm"
                      />
                      <FieldInput
                        label="Template Storage"
                        value={templateStorage}
                        onChange={setTemplateStorage}
                        placeholder="local"
                      />
                    </div>
                    <div className="mt-3">
                      <ToggleSwitch
                        label="Protection (prevent accidental deletion)"
                        checked={protection}
                        onChange={setProtection}
                      />
                    </div>
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
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-foreground mb-2 block text-sm font-medium">
                          IP Mode
                        </label>
                        <div className="flex gap-2">
                          {(["dhcp", "static"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setIpMode(m)}
                              className={`rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                                ipMode === m
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      {ipMode === "static" && (
                        <>
                          <FieldInput
                            label="IPv4 Address (CIDR)"
                            value={ip}
                            onChange={setIp}
                            placeholder="192.168.1.100/24"
                            error={errors.ip}
                          />
                          <FieldInput
                            label="IPv4 Gateway"
                            value={gateway}
                            onChange={setGateway}
                            placeholder="192.168.1.1"
                          />
                        </>
                      )}
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
                      <FieldInput
                        label="Search Domain"
                        value={searchdomain}
                        onChange={setSearchdomain}
                        placeholder="auto"
                      />
                      <FieldInput
                        label="Nameserver (DNS)"
                        value={ns}
                        onChange={setNs}
                        placeholder="auto"
                      />
                    </div>
                    {/* IPv6 */}
                    <div className="mt-4">
                      <label className="text-foreground mb-2 block text-sm font-medium">
                        IPv6 Method
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(["auto", "dhcp", "static", "none"] as const).map(
                          (m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setIpv6Method(m)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                ipv6Method === m
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {m}
                            </button>
                          ),
                        )}
                      </div>
                      {ipv6Method === "static" && (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <FieldInput
                            label="IPv6 Address (CIDR)"
                            value={ipv6Ip}
                            onChange={setIpv6Ip}
                            placeholder="e.g. 2001:db8::1/64"
                          />
                          <FieldInput
                            label="IPv6 Gateway"
                            value={ipv6Gateway}
                            onChange={setIpv6Gateway}
                            placeholder="e.g. 2001:db8::1"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features & Services */}
                  <div>
                    <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                      Features &amp; Services
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
                        label="TUN"
                        checked={tun}
                        onChange={setTun}
                      />
                      <ToggleSwitch
                        label="GPU Passthrough"
                        checked={gpu}
                        onChange={setGpu}
                      />
                      <ToggleSwitch
                        label="Keyctl"
                        checked={keyctl}
                        onChange={setKeyctl}
                      />
                      <ToggleSwitch
                        label="Mknod"
                        checked={mknod}
                        onChange={setMknod}
                      />
                      <ToggleSwitch
                        label="Verbose"
                        checked={verbose}
                        onChange={setVerbose}
                      />
                      <ToggleSwitch
                        label="APT Cacher"
                        checked={aptCacher}
                        onChange={setAptCacher}
                      />
                    </div>
                    {aptCacher && (
                      <div className="mt-3 max-w-sm">
                        <FieldInput
                          label="APT Cacher IP / URL"
                          value={aptCacherIp}
                          onChange={setAptCacherIp}
                          placeholder="e.g. 192.168.1.10"
                        />
                      </div>
                    )}
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <FieldInput
                        label="Mount Filesystem"
                        value={mountFs}
                        onChange={setMountFs}
                        placeholder="nfs;cifs"
                        hint="Semicolon-separated filesystem types"
                      />
                    </div>
                    {ssh && (
                      <div className="mt-3">
                        <FieldInput
                          label="SSH Authorized Key"
                          value={sshAuthorizedKey}
                          onChange={setSshAuthorizedKey}
                          placeholder="ssh-ed25519 AAAA..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
              <div className="mt-4 space-y-3">
                {/* Server / execution target selection */}
                <div className="glass-card-static rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <ServerIcon className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs font-medium">
                      Execute on
                    </span>
                    {serversLoading && (
                      <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Server options as bubbles */}
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedServer(s)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selectedServer?.id === s.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                        style={
                          s.color
                            ? {
                                borderColor:
                                  selectedServer?.id === s.id
                                    ? s.color
                                    : undefined,
                                backgroundColor:
                                  selectedServer?.id === s.id
                                    ? `${s.color}1a`
                                    : undefined,
                                color:
                                  selectedServer?.id === s.id
                                    ? s.color
                                    : undefined,
                              }
                            : undefined
                        }
                      >
                        {s.color && (
                          <span
                            className="h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                        )}
                        <span className="truncate">
                          {s.name} ({s.ip})
                        </span>
                      </button>
                    ))}
                  </div>
                  {!selectedServer && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Select a Proxmox node to execute scripts.
                    </p>
                  )}

                  {/* Container picker for addon/pbs/pmg scripts */}
                  {needsContainerPicker && selectedServer && (
                    <div className="border-border/60 mt-3 border-t pt-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Box className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="text-muted-foreground text-xs font-medium">
                          Target container
                        </span>
                        {containersLoading && (
                          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                        )}
                      </div>
                      {containersData?.error ? (
                        <p className="text-destructive text-xs">
                          {containersData.error}
                        </p>
                      ) : containerPickerOptions.length === 0 &&
                        !containersLoading ? (
                        <p className="text-muted-foreground text-xs">
                          No containers found on this server
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {containerPickerOptions.map((c) => (
                            <button
                              key={`${c.isVm ? "vm" : "lxc"}-${c.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedContainerId(c.id);
                                setSelectedContainerIsVm(c.isVm);
                              }}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                selectedContainerId === c.id
                                  ? "border-primary bg-primary/10 text-primary"
                                  : c.pinned
                                    ? "border-amber-500/50 text-amber-600 hover:border-amber-500 dark:text-amber-400"
                                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  c.status === "running"
                                    ? "bg-green-500"
                                    : c.status === "stopped"
                                      ? "bg-red-500"
                                      : "bg-zinc-400"
                                }`}
                              />
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  c.isVm
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-green-500/10 text-green-500"
                                }`}
                              >
                                {c.isVm ? "VM" : "LXC"}
                              </span>
                              {c.pinned && (
                                <span className="text-amber-500">★</span>
                              )}
                              <span>{c.name}</span>
                              <span className="text-muted-foreground/60">
                                #{c.id}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  {selectedScript &&
                    !isScriptDownloaded(selectedScript.slug) && (
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                        Script not downloaded
                      </span>
                    )}
                  <Button
                    onClick={handleExecute}
                    disabled={
                      !selectedServer ||
                      hasErrors ||
                      !selectedScript ||
                      !isScriptDownloaded(selectedScript.slug) ||
                      (needsContainerPicker &&
                        !!selectedServer &&
                        !selectedContainerId)
                    }
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {selectedServer
                      ? `Execute on ${selectedServer.name}`
                      : "Select node"}
                  </Button>
                </div>
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

      {/* Download confirmation dialog */}
      {downloadDialogSlug &&
        downloadDialogScript &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDownloadDialogSlug(null)}
          >
            <div
              className="border-border bg-card mx-4 w-full max-w-md rounded-xl border p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
                  <Download className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-foreground text-lg font-semibold">
                    Script Not Downloaded
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    This script needs to be downloaded first
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 mb-4 flex items-center gap-3 rounded-lg p-3">
                {downloadDialogScript.logo ? (
                  <Image
                    src={downloadDialogScript.logo}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded object-contain"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded text-sm font-bold">
                    {downloadDialogScript.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {downloadDialogScript.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {downloadDialogScript.type} script
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mb-5 text-sm">
                Do you want to download{" "}
                <strong className="text-foreground">
                  {downloadDialogScript.name}
                </strong>{" "}
                now? You can configure and execute it afterwards.
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDownloadDialogSlug(null)}
                  disabled={loadScriptMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={loadScriptMutation.isPending}
                  onClick={() => {
                    loadScriptMutation.mutate(
                      { slug: downloadDialogSlug },
                      {
                        onSuccess: () => {
                          // Wait for the query cache to refresh before selecting,
                          // so isScriptDownloaded returns true and Execute is enabled
                          void utils.scripts.getAllDownloadedScripts
                            .refetch()
                            .then(() => {
                              setSelectedSlug(downloadDialogSlug);
                              setDownloadDialogSlug(null);
                              handleReset();
                            });
                        },
                        onError: () => {
                          // Keep dialog open so user sees the error state
                        },
                      },
                    );
                  }}
                >
                  {loadScriptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download Script
                    </>
                  )}
                </Button>
              </div>

              {loadScriptMutation.isError && (
                <p className="mt-3 text-xs text-red-400">
                  Failed to download script. Please try again.
                </p>
              )}
            </div>
          </div>,
          document.body,
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
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-background text-foreground placeholder:text-muted-foreground focus:border-primary w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {hint && !error && (
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      )}
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
