"use client";

import {
  Server,
  MonitorPlay,
  Activity,
  MonitorX,
  ServerCrash,
} from "lucide-react";

interface InstalledScriptsStatsProps {
  total: number;
  runningLxc: number;
  runningVm: number;
  stoppedLxc: number;
  stoppedVm: number;
}

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, colorClass, bgClass, icon }: StatCardProps) {
  return (
    <div className="bg-card border-border flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${colorClass}`}>
          {value}
        </p>
      </div>
      <div className={`rounded-lg p-2 ${bgClass}`}>{icon}</div>
    </div>
  );
}

export function InstalledScriptsStats({
  total,
  runningLxc,
  runningVm,
  stoppedLxc,
  stoppedVm,
}: InstalledScriptsStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className="col-span-2 lg:col-span-1">
        <StatCard
          label="Total Installed"
          value={total}
          colorClass="text-foreground"
          bgClass="bg-primary/10"
          icon={<Server className="text-primary h-5 w-5" />}
        />
      </div>
      <StatCard
        label="LXC Running"
        value={runningLxc}
        colorClass="text-success"
        bgClass="bg-success/10"
        icon={<MonitorPlay className="text-success h-5 w-5" />}
      />
      <StatCard
        label="VM Running"
        value={runningVm}
        colorClass="text-success"
        bgClass="bg-success/10"
        icon={<Activity className="text-success h-5 w-5" />}
      />
      <StatCard
        label="LXC Stopped"
        value={stoppedLxc}
        colorClass="text-error"
        bgClass="bg-error/10"
        icon={<MonitorX className="text-error h-5 w-5" />}
      />
      <StatCard
        label="VM Stopped"
        value={stoppedVm}
        colorClass="text-error"
        bgClass="bg-error/10"
        icon={<ServerCrash className="text-error h-5 w-5" />}
      />
    </div>
  );
}
