'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Copy, X } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';

interface CloneCountInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (count: number) => void;
  storageName: string;
}

export function CloneCountInputModal({
  isOpen,
  onClose,
  onSubmit,
  storageName
}: CloneCountInputModalProps) {
  const [cloneCount, setCloneCount] = useState<number>(1);
  
  useRegisterModal(isOpen, { id: 'clone-count-input-modal', allowEscape: true, onClose });

  useEffect(() => {
    if (isOpen) {
      setCloneCount(1); // Reset to default when modal opens
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (cloneCount >= 1) {
      onSubmit(cloneCount);
      setCloneCount(1); // Reset after submit
    }
  };

  const handleClose = () => {
    setCloneCount(1); // Reset on close
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Copy className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-card-foreground">Clone Count</h2>
          </div>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            How many clones would you like to create?
          </p>
          
          {storageName && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Storage:</p>
              <p className="text-sm font-medium text-foreground">{storageName}</p>
            </div>
          )}

          <div className="space-y-2 mb-6">
            <label htmlFor="cloneCount" className="block text-sm font-medium text-foreground">
              Number of Clones
            </label>
            <Input
              id="cloneCount"
              type="number"
              min="1"
              max="100"
              value={cloneCount}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 100) {
                  setCloneCount(value);
                } else if (e.target.value === '') {
                  setCloneCount(1);
                }
              }}
              className="w-full"
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              Enter a number between 1 and 100
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={cloneCount < 1 || cloneCount > 100}
              variant="default"
              size="default"
              className="w-full sm:w-auto"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

