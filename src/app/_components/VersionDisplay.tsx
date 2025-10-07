'use client';

import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ExternalLink, Download, RefreshCw, Loader2, Check } from "lucide-react";
import { useState } from "react";

// Loading overlay component
function LoadingOverlay({ isNetworkError = false }: { isNetworkError?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md mx-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-800 animate-pulse"></div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {isNetworkError ? 'Server Restarting' : 'Updating Application'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isNetworkError 
                ? 'The server is restarting after the update...' 
                : 'Please stand by while we update your application...'
              }
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {isNetworkError 
                ? 'This may take a few moments. The page will reload automatically. You may see a blank page for up to a minute!.'
                : 'The server will restart automatically when complete.'
              }
            </p>
          </div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VersionDisplay() {
  const { data: versionStatus, isLoading, error } = api.version.getVersionStatus.useQuery();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [updateStartTime, setUpdateStartTime] = useState<number | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  
  const executeUpdate = api.version.executeUpdate.useMutation({
    onSuccess: (result: any) => {
      const now = Date.now();
      const elapsed = updateStartTime ? now - updateStartTime : 0;
 
      
      setUpdateResult({ success: result.success, message: result.message });
      
      if (result.success) {
        // The script now runs independently, so we show a longer overlay
        // and wait for the server to restart
        setIsNetworkError(true);
        setUpdateResult({ success: true, message: 'Update in progress... Server will restart automatically.' });

        // Wait longer for the update to complete and server to restart
        setTimeout(() => {
          setIsUpdating(false);
          setIsNetworkError(false);
          // Try to reload after the update completes
          setTimeout(() => {
            window.location.reload();
          }, 10000); // 10 seconds to allow for update completion
        }, 5000); // Show overlay for 5 seconds
      } else {
        // For errors, show for at least 1 second
        const remainingTime = Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          setIsUpdating(false);
        }, remainingTime);
      }
    },
    onError: (error) => {
      const now = Date.now();
      const elapsed = updateStartTime ? now - updateStartTime : 0;
      
      // Check if this is a network error (expected during server restart)
      const isNetworkError = error.message.includes('Failed to fetch') || 
                            error.message.includes('NetworkError') ||
                            error.message.includes('fetch') ||
                            error.message.includes('network');
      
      if (isNetworkError && elapsed < 60000) { // If it's a network error within 30 seconds, treat as success
        setIsNetworkError(true);
        setUpdateResult({ success: true, message: 'Update in progress... Server is restarting.' });
        
        // Wait longer for server to come back up
        setTimeout(() => {
          setIsUpdating(false);
          setIsNetworkError(false);
          // Try to reload after a longer delay
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        }, 3000);
      } else {
        // For real errors, show for at least 1 second
        setUpdateResult({ success: false, message: error.message });
        const remainingTime = Math.max(0, 1000 - elapsed);
        setTimeout(() => {
          setIsUpdating(false);
        }, remainingTime);
      }
    }
  });

  const handleUpdate = () => {
    setIsUpdating(true);
    setUpdateResult(null);
    setIsNetworkError(false);
    setUpdateStartTime(Date.now());
    executeUpdate.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="animate-pulse">
          Loading...
        </Badge>
      </div>
    );
  }

  if (error || !versionStatus?.success) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive">
          v{versionStatus?.currentVersion ?? 'Unknown'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          (Unable to check for updates)
        </span>
      </div>
    );
  }

  const { currentVersion, isUpToDate, updateAvailable, releaseInfo } = versionStatus;

  return (
    <>
      {/* Loading overlay */}
      {isUpdating && <LoadingOverlay isNetworkError={isNetworkError} />}
      
      <div className="flex items-center gap-2">
        <Badge variant={isUpToDate ? "default" : "secondary"}>
          v{currentVersion}
        </Badge>
        
        {updateAvailable && releaseInfo && (
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Badge variant="destructive" className="animate-pulse cursor-help">
                Update Available
              </Badge>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                <div className="text-center">
                  <div className="font-semibold mb-1">How to update:</div>
                  <div>Click the button to update</div>
                  <div>or update manually:</div>
                  <div>cd $PVESCRIPTLOCAL_DIR</div>
                  <div>git pull</div>
                  <div>npm install</div>
                  <div>npm run build</div>
                  <div>npm start</div>
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
              </div>
            </div>
            
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              size="sm"
              variant="destructive"
              className="text-xs h-6 px-2"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1" />
                  Update Now
                </>
              )}
            </Button>
            
            <a
              href={releaseInfo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="View latest release"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
            
            {updateResult && (
              <div className={`text-xs px-2 py-1 rounded ${
                updateResult.success 
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}>
                {updateResult.message}
              </div>
            )}
          </div>
        )}
        
        {isUpToDate && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Up to date
          </span>
        )}
      </div>
    </>
  );
}
