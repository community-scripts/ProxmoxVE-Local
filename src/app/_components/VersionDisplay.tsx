"use client";

import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { useTranslation } from "~/lib/i18n/useTranslation";

import { ExternalLink, Download, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface VersionDisplayProps {
  onOpenReleaseNotes?: () => void;
}

// Loading overlay component with log streaming
function LoadingOverlay({
  isNetworkError = false,
  logs = [],
}: {
  isNetworkError?: boolean;
  logs?: string[];
}) {
  const { t } = useTranslation("versionDisplay.loadingOverlay");
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border-border mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border p-8 shadow-2xl">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Loader2 className="text-primary h-12 w-12 animate-spin" />
            <div className="border-primary/20 absolute inset-0 animate-pulse rounded-full border-2"></div>
          </div>
          <div className="text-center">
            <h3 className="text-card-foreground mb-2 text-lg font-semibold">
              {isNetworkError
                ? t("serverRestarting")
                : t("updatingApplication")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {isNetworkError
                ? t("serverRestartingMessage")
                : t("updatingMessage")}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {isNetworkError ? t("serverRestartingNote") : t("updatingNote")}
            </p>
          </div>

          {/* Log output */}
          {logs.length > 0 && (
            <div className="bg-card border-border text-chart-2 terminal-output mt-4 max-h-60 w-full overflow-y-auto rounded-lg border p-4 font-mono text-xs">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="mb-1 break-words whitespace-pre-wrap"
                >
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          <div className="flex space-x-1">
            <div className="bg-primary h-2 w-2 animate-bounce rounded-full"></div>
            <div
              className="bg-primary h-2 w-2 animate-bounce rounded-full"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="bg-primary h-2 w-2 animate-bounce rounded-full"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VersionDisplay({
  onOpenReleaseNotes,
}: VersionDisplayProps = {}) {
  const { t } = useTranslation("versionDisplay");
  const { t: tOverlay } = useTranslation("versionDisplay.loadingOverlay");
  const {
    data: versionStatus,
    isLoading,
    error,
  } = api.version.getVersionStatus.useQuery();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [shouldSubscribe, setShouldSubscribe] = useState(false);
  const [updateStartTime, setUpdateStartTime] = useState<number | null>(null);
  const lastLogTimeRef = useRef<number>(Date.now());
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeUpdate = api.version.executeUpdate.useMutation({
    onSuccess: (result) => {
      setUpdateResult({ success: result.success, message: result.message });

      if (result.success) {
        // Start subscribing to update logs
        setShouldSubscribe(true);
        setUpdateLogs([tOverlay("updateStarted")]);
      } else {
        setIsUpdating(false);
      }
    },
    onError: (error) => {
      setUpdateResult({ success: false, message: error.message });
      setIsUpdating(false);
    },
  });

  // Poll for update logs
  const { data: updateLogsData } = api.version.getUpdateLogs.useQuery(
    undefined,
    {
      enabled: shouldSubscribe,
      refetchInterval: 1000, // Poll every second
      refetchIntervalInBackground: true,
    },
  );

  // Attempt to reconnect and reload page when server is back
  const startReconnectAttempts = useCallback(() => {
    if (reconnectIntervalRef.current) return;

    setUpdateLogs((prev) => [...prev, tOverlay("reconnecting")]);

    reconnectIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          // Try to fetch the root path to check if server is back
          const response = await fetch("/", { method: "HEAD" });
          if (response.ok || response.status === 200) {
            setUpdateLogs((prev) => [...prev, tOverlay("serverBackOnline")]);

            // Clear interval and reload
            if (reconnectIntervalRef.current) {
              clearInterval(reconnectIntervalRef.current);
            }

            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } catch {
          // Server still down, keep trying
        }
      })();
    }, 2000);
  }, [tOverlay]);

  // Update logs when data changes
  useEffect(() => {
    if (updateLogsData?.success && updateLogsData.logs) {
      lastLogTimeRef.current = Date.now();
      setUpdateLogs(updateLogsData.logs);

      if (updateLogsData.isComplete) {
        setUpdateLogs((prev) => [...prev, tOverlay("updateComplete")]);
        setIsNetworkError(true);
        // Start reconnection attempts when we know update is complete
        startReconnectAttempts();
      }
    }
  }, [updateLogsData, tOverlay, startReconnectAttempts]);

  // Monitor for server connection loss and auto-reload (fallback only)
  useEffect(() => {
    if (!shouldSubscribe) return;

    // Only use this as a fallback - the main trigger should be completion detection
    const checkInterval = setInterval(() => {
      const timeSinceLastLog = Date.now() - lastLogTimeRef.current;

      // Only start reconnection if we've been updating for at least 3 minutes
      // and no logs for 60 seconds (very conservative fallback)
      const hasBeenUpdatingLongEnough =
        updateStartTime && Date.now() - updateStartTime > 180000; // 3 minutes
      const noLogsForAWhile = timeSinceLastLog > 60000; // 60 seconds

      if (
        hasBeenUpdatingLongEnough &&
        noLogsForAWhile &&
        isUpdating &&
        !isNetworkError
      ) {
        setIsNetworkError(true);
        setUpdateLogs((prev) => [...prev, tOverlay("serverRestarting2")]);

        // Start trying to reconnect
        startReconnectAttempts();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [
    shouldSubscribe,
    isUpdating,
    updateStartTime,
    isNetworkError,
    tOverlay,
    startReconnectAttempts,
  ]);

  // Cleanup reconnect interval on unmount
  useEffect(() => {
    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    setUpdateResult(null);
    setIsNetworkError(false);
    setUpdateLogs([]);
    setShouldSubscribe(false);
    setUpdateStartTime(Date.now());
    lastLogTimeRef.current = Date.now();
    executeUpdate.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="animate-pulse">
          {t("loading")}
        </Badge>
      </div>
    );
  }

  if (error || !versionStatus?.success) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive">
          v{versionStatus?.currentVersion ?? t("unknownVersion")}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {t("unableToCheck")}
        </span>
      </div>
    );
  }

  const { currentVersion, isUpToDate, updateAvailable, releaseInfo } =
    versionStatus;

  return (
    <>
      {/* Loading overlay */}
      {isUpdating && (
        <LoadingOverlay isNetworkError={isNetworkError} logs={updateLogs} />
      )}

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-2">
        <Badge
          variant={isUpToDate ? "default" : "secondary"}
          className={`text-xs ${onOpenReleaseNotes ? "cursor-pointer transition-opacity hover:opacity-80" : ""}`}
          onClick={onOpenReleaseNotes}
        >
          v{currentVersion}
        </Badge>

        {updateAvailable && releaseInfo && (
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleUpdate}
                disabled={isUpdating}
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-xs"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">
                      {t("update.updating")}
                    </span>
                    <span className="sm:hidden">
                      {t("update.updatingShort")}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">
                      {t("update.updateNow")}
                    </span>
                    <span className="sm:hidden">
                      {t("update.updateNowShort")}
                    </span>
                  </>
                )}
              </Button>

              <ContextualHelpIcon
                section="update-system"
                tooltip={t("helpTooltip")}
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">
                {t("releaseNotes")}
              </span>
              <a
                href={releaseInfo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                title="View latest release"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {updateResult && (
              <div
                className={`rounded px-2 py-1 text-center text-xs ${
                  updateResult.success
                    ? "bg-chart-2/20 text-chart-2 border-chart-2/30 border"
                    : "bg-destructive/20 text-destructive border-destructive/30 border"
                }`}
              >
                {updateResult.message}
              </div>
            )}
          </div>
        )}

        {isUpToDate && (
          <span className="text-chart-2 text-xs">{t("upToDate")}</span>
        )}
      </div>
    </>
  );
}
