'use client';

import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, ExternalLink, Calendar, Tag, AlertTriangle } from 'lucide-react';
import { useRegisterModal } from './modal/ModalStackProvider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  latestVersion
}: UpdateConfirmationModalProps) {
  useRegisterModal(isOpen, { id: 'update-confirmation-modal', allowEscape: true, onClose });

  if (!isOpen || !releaseInfo) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-warning" />
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">Confirm Update</h2>
              <p className="text-sm text-muted-foreground mt-1">
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
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Version Info */}
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-card-foreground">
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
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  <span>{releaseInfo.tagName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(releaseInfo.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>Updating from </span>
                <span className="font-medium text-card-foreground">v{currentVersion}</span>
                <span> to </span>
                <span className="font-medium text-card-foreground">v{latestVersion}</span>
              </div>
            </div>

            {/* Changelog */}
            {releaseInfo.body ? (
              <div className="border rounded-lg p-6 border-border bg-card">
                <h4 className="text-md font-semibold text-card-foreground mb-4">Changelog</h4>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children}) => <h1 className="text-2xl font-bold text-card-foreground mb-4 mt-6">{children}</h1>,
                      h2: ({children}) => <h2 className="text-xl font-semibold text-card-foreground mb-3 mt-5">{children}</h2>,
                      h3: ({children}) => <h3 className="text-lg font-medium text-card-foreground mb-2 mt-4">{children}</h3>,
                      p: ({children}) => <p className="text-card-foreground mb-3 leading-relaxed">{children}</p>,
                      ul: ({children}) => <ul className="list-disc list-inside text-card-foreground mb-3 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-inside text-card-foreground mb-3 space-y-1">{children}</ol>,
                      li: ({children}) => <li className="text-card-foreground">{children}</li>,
                      a: ({href, children}) => <a href={href} className="text-info hover:text-info/80 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      strong: ({children}) => <strong className="font-semibold text-card-foreground">{children}</strong>,
                      em: ({children}) => <em className="italic text-card-foreground">{children}</em>,
                    }}
                  >
                    {releaseInfo.body}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-6 border-border bg-card">
                <p className="text-muted-foreground">No changelog available for this release.</p>
              </div>
            )}

            {/* Warning */}
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-sm text-card-foreground">
                  <p className="font-medium mb-1">Important:</p>
                  <p className="text-muted-foreground">
                    Please review the changelog above for any breaking changes or important updates before proceeding. 
                    The server will restart automatically after the update completes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
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


