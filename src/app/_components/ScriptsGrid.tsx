'use client';

import React, { useState } from 'react';
import { api } from '~/trpc/react';
import { ScriptCard } from './ScriptCard';
import { ScriptDetailModal } from './ScriptDetailModal';


interface ScriptsGridProps {
  onInstallScript?: (scriptPath: string, scriptName: string) => void;
}

export function ScriptsGrid({ onInstallScript }: ScriptsGridProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: scriptCardsData, isLoading: githubLoading, error: githubError, refetch } = api.scripts.getScriptCards.useQuery();
  const { data: localScriptsData, isLoading: localLoading, error: localError } = api.scripts.getCtScripts.useQuery();
  const { data: scriptData } = api.scripts.getScriptBySlug.useQuery(
    { slug: selectedSlug ?? '' },
    { enabled: !!selectedSlug }
  );

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

  // Filter scripts based on search query (name and slug only)
  const filteredScripts = React.useMemo(() => {
    if (!searchQuery?.trim()) {
      return scriptsWithStatus;
    }

    const query = searchQuery.toLowerCase().trim();
    
    // If query is too short, don't filter
    if (query.length < 1) {
      return scriptsWithStatus;
    }

    const filtered = scriptsWithStatus.filter(script => {
      // Ensure script exists and has required properties
      if (!script || typeof script !== 'object') {
        return false;
      }

      const name = (script.name ?? '').toLowerCase();
      const slug = (script.slug ?? '').toLowerCase();

      const matches = name.includes(query) || slug.includes(query);

      return matches;
    });

    return filtered;
  }, [scriptsWithStatus, searchQuery]);


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
    <>
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
        {searchQuery && (
          <div className="text-center mt-2 text-sm text-gray-600">
            {filteredScripts.length === 0 ? (
              <span>No scripts found matching &quot;{searchQuery}&quot;</span>
            ) : (
              <span>Found {filteredScripts.length} script{filteredScripts.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;</span>
            )}
          </div>
        )}
      </div>

      {/* Scripts Grid */}
      {filteredScripts.length === 0 && searchQuery ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg font-medium">No matching scripts found</p>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search terms or clear the search to see all scripts.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Search
            </button>
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
    </>
  );
}
