"use client";

import React, { useState } from "react";

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
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-5 w-5 text-gray-400 dark:text-gray-500"
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
            className="block w-full rounded-lg border border-gray-300 bg-white py-3 pr-10 pl-10 text-sm leading-5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:placeholder-gray-300 dark:focus:ring-blue-400"
          />
          {filters.searchQuery && (
            <button
              onClick={() => updateFilters({ searchQuery: "" })}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
            </button>
          )}
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-4 flex flex-wrap gap-3">
        {/* Updateable Filter */}
        <button
          onClick={() => {
            const next =
              filters.showUpdatable === null
                ? true
                : filters.showUpdatable === true
                  ? false
                  : null;
            updateFilters({ showUpdatable: next });
          }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filters.showUpdatable === null
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              : filters.showUpdatable === true
                ? "border border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-200"
                : "border border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200"
          }`}
        >
          {getUpdatableButtonText()}
        </button>

        {/* Type Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filters.selectedTypes.length === 0
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                : "border border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200"
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
          </button>

          {isTypeDropdownOpen && (
            <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="p-2">
                {SCRIPT_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex cursor-pointer items-center space-x-3 rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                    />
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="border-t border-gray-200 p-2 dark:border-gray-700">
                <button
                  onClick={() => {
                    updateFilters({ selectedTypes: [] });
                    setIsTypeDropdownOpen(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                  Clear all
                </button>
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
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:focus:ring-blue-400"
          >
            <option value="name">📝 By Name</option>
            <option value="created">📅 By Created Date</option>
          </select>

          {/* Sort Order Button */}
          <button
            onClick={() =>
              updateFilters({
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
            className="flex items-center space-x-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
          </button>
        </div>
      </div>

      {/* Filter Summary and Clear All */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredCount === totalScripts ? (
            <span>Showing all {totalScripts} scripts</span>
          ) : (
            <span>
              {filteredCount} of {totalScripts} scripts{" "}
              {hasActiveFilters && (
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  (filtered)
                </span>
              )}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-1 rounded-md px-3 py-1 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
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
          </button>
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
