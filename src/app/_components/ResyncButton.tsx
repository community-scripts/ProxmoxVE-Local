'use client';

import { useState, useRef } from 'react';
import { api } from '~/trpc/react';
import { Button } from './ui/button';
import { ContextualHelpIcon } from './ContextualHelpIcon';

export function ResyncButton() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const hasReloadedRef = useRef<boolean>(false);
  const isUserInitiatedRef = useRef<boolean>(false);

  const resyncMutation = api.scripts.resyncScripts.useMutation({
    onSuccess: (data) => {
      setIsResyncing(false);
      setLastSync(new Date());
      if (data.success) {
        setSyncMessage(data.message ?? 'Scripts synced successfully');
        // Only reload if this was triggered by user action
        if (isUserInitiatedRef.current && !hasReloadedRef.current) {
          hasReloadedRef.current = true;
          setTimeout(() => {
            window.location.reload();
          }, 2000); // Wait 2 seconds to show the success message
        } else {
          // Reset flag if reload didn't happen
          isUserInitiatedRef.current = false;
        }
      } else {
        setSyncMessage(data.error ?? 'Failed to sync scripts');
        // Clear message after 3 seconds for errors
        setTimeout(() => setSyncMessage(null), 3000);
        isUserInitiatedRef.current = false;
      }
    },
    onError: (error) => {
      setIsResyncing(false);
      setSyncMessage(`Error: ${error.message}`);
      setTimeout(() => setSyncMessage(null), 3000);
      isUserInitiatedRef.current = false;
    },
  });

  const handleResync = async () => {
    // Prevent multiple simultaneous sync operations
    if (isResyncing) return;
    
    // Mark as user-initiated before starting
    isUserInitiatedRef.current = true;
    hasReloadedRef.current = false;
    setIsResyncing(true);
    setSyncMessage(null);
    resyncMutation.mutate();
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="text-sm text-muted-foreground font-medium">
        Sync scripts with configured repositories
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Sync Json Files</span>
              </>
            )}
          </Button>
          <ContextualHelpIcon section="sync-button" tooltip="Help with Sync Button" />
        </div>

        {lastSync && (
          <div className="text-xs text-muted-foreground">
            Last sync: {lastSync.toLocaleTimeString()}
          </div>
        )}
      </div>

      {syncMessage && (
        <div className={`text-sm px-3 py-1 rounded-lg ${
          syncMessage.includes('Error') || syncMessage.includes('Failed')
            ? 'bg-error/10 text-error'
            : 'bg-success/10 text-success'
        }`}>
          {syncMessage}
        </div>
      )}
    </div>
  );
}
