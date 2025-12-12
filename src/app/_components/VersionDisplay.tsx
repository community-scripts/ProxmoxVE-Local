'use client';

import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { UpdateConfirmationModal } from "./UpdateConfirmationModal";

import { ExternalLink, Download, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface VersionDisplayProps {
  onOpenReleaseNotes?: () => void;
}

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

export function VersionDisplay({ onOpenReleaseNotes }: VersionDisplayProps = {}) {
  const { data: versionStatus, isLoading, error } = api.version.getVersionStatus.useQuery();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [shouldSubscribe, setShouldSubscribe] = useState(false);
  const [updateStartTime, setUpdateStartTime] = useState<number | null>(null);
  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
  const lastLogTimeRef = useRef<number>(0);
  
  // Initialize lastLogTimeRef in useEffect to avoid calling Date.now() during render
  useEffect(() => {
    if (lastLogTimeRef.current === 0) {
      lastLogTimeRef.current = Date.now();
    }
  }, []);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasReloadedRef = useRef<boolean>(false);
  const isUpdatingRef = useRef<boolean>(false);
  const isNetworkErrorRef = useRef<boolean>(false);
  const updateSessionIdRef = useRef<string | null>(null);
  const updateStartTimeRef = useRef<number | null>(null);
  const logFileModifiedTimeRef = useRef<number | null>(null);
  const isCompleteProcessedRef = useRef<boolean>(false);
  
  const executeUpdate = api.version.executeUpdate.useMutation({
    onSuccess: (result) => {
      setUpdateResult({ success: result.success, message: result.message });
      
      if (result.success) {
        // Start subscribing to update logs only if we're actually updating
        if (isUpdatingRef.current) {
          setShouldSubscribe(true);
          setUpdateLogs(['Update started...']);
        }
      } else {
        setIsUpdating(false);
        setShouldSubscribe(false); // Reset subscription on failure
        updateSessionIdRef.current = null;
        updateStartTimeRef.current = null;
        logFileModifiedTimeRef.current = null;
        isCompleteProcessedRef.current = false;
      }
    },
    onError: (error) => {
      setUpdateResult({ success: false, message: error.message });
      setIsUpdating(false);
      setShouldSubscribe(false); // Reset subscription on error
      updateSessionIdRef.current = null;
      updateStartTimeRef.current = null;
      logFileModifiedTimeRef.current = null;
      isCompleteProcessedRef.current = false;
    }
  });

  // Poll for update logs - only enabled when shouldSubscribe is true AND we're updating
  const { data: updateLogsData } = api.version.getUpdateLogs.useQuery(undefined, {
    enabled: shouldSubscribe && isUpdating,
    refetchInterval: shouldSubscribe && isUpdating ? 1000 : false, // Poll every second only when updating
    refetchIntervalInBackground: false, // Don't poll in background to prevent stale data
  });

  // Attempt to reconnect and reload page when server is back
  // Memoized with useCallback to prevent recreation on every render
  // Only depends on refs to avoid stale closures
  const startReconnectAttempts = useCallback(() => {
    // CRITICAL: Stricter guard - check refs BEFORE starting reconnect attempts
    // Only start if we're actually updating and haven't already started
    // Double-check isUpdating state and session validity to prevent false triggers from stale data
    if (reconnectIntervalRef.current || !isUpdatingRef.current || hasReloadedRef.current || !updateStartTimeRef.current) {
      return;
    }
    
    // Validate session age before starting reconnection attempts
    const sessionAge = Date.now() - updateStartTimeRef.current;
    const MAX_SESSION_AGE = 30 * 60 * 1000; // 30 minutes
    if (sessionAge > MAX_SESSION_AGE) {
      // Session is stale, don't start reconnection
      return;
    }
    
    setUpdateLogs(prev => [...prev, 'Attempting to reconnect...']);
    
    reconnectIntervalRef.current = setInterval(() => {
      void (async () => {
        // Guard: Only proceed if we're still updating and in network error state
        // Check refs directly to avoid stale closures
        if (!isUpdatingRef.current || !isNetworkErrorRef.current || hasReloadedRef.current || !updateStartTimeRef.current) {
          // Clear interval if we're no longer updating
          if (!isUpdatingRef.current && reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          return;
        }
        
        // Validate session is still valid
        const currentSessionAge = Date.now() - updateStartTimeRef.current;
        if (currentSessionAge > MAX_SESSION_AGE) {
          // Session expired, stop reconnection attempts
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          return;
        }
        
        try {
          // Try to fetch the root path to check if server is back
          const response = await fetch('/', { method: 'HEAD' });
          if (response.ok || response.status === 200) {
            // Double-check we're still updating and session is valid before reloading
            if (!isUpdatingRef.current || hasReloadedRef.current || !updateStartTimeRef.current) {
              return;
            }
            
            // Final session validation
            const finalSessionAge = Date.now() - updateStartTimeRef.current;
            if (finalSessionAge > MAX_SESSION_AGE) {
              return;
            }
            
            // Mark that we're about to reload to prevent multiple reloads
            hasReloadedRef.current = true;
            setUpdateLogs(prev => [...prev, 'Server is back online! Reloading...']);
            
            // Clear interval
            if (reconnectIntervalRef.current) {
              clearInterval(reconnectIntervalRef.current);
              reconnectIntervalRef.current = null;
            }
            
            // Clear any existing reload timeout
            if (reloadTimeoutRef.current) {
              clearTimeout(reloadTimeoutRef.current);
              reloadTimeoutRef.current = null;
            }
            
            // Set reload timeout
            reloadTimeoutRef.current = setTimeout(() => {
              reloadTimeoutRef.current = null;
              window.location.reload();
            }, 1000);
          }
        } catch {
          // Server still down, keep trying
        }
      })();
    }, 2000);
  }, []); // Empty deps - only uses refs which are stable

  // Update logs when data changes
  useEffect(() => {
    // CRITICAL: Only process update logs if we're actually updating
    // This prevents stale isComplete data from triggering reloads when not updating
    if (!isUpdating || !updateStartTimeRef.current) {
      return;
    }
    
    // CRITICAL: Validate session - only process logs from current update session
    // Check that update started within last 30 minutes (reasonable window for update)
    const sessionAge = Date.now() - updateStartTimeRef.current;
    const MAX_SESSION_AGE = 30 * 60 * 1000; // 30 minutes
    if (sessionAge > MAX_SESSION_AGE) {
      // Session is stale, reset everything
      setTimeout(() => {
        setIsUpdating(false);
        setShouldSubscribe(false);
      }, 0);
      updateSessionIdRef.current = null;
      updateStartTimeRef.current = null;
      logFileModifiedTimeRef.current = null;
      isCompleteProcessedRef.current = false;
      return;
    }
    
    if (updateLogsData?.success && updateLogsData.logs) {
      
      if (updateLogsData.logFileModifiedTime !== null && logFileModifiedTimeRef.current !== null) {
        
        if (updateLogsData.logFileModifiedTime < logFileModifiedTimeRef.current) {
        
          return;
        }
      } else if (updateLogsData.logFileModifiedTime !== null && updateStartTimeRef.current) {
       
        const timeDiff = updateLogsData.logFileModifiedTime - updateStartTimeRef.current;
        if (timeDiff < -5000) {
         
        }
        logFileModifiedTimeRef.current = updateLogsData.logFileModifiedTime;
      }
      
      lastLogTimeRef.current = Date.now();
      setTimeout(() => setUpdateLogs(updateLogsData.logs), 0);
      
      
      if (
        updateLogsData.isComplete && 
        isUpdating && 
        updateStartTimeRef.current && 
        sessionAge < MAX_SESSION_AGE &&
        !isCompleteProcessedRef.current
      ) {
        // Mark as processed immediately to prevent multiple triggers
        isCompleteProcessedRef.current = true;
        
        // Stop polling immediately to prevent further stale data processing
        setTimeout(() => setShouldSubscribe(false), 0);
        
        setTimeout(() => {
          setUpdateLogs(prev => [...prev, 'Update complete! Server restarting...']);
          setIsNetworkError(true);
        }, 0);
        
        // Start reconnection attempts when we know update is complete
        setTimeout(() => startReconnectAttempts(), 0);
      }
    }
  }, [updateLogsData, startReconnectAttempts, isUpdating]);

  // Monitor for server connection loss and auto-reload (fallback only)
  useEffect(() => {
    // Early return: only run if we're actually updating
    if (!shouldSubscribe || !isUpdating) return;

    // Only use this as a fallback - the main trigger should be completion detection
    const checkInterval = setInterval(() => {
      // Check refs first to ensure we're still updating
      if (!isUpdatingRef.current || hasReloadedRef.current) {
        return;
      }

      const timeSinceLastLog = Date.now() - lastLogTimeRef.current;
      
      // Only start reconnection if we've been updating for at least 3 minutes
      // and no logs for 60 seconds (very conservative fallback)
      const hasBeenUpdatingLongEnough = updateStartTime && (Date.now() - updateStartTime) > 180000; // 3 minutes
      const noLogsForAWhile = timeSinceLastLog > 60000; // 60 seconds
      
      // Additional guard: check refs again before triggering and validate session
      const sessionAge = updateStartTimeRef.current ? Date.now() - updateStartTimeRef.current : Infinity;
      const MAX_SESSION_AGE = 30 * 60 * 1000; // 30 minutes
      if (hasBeenUpdatingLongEnough && noLogsForAWhile && isUpdatingRef.current && !isNetworkErrorRef.current && updateStartTimeRef.current && sessionAge < MAX_SESSION_AGE) {
        setIsNetworkError(true);
        setUpdateLogs(prev => [...prev, 'Server restarting... waiting for reconnection...']);
        
        // Start trying to reconnect
        startReconnectAttempts();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [shouldSubscribe, isUpdating, updateStartTime, startReconnectAttempts]);

  // Keep refs in sync with state
  useEffect(() => {
    isUpdatingRef.current = isUpdating;
    // CRITICAL: Reset shouldSubscribe immediately when isUpdating becomes false
    // This prevents stale polling from continuing
    if (!isUpdating) {
      setTimeout(() => {
        setShouldSubscribe(false);
      }, 0);
      // Reset completion processing flag when update stops
      isCompleteProcessedRef.current = false;
    }
  }, [isUpdating]);

  useEffect(() => {
    isNetworkErrorRef.current = isNetworkError;
  }, [isNetworkError]);

  // Keep updateStartTime ref in sync
  useEffect(() => {
    updateStartTimeRef.current = updateStartTime;
  }, [updateStartTime]);

  // Clear reconnect interval when update completes or component unmounts
  useEffect(() => {
    // If we're no longer updating, clear the reconnect interval and reset subscription
    if (!isUpdating) {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      // Clear reload timeout if update stops
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
      // Reset subscription to prevent stale polling
      setTimeout(() => {
        setShouldSubscribe(false);
      }, 0);
      // Reset completion processing flag
      isCompleteProcessedRef.current = false;
      // Don't clear session refs here - they're cleared explicitly on unmount or new update
    }
    
    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, [isUpdating]);

  // Cleanup on component unmount - reset all update-related state
  useEffect(() => {
    return () => {
      // Clear all intervals
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      // Reset all refs and state
      updateSessionIdRef.current = null;
      updateStartTimeRef.current = null;
      logFileModifiedTimeRef.current = null;
      isCompleteProcessedRef.current = false;
      hasReloadedRef.current = false;
      isUpdatingRef.current = false;
      isNetworkErrorRef.current = false;
    };
  }, []);

  const handleUpdate = () => {
    // Show confirmation modal instead of starting update directly
    setShowUpdateConfirmation(true);
  };

  // Helper to generate secure random string
  function getSecureRandomString(length: number): string {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    // Convert to base36 string (alphanumeric)
    return Array.from(array, b => b.toString(36)).join('').substr(0, length);
  }

  const handleConfirmUpdate = () => {
    // Close the confirmation modal
    setShowUpdateConfirmation(false);
    // Start the actual update process
    const randomSuffix = getSecureRandomString(9);
    const sessionId = `update_${Date.now()}_${randomSuffix}`;
    const startTime = Date.now();
    
    setIsUpdating(true);
    setUpdateResult(null);
    setIsNetworkError(false);
    setUpdateLogs([]);
    setShouldSubscribe(false); // Will be set to true in mutation onSuccess
    setUpdateStartTime(startTime);
    
    // Set refs for session tracking
    updateSessionIdRef.current = sessionId;
    updateStartTimeRef.current = startTime;
    lastLogTimeRef.current = startTime;
    logFileModifiedTimeRef.current = null; // Will be set when we first see log file
    isCompleteProcessedRef.current = false; // Reset completion flag
    hasReloadedRef.current = false; // Reset reload flag when starting new update
    
    // Clear any existing reconnect interval and reload timeout
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    
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
      
      {/* Update Confirmation Modal */}
      {versionStatus?.releaseInfo && (
        <UpdateConfirmationModal
          isOpen={showUpdateConfirmation}
          onClose={() => setShowUpdateConfirmation(false)}
          onConfirm={handleConfirmUpdate}
          releaseInfo={versionStatus.releaseInfo}
          currentVersion={versionStatus.currentVersion}
          latestVersion={versionStatus.latestVersion}
        />
      )}
      
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
        <Badge 
          variant={isUpToDate ? "default" : "secondary"} 
          className={`text-xs ${onOpenReleaseNotes ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={onOpenReleaseNotes}
        >
          v{currentVersion}
        </Badge>
        
        {updateAvailable && releaseInfo && (
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
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
              
              <ContextualHelpIcon section="update-system" tooltip="Help with updates" />
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Release Notes:</span>
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
