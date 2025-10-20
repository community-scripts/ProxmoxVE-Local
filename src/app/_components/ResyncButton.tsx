"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function ResyncButton() {
  const { t } = useTranslation("resyncButton");
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const resyncMutation = api.scripts.resyncScripts.useMutation({
    onSuccess: (data) => {
      setIsResyncing(false);
      setLastSync(new Date());
      if (data.success) {
        setSyncMessage(data.message ?? t("messages.success"));
        // Reload the page after successful sync
        setTimeout(() => {
          window.location.reload();
        }, 2000); // Wait 2 seconds to show the success message
      } else {
        setSyncMessage(data.error ?? t("messages.failed"));
        // Clear message after 3 seconds for errors
        setTimeout(() => setSyncMessage(null), 3000);
      }
    },
    onError: (error) => {
      setIsResyncing(false);
      setSyncMessage(
        t("messages.error", { values: { message: error.message } }),
      );
      setTimeout(() => setSyncMessage(null), 3000);
    },
  });

  const handleResync = async () => {
    setIsResyncing(true);
    setSyncMessage(null);
    resyncMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="text-muted-foreground text-sm font-medium">
        {t("syncDescription")}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleResync}
            disabled={isResyncing}
            variant="outline"
            size="default"
            className="inline-flex items-center"
          >
            {isResyncing ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                <span>{t("syncing")}</span>
              </>
            ) : (
              <>
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{t("syncJsonFiles")}</span>
              </>
            )}
          </Button>
          <ContextualHelpIcon
            section="sync-button"
            tooltip={t("helpTooltip")}
          />
        </div>

        {lastSync && (
          <div className="text-muted-foreground text-xs">
            {t("lastSync", { values: { time: lastSync.toLocaleTimeString() } })}
          </div>
        )}
      </div>

      {syncMessage && (
        <div
          className={`rounded-lg px-3 py-1 text-sm ${
            syncMessage.includes("Error") ||
            syncMessage.includes("Failed") ||
            syncMessage.includes("Fehler")
              ? "bg-error/10 text-error"
              : "bg-success/10 text-success"
          }`}
        >
          {syncMessage}
        </div>
      )}
    </div>
  );
}
