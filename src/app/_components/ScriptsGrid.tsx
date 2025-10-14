'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '~/trpc/react';
import { ScriptCard } from './ScriptCard';
import { ScriptCardList } from './ScriptCardList';
import { ScriptDetailModal } from './ScriptDetailModal';
import { CategorySidebar } from './CategorySidebar';
import { FilterBar, type FilterState } from './FilterBar';
import { ViewToggle } from './ViewToggle';
import { Button } from './ui/button';
import type { ScriptCard as ScriptCardType } from '~/types/script';


interface ScriptsGridProps {
  onInstallScript?: (scriptPath: string, scriptName: string) => void;
}

export function ScriptsGrid({ onInstallScript }: ScriptsGridProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; currentScript: string; failed: Array<{ slug: string; error: string }> } | null>(null);
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
  const { data: localScriptsData, isLoading: localLoading, error: localError } = api.scripts.getAllDownloadedScripts.useQuery();
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: selectedSlug ?? '' },
    { enabled: !!selectedSlug }
  );

  // Individual script download mutation
  const loadSingleScriptMutation = api.scripts.loadScript.useMutation();

  // Load SAVE_FILTER setting, saved filters, and view mode on component mount
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

        // Load view mode
        const viewModeResponse = await fetch('/api/settings/view-mode');
        if (viewModeResponse.ok) {
          const viewModeData = await viewModeResponse.json();
          const viewMode = viewModeData.viewMode;
          if (viewMode && typeof viewMode === 'string' && (viewMode === 'card' || viewMode === 'list')) {
            setViewMode(viewMode);
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

  // Save view mode when it changes
  useEffect(() => {
    if (isLoadingFilters) return;

    const saveViewMode = async () => {
      try {
        await fetch('/api/settings/view-mode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ viewMode }),
        });
      } catch (error) {
        console.error('Error saving view mode:', error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(() => void saveViewMode(), 300);
    return () => clearTimeout(timeoutId);
  }, [viewMode, isLoadingFilters]);

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

  // Count scripts per category (using deduplicated scripts)
  const categoryCounts = React.useMemo((): Record<string, number> => {
    if (!scriptCardsData?.success) return {};
    
    const counts: Record<string, number> = {};
    
    // Initialize all categories with 0
    categories.forEach((categoryName: string) => {
      counts[categoryName] = 0;
    });
    
    // Count each unique script only once per category
    combinedScripts.forEach(script => {
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
  }, [categories, combinedScripts, scriptCardsData?.success]);


  // Update scripts with download status
  const scriptsWithStatus = React.useMemo((): ScriptCardType[] => {
    return combinedScripts.map(script => {
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
        // Removed isUpToDate - only show in modal for detailed comparison
      };
    });
  }, [combinedScripts, localScriptsData]);

  // Filter scripts based on all filters and category
  const filteredScripts = React.useMemo((): ScriptCardType[] => {
    let scripts = scriptsWithStatus;

    // Filter by search query (use filters.searchQuery instead of deprecated searchQuery)
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

    // Filter by category using real category data from deduplicated scripts
    if (selectedCategory) {
      scripts = scripts.filter(script => {
        if (!script) return false;
        
        // Check if the deduplicated script has categoryNames that include the selected category
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
  }, [scriptsWithStatus, filters, selectedCategory]);

  // Calculate filter counts for FilterBar
  const filterCounts = React.useMemo(() => {
    const installedCount = scriptsWithStatus.filter(script => script?.isDownloaded).length;
    const updatableCount = scriptsWithStatus.filter(script => script?.updateable).length;
    
    return { installedCount, updatableCount };
  }, [scriptsWithStatus]);

  // Sync legacy searchQuery with filters.searchQuery for backward compatibility
  useEffect(() => {
    if (searchQuery !== filters.searchQuery) {
      setFilters(prev => ({ ...prev, searchQuery }));
    }
  }, [searchQuery, filters.searchQuery]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    // Sync searchQuery for backward compatibility
    setSearchQuery(newFilters.searchQuery);
  };

  // Selection management functions
  const toggleScriptSelection = (slug: string) => {
    setSelectedSlugs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    const visibleSlugs = new Set(filteredScripts.map(script => script.slug).filter(Boolean));
    setSelectedSlugs(visibleSlugs);
  };

  const clearSelection = () => {
    setSelectedSlugs(new Set());
  };

  const getFriendlyErrorMessage = (error: string, slug: string): string => {
    const errorLower = error.toLowerCase();
    
    // Exact matches first (most specific)
    if (error === 'Script not found') {
      return `Script "${slug}" is not available for download. It may not exist in the repository or has been removed.`;
    }
    
    if (error === 'Failed to load script') {
      return `Unable to download script "${slug}". Please check your internet connection and try again.`;
    }
    
    // Network/Connection errors
    if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('timeout')) {
      return 'Network connection failed. Please check your internet connection and try again.';
    }
    
    // GitHub API errors
    if (errorLower.includes('not found') || errorLower.includes('404')) {
      return `Script "${slug}" not found in the repository. It may have been removed or renamed.`;
    }
    
    if (errorLower.includes('rate limit') || errorLower.includes('403')) {
      return 'GitHub API rate limit exceeded. Please wait a few minutes and try again.';
    }
    
    if (errorLower.includes('unauthorized') || errorLower.includes('401')) {
      return 'Access denied. The script may be private or require authentication.';
    }
    
    // File system errors
    if (errorLower.includes('permission') || errorLower.includes('eacces')) {
      return 'Permission denied. Please check file system permissions.';
    }
    
    if (errorLower.includes('no space') || errorLower.includes('enospc')) {
      return 'Insufficient disk space. Please free up some space and try again.';
    }
    
    if (errorLower.includes('read-only') || errorLower.includes('erofs')) {
      return 'Cannot write to read-only file system. Please check your installation directory.';
    }
    
    // Script-specific errors
    if (errorLower.includes('script not found')) {
      return `Script "${slug}" not found in the local scripts directory.`;
    }
    
    if (errorLower.includes('invalid script') || errorLower.includes('malformed')) {
      return `Script "${slug}" appears to be corrupted or invalid.`;
    }
    
    if (errorLower.includes('already exists') || errorLower.includes('file exists')) {
      return `Script "${slug}" already exists locally. Skipping download.`;
    }
    
    // Generic fallbacks
    if (errorLower.includes('timeout')) {
      return 'Download timed out. The script may be too large or the connection is slow.';
    }
    
    if (errorLower.includes('server error') || errorLower.includes('500')) {
      return 'Server error occurred. Please try again later.';
    }
    
    // If we can't categorize it, return a more helpful generic message
    if (error.length > 100) {
      return `Download failed: ${error.substring(0, 100)}...`;
    }
    
    return `Download failed: ${error}`;
  };

  const downloadScriptsIndividually = async (slugsToDownload: string[]) => {
    setDownloadProgress({ current: 0, total: slugsToDownload.length, currentScript: '', failed: [] });
    
    const successful: Array<{ slug: string; files: string[] }> = [];
    const failed: Array<{ slug: string; error: string }> = [];
    
    for (let i = 0; i < slugsToDownload.length; i++) {
      const slug = slugsToDownload[i];
      
      // Update progress with current script
      setDownloadProgress(prev => prev ? {
        ...prev,
        current: i,
        currentScript: slug ?? ''
      } : null);
      
      try {
        // Download individual script
        const result = await loadSingleScriptMutation.mutateAsync({ slug: slug ?? '' });
        
        if (result.success) {
          successful.push({ slug: slug ?? '', files: result.files ?? [] });
        } else {
          const error = 'error' in result ? result.error : 'Failed to load script';
          const userFriendlyError = getFriendlyErrorMessage(error, slug ?? '');
          failed.push({ slug: slug ?? '', error: userFriendlyError });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load script';
        const userFriendlyError = getFriendlyErrorMessage(errorMessage, slug ?? '');
        failed.push({ 
          slug: slug ?? '', 
          error: userFriendlyError
        });
      }
    }
    
    // Final progress update
    setDownloadProgress(prev => prev ? {
      ...prev,
      current: slugsToDownload.length,
      failed
    } : null);
    
    // Clear selection and refetch to update card download status
    setSelectedSlugs(new Set());
    void refetch();
    
    // Keep progress bar visible until user navigates away or manually dismisses
    // Progress bar will stay visible to show final results
  };

  const handleBatchDownload = () => {
    const slugsToDownload = Array.from(selectedSlugs);
    if (slugsToDownload.length > 0) {
      void downloadScriptsIndividually(slugsToDownload);
    }
  };

  const handleDownloadAllFiltered = () => {
    const slugsToDownload = filteredScripts.map(script => script.slug).filter(Boolean);
    if (slugsToDownload.length > 0) {
      void downloadScriptsIndividually(slugsToDownload);
    }
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

  // Clear selection when switching between card/list views
  useEffect(() => {
    setSelectedSlugs(new Set());
  }, [viewMode]);

  // Clear progress bar when component unmounts
  useEffect(() => {
    return () => {
      setDownloadProgress(null);
    };
  }, []);


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
        <span className="ml-2 text-muted-foreground">Loading scripts...</span>
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
          <p className="text-lg font-medium">Failed to load scripts</p>
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

  if (!scriptsWithStatus || scriptsWithStatus.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No scripts found</p>
          <p className="text-sm text-muted-foreground mt-1">
            No script files were found in the repository or local directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Category Sidebar */}
      <div className="flex-shrink-0 order-2 lg:order-1">
        <CategorySidebar
          categories={categories}
          categoryCounts={categoryCounts}
          totalScripts={scriptsWithStatus.length}
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
          totalScripts={scriptsWithStatus.length}
          filteredCount={filteredScripts.length}
          updatableCount={filterCounts.updatableCount}
          saveFiltersEnabled={saveFiltersEnabled}
          isLoadingFilters={isLoadingFilters}
        />

        {/* View Toggle */}
        <ViewToggle
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />


        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedSlugs.size > 0 ? (
            <Button
              onClick={handleBatchDownload}
              disabled={loadSingleScriptMutation.isPending}
              variant="outline"
              size="sm"
              className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-300 hover:text-blue-200 hover:border-blue-400/50"
            >
              {loadSingleScriptMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Downloading...
                </>
              ) : (
                `Download Selected (${selectedSlugs.size})`
              )}
            </Button>
          ) : (
            <Button
              onClick={handleDownloadAllFiltered}
              disabled={filteredScripts.length === 0 || loadSingleScriptMutation.isPending}
              variant="outline"
              size="sm"
            >
              {loadSingleScriptMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Downloading...
                </>
              ) : (
                `Download All Filtered (${filteredScripts.length})`
              )}
            </Button>
          )}

          {selectedSlugs.size > 0 && (
            <Button
              onClick={clearSelection}
              variant="outline"
              size="default"
            >
              Clear Selection
            </Button>
          )}

          {filteredScripts.length > 0 && (
            <Button
              onClick={selectAllVisible}
              variant="outline"
              size="default"
            >
              Select All Visible
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        {downloadProgress && (
          <div className="mb-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {downloadProgress.current >= downloadProgress.total ? 'Download completed' : 'Downloading scripts'}... {downloadProgress.current} of {downloadProgress.total}
                </span>
                {downloadProgress.currentScript && downloadProgress.current < downloadProgress.total && (
                  <span className="text-xs text-muted-foreground">
                    Currently downloading: {downloadProgress.currentScript}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {Math.round((downloadProgress.current / downloadProgress.total) * 100)}%
                </span>
                {downloadProgress.current >= downloadProgress.total && (
                  <button
                    onClick={() => setDownloadProgress(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Dismiss progress bar"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ease-out ${
                  downloadProgress.failed.length > 0 ? 'bg-yellow-500' : 'bg-primary'
                }`}
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
            </div>
            
            {/* Progress Visualization */}
            <div className="flex items-center text-xs text-muted-foreground mb-2">
              <span className="mr-2">Progress:</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: downloadProgress.total }, (_, i) => {
                  const isCompleted = i < downloadProgress.current;
                  const isCurrent = i === downloadProgress.current;
                  const isFailed = downloadProgress.failed.some(f => f.slug === downloadProgress.currentScript);
                  
                  return (
                    <span 
                      key={i} 
                      className={`px-1 py-0.5 rounded text-xs ${
                        isCompleted 
                          ? isFailed ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : isCurrent 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (isFailed ? '✗' : '✓') : isCurrent ? '⟳' : '○'}
                    </span>
                  );
                })}
              </div>
            </div>
            
            {/* Failed Scripts Details */}
            {downloadProgress.failed.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                    Failed Downloads ({downloadProgress.failed.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {downloadProgress.failed.map((failed, index) => (
                    <div key={index} className="text-xs text-red-700 dark:text-red-300">
                      <span className="font-medium">{failed.slug}:</span> {failed.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legacy Search Bar (keeping for backward compatibility, but hidden) */}
        <div className="hidden mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search scripts by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-border rounded-lg leading-5 bg-card placeholder-muted-foreground text-foreground focus:outline-none focus:placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {(searchQuery || selectedCategory) && (
            <div className="text-center mt-2 text-sm text-muted-foreground">
              {filteredScripts.length === 0 ? (
                <span>No scripts found{searchQuery ? ` matching "${searchQuery}"` : ''}{selectedCategory ? ` in category "${selectedCategory}"` : ''}</span>
              ) : (
                <span>
                  Found {filteredScripts.length} script{filteredScripts.length !== 1 ? 's' : ''}
                  {searchQuery ? ` matching "${searchQuery}"` : ''}
                  {selectedCategory ? ` in category "${selectedCategory}"` : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scripts Grid */}
        {filteredScripts.length === 0 && (filters.searchQuery || selectedCategory || filters.showUpdatable !== null || filters.selectedTypes.length > 0) ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg font-medium">No matching scripts found</p>
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
          viewMode === 'card' ? (
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
                  isSelected={selectedSlugs.has(script.slug ?? '')}
                  onToggleSelect={toggleScriptSelection}
                />
              );
            })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredScripts.map((script, index) => {
              // Add validation to ensure script has required properties
              if (!script || typeof script !== 'object') {
                return null;
              }
              
              // Create a unique key by combining slug, name, and index to handle duplicates
              const uniqueKey = `${script.slug ?? 'unknown'}-${script.name ?? 'unnamed'}-${index}`;
              
              return (
                <ScriptCardList
                  key={uniqueKey}
                  script={script}
                  onClick={handleCardClick}
                  isSelected={selectedSlugs.has(script.slug ?? '')}
                  onToggleSelect={toggleScriptSelection}
                />
              );
            })}
            </div>
          )
        )}

        <ScriptDetailModal
          script={scriptData?.success ? scriptData.script : null}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onInstallScript={onInstallScript}
        />
      </div>
    </div>
  );
}
