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
        return 'bg-primary/10 text-primary border-primary/20';
      case 'addon':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'vm':
        return 'bg-success/10 text-success border-success/20';
      case 'pve':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'type':
        return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${type ? getTypeStyles(type) : getTypeStyles('unknown')}`;
      
      case 'updateable':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20';
      
      case 'privileged':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20';
      
      case 'status':
        switch (status) {
          case 'success':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20';
          case 'failed':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error/10 text-error border border-error/20';
          case 'in_progress':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border';
        }
      
      case 'execution-mode':
        switch (executionMode) {
          case 'local':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20';
          case 'ssh':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border';
        }
      
      case 'note':
        switch (noteType) {
          case 'warning':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20';
          case 'error':
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20';
          default:
            return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20';
        }
      
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border';
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