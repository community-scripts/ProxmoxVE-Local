"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Copy,
  Check,
  Cpu,
  HardDrive,
  Server,
  Settings,
  AlertTriangle,
  Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants (mirrors ProxmoxVE-Frontend/lib/install-command.ts)
// ---------------------------------------------------------------------------

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main";
const GITEA_RAW_BASE =
  "https://git.community-scripts.org/community-scripts/ProxmoxVE/raw/branch/main";
const GITHUB_RAW_BASE_DEV =
  "https://raw.githubusercontent.com/community-scripts/ProxmoxVED/main";
const GITEA_RAW_BASE_DEV =
  "https://git.community-scripts.org/community-scripts/ProxmoxVED/raw/branch/main";

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

function buildCommand(url: string): string {
  return `bash -c "$(curl -fsSL ${url})"`;
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
}: InstallCommandBlockProps) {
  const [source, setSource] = useState<InstallSource>("github");
  const [env, setEnv] = useState<InstallEnv>("default");
  const [copied, setCopied] = useState(false);
  const [installMode, setInstallMode] = useState<InstallMode>("");
  const [devConfirmed, setDevConfirmed] = useState(false);
  const [armEnabled, setArmEnabled] = useState(false);

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

  const baseCommand = useMemo(() => {
    const ghBase = isDev ? GITHUB_RAW_BASE_DEV : GITHUB_RAW_BASE;
    const gtBase = isDev ? GITEA_RAW_BASE_DEV : GITEA_RAW_BASE;
    const base = source === "github" ? ghBase : gtBase;

    if (env === "alpine" && hasAlpine && alpinePath) {
      return buildCommand(`${base}/${alpinePath}`);
    }
    return buildCommand(`${base}/${defaultPath}`);
  }, [env, hasAlpine, source, isDev, defaultPath, alpinePath]);

  const command = useMemo(() => {
    if (env !== "advanced" || !defaults) return baseCommand;

    if (installMode) {
      return `mode=${installMode} ${baseCommand}`;
    }

    const overrides: string[] = [];
    if (advCpu !== defaults.cpu) overrides.push(`var_cpu="${advCpu}"`);
    if (advRam !== defaults.ram) overrides.push(`var_ram="${advRam}"`);
    if (advHdd !== defaults.hdd) overrides.push(`var_disk="${advHdd}"`);

    if (overrides.length === 0) return baseCommand;
    return `${overrides.join(" ")} ${baseCommand}`;
  }, [env, baseCommand, defaults, advCpu, advRam, advHdd, installMode]);

  const displayCommand = useMemo(
    () => (hasArm && armEnabled ? `var_arm="true" ${command}` : command),
    [hasArm, armEnabled, command],
  );

  const hasOverrides =
    env === "advanced" &&
    defaults &&
    !installMode &&
    (advCpu !== defaults.cpu ||
      advRam !== defaults.ram ||
      advHdd !== defaults.hdd);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }, [displayCommand]);

  const instruction =
    env === "alpine" && hasAlpine
      ? `As an alternative option, you can use Alpine Linux to create a container with faster creation time and minimal system resource usage.`
      : env === "advanced"
        ? "Customize the resources below. The generated command will override the script defaults."
        : `Run the command below in the Proxmox VE Shell to install ${scriptName}.`;

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

      <p className="text-muted-foreground text-sm">{instruction}</p>

      {/* DEV gate */}
      {isDev && !devConfirmed ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Development script
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                This script is in active development and may be unstable,
                incomplete, or subject to breaking changes. It is{" "}
                <strong>not recommended for production use</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDevConfirmed(true)}
            className="bg-card mt-3 flex items-center gap-2 self-start rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:border-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
          >
            I understand — show install command →
          </button>
        </div>
      ) : (
        /* Command display */
        <div className="group relative overflow-hidden rounded-lg bg-[#0c0e14]">
          <code className="block overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed sm:text-sm">
            <HighlightedCommand command={displayCommand} />
          </code>
          <button
            onClick={() => void handleCopy()}
            className="absolute top-2 right-2 rounded-md border border-white/10 bg-white/5 p-1.5 text-white/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
            title={copied ? "Copied!" : "Copy command"}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
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

function HighlightedCommand({ command }: { command: string }) {
  const parts: React.ReactNode[] = [];
  let rest = command;

  /* Strip leading env var tokens: mode=xxx or var_xxx="yyy" */
  const envRe = /^((?:(?:mode=\S+|var_\w+="[^"]*")\s+)+)/;
  const envMatch = rest.match(envRe);
  if (envMatch?.[1]) {
    const envStr = envMatch[1];
    rest = rest.slice(envStr.length);
    const tokens = envStr.trim().split(/\s+/);
    for (const token of tokens) {
      if (token.startsWith("mode=")) {
        parts.push(
          <span
            key={`m-${token}`}
            className="text-amber-400 dark:text-amber-300"
          >
            {token}
          </span>,
        );
      } else {
        parts.push(
          <span key={`v-${token}`} className="text-primary">
            {token}
          </span>,
        );
      }
      parts.push(" ");
    }
  }

  /* Highlight URL */
  const urlRe = /(https?:\/\/[^\s"')]+)/;
  const urlMatch = rest.match(urlRe);
  if (urlMatch?.index !== undefined) {
    const before = rest.slice(0, urlMatch.index);
    const url = urlMatch[1]!;
    const after = rest.slice(urlMatch.index + url.length);
    parts.push(
      <span key="b" className="text-muted-foreground">
        {before}
      </span>,
    );
    parts.push(
      <a
        key="u"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer text-sky-500 hover:underline dark:text-sky-400"
      >
        {url}
      </a>,
    );
    parts.push(
      <span key="a" className="text-muted-foreground">
        {after}
      </span>,
    );
  } else {
    parts.push(
      <span key="r" className="text-foreground">
        {rest}
      </span>,
    );
  }

  return <>{parts}</>;
}
