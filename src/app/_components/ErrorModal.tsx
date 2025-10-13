'use client';

import { useEffect } from 'react';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: string;
  type?: 'error' | 'success';
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  details,
  type = 'error'
}: ErrorModalProps) {
  // Auto-close after 10 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {type === 'success' ? (
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            )}
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-foreground mb-4">{message}</p>
          {details && (
            <div className={`rounded-lg p-3 ${
              type === 'success'
                ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                type === 'success'
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {type === 'success' ? 'Details:' : 'Error Details:'}
              </p>
              <pre className={`text-xs whitespace-pre-wrap break-words ${
                type === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {details}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
