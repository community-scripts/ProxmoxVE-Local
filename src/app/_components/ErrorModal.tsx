'use client';

import { useEffect } from 'react';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';

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
  useRegisterModal(isOpen, { id: 'error-modal', allowEscape: true, onClose });
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
              <CheckCircle className="h-8 w-8 text-success" />
            ) : (
              <AlertCircle className="h-8 w-8 text-error" />
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
                ? 'bg-success/10 border border-success/20'
                : 'bg-error/10 border border-error/20'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                type === 'success'
                  ? 'text-success-foreground'
                  : 'text-error-foreground'
              }`}>
                {type === 'success' ? 'Details:' : 'Error Details:'}
              </p>
              <pre className={`text-xs whitespace-pre-wrap break-words ${
                type === 'success'
                  ? 'text-success/80'
                  : 'text-error/80'
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
