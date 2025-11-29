"use client";

import { Loader2, CheckCircle, X } from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useEffect, useRef } from "react";
import { Button } from "./ui/button";

interface LoadingModalProps {
  isOpen: boolean;
  action?: string;
  logs?: string[];
  isComplete?: boolean;
  title?: string;
  onClose?: () => void;
}

export function LoadingModal({
  isOpen,
  action,
  logs = [],
  isComplete = false,
  title,
  onClose,
}: LoadingModalProps) {
  // Allow dismissing with ESC only when complete, prevent during running
  useRegisterModal(isOpen, {
    id: "loading-modal",
    allowEscape: isComplete,
    onClose: onClose ?? (() => null),
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border-border relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border p-8 shadow-xl">
        {/* Close button - only show when complete */}
        {isComplete && onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {isComplete ? (
              <CheckCircle className="text-success h-12 w-12" />
            ) : (
              <>
                <Loader2 className="text-primary h-12 w-12 animate-spin" />
                <div className="border-primary/20 absolute inset-0 animate-pulse rounded-full border-2"></div>
              </>
            )}
          </div>

          {/* Action text - displayed prominently */}
          {action && (
            <p className="text-foreground text-base font-medium">{action}</p>
          )}

          {/* Static title text */}
          {title && <p className="text-muted-foreground text-sm">{title}</p>}

          {/* Log output */}
          {logs.length > 0 && (
            <div className="bg-card border-border text-chart-2 terminal-output max-h-[60vh] w-full overflow-y-auto rounded-lg border p-4 font-mono text-xs">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="mb-1 break-words whitespace-pre-wrap"
                >
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {!isComplete && (
            <div className="flex space-x-1">
              <div className="bg-primary h-2 w-2 animate-bounce rounded-full"></div>
              <div
                className="bg-primary h-2 w-2 animate-bounce rounded-full"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="bg-primary h-2 w-2 animate-bounce rounded-full"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
