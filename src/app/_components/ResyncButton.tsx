'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';

export function ResyncButton() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const resyncMutation = api.scripts.resyncScripts.useMutation({
    onSuccess: (data) => {
      setIsResyncing(false);
      setLastSync(new Date());
      if (data.success) {
        setSyncMessage(data.message ?? 'Scripts synced successfully');
        // Reload the page after successful sync
        setTimeout(() => {
          window.location.reload();
        }, 2000); // Wait 2 seconds to show the success message
      } else {
        setSyncMessage(data.error ?? 'Failed to sync scripts');
        // Clear message after 3 seconds for errors
        setTimeout(() => setSyncMessage(null), 3000);
      }
    },
    onError: (error) => {
      setIsResyncing(false);
      setSyncMessage(`Error: ${error.message}`);
      setTimeout(() => setSyncMessage(null), 3000);
    },
  });

  const handleResync = async () => {
    setIsResyncing(true);
    setSyncMessage(null);
    resyncMutation.mutate();
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
        Sync scripts with ProxmoxVE repo
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={handleResync}
          disabled={isResyncing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isResyncing
              ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
              : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
          }`}
        >
          {isResyncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sync Json Files</span>
            </>
          )}
        </button>

        {lastSync && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last sync: {lastSync.toLocaleTimeString()}
          </div>
        )}
      </div>

      {syncMessage && (
        <div className={`text-sm px-3 py-1 rounded-lg ${
          syncMessage.includes('Error') || syncMessage.includes('Failed')
            ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
            : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        }`}>
          {syncMessage}
        </div>
      )}
    </div>
  );
}
