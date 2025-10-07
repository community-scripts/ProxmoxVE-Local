"use client";

import React, { useState } from "react";
import { Button } from "./ui/button";

export interface FilterState {
  searchQuery: string;
  showUpdatable: boolean | null; // null = all, true = only updatable, false = only non-updatable
  selectedTypes: string[]; // Array of selected types: 'lxc', 'vm', 'addon', 'pve'
  sortBy: "name" | "created"; // Sort criteria (removed 'updated')
  sortOrder: "asc" | "desc"; // Sort direction
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalScripts: number;
  filteredCount: number;
  updatableCount?: number;
}

const SCRIPT_TYPES = [
  { value: "ct", label: "LXC Container", icon: "📦" },
  { value: "vm", label: "Virtual Machine", icon: "💻" },
  { value: "addon", label: "Add-on", icon: "🔧" },
  { value: "pve", label: "PVE Host", icon: "🖥️" },
];

export function FilterBar({
  filters,
  onFiltersChange,
  totalScripts,
  filteredCount,
  updatableCount = 0,
}: FilterBarProps) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: "",
      showUpdatable: null,
      selectedTypes: [],
      sortBy: "name",
      sortOrder: "asc",
    });
  };

  const hasActiveFilters =
    filters.searchQuery ||
    filters.showUpdatable !== null ||
    filters.selectedTypes.length > 0 ||
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
    <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-5 w-5 text-muted-foreground"
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
            className="block w-full rounded-lg border border-input bg-background py-3 pr-10 pl-10 text-sm leading-5 text-foreground placeholder-muted-foreground focus:border-primary focus:placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
          {filters.searchQuery && (
            <Button
              onClick={() => updateFilters({ searchQuery: "" })}
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-0 pr-3 text-muted-foreground hover:text-foreground"
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
      <div className="mb-4 flex flex-wrap gap-3">
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
            className={`${
              filters.showUpdatable === null
                ? "bg-muted text-muted-foreground hover:bg-accent"
                : filters.showUpdatable === true
                  ? "border border-green-500/20 bg-green-500/10 text-green-400"
                  : "border border-destructive/20 bg-destructive/10 text-destructive"
            }`}
        >
          {getUpdatableButtonText()}
        </Button>

        {/* Type Dropdown */}
        <div className="relative">
          <Button
            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            variant="outline"
            size="default"
            className={`flex items-center space-x-2 ${
              filters.selectedTypes.length === 0
                ? "bg-muted text-muted-foreground hover:bg-accent"
                : "border border-primary/20 bg-primary/10 text-primary"
            }`}
          >
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
            <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border border-border bg-card shadow-lg">
              <div className="p-2">
                {SCRIPT_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex cursor-pointer items-center space-x-3 rounded-md px-3 py-2 hover:bg-accent"
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
                      className="rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-sm text-muted-foreground">
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <Button
                  onClick={() => {
                    updateFilters({ selectedTypes: [] });
                    setIsTypeDropdownOpen(false);
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Clear all
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-2">
          {/* Sort By Dropdown */}
          <select
            value={filters.sortBy}
            onChange={(e) =>
              updateFilters({ sortBy: e.target.value as "name" | "created" })
            }
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="name">📝 By Name</option>
            <option value="created">📅 By Created Date</option>
          </select>

          {/* Sort Order Button */}
          <Button
            onClick={() =>
              updateFilters({
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
            variant="outline"
            size="default"
            className="flex items-center space-x-1 bg-muted text-muted-foreground hover:bg-accent"
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
      </div>

      {/* Filter Summary and Clear All */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredCount === totalScripts ? (
            <span>Showing all {totalScripts} scripts</span>
          ) : (
            <span>
              {filteredCount} of {totalScripts} scripts{" "}
              {hasActiveFilters && (
                <span className="font-medium text-blue-600">
                  (filtered)
                </span>
              )}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            onClick={clearAllFilters}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-1 text-red-600 hover:bg-red-50 hover:text-red-800"
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

      {/* Click outside to close dropdown */}
      {isTypeDropdownOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsTypeDropdownOpen(false)}
        />
      )}
    </div>
  );
}
