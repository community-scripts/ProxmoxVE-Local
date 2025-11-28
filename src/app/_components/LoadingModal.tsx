'use client';

import { Loader2, CheckCircle, X } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import { useEffect, useRef } from 'react';
import { Button } from './ui/button';

interface LoadingModalProps {
  isOpen: boolean;
  action?: string;
  logs?: string[];
  isComplete?: boolean;
  title?: string;
  onClose?: () => void;
}

export function LoadingModal({ isOpen, action: _action, logs = [], isComplete = false, title, onClose }: LoadingModalProps) {
  // Allow dismissing with ESC only when complete, prevent during running
  useRegisterModal(isOpen, { id: 'loading-modal', allowEscape: isComplete, onClose: onClose ?? (() => null) });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full border border-border p-8 max-h-[80vh] flex flex-col relative">
        {/* Close button - only show when complete */}
        {isComplete && onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {isComplete ? (
              <CheckCircle className="h-12 w-12 text-success" />
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse"></div>
              </>
            )}
          </div>
          
          {/* Static title text */}
          {title && (
            <p className="text-sm text-muted-foreground">
              {title}
            </p>
          )}
          
          {/* Log output */}
          {logs.length > 0 && (
            <div className="w-full bg-card border border-border rounded-lg p-4 font-mono text-xs text-chart-2 max-h-[60vh] overflow-y-auto terminal-output">
              {logs.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {!isComplete && (
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

