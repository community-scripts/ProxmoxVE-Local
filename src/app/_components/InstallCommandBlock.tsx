"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  HardDrive,
  Server,
  Settings,
  Info,
  Play,
  Loader2,
} from "lucide-react";
import type { Server as ServerType } from "~/types/server";
import { api } from "~/trpc/react";
import { useShell } from "./ShellContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type InstallEnv =
  | "default"
  | "mydefaults"
  | "appdefaults"
  | "alpine"
  | "advanced";

const CONTAINER_TYPES = ["lxc", "vm", "pbs", "pmg"] as const;

// ---------------------------------------------------------------------------
// Presets (mirrors Frontend)
// ---------------------------------------------------------------------------

const CPU_PRESETS = Array.from({ length: 16 }, (_, i) => i + 1);

const RAM_PRESETS: number[] = (() => {
  const steps: number[] = [];
  for (let v = 512; v <= 2048; v += 256) steps.push(v);
  for (let v = 3072; v <= 8192; v += 1024) steps.push(v);
  for (let v = 10240; v <= 40960; v += 2048) steps.push(v);
  return steps;
})();

const HDD_PRESETS: number[] = (() => {
  const steps: number[] = [];
  for (let v = 2; v <= 12; v += 2) steps.push(v);
  for (let v = 16; v <= 24; v += 4) steps.push(v);
  for (let v = 32; v <= 64; v += 8) steps.push(v);
  for (let v = 80; v <= 128; v += 16) steps.push(v);
  return steps;
})();

