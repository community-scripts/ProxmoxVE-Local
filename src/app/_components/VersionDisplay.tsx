'use client';

import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

import { ExternalLink, Download, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

// Loading overlay component with log streaming
function LoadingOverlay({ 
  isNetworkError = false, 
  logs = [] 
}: { 
  isNetworkError?: boolean; 
  logs?: string[];
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-lg p-8 shadow-2xl border border-border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse"></div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-card-foreground mb-2">
              {isNetworkError ? 'Server Restarting' : 'Updating Application'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isNetworkError 
                ? 'The server is restarting after the update...' 
                : 'Please stand by while we update your application...'
              }
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {isNetworkError 
                ? 'This may take a few moments. The page will reload automatically.'
                : 'The server will restart automatically when complete.'
              }
            </p>
          </div>
          
          {/* Log output */}
          {logs.length > 0 && (
            <div className="w-full mt-4 bg-card border border-border rounded-lg p-4 font-mono text-xs text-chart-2 max-h-60 overflow-y-auto terminal-output">
              {logs.map((log, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap break-words">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
        setUpdateLogs(['Update started...']);
      } else {
        setIsUpdating(false);
      }
    },
    onError: (error) => {
      setUpdateResult({ success: false, message: error.message });
      setIsUpdating(false);
    }
  });

  // Poll for update logs
  const { data: updateLogsData } = api.version.getUpdateLogs.useQuery(undefined, {
    enabled: shouldSubscribe,
    refetchInterval: 1000, // Poll every second
    refetchIntervalInBackground: true,
  });

  // Update logs when data changes
  useEffect(() => {
    if (updateLogsData?.success && updateLogsData.logs) {
      lastLogTimeRef.current = Date.now();
      setUpdateLogs(updateLogsData.logs);
      
      if (updateLogsData.isComplete) {
        setUpdateLogs(prev => [...prev, 'Update complete! Server restarting...']);
        setIsNetworkError(true);
        // Start reconnection attempts when we know update is complete
        startReconnectAttempts();
      }
    }
  }, [updateLogsData]);

  // Monitor for server connection loss and auto-reload (fallback only)
  useEffect(() => {
    if (!shouldSubscribe) return;

    // Only use this as a fallback - the main trigger should be completion detection
    const checkInterval = setInterval(() => {
      const timeSinceLastLog = Date.now() - lastLogTimeRef.current;
      
      // Only start reconnection if we've been updating for at least 3 minutes
      // and no logs for 60 seconds (very conservative fallback)
      const hasBeenUpdatingLongEnough = updateStartTime && (Date.now() - updateStartTime) > 180000; // 3 minutes
      const noLogsForAWhile = timeSinceLastLog > 60000; // 60 seconds
      
      if (hasBeenUpdatingLongEnough && noLogsForAWhile && isUpdating && !isNetworkError) {
        console.log('Fallback: Assuming server restart due to long silence');
        setIsNetworkError(true);
        setUpdateLogs(prev => [...prev, 'Server restarting... waiting for reconnection...']);
        
        // Start trying to reconnect
        startReconnectAttempts();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [shouldSubscribe, isUpdating, updateStartTime, isNetworkError]);

  // Attempt to reconnect and reload page when server is back
  const startReconnectAttempts = () => {
    if (reconnectIntervalRef.current) return;
    
    setUpdateLogs(prev => [...prev, 'Attempting to reconnect...']);
    
    reconnectIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          // Try to fetch the root path to check if server is back
          const response = await fetch('/', { method: 'HEAD' });
          if (response.ok || response.status === 200) {
            setUpdateLogs(prev => [...prev, 'Server is back online! Reloading...']);
            
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
  };

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
      {isUpdating && <LoadingOverlay isNetworkError={isNetworkError} logs={updateLogs} />}
      
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
        <Badge variant={isUpToDate ? "default" : "secondary"} className="text-xs">
          v{currentVersion}
        </Badge>
        
        {updateAvailable && releaseInfo && (
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="relative group">
              <Badge variant="destructive" className="animate-pulse cursor-help text-xs">
                Update Available
              </Badge>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 hidden sm:block">
                <div className="text-center">
                  <div className="font-semibold mb-1">How to update:</div>
                  <div>Click the button to update, when installed via the helper script</div>
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
            
            <div className="flex items-center gap-2">
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
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Update Now</span>
                    <span className="sm:hidden">Update</span>
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
            </div>
            
            {updateResult && (
              <div className={`text-xs px-2 py-1 rounded text-center ${
                updateResult.success 
                  ? 'bg-chart-2/20 text-chart-2 border border-chart-2/30' 
                  : 'bg-destructive/20 text-destructive border border-destructive/30'
              }`}>
                {updateResult.message}
              </div>
            )}
          </div>
        )}
        
        {isUpToDate && (
          <span className="text-xs text-chart-2">
            ✓ Up to date
          </span>
        )}
      </div>
    </>
  );
}
