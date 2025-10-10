'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ScriptCard } from '~/types/script';
import { TypeBadge, UpdateableBadge } from './Badge';

interface ScriptCardListProps {
  script: ScriptCard;
  onClick: (script: ScriptCard) => void;
}

export function ScriptCardList({ script, onClick }: ScriptCardListProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getCategoryNames = () => {
    if (!script.categoryNames || script.categoryNames.length === 0) return 'Uncategorized';
    return script.categoryNames.join(', ');
  };

  return (
    <div
      className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer border border-border hover:border-primary"
      onClick={() => onClick(script)}
    >
      <div className="p-6">
        <div className="flex items-start space-x-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={56}
                height={56}
                className="w-14 h-14 rounded-lg object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-lg font-semibold">
                  {script.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-foreground truncate mb-2">
                  {script.name || 'Unnamed Script'}
                </h3>
                <div className="flex items-center space-x-3">
                  <TypeBadge type={script.type ?? 'unknown'} />
                  {script.updateable && <UpdateableBadge />}
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${
                      script.isDownloaded ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      script.isDownloaded ? 'text-green-700' : 'text-destructive'
                    }`}>
                      {script.isDownloaded ? 'Downloaded' : 'Not Downloaded'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side - Website link */}
              {script.website && (
                <a
                  href={script.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1 ml-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Website</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
              {script.description || 'No description available'}
            </p>

            {/* Metadata Row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span>Categories: {getCategoryNames()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Created: {formatDate(script.date_created)}</span>
                </div>
                {(script.os || script.version) && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    <span>
                      {script.os && script.version 
                        ? `${script.os.charAt(0).toUpperCase() + script.os.slice(1)} ${script.version}`
                        : script.os 
                          ? script.os.charAt(0).toUpperCase() + script.os.slice(1)
                          : script.version
                            ? `Version ${script.version}`
                            : ''
                      }
                    </span>
                  </div>
                )}
                {script.interface_port && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Port: {script.interface_port}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>ID: {script.slug || 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
