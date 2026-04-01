"use client";

import { useState, useEffect, startTransition } from "react";
import { api } from "~/trpc/react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { X, ExternalLink, Calendar, Tag, Loader2 } from "lucide-react";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightVersion?: string;
}

interface Release {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
}

// Helper functions for localStorage
const getLastSeenVersion = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("LAST_SEEN_RELEASE_VERSION");
};

const markVersionAsSeen = (version: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("LAST_SEEN_RELEASE_VERSION", version);
};

export function ReleaseNotesModal({
  isOpen,
  onClose,
  highlightVersion,
}: ReleaseNotesModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "release-notes-modal",
    allowEscape: true,
    onClose,
  });
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const {
    data: releasesData,
    isLoading,
    error,
  } = api.version.getAllReleases.useQuery(undefined, {
    enabled: isOpen,
  });
  const { data: versionData } = api.version.getCurrentVersion.useQuery(
    undefined,
    {
      enabled: isOpen,
    },
  );

  // Get current version when modal opens
  useEffect(() => {
    if (isOpen && versionData?.success && versionData.version) {
      startTransition(() => {
        setCurrentVersion(versionData.version);
      });
    }
  }, [isOpen, versionData]);

  // Mark version as seen when modal closes
  const handleClose = () => {
    if (currentVersion) {
      markVersionAsSeen(currentVersion);
    }
    onClose();
  };

  if (!isOpen) return null;

  const releases: Release[] = releasesData?.success
    ? (releasesData.releases ?? [])
    : [];

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
      >
        <div className="bg-card border-border flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Tag className="text-primary h-6 w-6" />
              <h2 className="text-card-foreground text-2xl font-bold">
                Release Notes
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="text-primary h-6 w-6 animate-spin" />
                  <span className="text-muted-foreground">
                    Loading release notes...
                  </span>
                </div>
              </div>
            ) : error || !releasesData?.success ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <p className="text-destructive mb-2">
                    Failed to load release notes
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {releasesData?.error ?? "Please try again later"}
                  </p>
                </div>
              </div>
            ) : releases.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No releases found</p>
              </div>
            ) : (
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                {releases.map((release, index) => {
                  const isHighlighted =
                    highlightVersion &&
                    release.tagName.replace("v", "") === highlightVersion;
                  const isLatest = index === 0;

                  return (
                    <div
                      key={release.tagName}
                      className={`rounded-lg border p-6 ${
                        isHighlighted
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      } ${isLatest ? "ring-primary/20 ring-2" : ""}`}
                    >
                      {/* Release Header */}
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <h3 className="text-card-foreground text-xl font-semibold">
                              {release.name || release.tagName}
                            </h3>
                            {isLatest && (
                              <Badge variant="default" className="text-xs">
                                Latest
                              </Badge>
                            )}
                            {isHighlighted && (
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary text-xs"
                              >
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Tag className="h-4 w-4" />
                              <span>{release.tagName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {new Date(
                                  release.publishedAt,
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <a
                            href={release.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on GitHub"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>

                      {/* Release Body */}
                      {release.body && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => (
                                <h1 className="text-card-foreground mt-6 mb-4 text-2xl font-bold">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-card-foreground mt-5 mb-3 text-xl font-semibold">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-card-foreground mt-4 mb-2 text-lg font-medium">
                                  {children}
                                </h3>
                              ),
                              p: ({ children }) => (
                                <p className="text-card-foreground mb-3 leading-relaxed">
                                  {children}
                                </p>
                              ),
                              ul: ({ children }) => (
                                <ul className="text-card-foreground mb-3 list-inside list-disc space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="text-card-foreground mb-3 list-inside list-decimal space-y-1">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="text-card-foreground">
                                  {children}
                                </li>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  className="text-info hover:text-info/80 underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {children}
                                </a>
                              ),
                              strong: ({ children }) => (
                                <strong className="text-card-foreground font-semibold">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="text-card-foreground italic">
                                  {children}
                                </em>
                              ),
                            }}
                          >
                            {release.body}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-t p-6">
            <div className="text-muted-foreground text-sm">
              {currentVersion && (
                <span>
                  Current version:{" "}
                  <span className="text-card-foreground font-medium">
                    v{currentVersion}
                  </span>
                </span>
              )}
            </div>
            <Button onClick={handleClose} variant="default">
              Close
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// Export helper functions for use in other components
export { getLastSeenVersion, markVersionAsSeen };
