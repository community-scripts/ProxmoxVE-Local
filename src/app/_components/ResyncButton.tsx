"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";

export function ResyncButton() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const hasReloadedRef = useRef<boolean>(false);
  const isUserInitiatedRef = useRef<boolean>(false);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resyncMutation = api.scripts.resyncScripts.useMutation({
    onSuccess: (data) => {
      setIsResyncing(false);
      setLastSync(new Date());
      if (data.success) {
        setSyncMessage(data.message ?? "Scripts synced successfully");
        // Only reload if this was triggered by user action
        if (isUserInitiatedRef.current && !hasReloadedRef.current) {
          hasReloadedRef.current = true;

          // Clear any existing reload timeout
          if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
            reloadTimeoutRef.current = null;
          }

          // Set new reload timeout
          reloadTimeoutRef.current = setTimeout(() => {
            reloadTimeoutRef.current = null;
            window.location.reload();
          }, 2000); // Wait 2 seconds to show the success message
        } else {
          // Reset flag if reload didn't happen
          isUserInitiatedRef.current = false;
        }
      } else {
        setSyncMessage(data.error ?? "Failed to sync scripts");
        // Clear message after 3 seconds for errors
        if (messageTimeoutRef.current) {
          clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => {
          setSyncMessage(null);
          messageTimeoutRef.current = null;
        }, 3000);
        isUserInitiatedRef.current = false;
      }
    },
    onError: (error) => {
      setIsResyncing(false);
      setSyncMessage(`Error: ${error.message}`);
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = setTimeout(() => {
        setSyncMessage(null);
        messageTimeoutRef.current = null;
      }, 3000);
      isUserInitiatedRef.current = false;
    },
  });

  const handleResync = async () => {
    // Prevent multiple simultaneous sync operations
    if (isResyncing) return;

    // Clear any pending reload timeout
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }

    // Mark as user-initiated before starting
    isUserInitiatedRef.current = true;
    hasReloadedRef.current = false;
    setIsResyncing(true);
    setSyncMessage(null);
    resyncMutation.mutate();
  };

  // Cleanup on unmount - clear any pending timeouts
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      // Reset refs on unmount
      hasReloadedRef.current = false;
      isUserInitiatedRef.current = false;
    };
  }, []);

  return (
    <>
      <Button
        onClick={handleResync}
        disabled={isResyncing}
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        title={isResyncing ? "Syncing..." : "Sync Scripts"}
        aria-label="Sync Scripts"
      >
        {isResyncing ? (
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
        ) : (
          <svg
            className="h-4 w-4"
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
        )}
      </Button>

      {syncMessage && (
        <div
          className={`rounded-lg px-2 py-1 text-xs ${
            syncMessage.includes("Error") || syncMessage.includes("Failed")
              ? "bg-error/10 text-error"
              : "bg-success/10 text-success"
          }`}
        >
          {syncMessage}
        </div>
      )}
    </>
  );
}
