"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import {
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  SkipForward,
  AlertTriangle,
} from "lucide-react";

interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
  error?: string;
}

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SyncModalContent({ isOpen, onClose }: SyncModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "sync-modal",
    allowEscape: true,
    onClose,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resyncMutation = api.scripts.resyncScripts.useMutation({
    onSuccess: (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsSyncing(false);
      setResult({
        success: data.success,
        message: data.message ?? "Sync complete",
        count: data.count,
        error: data.error ?? undefined,
      });
    },
    onError: (error) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsSyncing(false);
      setResult({
        success: false,
        message: "Sync failed",
        error: error.message,
      });
    },
  });

  const handleSync = () => {
    setIsSyncing(true);
    setResult(null);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
    resyncMutation.mutate();
  };

  const handleCloseAndReload = () => {
    onClose();
    if (result?.success) {
      window.location.reload();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-start sync when modal opens
  useEffect(() => {
    if (isOpen && !isSyncing && !result) {
      handleSync();
    }
  }, [isOpen]);

  // Reset state when modal reopens
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setIsSyncing(false);
      setElapsedMs(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  // Parse result stats from message
  const parseStats = (message: string) => {
    const downloaded = /(?<num>\d+)\s*downloaded/.exec(message)?.groups?.num;
    const cached = /(?<num>\d+)\s*cached/.exec(message)?.groups?.num;
    const errors = /(?<num>\d+)\s*error/.exec(message)?.groups?.num;
    return { downloaded, cached, errors };
  };

  const stats = result?.message ? parseStats(result.message) : null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSyncing)
            handleCloseAndReload();
        }}
      >
        <div className="bg-card w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl">
          {/* Header */}
          <div className="border-border/60 flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSyncing ? "bg-primary/10" : result?.success ? "bg-success/10" : result ? "bg-destructive/10" : "bg-primary/10"}`}
              >
                {isSyncing ? (
                  <RefreshCw className="text-primary h-4 w-4 animate-spin" />
                ) : result?.success ? (
                  <CheckCircle2 className="text-success h-4 w-4" />
                ) : result ? (
                  <XCircle className="text-destructive h-4 w-4" />
                ) : (
                  <RefreshCw className="text-primary h-4 w-4" />
                )}
              </div>
              <h2 className="text-foreground text-lg font-bold tracking-tight">
                {isSyncing
                  ? "Syncing..."
                  : result?.success
                    ? "Sync Complete"
                    : result
                      ? "Sync Failed"
                      : "Sync"}
              </h2>
            </div>
            {!isSyncing && (
              <Button
                onClick={handleCloseAndReload}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="p-5">
            {isSyncing && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    Syncing logo cache with repository...
                  </p>
                  <span className="text-muted-foreground/60 font-mono text-xs tabular-nums">
                    {formatTime(elapsedMs)}
                  </span>
                </div>
                <div className="bg-primary/5 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full animate-pulse rounded-full"
                    style={{ width: "60%" }}
                  />
                </div>
              </div>
            )}

            {result && !isSyncing && (
              <div className="space-y-4">
                {result.success && stats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-success/5 border-success/20 flex flex-col items-center rounded-xl border p-3">
                      <Download className="text-success mb-1 h-4 w-4" />
                      <span className="text-foreground text-lg font-bold tabular-nums">
                        {stats.downloaded ?? 0}
                      </span>
                      <span className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                        Downloaded
                      </span>
                    </div>
                    <div className="bg-muted/30 flex flex-col items-center rounded-xl border p-3">
                      <SkipForward className="text-muted-foreground mb-1 h-4 w-4" />
                      <span className="text-foreground text-lg font-bold tabular-nums">
                        {stats.cached ?? 0}
                      </span>
                      <span className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                        Cached
                      </span>
                    </div>
                    <div
                      className={`flex flex-col items-center rounded-xl border p-3 ${Number(stats.errors) > 0 ? "border-destructive/20 bg-destructive/5" : "bg-muted/30"}`}
                    >
                      <AlertTriangle
                        className={`mb-1 h-4 w-4 ${Number(stats.errors) > 0 ? "text-destructive" : "text-muted-foreground"}`}
                      />
                      <span className="text-foreground text-lg font-bold tabular-nums">
                        {stats.errors ?? 0}
                      </span>
                      <span className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                        Errors
                      </span>
                    </div>
                  </div>
                )}

                {!result.success && (
                  <div className="bg-destructive/5 border-destructive/20 rounded-xl border p-4">
                    <p className="text-destructive text-sm font-medium">
                      {result.error ?? result.message}
                    </p>
                  </div>
                )}

                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Completed in {formatTime(elapsedMs)}</span>
                </div>

                <div className="flex gap-2">
                  {result.success ? (
                    <Button
                      onClick={handleCloseAndReload}
                      size="sm"
                      className="w-full"
                    >
                      Done & Reload
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSync}
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                      <Button
                        onClick={handleCloseAndReload}
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                      >
                        Close
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function ResyncButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title="Sync Scripts"
        aria-label="Sync Scripts"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      <SyncModalContent isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
