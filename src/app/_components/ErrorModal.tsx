"use client";

import { useEffect } from "react";
import { Button } from "./ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "~/lib/i18n/useTranslation";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  details?: string;
  type?: "error" | "success";
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  details,
  type = "error",
}: ErrorModalProps) {
  const { t } = useTranslation("errorModal");
  const { t: tc } = useTranslation("common.actions");
  useRegisterModal(isOpen, { id: "error-modal", allowEscape: true, onClose });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-lg rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-center border-b p-6">
          <div className="flex items-center gap-3">
            {type === "success" ? (
              <CheckCircle className="text-success h-8 w-8" />
            ) : (
              <AlertCircle className="text-error h-8 w-8" />
            )}
            <h2 className="text-foreground text-xl font-semibold">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-foreground mb-4 text-sm">{message}</p>
          {details && (
            <div
              className={`rounded-lg p-3 ${
                type === "success"
                  ? "bg-success/10 border-success/20 border"
                  : "bg-error/10 border-error/20 border"
              }`}
            >
              <p
                className={`mb-1 text-xs font-medium ${
                  type === "success"
                    ? "text-success-foreground"
                    : "text-error-foreground"
                }`}
              >
                {type === "success"
                  ? t("detailsLabel")
                  : t("errorDetailsLabel")}
              </p>
              <pre
                className={`text-xs break-words whitespace-pre-wrap ${
                  type === "success" ? "text-success/80" : "text-error/80"
                }`}
              >
                {details}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex justify-end gap-3 border-t p-6">
          <Button variant="outline" onClick={onClose}>
            {tc("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
