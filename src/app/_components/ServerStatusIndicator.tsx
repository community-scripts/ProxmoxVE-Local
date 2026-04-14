"use client";

import { api } from "~/trpc/react";

/**
 * Shows the reachability of each configured Proxmox host.
 * Displays per-node indicators with name: green = online, red = offline, grey = loading/none.
 */
export function ServerStatusIndicator() {
  const { data, isLoading } = api.servers.checkServersStatus.useQuery(
    undefined,
    { refetchInterval: 30_000, staleTime: 20_000 },
  );

  const servers: Array<{
    id: number;
    name: string;
    ip: string;
    online: boolean;
  }> =
    (data?.servers as Array<{
      id: number;
      name: string;
      ip: string;
      online: boolean;
    }>) ?? [];

  if (isLoading) {
    return (
      <span
        className="bg-muted-foreground/40 relative inline-block h-2.5 w-2.5 rounded-full"
        title="Checking servers…"
      />
    );
  }

  if (servers.length === 0) {
    return (
      <span
        className="bg-muted-foreground/40 relative inline-block h-2.5 w-2.5 rounded-full"
        title="No Proxmox hosts configured"
      />
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {servers.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-1.5"
          title={`${s.name} (${s.ip}): ${s.online ? "✓ online" : "✗ offline"}`}
        >
          <span
            className={`relative inline-block h-2 w-2 rounded-full ${
              s.online ? "bg-emerald-500" : "bg-red-500"
            }`}
          >
            {s.online && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
          </span>
          <span className="text-muted-foreground text-[11px] leading-none font-medium">
            {s.name}
          </span>
        </div>
      ))}
    </div>
  );
}
