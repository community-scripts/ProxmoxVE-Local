'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '~/trpc/react';
import { ScriptCard } from './ScriptCard';
import { ScriptDetailModal } from './ScriptDetailModal';
import { CategorySidebar } from './CategorySidebar';
import { FilterBar, type FilterState } from './FilterBar';
import { Button } from './ui/button';
import type { ScriptCard as ScriptCardType } from '~/types/script';

export function DownloadedScriptsTab() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    showUpdatable: null,
    selectedTypes: [],
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [saveFiltersEnabled, setSaveFiltersEnabled] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: scriptCardsData, isLoading: githubLoading, error: githubError, refetch } = api.scripts.getScriptCardsWithCategories.useQuery();
  const { data: localScriptsData, isLoading: localLoading, error: localError } = api.scripts.getCtScripts.useQuery();
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: selectedSlug ?? '' },
    { enabled: !!selectedSlug }
  );

  // Load SAVE_FILTER setting and saved filters on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load SAVE_FILTER setting
        const saveFilterResponse = await fetch('/api/settings/save-filter');
        let saveFilterEnabled = false;
        if (saveFilterResponse.ok) {
          const saveFilterData = await saveFilterResponse.json();
          saveFilterEnabled = saveFilterData.enabled ?? false;
          setSaveFiltersEnabled(saveFilterEnabled);
        }

        // Load saved filters if SAVE_FILTER is enabled
        if (saveFilterEnabled) {
          const filtersResponse = await fetch('/api/settings/filters');
          if (filtersResponse.ok) {
            const filtersData = await filtersResponse.json();
            if (filtersData.filters) {
              setFilters(filtersData.filters as FilterState);
            }
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoadingFilters(false);
      }
    };

    void loadSettings();
  }, []);

  // Save filters when they change (if SAVE_FILTER is enabled)
  useEffect(() => {
    if (!saveFiltersEnabled || isLoadingFilters) return;

    const saveFilters = async () => {
      try {
        await fetch('/api/settings/filters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filters }),
        });
      } catch (error) {
        console.error('Error saving filters:', error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(() => void saveFilters(), 500);
    return () => clearTimeout(timeoutId);
  }, [filters, saveFiltersEnabled, isLoadingFilters]);

  // Extract categories from metadata
  const categories = React.useMemo((): string[] => {
    if (!scriptCardsData?.success || !scriptCardsData.metadata?.categories) return [];
    
    return (scriptCardsData.metadata.categories as any[])
      .filter((cat) => cat.id !== 0) // Exclude Miscellaneous for main list
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cat) => cat.name as string)
      .filter((name): name is string => typeof name === 'string');
  }, [scriptCardsData]);

  // Get GitHub scripts with download status (deduplicated)
  const combinedScripts = React.useMemo((): ScriptCardType[] => {
    if (!scriptCardsData?.success) return [];
    
    // Use Map to deduplicate by slug/name
    const scriptMap = new Map<string, ScriptCardType>();
    
    scriptCardsData.cards?.forEach(script => {
      if (script?.name && script?.slug) {
        // Use slug as unique identifier, only keep first occurrence
        if (!scriptMap.has(script.slug)) {
          scriptMap.set(script.slug, {
            ...script,
            source: 'github' as const,
            isDownloaded: false, // Will be updated by status check
            isUpToDate: false,   // Will be updated by status check
          });
        }
      }
    });

    return Array.from(scriptMap.values());
  }, [scriptCardsData]);

  // Update scripts with download status and filter to only downloaded scripts
  const downloadedScripts = React.useMemo((): ScriptCardType[] => {
    return combinedScripts
      .map(script => {
        if (!script?.name) {
          return script; // Return as-is if invalid
        }
        
        // Check if there's a corresponding local script
        const hasLocalVersion = localScriptsData?.scripts?.some(local => {
          if (!local?.name) return false;
          const localName = local.name.replace(/\.sh$/, '');
          return localName.toLowerCase() === script.name.toLowerCase() || 
                 localName.toLowerCase() === (script.slug ?? '').toLowerCase();
        }) ?? false;
        
        return {
          ...script,
          isDownloaded: hasLocalVersion,
        };
      })
      .filter(script => script.isDownloaded); // Only show downloaded scripts
  }, [combinedScripts, localScriptsData]);

  // Count scripts per category (using downloaded scripts only)
  const categoryCounts = React.useMemo((): Record<string, number> => {
    if (!scriptCardsData?.success) return {};
    
    const counts: Record<string, number> = {};
    
    // Initialize all categories with 0
    categories.forEach((categoryName: string) => {
      counts[categoryName] = 0;
    });
    
    // Count each unique downloaded script only once per category
    downloadedScripts.forEach(script => {
      if (script.categoryNames && script.slug) {
        const countedCategories = new Set<string>();
        script.categoryNames.forEach((categoryName: unknown) => {
          if (typeof categoryName === 'string' && counts[categoryName] !== undefined && !countedCategories.has(categoryName)) {
            countedCategories.add(categoryName);
            counts[categoryName]++;
          }
        });
      }
    });
    
    return counts;
  }, [categories, downloadedScripts, scriptCardsData?.success]);

  // Filter scripts based on all filters and category
  const filteredScripts = React.useMemo((): ScriptCardType[] => {
    let scripts = downloadedScripts;

    // Filter by search query
    if (filters.searchQuery?.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      
      if (query.length >= 1) {
        scripts = scripts.filter(script => {
          if (!script || typeof script !== 'object') {
            return false;
          }

          const name = (script.name ?? '').toLowerCase();
          const slug = (script.slug ?? '').toLowerCase();

          return name.includes(query) ?? slug.includes(query);
        });
      }
    }

    // Filter by category using real category data from downloaded scripts
    if (selectedCategory) {
      scripts = scripts.filter(script => {
        if (!script) return false;
        
        // Check if the downloaded script has categoryNames that include the selected category
        return script.categoryNames?.includes(selectedCategory) ?? false;
      });
    }

    // Filter by updateable status
    if (filters.showUpdatable !== null) {
      scripts = scripts.filter(script => {
        if (!script) return false;
        const isUpdatable = script.updateable ?? false;
        return filters.showUpdatable ? isUpdatable : !isUpdatable;
      });
    }

    // Filter by script types
    if (filters.selectedTypes.length > 0) {
      scripts = scripts.filter(script => {
        if (!script) return false;
        const scriptType = (script.type ?? '').toLowerCase();
        return filters.selectedTypes.some(type => type.toLowerCase() === scriptType);
      });
    }

    // Apply sorting
    scripts.sort((a, b) => {
      if (!a || !b) return 0;
      
      let compareValue = 0;
      
      switch (filters.sortBy) {
        case 'name':
          compareValue = (a.name ?? '').localeCompare(b.name ?? '');
          break;
        case 'created':
          // Get creation date from script metadata in JSON format (date_created: "YYYY-MM-DD")
          const aCreated = a?.date_created ?? '';
          const bCreated = b?.date_created ?? '';
          
          // If both have dates, compare them directly
          if (aCreated && bCreated) {
            // For dates: asc = oldest first (2020 before 2024), desc = newest first (2024 before 2020)
            compareValue = aCreated.localeCompare(bCreated);
          } else if (aCreated && !bCreated) {
            // Scripts with dates come before scripts without dates
            compareValue = -1;
          } else if (!aCreated && bCreated) {
            // Scripts without dates come after scripts with dates
            compareValue = 1;
          } else {
            // Both have no dates, fallback to name comparison
            compareValue = (a.name ?? '').localeCompare(b.name ?? '');
          }
          break;
        default:
          compareValue = (a.name ?? '').localeCompare(b.name ?? '');
      }
      
      // Apply sort order
      return filters.sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return scripts;
  }, [downloadedScripts, filters, selectedCategory]);

  // Calculate filter counts for FilterBar
  const filterCounts = React.useMemo(() => {
    const updatableCount = downloadedScripts.filter(script => script?.updateable).length;
    
    return { installedCount: downloadedScripts.length, updatableCount };
  }, [downloadedScripts]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Handle category selection with auto-scroll
  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  // Auto-scroll effect when category changes
  useEffect(() => {
    if (selectedCategory && gridRef.current) {
      const timeoutId = setTimeout(() => {
        gridRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedCategory]);

  const handleCardClick = (scriptCard: { slug: string }) => {
    // All scripts are GitHub scripts, open modal
    setSelectedSlug(scriptCard.slug);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSlug(null);
  };

  if (githubLoading || localLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Loading downloaded scripts...</span>
      </div>
    );
  }

  if (githubError || localError) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-lg font-medium">Failed to load downloaded scripts</p>
          <p className="text-sm text-muted-foreground mt-1">
            {githubError?.message ?? localError?.message ?? 'Unknown error occurred'}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="default"
          size="default"
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!downloadedScripts || downloadedScripts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No downloaded scripts found</p>
          <p className="text-sm text-muted-foreground mt-1">
            You haven&apos;t downloaded any scripts yet. Visit the Available Scripts tab to download some scripts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Downloaded Scripts</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{downloadedScripts.length}</div>
            <div className="text-sm text-blue-300">Total Downloaded</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{filterCounts.updatableCount}</div>
            <div className="text-sm text-green-300">Updatable</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{filteredScripts.length}</div>
            <div className="text-sm text-purple-300">Filtered Results</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Category Sidebar */}
        <div className="flex-shrink-0 order-2 lg:order-1">
          <CategorySidebar
            categories={categories}
            categoryCounts={categoryCounts}
            totalScripts={downloadedScripts.length}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 order-1 lg:order-2" ref={gridRef}>
          {/* Enhanced Filter Bar */}
          <FilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            totalScripts={downloadedScripts.length}
            filteredCount={filteredScripts.length}
            updatableCount={filterCounts.updatableCount}
            saveFiltersEnabled={saveFiltersEnabled}
            isLoadingFilters={isLoadingFilters}
          />

          {/* Scripts Grid */}
          {filteredScripts.length === 0 && (filters.searchQuery || selectedCategory || filters.showUpdatable !== null || filters.selectedTypes.length > 0) ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-medium">No matching downloaded scripts found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try different filter settings or clear all filters.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  {filters.searchQuery && (
                    <Button
                      onClick={() => handleFiltersChange({ ...filters, searchQuery: '' })}
                      variant="default"
                      size="default"
                    >
                      Clear Search
                    </Button>
                  )}
                  {selectedCategory && (
                    <Button
                      onClick={() => handleCategorySelect(null)}
                      variant="secondary"
                      size="default"
                    >
                      Clear Category
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredScripts.map((script, index) => {
              // Add validation to ensure script has required properties
              if (!script || typeof script !== 'object') {
                return null;
              }
              
              // Create a unique key by combining slug, name, and index to handle duplicates
              const uniqueKey = `${script.slug ?? 'unknown'}-${script.name ?? 'unnamed'}-${index}`;
              
              return (
                <ScriptCard
                  key={uniqueKey}
                  script={script}
                  onClick={handleCardClick}
                />
              );
            })}
            </div>
          )}

          <ScriptDetailModal
            script={scriptData?.success ? scriptData.script : null}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onInstallScript={() => {
              // Downloaded scripts don't need installation
            }}
          />
        </div>
      </div>
    </div>
  );
}
