'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '~/trpc/react';
import { ScriptCard } from './ScriptCard';
import { ScriptDetailModal } from './ScriptDetailModal';
import { CategorySidebar } from './CategorySidebar';


interface ScriptsGridProps {
  onInstallScript?: (scriptPath: string, scriptName: string) => void;
}

export function ScriptsGrid({ onInstallScript }: ScriptsGridProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: scriptCardsData, isLoading: githubLoading, error: githubError, refetch } = api.scripts.getScriptCardsWithCategories.useQuery();
  const { data: localScriptsData, isLoading: localLoading, error: localError } = api.scripts.getCtScripts.useQuery();
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: selectedSlug ?? '' },
    { enabled: !!selectedSlug }
  );

  // Extract categories from metadata
  const categories = React.useMemo(() => {
    if (!scriptCardsData?.success || !scriptCardsData.metadata?.categories) return [];
    
    return (scriptCardsData.metadata.categories as any[])
      .filter((cat) => cat.id !== 0) // Exclude Miscellaneous for main list
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((cat) => cat.name as string)
      .filter((name): name is string => typeof name === 'string');
  }, [scriptCardsData]);

  // Count scripts per category
  const categoryCounts = React.useMemo(() => {
    if (!scriptCardsData?.success) return {};
    
    const counts: Record<string, number> = {};
    
    // Initialize all categories with 0
    categories.forEach((categoryName: string) => {
      counts[categoryName] = 0;
    });
    
    // Count scripts for each category
    scriptCardsData.cards?.forEach(script => {
      if (script.categoryNames) {
        script.categoryNames.forEach((categoryName) => {
          if (categoryName && counts[categoryName] !== undefined) {
            counts[categoryName]++;
          }
        });
      }
    });
    
    return counts;
  }, [scriptCardsData, categories]);

  // Get GitHub scripts with download status
  const combinedScripts = React.useMemo(() => {
    const githubScripts = scriptCardsData?.success ? (scriptCardsData.cards
      ?.filter(script => script?.name) // Filter out invalid scripts
      ?.map(script => ({
        ...script,
        source: 'github' as const,
        isDownloaded: false, // Will be updated by status check
        isUpToDate: false,   // Will be updated by status check
      })) ?? []) : [];

    return githubScripts;
  }, [scriptCardsData]);


  // Update scripts with download status
  const scriptsWithStatus = React.useMemo(() => {
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

  // Filter scripts based on search query and category
  const filteredScripts = React.useMemo(() => {
    let scripts = scriptsWithStatus;

    // Filter by search query first
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase().trim();
      
      if (query.length >= 1) {
        scripts = scripts.filter(script => {
          if (!script || typeof script !== 'object') {
            return false;
          }

          const name = (script.name ?? '').toLowerCase();
          const slug = (script.slug ?? '').toLowerCase();

          return name.includes(query) || slug.includes(query);
        });
      }
    }

    // Filter by category using real category data
    if (selectedCategory) {
      scripts = scripts.filter(script => {
        if (!script) return false;
        
        // Check if script has categoryNames that include the selected category
        const scriptWithCategories = scriptCardsData?.success ? 
          scriptCardsData.cards?.find(s => s.slug === script.slug) : null;
        
        return scriptWithCategories?.categoryNames?.includes(selectedCategory) ?? false;
      });
    }

    return scripts;
  }, [scriptsWithStatus, searchQuery, selectedCategory, scriptCardsData]);

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
        <span className="ml-2 text-gray-600">Loading scripts...</span>
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
          <p className="text-sm text-gray-500 mt-1">
            {githubError?.message ?? localError?.message ?? 'Unknown error occurred'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!scriptsWithStatus || scriptsWithStatus.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No scripts found</p>
          <p className="text-sm text-gray-500 mt-1">
            No script files were found in the repository or local directory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Category Sidebar */}
      <div className="flex-shrink-0">
        <CategorySidebar
          categories={categories}
          categoryCounts={categoryCounts}
          totalScripts={scriptsWithStatus.length}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0" ref={gridRef}>
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search scripts by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-300 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {(searchQuery || selectedCategory) && (
            <div className="text-center mt-2 text-sm text-gray-600">
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
        {filteredScripts.length === 0 && (searchQuery || selectedCategory) ? (
          <div className="text-center py-12">
            <div className="text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-lg font-medium">No matching scripts found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search terms{searchQuery ? ' or clear the search' : ''}{selectedCategory ? ' or select a different category' : ''}.
              </p>
              <div className="flex justify-center gap-2 mt-4">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
                {selectedCategory && (
                  <button
                    onClick={() => handleCategorySelect(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Clear Category
                  </button>
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
          onInstallScript={onInstallScript}
        />
      </div>
    </div>
  );
}
