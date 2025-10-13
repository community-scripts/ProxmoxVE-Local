'use client';

import { useState } from 'react';
import { ContextualHelpIcon } from './ContextualHelpIcon';

interface CategorySidebarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  totalScripts: number;
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

// Icon mapping for categories
const CategoryIcon = ({ iconName, className = "w-5 h-5" }: { iconName: string; className?: string }) => {
  const iconMap: Record<string, React.ReactElement> = {
    server: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    monitor: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    box: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    shield: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    "shield-check": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    key: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1 0 21 9z" />
      </svg>
    ),
    archive: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    database: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    "chart-bar": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    template: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    "folder-open": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    "document-text": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    film: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1.5a.5.5 0 01.5-.5h1a.5.5 0 01.5.5V4m-3 0H9m3 0v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4m6 0h2a2 2 0 012 2v12a2 2 0 01-2 2h-2V4z" />
      </svg>
    ),
    download: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    "video-camera": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    home: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    wifi: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    "chat-alt": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    clock: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    code: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    "external-link": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    ),
    sparkles: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    "currency-dollar": (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    puzzle: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    office: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  };

  return iconMap[iconName] ?? (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z" />
    </svg>
  );
};

export function CategorySidebar({ 
  categories, 
  categoryCounts, 
  totalScripts, 
  selectedCategory, 
  onCategorySelect 
}: CategorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Category to icon mapping (based on metadata.json)
  const categoryIconMapping: Record<string, string> = {
    'Proxmox & Virtualization': 'server',
    'Operating Systems': 'monitor',
    'Containers & Docker': 'box',
    'Network & Firewall': 'shield',
    'Adblock & DNS': 'shield-check',
    'Authentication & Security': 'key',
    'Backup & Recovery': 'archive',
    'Databases': 'database',
    'Monitoring & Analytics': 'chart-bar',
    'Dashboards & Frontends': 'template',
    'Files & Downloads': 'folder-open',
    'Documents & Notes': 'document-text',
    'Media & Streaming': 'film',
    '*Arr Suite': 'download',
    'NVR & Cameras': 'video-camera',
    'IoT & Smart Home': 'home',
    'ZigBee, Z-Wave & Matter': 'wifi',
    'MQTT & Messaging': 'chat-alt',
    'Automation & Scheduling': 'clock',
    'AI / Coding & Dev-Tools': 'code',
    'Webservers & Proxies': 'external-link',
    'Bots & ChatOps': 'sparkles',
    'Finance & Budgeting': 'currency-dollar',
    'Gaming & Leisure': 'puzzle',
    'Business & ERP': 'office',
    'Miscellaneous': 'box'
  };

  // Sort categories by count (descending) and then alphabetically
  const sortedCategories = categories
    .map(category => [category, categoryCounts[category] ?? 0] as const)
    .sort(([a, countA], [b, countB]) => {
      if (countB !== countA) return countB - countA;
      return a.localeCompare(b);
    });

  return (
    <div className={`bg-card rounded-lg shadow-md border border-border transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-full lg:w-80'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Categories</h3>
              <p className="text-sm text-muted-foreground">{totalScripts} Total scripts</p>
            </div>
            <ContextualHelpIcon section="available-scripts" tooltip="Help with categories" />
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title={isCollapsed ? 'Expand categories' : 'Collapse categories'}
        >
          <svg 
            className={`w-5 h-5 text-muted-foreground transition-transform ${
              isCollapsed ? 'rotate-180' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded state - show full categories */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="space-y-2">
            {/* "All Categories" option */}
            <button
              onClick={() => onCategorySelect(null)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedCategory === null
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
            >
              <div className="flex items-center space-x-3">
                <CategoryIcon 
                  iconName="template" 
                  className={`w-5 h-5 ${selectedCategory === null ? 'text-primary' : 'text-muted-foreground'}`} 
                />
                <span className="font-medium">All Categories</span>
              </div>
              <span className={`text-sm px-2 py-1 rounded-full ${
                selectedCategory === null
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {totalScripts}
              </span>
            </button>

            {/* Individual Categories */}
            {sortedCategories.map(([category, count]) => {
              const isSelected = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => onCategorySelect(category)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CategoryIcon 
                      iconName={categoryIconMapping[category] ?? 'box'} 
                      className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} 
                    />
                    <span className="font-medium capitalize">
                      {category.replace(/[_-]/g, ' ')}
                    </span>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsed state - show only icons with counters and tooltips */}
      {isCollapsed && (
        <div className="p-2 flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto lg:overflow-x-visible">
          {/* "All Categories" option */}
          <div className="group relative">
            <button
              onClick={() => onCategorySelect(null)}
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors relative ${
                  selectedCategory === null
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
            >
              <CategoryIcon 
                iconName="template" 
                className={`w-5 h-5 ${selectedCategory === null ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} 
              />
              <span className={`text-xs mt-1 px-1 rounded ${
                selectedCategory === null
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {totalScripts}
              </span>
            </button>
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden lg:block">
              All Categories ({totalScripts})
            </div>
          </div>

          {/* Individual Categories */}
          {sortedCategories.map(([category, count]) => {
            const isSelected = selectedCategory === category;
            
            return (
              <div key={category} className="group relative">
                <button
                  onClick={() => onCategorySelect(category)}
                  className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors relative ${
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <CategoryIcon 
                    iconName={categoryIconMapping[category] ?? 'box'} 
                    className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} 
                  />
                  <span className={`text-xs mt-1 px-1 rounded ${
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
                
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden lg:block">
                  {category} ({count})
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}