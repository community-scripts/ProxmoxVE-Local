'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';

interface DiffViewerProps {
  scriptSlug: string;
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DiffViewer({ scriptSlug, filePath, isOpen, onClose }: DiffViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get diff content
  const { data: diffData, refetch } = api.scripts.getScriptDiff.useQuery(
    { slug: scriptSlug, filePath },
    { enabled: isOpen && !!scriptSlug && !!filePath }
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await refetch();
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const renderDiffLine = (line: string, index: number) => {
    const lineNumberMatch = /^([+-]?\d+):/.exec(line);
    const lineNumber = lineNumberMatch?.[1];
    const content = line.replace(/^[+-]?\d+:\s*/, '');
    const isAdded = line.startsWith('+');
    const isRemoved = line.startsWith('-');

    return (
      <div
        key={index}
        className={`flex font-mono text-sm ${
          isAdded
            ? 'bg-success/10 text-success border-l-4 border-success'
            : isRemoved
            ? 'bg-destructive/10 text-destructive border-l-4 border-destructive'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <div className="w-16 text-right pr-2 text-muted-foreground select-none">
          {lineNumber}
        </div>
        <div className="flex-1 pl-2">
          <span className={isAdded ? 'text-success' : isRemoved ? 'text-destructive' : ''}>
            {isAdded ? '+' : isRemoved ? '-' : ' '}
          </span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-border mx-4 sm:mx-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Script Diff</h2>
            <p className="text-sm text-muted-foreground">{filePath}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 bg-muted border-b border-border">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-success/20 border border-success/40"></div>
              <span className="text-success">Added (Remote)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-destructive/20 border border-destructive/40"></div>
              <span className="text-destructive">Removed (Local)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-muted border border-border"></div>
              <span className="text-muted-foreground">Unchanged</span>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {diffData?.success ? (
            diffData.diff ? (
              <div className="divide-y divide-border">
                {diffData.diff.split('\n').map((line, index) => 
                  line.trim() ? renderDiffLine(line, index) : null
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <svg className="w-12 h-12 mx-auto mb-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No differences found</p>
                <p className="text-sm">The local and remote files are identical</p>
              </div>
            )
          ) : diffData?.error ? (
            <div className="p-8 text-center text-destructive">
              <svg className="w-12 h-12 mx-auto mb-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Error loading diff</p>
              <p className="text-sm">{diffData.error}</p>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading diff...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
