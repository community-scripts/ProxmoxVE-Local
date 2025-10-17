'use client';

import { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, ExternalLink, Calendar, Tag, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightVersion?: string;
}

interface Release {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
}

// Helper functions for localStorage
const getLastSeenVersion = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('LAST_SEEN_RELEASE_VERSION');
};

const markVersionAsSeen = (version: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('LAST_SEEN_RELEASE_VERSION', version);
};

export function ReleaseNotesModal({ isOpen, onClose, highlightVersion }: ReleaseNotesModalProps) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const { data: releasesData, isLoading, error } = api.version.getAllReleases.useQuery(undefined, {
    enabled: isOpen
  });
  const { data: versionData } = api.version.getCurrentVersion.useQuery(undefined, {
    enabled: isOpen
  });

  // Get current version when modal opens
  useEffect(() => {
    if (isOpen && versionData?.success && versionData.version) {
      setCurrentVersion(versionData.version);
    }
  }, [isOpen, versionData]);

  // Mark version as seen when modal closes
  const handleClose = () => {
    if (currentVersion) {
      markVersionAsSeen(currentVersion);
    }
    onClose();
  };

  if (!isOpen) return null;

  const releases: Release[] = releasesData?.success ? releasesData.releases ?? [] : [];

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Tag className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-card-foreground">Release Notes</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading release notes...</span>
              </div>
            </div>
          ) : error || !releasesData?.success ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-destructive mb-2">Failed to load release notes</p>
                <p className="text-sm text-muted-foreground">
                  {releasesData?.error ?? 'Please try again later'}
                </p>
              </div>
            </div>
          ) : releases.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">No releases found</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {releases.map((release, index) => {
                const isHighlighted = highlightVersion && release.tagName.replace('v', '') === highlightVersion;
                const isLatest = index === 0;
                
                return (
                  <div
                    key={release.tagName}
                    className={`border rounded-lg p-6 ${
                      isHighlighted 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border bg-card'
                    } ${isLatest ? 'ring-2 ring-primary/20' : ''}`}
                  >
                    {/* Release Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-card-foreground">
                            {release.name || release.tagName}
                          </h3>
                          {isLatest && (
                            <Badge variant="default" className="text-xs">
                              Latest
                            </Badge>
                          )}
                          {isHighlighted && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              New
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            <span>{release.tagName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(release.publishedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 w-8 p-0"
                      >
                        <a
                          href={release.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on GitHub"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>

                    {/* Release Body */}
                    {release.body && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({children}) => <h1 className="text-2xl font-bold text-card-foreground mb-4 mt-6">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-semibold text-card-foreground mb-3 mt-5">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-medium text-card-foreground mb-2 mt-4">{children}</h3>,
                            p: ({children}) => <p className="text-card-foreground mb-3 leading-relaxed">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-inside text-card-foreground mb-3 space-y-1">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside text-card-foreground mb-3 space-y-1">{children}</ol>,
                            li: ({children}) => <li className="text-card-foreground">{children}</li>,
                            a: ({href, children}) => <a href={href} className="text-info hover:text-info/80 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            strong: ({children}) => <strong className="font-semibold text-card-foreground">{children}</strong>,
                            em: ({children}) => <em className="italic text-card-foreground">{children}</em>,
                          }}
                        >
                          {release.body}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {currentVersion && (
              <span>Current version: <span className="font-medium text-card-foreground">v{currentVersion}</span></span>
            )}
          </div>
          <Button onClick={handleClose} variant="default">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Export helper functions for use in other components
export { getLastSeenVersion, markVersionAsSeen };
