'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ScriptCard } from '~/types/script';
import { TypeBadge, UpdateableBadge } from './Badge';

interface ScriptCardProps {
  script: ScriptCard;
  onClick: (script: ScriptCard) => void;
  isSelected?: boolean;
  onToggleSelect?: (slug: string) => void;
}

export function ScriptCard({ script, onClick, isSelected = false, onToggleSelect }: ScriptCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect && script.slug) {
      onToggleSelect(script.slug);
    }
  };

  return (
    <div
      className="bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-border hover:border-primary h-full flex flex-col relative"
      onClick={() => onClick(script)}
    >
      {/* Checkbox in top-left corner */}
      {onToggleSelect && (
        <div className="absolute top-2 left-2 z-10">
          <div 
            className={`w-4 h-4 border-2 rounded cursor-pointer transition-all duration-200 flex items-center justify-center ${
              isSelected 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'bg-card border-border hover:border-primary/60 hover:bg-accent'
            }`}
            onClick={handleCheckboxClick}
          >
            {isSelected && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}
      
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
