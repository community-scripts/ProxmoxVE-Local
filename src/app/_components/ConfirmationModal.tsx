'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant: 'simple' | 'danger';
  confirmText?: string; // What the user must type for danger variant
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant,
  confirmText,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel'
}: ConfirmationModalProps) {
  const [typedText, setTypedText] = useState('');

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isConfirmEnabled = isDanger ? typedText === confirmText : true;

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setTypedText(''); // Reset for next time
    }
  };

  const handleClose = () => {
    onClose();
    setTypedText(''); // Reset when closing
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {isDanger ? (
              <AlertTriangle className="h-8 w-8 text-error" />
            ) : (
              <Info className="h-8 w-8 text-info" />
            )}
            <h2 className="text-2xl font-bold text-card-foreground">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-6">
            {message}
          </p>

          {/* Type-to-confirm input for danger variant */}
          {isDanger && confirmText && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Type <code className="bg-muted px-2 py-1 rounded text-sm">{confirmText}</code> to confirm:
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder={`Type "${confirmText}" here`}
                autoComplete="off"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              {cancelButtonText}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled}
              variant={isDanger ? "destructive" : "default"}
              size="default"
              className="w-full sm:w-auto"
            >
              {confirmButtonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
