'use client';

import { api } from "~/trpc/react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ExternalLink, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

export function VersionDisplay() {
  const { data: versionStatus, isLoading, error } = api.version.getVersionStatus.useQuery();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const executeUpdate = api.version.executeUpdate.useMutation({
    onSuccess: (result: any) => {
      setUpdateResult({ success: result.success, message: result.message });
      setIsUpdating(false);
      if (result.success) {
        // Refresh the page after successful update
        setTimeout(() => window.location.reload(), 2000);
      }
    },
    onError: (error) => {
      setUpdateResult({ success: false, message: error.message });
      setIsUpdating(false);
    }
  });

  const handleUpdate = () => {
    setIsUpdating(true);
    setUpdateResult(null);
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
    <div className="flex items-center gap-2">
      <Badge variant={isUpToDate ? "default" : "secondary"}>
        v{currentVersion}
      </Badge>
      
      {updateAvailable && releaseInfo && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Badge variant="destructive" className="animate-pulse cursor-help">
                Update Available
              </Badge>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                <div className="text-center">
                  <div className="font-semibold mb-1">How to update:</div>
                  <div>Click the button below to update</div>
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
          
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              size="sm"
              variant="destructive"
              className="text-xs"
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
        </div>
      )}
      
      {isUpToDate && (
        <span className="text-xs text-green-600 dark:text-green-400">
          ✓ Up to date
        </span>
      )}
    </div>
  );
}
