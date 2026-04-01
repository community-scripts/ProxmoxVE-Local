"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface DiffViewerProps {
  scriptSlug: string;
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DiffViewer({
  scriptSlug,
  filePath,
  isOpen,
  onClose,
}: DiffViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get diff content
  const { data: diffData, refetch } = api.scripts.getScriptDiff.useQuery(
    { slug: scriptSlug, filePath },
    { enabled: isOpen && !!scriptSlug && !!filePath },
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await refetch();
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const renderDiffLine = (line: string, index: number) => {
    const lineNumberMatch = /^([+-]?\d+):/.exec(line);
    const lineNumber = lineNumberMatch?.[1];
    const content = line.replace(/^[+-]?\d+:\s*/, "");
    const isAdded = line.startsWith("+");
    const isRemoved = line.startsWith("-");

    return (
      <div
        key={index}
        className={`flex font-mono text-sm ${
          isAdded
            ? "bg-success/10 text-success border-success border-l-4"
            : isRemoved
              ? "bg-destructive/10 text-destructive border-destructive border-l-4"
              : "bg-muted text-muted-foreground"
        }`}
      >
        <div className="text-muted-foreground w-16 pr-2 text-right select-none">
          {lineNumber}
        </div>
        <div className="flex-1 pl-2">
          <span
            className={
              isAdded ? "text-success" : isRemoved ? "text-destructive" : ""
            }
          >
            {isAdded ? "+" : isRemoved ? "-" : " "}
          </span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border-border mx-4 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg border shadow-xl sm:mx-0">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-foreground text-xl font-bold">Script Diff</h2>
            <p className="text-muted-foreground text-sm">{filePath}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-3 py-1 text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close diff viewer"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-muted border-border border-b px-4 py-2">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="bg-success/20 border-success/40 h-3 w-3 border"></div>
              <span className="text-success">Added (Remote)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="bg-destructive/20 border-destructive/40 h-3 w-3 border"></div>
              <span className="text-destructive">Removed (Local)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="bg-muted border-border h-3 w-3 border"></div>
              <span className="text-muted-foreground">Unchanged</span>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          {diffData?.success ? (
            diffData.diff ? (
              <div className="divide-border divide-y">
                {diffData.diff
                  .split("\n")
                  .map((line, index) =>
                    line.trim() ? renderDiffLine(line, index) : null,
                  )}
              </div>
            ) : (
              <div className="text-muted-foreground p-8 text-center">
                <svg
                  className="text-muted-foreground mx-auto mb-4 h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>No differences found</p>
                <p className="text-sm">
                  The local and remote files are identical
                </p>
              </div>
            )
          ) : diffData?.error ? (
            <div className="text-destructive p-8 text-center">
              <svg
                className="text-destructive mx-auto mb-4 h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>Error loading diff</p>
              <p className="text-sm">{diffData.error}</p>
            </div>
          ) : (
            <div className="text-muted-foreground p-8 text-center">
              <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
              <p>Loading diff...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
