'use client';

import React from 'react';

interface BadgeProps {
  variant: 'type' | 'updateable' | 'privileged' | 'status' | 'note' | 'execution-mode';
  type?: string;
  noteType?: 'info' | 'warning' | 'error';
  status?: 'success' | 'failed' | 'in_progress';
  executionMode?: 'local' | 'ssh';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, type, noteType, status, executionMode, children, className = '' }: BadgeProps) {
  const getTypeStyles = (scriptType: string) => {
    switch (scriptType.toLowerCase()) {
      case 'ct':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
      case 'addon':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700';
      case 'vm':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
      case 'pve':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'type':
        return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${type ? getTypeStyles(type) : getTypeStyles('unknown')}`;
      
      case 'updateable':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700';
      
      case 'privileged':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700';
      
      case 'status':
        switch (status) {
          case 'success':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700';
          case 'failed':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700';
          case 'in_progress':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
        }
      
      case 'execution-mode':
        switch (executionMode) {
          case 'local':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700';
          case 'ssh':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
        }
      
      case 'note':
        switch (noteType) {
          case 'warning':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700';
          case 'error':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700';
        }
      
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
    }
  };

  // Format the text for type badges
  const formatText = () => {
    if (variant === 'type' && type) {
      switch (type.toLowerCase()) {
        case 'ct':
          return 'LXC';
        case 'addon':
          return 'ADDON';
        case 'vm':
          return 'VM';
        case 'pve':
          return 'PVE';
        default:
          return type.toUpperCase();
      }
    }
    return children;
  };

  return (
    <span className={`${getVariantStyles()} ${className}`}>
      {formatText()}
    </span>
  );
}

// Convenience components for common use cases
export const TypeBadge = ({ type, className }: { type: string; className?: string }) => (
  <Badge variant="type" type={type} className={className}>
    {type}
  </Badge>
);

export const UpdateableBadge = ({ className }: { className?: string }) => (
  <Badge variant="updateable" className={className}>
    Updateable
  </Badge>
);

export const PrivilegedBadge = ({ className }: { className?: string }) => (
  <Badge variant="privileged" className={className}>
    Privileged
  </Badge>
);

export const StatusBadge = ({ status, children, className }: { status: 'success' | 'failed' | 'in_progress'; children: React.ReactNode; className?: string }) => (
  <Badge variant="status" status={status} className={className}>
    {children}
  </Badge>
);

export const ExecutionModeBadge = ({ mode, children, className }: { mode: 'local' | 'ssh'; children: React.ReactNode; className?: string }) => (
  <Badge variant="execution-mode" executionMode={mode} className={className}>
    {children}
  </Badge>
);

export const NoteBadge = ({ noteType, children, className }: { noteType: 'info' | 'warning' | 'error'; children: React.ReactNode; className?: string }) => (
  <Badge variant="note" noteType={noteType} className={className}>
    {children}
  </Badge>
);