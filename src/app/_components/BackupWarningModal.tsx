'use client';

import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';

interface BackupWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function BackupWarningModal({
  isOpen,
  onClose,
  onProceed
}: BackupWarningModalProps) {
  useRegisterModal(isOpen, { id: 'backup-warning-modal', allowEscape: true, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <h2 className="text-2xl font-bold text-card-foreground">Backup Failed</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-6">
            The backup failed, but you can still proceed with the update if you wish.
            <br /><br />
            <strong className="text-foreground">Warning:</strong> Proceeding without a backup means you won&apos;t be able to restore the container if something goes wrong during the update.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={onProceed}
              variant="default"
              size="default"
              className="w-full sm:w-auto bg-warning hover:bg-warning/90"
            >
              Proceed Anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



