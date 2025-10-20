"use client";

import { Loader2 } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface LoadingModalProps {
  isOpen: boolean;
  action: string;
}

export function LoadingModal({ isOpen, action }: LoadingModalProps) {
  const { t } = useTranslation("loadingModal");
  useRegisterModal(isOpen, {
    id: "loading-modal",
    allowEscape: false,
    onClose: () => null,
  });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-md rounded-lg border p-8 shadow-xl">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Loader2 className="text-primary h-12 w-12 animate-spin" />
            <div className="border-primary/20 absolute inset-0 animate-pulse rounded-full border-2"></div>
          </div>
          <div className="text-center">
            <h3 className="text-card-foreground mb-2 text-lg font-semibold">
              {t("processing")}
            </h3>
            <p className="text-muted-foreground text-sm">{action}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {t("pleaseWait")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
