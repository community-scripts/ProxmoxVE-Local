"use client";

import { api } from "~/trpc/react";

/**
 * Shows the reachability of configured Proxmox hosts.
 * Green pulsing dot = all online, amber = some offline, red = all offline, grey = no servers.
 * Hover for per-server breakdown.
 */
export function ServerStatusIndicator() {
  const { data, isLoading } = api.servers.checkServersStatus.useQuery(
    undefined,
    { refetchInterval: 30_000, staleTime: 20_000 },
  );

  const servers = data?.servers ?? [];

  if (isLoading || servers.length === 0) {
    // No servers configured — grey neutral dot
    return (
      <span
        className="bg-muted-foreground/40 relative inline-block h-2.5 w-2.5 rounded-full"
        title={isLoading ? "Checking servers…" : "No Proxmox hosts configured"}
      />
    );
  }

  const onlineCount = servers.filter((s) => s.online).length;
  const allOnline = onlineCount === servers.length;
  const allOffline = onlineCount === 0;

  const color = allOnline
    ? "bg-emerald-500"
    : allOffline
      ? "bg-red-500"
      : "bg-amber-500";
  const pingColor = allOnline
    ? "bg-emerald-400"
    : allOffline
      ? "bg-red-400"
      : "bg-amber-400";

  const tooltip = servers
    .map((s) => `${s.name} (${s.ip}): ${s.online ? "✓ online" : "✗ offline"}`)
    .join("\n");

  return (
    <span
      className={`relative inline-block h-2.5 w-2.5 rounded-full ${color}`}
      title={tooltip}
    >
      <span
        className={`absolute inset-0 animate-ping rounded-full opacity-75 ${pingColor}`}
      />
    </span>
  );
}
