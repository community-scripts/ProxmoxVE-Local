"use client";

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
    <div className="bg-card rounded-lg p-4 shadow sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search scripts, container IDs, or servers..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-border bg-card text-foreground placeholder-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Filter Dropdowns - Responsive Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(
                e.target.value as "all" | "success" | "failed" | "in_progress",
              )
            }
            className="border-border bg-card text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="in_progress">In Progress</option>
          </select>

          <select
            value={serverFilter}
            onChange={(e) => onServerFilterChange(e.target.value)}
            className="border-border bg-card text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
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
    </div>
  );
}
