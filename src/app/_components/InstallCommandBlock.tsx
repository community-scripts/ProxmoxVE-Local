"use client";

import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  HardDrive,
  Server,
  Settings,
  Info,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Server as ServerType } from "~/types/server";
import { Terminal } from "./Terminal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type InstallSource = "github" | "gitea";
type InstallEnv = "default" | "alpine" | "advanced";

const GITEA_INFO =
  "When to use Gitea: GitHub may have issues including slow connections, delayed updates after bug fixes, no IPv6 support, API rate limits (60/hour). Use our Gitea mirror as a reliable alternative when experiencing these issues.";

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

const INSTALL_MODES = [
  { value: "" as const, label: "Custom" },
  { value: "mydefaults" as const, label: "My Defaults" },
  { value: "appdefaults" as const, label: "App Defaults" },
] as const;
type InstallMode = (typeof INSTALL_MODES)[number]["value"];

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
}: InstallCommandBlockProps) {
  const [source, setSource] = useState<InstallSource>("github");
  const [env, setEnv] = useState<InstallEnv>("default");
  const [installMode, setInstallMode] = useState<InstallMode>("");
  const [armEnabled, setArmEnabled] = useState(false);

  // Server selection state
  const [servers, setServers] = useState<ServerType[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerType | null>(null);
  const [serversLoading, setServersLoading] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);

  // Inline terminal state
  const [running, setRunning] = useState<{
    scriptPath: string;
    envVars: Record<string, string>;
    server: ServerType;
  } | null>(null);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

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

  const showAdvanced = scriptType === "ct" || scriptType === "lxc";

  const defaultPath = getDefaultInstallPath(scriptType, slug);
  const alpinePath = getAlpineInstallPath(scriptType, slug);

  const hasOverrides =
    env === "advanced" &&
    defaults &&
    !installMode &&
    (advCpu !== defaults.cpu ||
      advRam !== defaults.ram ||
      advHdd !== defaults.hdd);

  const handleInstall = () => {
    if (!selectedServer) return;

    // Derive script path based on env selection
    let scriptFile = defaultPath;
    if (env === "alpine" && hasAlpine && alpinePath) {
      scriptFile = alpinePath;
    }
    const scriptPath = `scripts/${scriptFile}`;

    // Build envVars from form state
    const envVars: Record<string, string> = {};

    if (env === "advanced" && defaults) {
      if (installMode) {
        // mydefaults / appdefaults
        envVars.mode = installMode;
      } else {
        // Custom sliders — use "generated" to skip all dialogs
        envVars.mode = "generated";
        envVars.var_cpu = String(advCpu);
        envVars.var_ram = String(advRam);
        envVars.var_disk = String(advHdd);
      }
    } else {
      // Default or Alpine — skip dialog with mode=default
      envVars.mode = "default";
    }

    if (hasArm && armEnabled) envVars.var_arm = "true";

    setRunning({ scriptPath, envVars, server: selectedServer });
    setTerminalCollapsed(false);
    onTerminalChange?.(true);

    // Scroll into view after a tick
    setTimeout(() => {
      terminalRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  };

  const handleCloseTerminal = () => {
    setRunning(null);
    onTerminalChange?.(false);
  };

  return (
    <section className="glass-card-static space-y-3 rounded-2xl border p-5">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.1em] uppercase">
        Install
      </h2>

      {/* Source + Env toggles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <fieldset className="m-0 flex border-0 p-0">
          <legend className="sr-only">Install source</legend>
          <div className="bg-muted/40 flex rounded-lg p-0.5">
            <OptionToggle
              selected={source === "github"}
              onClick={() => setSource("github")}
              label="GitHub"
            />
            <OptionToggle
              selected={source === "gitea"}
              onClick={() => setSource("gitea")}
              label="Gitea"
            />
          </div>
        </fieldset>

        <div className="bg-border hidden h-4 w-px sm:block" aria-hidden />

        <fieldset className="m-0 flex border-0 p-0">
          <legend className="sr-only">Install mode</legend>
          <div className="bg-muted/40 flex rounded-lg p-0.5">
            <OptionToggle
              selected={env === "default"}
              onClick={() => setEnv("default")}
              label="Default"
            />
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
      </div>

      {/* Gitea info */}
      {source === "gitea" && (
        <div className="text-muted-foreground bg-muted/30 border-border flex gap-2 rounded-md border px-3 py-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{GITEA_INFO}</p>
        </div>
      )}

      {/* Advanced configurator */}
      {env === "advanced" && defaults && (
        <div className="border-border bg-muted/20 rounded-xl border p-3.5 dark:bg-white/[0.02]">
          {/* Install mode pills */}
          <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-[0.625rem] font-semibold tracking-wider uppercase">
              Mode
            </span>
            {INSTALL_MODES.map(({ value, label }) => (
              <button
                type="button"
                key={value || "custom"}
                title={MODE_DESCRIPTIONS[value]}
                onClick={() => setInstallMode(value)}
                className={`rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium transition-colors ${
                  installMode === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sliders — only in Custom mode */}
          {!installMode && (
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
          )}

          {/* Mode note */}
          {installMode && MODE_DESCRIPTIONS[installMode] && (
            <p className="text-muted-foreground mt-2 text-[0.6875rem]">
              {MODE_DESCRIPTIONS[installMode]}
            </p>
          )}

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

      {/* Server selector + Install button */}
      {hasLocalFiles && (
        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3">
          {serversLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading servers…
            </div>
          ) : servers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No servers configured. Add servers in Settings.
            </p>
          ) : (
            <>
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setServerDropdownOpen((o) => !o)}
                  className="border-border bg-background text-foreground hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    {selectedServer ? (
                      <>
                        {selectedServer.color && (
                          <span
                            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{
                              backgroundColor: selectedServer.color,
                            }}
                          />
                        )}
                        <span className="truncate">
                          {selectedServer.name} ({selectedServer.ip})
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Select node…
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${serverDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {serverDropdownOpen && (
                  <div className="border-border bg-card absolute right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border shadow-lg">
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedServer(s);
                          setServerDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          selectedServer?.id === s.id
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        {s.color && (
                          <span
                            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                        )}
                        <span className="truncate">
                          {s.name} ({s.ip}) — {s.user}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleInstall}
                disabled={!selectedServer || !!running}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {running ? "Running…" : "Install"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline Terminal — collapsible, breaks out of card padding */}
      {running && (
        <div
          ref={terminalRef}
          className="border-border/60 -mx-5 -mb-5 space-y-0 border-t"
        >
          <button
            type="button"
            onClick={() => setTerminalCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/40 flex w-full items-center gap-1 px-5 py-2 text-xs font-medium transition-colors"
          >
            {terminalCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            Console Output
          </button>
          {!terminalCollapsed && (
            <Terminal
              scriptPath={running.scriptPath}
              onClose={handleCloseTerminal}
              mode="ssh"
              server={running.server}
              envVars={running.envVars}
            />
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
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
