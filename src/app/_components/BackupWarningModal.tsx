"use client";

import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";

interface BackupWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function BackupWarningModal({
  isOpen,
  onClose,
  onProceed,
}: BackupWarningModalProps) {
  useRegisterModal(isOpen, {
    id: "backup-warning-modal",
    allowEscape: true,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-center border-b p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-warning h-8 w-8" />
            <h2 className="text-card-foreground text-2xl font-bold">
              Backup Failed
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground mb-6 text-sm">
            The backup failed, but you can still proceed with the update if you
            wish.
            <br />
            <br />
            <strong className="text-foreground">Warning:</strong> Proceeding
            without a backup means you won&apos;t be able to restore the
            container if something goes wrong during the update.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
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
              className="bg-warning hover:bg-warning/90 w-full sm:w-auto"
            >
              Proceed Anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
