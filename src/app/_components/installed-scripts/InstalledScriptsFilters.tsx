"use client";

import { Search } from "lucide-react";

interface InstalledScriptsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "success" | "failed" | "in_progress";
  onStatusFilterChange: (
    value: "all" | "success" | "failed" | "in_progress",
  ) => void;
  serverFilter: string;
  onServerFilterChange: (value: string) => void;
  uniqueServers: string[];
}

export function InstalledScriptsFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serverFilter,
  onServerFilterChange,
  uniqueServers,
}: InstalledScriptsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search scripts, container IDs, or servers…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
        />
      </div>

      {/* Filter Selects */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusFilterChange(
              e.target.value as "all" | "success" | "failed" | "in_progress",
            )
          }
          className="border-border bg-background text-foreground focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none sm:w-40"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="in_progress">In Progress</option>
        </select>

        <select
          value={serverFilter}
          onChange={(e) => onServerFilterChange(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none sm:w-40"
        >
          <option value="all">All Servers</option>
          <option value="local">Local</option>
          {uniqueServers.map((server) => (
            <option key={server} value={server}>
              {server}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
