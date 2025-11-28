"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import {
  Package,
  Monitor,
  Wrench,
  Server,
  FileText,
  Calendar,
  RefreshCw,
  Filter,
  GitBranch,
} from "lucide-react";
import { api } from "~/trpc/react";
import { getDefaultFilters } from "./filterUtils";

export interface FilterState {
  searchQuery: string;
  showUpdatable: boolean | null; // null = all, true = only updatable, false = only non-updatable
  selectedTypes: string[]; // Array of selected types: 'lxc', 'vm', 'addon', 'pve'
  selectedRepositories: string[]; // Array of selected repository URLs
  sortBy: "name" | "created"; // Sort criteria (removed 'updated')
  sortOrder: "asc" | "desc"; // Sort direction
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalScripts: number;
  filteredCount: number;
  updatableCount?: number;
  saveFiltersEnabled?: boolean;
  isLoadingFilters?: boolean;
}

const SCRIPT_TYPES = [
  { value: "ct", label: "LXC Container", Icon: Package },
  { value: "vm", label: "Virtual Machine", Icon: Monitor },
  { value: "addon", label: "Add-on", Icon: Wrench },
  { value: "pve", label: "PVE Host", Icon: Server },
];

export function FilterBar({
  filters,
  onFiltersChange,
  totalScripts,
  filteredCount,
  updatableCount = 0,
  saveFiltersEnabled = false,
  isLoadingFilters = false,
}: FilterBarProps) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Fetch enabled repositories
  const { data: enabledReposData } = api.repositories.getEnabled.useQuery();
  const enabledRepos = enabledReposData?.repositories ?? [];

  // Helper function to extract repository name from URL
  const getRepoName = (url: string): string => {
    try {
      const match = /github\.com\/([^\/]+)\/([^\/]+)/.exec(url);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange(getDefaultFilters());
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.showUpdatable !== null ||
    filters.selectedTypes.length > 0 ||
    filters.selectedRepositories.length > 0 ||
    filters.sortBy !== "name" ||
    filters.sortOrder !== "asc";

  const getUpdatableButtonText = () => {
    if (filters.showUpdatable === null) return "Updatable: All";
    if (filters.showUpdatable === true)
      return `Updatable: Yes (${updatableCount})`;
    return "Updatable: No";
  };

  const getTypeButtonText = () => {
    if (filters.selectedTypes.length === 0) return "All Types";
    if (filters.selectedTypes.length === 1) {
      const type = SCRIPT_TYPES.find(
        (t) => t.value === filters.selectedTypes[0],
      );
      return type?.label ?? filters.selectedTypes[0];
    }
    return `${filters.selectedTypes.length} Types`;
  };

  return (
    <div className="border-border bg-card mb-6 rounded-lg border p-4 shadow-sm sm:p-6">
      {/* Loading State */}
      {isLoadingFilters && (
        <div className="mb-4 flex items-center justify-center py-2">
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
            <span>Loading saved filters...</span>
          </div>
        </div>
      )}

      {/* Filter Header */}
      {!isLoadingFilters && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground text-lg font-medium">
            Filter Scripts
          </h3>
          <div className="flex items-center gap-2">
            <ContextualHelpIcon
              section="available-scripts"
              tooltip="Help with filtering and searching"
            />
            <Button
              onClick={() => setIsMinimized(!isMinimized)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              title={isMinimized ? "Expand filters" : "Minimize filters"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${isMinimized ? "" : "rotate-180"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {/* Filter Content - Conditionally rendered based on minimized state */}
      {!isMinimized && !isLoadingFilters && (
        <>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="text-muted-foreground h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search scripts..."
                value={filters.searchQuery}
                onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:placeholder-muted-foreground focus:ring-primary block w-full rounded-lg border py-3 pr-10 pl-10 text-sm leading-5 focus:ring-2 focus:outline-none"
              />
              {filters.searchQuery && (
                <Button
                  onClick={() => updateFilters({ searchQuery: "" })}
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex h-full items-center justify-center pr-3"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row sm:gap-3">
            {/* Updateable Filter */}
            <Button
              onClick={() => {
                const next =
                  filters.showUpdatable === null
                    ? true
                    : filters.showUpdatable === true
                      ? false
                      : null;
                updateFilters({ showUpdatable: next });
              }}
              variant="outline"
              size="default"
              className={`flex w-full items-center justify-center space-x-2 sm:w-auto ${
                filters.showUpdatable === null
                  ? "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  : filters.showUpdatable === true
                    ? "border-success/20 bg-success/10 text-success border"
                    : "border-destructive/20 bg-destructive/10 text-destructive border"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              <span>{getUpdatableButtonText()}</span>
            </Button>

            {/* Type Dropdown */}
            <div className="relative w-full sm:w-auto">
              <Button
                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                variant="outline"
                size="default"
                className={`flex w-full items-center justify-center space-x-2 ${
                  filters.selectedTypes.length === 0
                    ? "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    : "border-primary/20 bg-primary/10 text-primary border"
                }`}
              >
                <Filter className="h-4 w-4" />
                <span>{getTypeButtonText()}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${isTypeDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>

              {isTypeDropdownOpen && (
                <div className="border-border bg-card absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border shadow-lg">
                  <div className="p-2">
                    {SCRIPT_TYPES.map((type) => {
                      const IconComponent = type.Icon;
                      return (
                        <label
                          key={type.value}
                          className="hover:bg-accent flex cursor-pointer items-center space-x-3 rounded-md px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={filters.selectedTypes.includes(type.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateFilters({
                                  selectedTypes: [
                                    ...filters.selectedTypes,
                                    type.value,
                                  ],
                                });
                              } else {
                                updateFilters({
                                  selectedTypes: filters.selectedTypes.filter(
                                    (t) => t !== type.value,
                                  ),
                                });
                              }
                            }}
                            className="border-input text-primary focus:ring-primary rounded"
                          />
                          <IconComponent className="h-4 w-4" />
                          <span className="text-muted-foreground text-sm">
                            {type.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="border-border border-t p-2">
                    <Button
                      onClick={() => {
                        updateFilters({ selectedTypes: [] });
                        setIsTypeDropdownOpen(false);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:bg-accent hover:text-foreground w-full justify-start"
                    >
                      Clear all
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Repository Filter Buttons - Only show if more than one enabled repo */}
            {enabledRepos.length > 1 &&
              enabledRepos.map((repo) => {
                const repoUrl = String(repo.url);
                const isSelected =
                  filters.selectedRepositories.includes(repoUrl);
                return (
                  <Button
                    key={repo.id}
                    onClick={() => {
                      const currentSelected = filters.selectedRepositories;
                      if (isSelected) {
                        // Remove repository from selection
                        updateFilters({
                          selectedRepositories: currentSelected.filter(
                            (url) => url !== repoUrl,
                          ),
                        });
                      } else {
                        // Add repository to selection
                        updateFilters({
                          selectedRepositories: [...currentSelected, repoUrl],
                        });
                      }
                    }}
                    variant="outline"
                    size="default"
                    className={`flex w-full items-center justify-center space-x-2 sm:w-auto ${
                      isSelected
                        ? "border-primary/20 bg-primary/10 text-primary border"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <GitBranch className="h-4 w-4" />
                    <span>{getRepoName(repoUrl)}</span>
                  </Button>
                );
              })}

            {/* Sort By Dropdown */}
            <div className="relative w-full sm:w-auto">
              <Button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                variant="outline"
                size="default"
                className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-center space-x-2 sm:w-auto"
              >
                {filters.sortBy === "name" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                <span>
                  {filters.sortBy === "name" ? "By Name" : "By Created Date"}
                </span>
                <svg
                  className={`h-4 w-4 transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>

              {isSortDropdownOpen && (
                <div className="border-border bg-card absolute top-full left-0 z-10 mt-1 w-full rounded-lg border shadow-lg sm:w-48">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        updateFilters({ sortBy: "name" });
                        setIsSortDropdownOpen(false);
                      }}
                      className={`hover:bg-accent flex w-full items-center space-x-3 rounded-md px-3 py-2 text-left ${
                        filters.sortBy === "name"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">By Name</span>
                    </button>
                    <button
                      onClick={() => {
                        updateFilters({ sortBy: "created" });
                        setIsSortDropdownOpen(false);
                      }}
                      className={`hover:bg-accent flex w-full items-center space-x-3 rounded-md px-3 py-2 text-left ${
                        filters.sortBy === "created"
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">By Created Date</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sort Order Button */}
            <Button
              onClick={() =>
                updateFilters({
                  sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
                })
              }
              variant="outline"
              size="default"
              className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-center space-x-1 sm:w-auto"
            >
              {filters.sortOrder === "asc" ? (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                  <span>
                    {filters.sortBy === "created" ? "Oldest First" : "A-Z"}
                  </span>
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 13l-5 5m0 0l-5-5m5 5V6"
                    />
                  </svg>
                  <span>
                    {filters.sortBy === "created" ? "Newest First" : "Z-A"}
                  </span>
                </>
              )}
            </Button>
          </div>

          {/* Filter Summary and Clear All */}
          <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="text-muted-foreground text-sm">
                {filteredCount === totalScripts ? (
                  <span>Showing all {totalScripts} scripts</span>
                ) : (
                  <span>
                    {filteredCount} of {totalScripts} scripts{" "}
                    {hasActiveFilters && (
                      <span className="text-info font-medium">(filtered)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Filter Persistence Status */}
              {!isLoadingFilters && saveFiltersEnabled && (
                <div className="text-success flex items-center space-x-1 text-xs">
                  <svg
                    className="h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Filters are being saved automatically</span>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                onClick={clearAllFilters}
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/10 hover:text-error-foreground flex w-full items-center justify-center space-x-1 sm:w-auto sm:justify-start"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <span>Clear all filters</span>
              </Button>
            )}
          </div>
        </>
      )}

      {/* Click outside to close dropdowns */}
      {(isTypeDropdownOpen || isSortDropdownOpen) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setIsTypeDropdownOpen(false);
            setIsSortDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
}
