'use client';

import { useState, useRef, useEffect } from 'react';
import type { Server } from '../../types/server';

interface ColorCodedDropdownProps {
  servers: Server[];
  selectedServer: Server | null;
  onServerSelect: (server: Server | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ColorCodedDropdown({ 
  servers, 
  selectedServer, 
  onServerSelect, 
  placeholder = "Select a server...",
  disabled = false 
}: ColorCodedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleServerClick = (server: Server) => {
    onServerSelect(server);
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onServerSelect(null);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground text-left flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'
        }`}
      >
        <span className="truncate">
          {selectedServer ? (
            <span className="flex items-center gap-2">
              {selectedServer.color && (
                <span 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedServer.color }}
                />
              )}
              {selectedServer.name} ({selectedServer.ip}) - {selectedServer.user}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <svg 
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Clear Selection Option */}
          <button
            type="button"
            onClick={handleClearSelection}
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {placeholder}
          </button>
          
          {/* Server Options */}
          {servers.map((server) => (
            <button
              key={server.id}
              type="button"
              onClick={() => handleServerClick(server)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2 ${
                selectedServer?.id === server.id 
                  ? 'bg-accent text-accent-foreground' 
                  : 'text-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {server.color && (
                <span 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: server.color }}
                />
              )}
              <span className="truncate">
                {server.name} ({server.ip}) - {server.user}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
