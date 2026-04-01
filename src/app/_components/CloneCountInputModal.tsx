"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Copy, X } from "lucide-react";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";

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
  storageName,
}: CloneCountInputModalProps) {
  const [cloneCount, setCloneCount] = useState<number>(1);

  const zIndex = useRegisterModal(isOpen, {
    id: "clone-count-input-modal",
    allowEscape: true,
    onClose,
  });

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
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
      >
        <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Copy className="text-primary h-6 w-6" />
              <h2 className="text-card-foreground text-2xl font-bold">
                Clone Count
              </h2>
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
            <p className="text-muted-foreground mb-4 text-sm">
              How many clones would you like to create?
            </p>

            {storageName && (
              <div className="bg-muted/50 mb-4 rounded-lg p-3">
                <p className="text-muted-foreground text-sm">Storage:</p>
                <p className="text-foreground text-sm font-medium">
                  {storageName}
                </p>
              </div>
            )}

            <div className="mb-6 space-y-2">
              <label
                htmlFor="cloneCount"
                className="text-foreground block text-sm font-medium"
              >
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
                  } else if (e.target.value === "") {
                    setCloneCount(1);
                  }
                }}
                className="w-full"
                placeholder="1"
              />
              <p className="text-muted-foreground text-xs">
                Enter a number between 1 and 100
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col justify-end gap-3 sm:flex-row">
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
    </ModalPortal>
  );
}
