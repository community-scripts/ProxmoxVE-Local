"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useTranslation } from "~/lib/i18n/useTranslation";

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
  saveFiltersEnabled?: boolean;
  isLoadingFilters?: boolean;
}

const SCRIPT_TYPES = [
  { value: "ct", labelKey: "types.options.ct", Icon: Package },
  { value: "vm", labelKey: "types.options.vm", Icon: Monitor },
  { value: "addon", labelKey: "types.options.addon", Icon: Wrench },
  { value: "pve", labelKey: "types.options.pve", Icon: Server },
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
  const { t } = useTranslation("filterBar");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

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
    if (filters.showUpdatable === null) return t("updatable.all");
    if (filters.showUpdatable === true) {
      return t("updatable.yes", { values: { count: updatableCount } });
    }
    return t("updatable.no");
  };

  const getTypeButtonText = () => {
    if (filters.selectedTypes.length === 0) return t("types.all");
    if (filters.selectedTypes.length === 1) {
      const type = SCRIPT_TYPES.find(
        (t) => t.value === filters.selectedTypes[0],
      );
      return type ? t(type.labelKey) : filters.selectedTypes[0];
    }
    return t("types.multiple", {
      values: { count: filters.selectedTypes.length },
    });
  };

  return (
    <div className="border-border bg-card mb-6 rounded-lg border p-4 shadow-sm sm:p-6">
      {/* Loading State */}
      {isLoadingFilters && (
        <div className="mb-4 flex items-center justify-center py-2">
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
            <span>{t("loading")}</span>
          </div>
        </div>
      )}

      {/* Filter Header */}
      {!isLoadingFilters && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-foreground text-lg font-medium">{t("header")}</h3>
          <ContextualHelpIcon
            section="available-scripts"
            tooltip={t("helpTooltip")}
          />
        </div>
      )}

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
            placeholder={t("search.placeholder")}
            value={filters.searchQuery}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
            className="border-input bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:placeholder-muted-foreground focus:ring-primary block w-full rounded-lg border py-3 pr-10 pl-10 text-sm leading-5 focus:ring-2 focus:outline-none"
          />
          {filters.searchQuery && (
            <Button
              onClick={() => updateFilters({ searchQuery: "" })}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 pr-3"
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
                        {t(type.labelKey)}
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
                  {t("actions.clearAllTypes")}
                </Button>
              </div>
            </div>
          )}
        </div>

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
              {filters.sortBy === "name"
                ? t("sort.byName")
                : t("sort.byCreated")}
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
                  <span className="text-sm">{t("sort.byName")}</span>
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
                  <span className="text-sm">{t("sort.byCreated")}</span>
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
                {filters.sortBy === "created"
                  ? t("sort.oldestFirst")
                  : t("sort.aToZ")}
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
                {filters.sortBy === "created"
                  ? t("sort.newestFirst")
                  : t("sort.zToA")}
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
              <span>
                {t("summary.showingAll", { values: { count: totalScripts } })}
              </span>
            ) : (
              <span>
                {t("summary.showingFiltered", {
                  values: { filtered: filteredCount, total: totalScripts },
                })}{" "}
                {hasActiveFilters && (
                  <span className="text-info font-medium">
                    {t("summary.filteredSuffix")}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Filter Persistence Status */}
          {!isLoadingFilters && saveFiltersEnabled && (
            <div className="text-success flex items-center space-x-1 text-xs">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("persistence.enabled")}</span>
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
            <span>{t("actions.clearFilters")}</span>
          </Button>
        )}
      </div>

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
