'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ScriptCard } from '~/types/script';
import { TypeBadge, UpdateableBadge } from './Badge';

interface ScriptCardProps {
  script: ScriptCard;
  onClick: (script: ScriptCard) => void;
}

export function ScriptCard({ script, onClick }: ScriptCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div
      className="bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-border hover:border-primary h-full flex flex-col"
      onClick={() => onClick(script)}
    >
      <div className="p-6 flex-1 flex flex-col">
        {/* Header with logo and name */}
        <div className="flex items-start space-x-4 mb-4">
          <div className="flex-shrink-0">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-lg font-semibold">
                  {script.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {script.name || 'Unnamed Script'}
            </h3>
            <div className="mt-2 space-y-2">
              {/* Type and Updateable status on first row */}
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <TypeBadge type={script.type ?? 'unknown'} />
                {script.updateable && <UpdateableBadge />}
              </div>
              
              {/* Download Status */}
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  script.isDownloaded ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className={`text-xs font-medium ${
                  script.isDownloaded ? 'text-green-700' : 'text-destructive'
                }`}>
                  {script.isDownloaded ? 'Downloaded' : 'Not Downloaded'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
          {script.description || 'No description available'}
        </p>

        {/* Footer with website link */}
        {script.website && (
          <div className="mt-auto">
            <a
              href={script.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Website</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
