"use client";

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { X, ExternalLink, Calendar, Tag, AlertTriangle } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface UpdateConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  releaseInfo: {
    tagName: string;
    name: string;
    publishedAt: string;
    htmlUrl: string;
    body?: string;
  } | null;
  currentVersion: string;
  latestVersion: string;
}

export function UpdateConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  releaseInfo,
  currentVersion,
  latestVersion,
}: UpdateConfirmationModalProps) {
  useRegisterModal(isOpen, {
    id: "update-confirmation-modal",
    allowEscape: true,
    onClose,
  });

  if (!isOpen || !releaseInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-warning h-6 w-6" />
            <div>
              <h2 className="text-card-foreground text-2xl font-bold">
                Confirm Update
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Review the changelog before proceeding with the update
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {/* Version Info */}
            <div className="bg-muted/50 border-border rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-card-foreground text-lg font-semibold">
                    {releaseInfo.name || releaseInfo.tagName}
                  </h3>
                  <Badge variant="default" className="text-xs">
                    Latest
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 p-0"
                >
                  <a
                    href={releaseInfo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="text-muted-foreground mb-3 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  <span>{releaseInfo.tagName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(releaseInfo.publishedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                <span>Updating from </span>
                <span className="text-card-foreground font-medium">
                  v{currentVersion}
                </span>
                <span> to </span>
                <span className="text-card-foreground font-medium">
                  v{latestVersion}
                </span>
              </div>
            </div>

            {/* Changelog */}
            {releaseInfo.body ? (
              <div className="border-border bg-card rounded-lg border p-6">
                <h4 className="text-md text-card-foreground mb-4 font-semibold">
                  Changelog
                </h4>
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
                        <li className="text-card-foreground">{children}</li>
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
                    {releaseInfo.body}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="border-border bg-card rounded-lg border p-6">
                <p className="text-muted-foreground">
                  No changelog available for this release.
                </p>
              </div>
            )}

            {/* Warning */}
            <div className="bg-warning/10 border-warning/30 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="text-card-foreground text-sm">
                  <p className="mb-1 font-medium">Important:</p>
                  <p className="text-muted-foreground">
                    Please review the changelog above for any breaking changes
                    or important updates before proceeding. The server will
                    restart automatically after the update completes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border bg-muted/30 flex items-center justify-between border-t p-6">
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive" className="gap-2">
            <span>Proceed with Update</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
