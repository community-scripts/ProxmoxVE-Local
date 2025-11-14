import type { FilterState } from "./FilterBar";

/**
 * Returns the default FilterState with all properties initialized.
 * This serves as the single source of truth for default filter values.
 */
export function getDefaultFilters(): FilterState {
  return {
    searchQuery: "",
    showUpdatable: null,
    selectedTypes: [],
    selectedRepositories: [],
    sortBy: "name",
    sortOrder: "asc",
  };
}

/**
 * Merges saved filters with defaults, ensuring all FilterState properties exist.
 * This prevents crashes when loading old saved filters that are missing new properties.
 * 
 * @param savedFilters - Partial or undefined saved filters from storage
 * @returns Complete FilterState with all properties guaranteed to exist
 */
export function mergeFiltersWithDefaults(
  savedFilters: Partial<FilterState> | undefined
): FilterState {
  const defaults = getDefaultFilters();
  
  if (!savedFilters) {
    return defaults;
  }
  
  // Merge saved filters with defaults, ensuring all properties exist
  return {
    searchQuery: savedFilters.searchQuery ?? defaults.searchQuery,
    showUpdatable: savedFilters.showUpdatable ?? defaults.showUpdatable,
    selectedTypes: savedFilters.selectedTypes ?? defaults.selectedTypes,
    selectedRepositories: savedFilters.selectedRepositories ?? defaults.selectedRepositories,
    sortBy: savedFilters.sortBy ?? defaults.sortBy,
    sortOrder: savedFilters.sortOrder ?? defaults.sortOrder,
  };
}

