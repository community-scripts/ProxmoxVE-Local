"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, Info } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "~/lib/i18n/useTranslation";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant: "simple" | "danger";
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
  confirmButtonText,
  cancelButtonText,
}: ConfirmationModalProps) {
  const { t } = useTranslation("confirmationModal");
  const { t: tc } = useTranslation("common.actions");
  const [typedText, setTypedText] = useState("");
  const isDanger = variant === "danger";
  const allowEscape = useMemo(() => !isDanger, [isDanger]);

  // Use provided button texts or fallback to translations
  const finalConfirmText = confirmButtonText ?? tc("confirm");
  const finalCancelText = cancelButtonText ?? tc("cancel");

  useRegisterModal(isOpen, { id: "confirmation-modal", allowEscape, onClose });

  if (!isOpen) return null;
  const isConfirmEnabled = isDanger ? typedText === confirmText : true;

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setTypedText(""); // Reset for next time
    }
  };

  const handleClose = () => {
    onClose();
    setTypedText(""); // Reset when closing
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-center border-b p-6">
          <div className="flex items-center gap-3">
            {isDanger ? (
              <AlertTriangle className="text-error h-8 w-8" />
            ) : (
              <Info className="text-info h-8 w-8" />
            )}
            <h2 className="text-card-foreground text-2xl font-bold">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground mb-6 text-sm">{message}</p>

          {/* Type-to-confirm input for danger variant */}
          {isDanger && confirmText && (
            <div className="mb-6">
              <label className="text-foreground mb-2 block text-sm font-medium">
                {
                  t("typeToConfirm", { values: { text: confirmText } }).split(
                    confirmText,
                  )[0]
                }
                <code className="bg-muted rounded px-2 py-1 text-sm">
                  {confirmText}
                </code>
                {
                  t("typeToConfirm", { values: { text: confirmText } }).split(
                    confirmText,
                  )[1]
                }
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring focus:border-ring w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                placeholder={t("placeholder", {
                  values: { text: confirmText },
                })}
                autoComplete="off"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <Button
              onClick={handleClose}
              variant="outline"
              size="default"
              className="w-full sm:w-auto"
            >
              {finalCancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isConfirmEnabled}
              variant={isDanger ? "destructive" : "default"}
              size="default"
              className="w-full sm:w-auto"
            >
              {finalConfirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