function snapToStep(value: number, steps: number[]): number {
  let closest = steps[0]!;
  let minDiff = Math.abs(value - closest);
  for (const step of steps) {
    const diff = Math.abs(value - step);
    if (diff < minDiff) {
      minDiff = diff;
      closest = step;
    }
  }
  return closest;
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  mydefaults:
    "Loads settings from /usr/local/community-scripts/default.vars on the Proxmox host",
  appdefaults:
    "Loads app-specific defaults — requires the App Defaults file to exist on the host",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function installPathPrefix(typeSlug: string | undefined): string {
  const t = (typeSlug ?? "ct").trim().toLowerCase();
  switch (t === "lxc" ? "ct" : t) {
    case "pve":
      return "tools/pve";
    case "addon":
      return "tools/addon";
    case "vm":
      return "vm";
    case "turnkey":
      return "turnkey";
    default:
      return "ct";
  }
}

function getDefaultInstallPath(
  typeSlug: string | undefined,
  slug: string,
): string {
  return `${installPathPrefix(typeSlug)}/${slug}.sh`;
}

function getAlpineInstallPath(
  typeSlug: string | undefined,
  slug: string,
): string | null {
  const t = (typeSlug ?? "ct").trim().toLowerCase();
  if (t !== "ct" && t !== "lxc") return null;
  const base = slug.startsWith("alpine-") ? slug : `alpine-${slug}`;
  return `ct/${base}.sh`;
}

function formatRam(mb: number): string {
  if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024} GB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InstallDefaults {
  cpu: number;
  ram: number;
  hdd: number;
}

export interface InstallCommandBlockProps {
  scriptType: string;
  slug: string;
  scriptName: string;
  isDev?: boolean;
  hasAlpine: boolean;
  defaults?: InstallDefaults;
  hasArm?: boolean;
  /** Whether the script has local files loaded */
  hasLocalFiles?: boolean;
  /** Called when the inline terminal opens or closes */
  onTerminalChange?: (active: boolean) => void;
  /** Environments the script must execute in (from script.execute_in) */
  executeIn?: string[] | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InstallCommandBlock({
  scriptType,
  slug,
  scriptName,
  isDev = false,
  hasAlpine,
  defaults,
  hasArm = false,
  hasLocalFiles = false,
  onTerminalChange,
  executeIn,
}: InstallCommandBlockProps) {
  const [env, setEnv] = useState<InstallEnv>("default");
  const [armEnabled, setArmEnabled] = useState(false);

  // Server selection state
  const { open: openShell } = useShell();

  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerType | null>(null);
  const [serversLoading, setServersLoading] = useState(false);

  const scriptTypeNorm = (scriptType ?? "").toLowerCase();
  const isLxcType = scriptTypeNorm === "ct" || scriptTypeNorm === "lxc";
  const executionPolicy = (() => {
    const has = (v: string) => !!executeIn?.includes(v);
    const allowVm = has("vm");
    const allowLxcByMode =
      has("pbs") || has("pmg") || (has("lxc") && !isLxcType);
    const requiresContainer = allowVm || allowLxcByMode;
    const pinMode = has("pbs") ? "pbs" : has("pmg") ? "pmg" : null;
    return { requiresContainer, allowVm, allowLxcByMode, pinMode };
  })();

  // Container picker state driven by execute_in + script type policy
  const needsContainerPicker = executionPolicy.requiresContainer;
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null,
  );
  const [selectedContainerIsVm, setSelectedContainerIsVm] = useState(false);

  const containerQuery = api.installedScripts.listContainersOnServer.useQuery(
    { serverId: selectedServer?.id ?? 0 },
    { enabled: needsContainerPicker && !!selectedServer },
  );

  const containerOptions = (() => {
    if (!containerQuery.data) return [];
    const opts: {
      id: string;
      name: string;
      isVm: boolean;
      status?: string;
      pinned?: boolean;
    }[] = [];
    const wantLxc = executionPolicy.allowLxcByMode;
    const wantVm = executionPolicy.allowVm;

    if (wantLxc) {
      for (const c of containerQuery.data.lxc) {
        const lower = (c.name ?? "").toLowerCase();
        const pinned =
          executionPolicy.pinMode === "pbs"
            ? lower.includes("proxmox-backup-server")
            : executionPolicy.pinMode === "pmg"
              ? lower.includes("proxmox-mail-gateway")
              : false;
        opts.push({
          id: String(c.id),
          name: c.name ?? String(c.id),
          isVm: false,
          status: c.status,
          pinned,
        });
      }
    }

    if (wantVm) {
      for (const v of containerQuery.data.vm) {
        opts.push({
          id: String(v.id),
          name: v.name ?? String(v.id),
          isVm: true,
          status: v.status,
          pinned: false,
        });
      }
    }

    return opts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return parseInt(a.id, 10) - parseInt(b.id, 10);
    });
  })();

  // Floating terminal status (button feedback only)
  const [running, setRunning] = useState(false);

  // Fetch servers when local files are available
  useEffect(() => {
    if (!hasLocalFiles) return;
    setServersLoading(true);
    fetch("/api/servers")
      .then((res) => res.json())
      .then((data: ServerType[]) => {
        const sorted = data.sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? ""),
        );
        setServers(sorted);
        if (sorted.length === 1) setSelectedServer(sorted[0] ?? null);
      })
      .catch(() => setServers([]))
      .finally(() => setServersLoading(false));
  }, [hasLocalFiles]);

  const [advCpu, setAdvCpu] = useState(
    snapToStep(defaults?.cpu ?? 1, CPU_PRESETS),
  );
  const [advRam, setAdvRam] = useState(
    snapToStep(defaults?.ram ?? 512, RAM_PRESETS),
  );
  const [advHdd, setAdvHdd] = useState(
    snapToStep(defaults?.hdd ?? 2, HDD_PRESETS),
  );

  const isAddonScript = scriptTypeNorm === "addon";
  const showAdvanced = isLxcType || isAddonScript;

  const canUseDefaultsTabs = isLxcType;

  useEffect(() => {
    if (
      !canUseDefaultsTabs &&
      (env === "mydefaults" || env === "appdefaults")
    ) {
      setEnv("default");
    }
  }, [canUseDefaultsTabs, env]);

  const defaultPath = getDefaultInstallPath(scriptType, slug);
  const alpinePath = getAlpineInstallPath(scriptType, slug);

  const hasOverrides =
    env === "advanced" &&
    defaults &&
    (advCpu !== defaults.cpu ||
      advRam !== defaults.ram ||
      advHdd !== defaults.hdd);

  const handleInstall = () => {
    if (!selectedServer) return;
    if (needsContainerPicker && !selectedContainerId) return;

    // Derive script path based on env selection
    let scriptFile = defaultPath;
    if (env === "alpine" && hasAlpine && alpinePath) {
      scriptFile = alpinePath;
    }
    const scriptPath = `scripts/${scriptFile}`;

    // Build envVars from form state
    const envVars: Record<string, string> = {};

    if (env === "mydefaults") {
      envVars.mode = "mydefaults";
    } else if (env === "appdefaults") {
      envVars.mode = "appdefaults";
    } else if (env === "advanced" && defaults) {
      // Custom sliders
      envVars.mode = "generated";
      envVars.var_cpu = String(advCpu);
      envVars.var_ram = String(advRam);
      envVars.var_disk = String(advHdd);
    } else {
      // Default or Alpine — skip dialog with mode=default
      envVars.mode = "default";
    }

    if (hasArm && armEnabled) envVars.var_arm = "true";

    const execInContainer = needsContainerPicker && !!selectedContainerId;

    setRunning(true);
    onTerminalChange?.(true);

    openShell({
      sessionKey: `install-${slug}-${Date.now()}`,
      title: `${scriptName}.sh (${selectedServer.name})`,
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
      onComplete: () => {
        setRunning(false);
        onTerminalChange?.(false);
      },
    });
  };

  return (
    <section className="glass-card-static space-y-3 rounded-2xl border p-5">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.1em] uppercase">
        Install
      </h2>

      {/* Install mode tabs */}
      <fieldset className="m-0 flex border-0 p-0">
        <legend className="sr-only">Install mode</legend>
        <div className="bg-muted/40 flex flex-wrap rounded-lg p-0.5">
          <OptionToggle
            selected={env === "default"}
            onClick={() => setEnv("default")}
            label="Default"
          />
          {canUseDefaultsTabs && (
            <OptionToggle
              selected={env === "mydefaults"}
              onClick={() => setEnv("mydefaults")}
              label="My Defaults"
              title={MODE_DESCRIPTIONS.mydefaults}
            />
          )}
          {canUseDefaultsTabs && (
            <OptionToggle
              selected={env === "appdefaults"}
              onClick={() => setEnv("appdefaults")}
              label="App Defaults"
              title={MODE_DESCRIPTIONS.appdefaults}
            />
          )}
          {hasAlpine && (
            <OptionToggle
              selected={env === "alpine"}
              onClick={() => setEnv("alpine")}
              label="Alpine"
            />
          )}
          {showAdvanced && defaults && (
            <OptionToggle
              selected={env === "advanced"}
              onClick={() => setEnv("advanced")}
              label="Advanced"
              icon={<Settings className="h-3 w-3" />}
            />
          )}
          {hasArm && (
            <OptionToggle
              selected={armEnabled}
              onClick={() => setArmEnabled((e) => !e)}
              label="ARM"
            />
          )}
        </div>
      </fieldset>

      {/* Advanced configurator */}
      {env === "advanced" && defaults && (
        <div className="border-border bg-muted/20 rounded-xl border p-3.5 dark:bg-white/[0.02]">
          {/* Custom resource sliders */}
          <div className="space-y-3.5">
            <PresetSlider
              label="CPU"
              icon={<Cpu className="text-primary h-3 w-3" />}
              presets={CPU_PRESETS}
              value={advCpu}
              onChange={setAdvCpu}
              defaultValue={defaults.cpu}
              format={(v) => `${v} Core${v !== 1 ? "s" : ""}`}
            />
            <PresetSlider
              label="RAM"
              icon={<Server className="text-primary h-3 w-3" />}
              presets={RAM_PRESETS}
              value={advRam}
              onChange={setAdvRam}
              defaultValue={defaults.ram}
              format={formatRam}
            />
            <PresetSlider
              label="Disk"
              icon={<HardDrive className="text-primary h-3 w-3" />}
              presets={HDD_PRESETS}
              value={advHdd}
              onChange={setAdvHdd}
              defaultValue={defaults.hdd}
              format={(v) => `${v} GB`}
            />
          </div>

          {hasOverrides && (
            <button
              type="button"
              className="text-primary mt-3 text-[0.6875rem] font-medium hover:underline"
              onClick={() => {
                setAdvCpu(defaults.cpu);
                setAdvRam(defaults.ram);
                setAdvHdd(defaults.hdd);
              }}
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}

      <p className="text-muted-foreground text-sm">
        {env === "alpine" && hasAlpine
          ? "Alpine Linux — faster creation, minimal resources."
          : env === "mydefaults"
            ? MODE_DESCRIPTIONS.mydefaults
            : env === "appdefaults"
              ? MODE_DESCRIPTIONS.appdefaults
              : env === "advanced"
                ? "Customize resources below, then select a node and install."
                : `Select a node below to install ${scriptName}.`}
      </p>

      {/* DEV warning */}
      {isDev && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Development script — may be unstable or incomplete.</span>
        </div>
      )}

      {/* Node + Container bubbles + Install */}
      {hasLocalFiles && (
        <div className="border-border/60 space-y-3 border-t pt-3">
          {serversLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading nodes…
            </div>
          ) : servers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No servers configured. Add servers in Settings.
            </p>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Select Node
                </p>
                <div className="flex flex-wrap gap-2">
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
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      <span className="truncate">
                        {s.name} ({s.ip})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {needsContainerPicker && selectedServer && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    Select Container
                  </p>
                  {containerQuery.isLoading ? (
                    <p className="text-muted-foreground text-xs">
                      Loading containers…
                    </p>
                  ) : containerOptions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No matching containers found on this node.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {containerOptions.map((c) => (
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
                          <span className="truncate">{c.name}</span>
                          <span className="text-muted-foreground/60">
                            #{c.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={
                    !selectedServer ||
                    running ||
                    (needsContainerPicker && !selectedContainerId)
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  {running ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {running ? "Running…" : "Install"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OptionToggle({
  selected,
  onClick,
  label,
  icon,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
        selected
          ? "bg-primary/15 text-primary ring-primary/30 ring-1"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PresetSlider({
  label,
  icon,
  presets,
  value,
  onChange,
  defaultValue,
  format,
}: {
  label: string;
  icon: React.ReactNode;
  presets: number[];
  value: number;
  onChange: (v: number) => void;
  defaultValue: number;
  format: (v: number) => string;
}) {
  const idx = (() => {
    const exactIdx = presets.indexOf(value);
    if (exactIdx >= 0) return exactIdx;
    let closest = 0;
    let minDiff = Math.abs(value - presets[0]!);
    for (let i = 1; i < presets.length; i++) {
      const diff = Math.abs(value - presets[i]!);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    return closest;
  })();

  const displayLabels = presets;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {icon} {label}
        </span>
        <span className="text-foreground text-[0.75rem] font-bold">
          {format(value)}
          {value === defaultValue && (
            <span className="text-muted-foreground ml-1 text-[0.5625rem] font-medium">
              (default)
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={presets.length - 1}
        value={idx}
        onChange={(e) => onChange(presets[Number(e.target.value)]!)}
        className="accent-primary h-1.5 w-full cursor-pointer"
      />
      <div className="relative mt-0.5 h-3">
        {displayLabels.map((p, i, arr) => {
          const pIdx = presets.indexOf(p);
          if (pIdx < 0) return null;
          const pct =
            presets.length > 1 ? (pIdx / (presets.length - 1)) * 100 : 0;
          const isFirst = i === 0;
          const isLast = i === arr.length - 1;
          // Only show landmark labels (subset) to avoid clutter
          const isLandmark =
            isFirst || isLast || p === value || p === defaultValue;
          if (!isLandmark) return null;
          return (
            <span
              key={p}
              className={`absolute text-[0.5625rem] leading-none tabular-nums ${
                isFirst ? "" : isLast ? "-translate-x-full" : "-translate-x-1/2"
              } ${
                p === value
                  ? "text-primary font-bold"
                  : p === defaultValue
                    ? "text-muted-foreground/80"
                    : "text-muted-foreground/60"
              }`}
              style={{ left: `${pct}%` }}
            >
              {format(p)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
