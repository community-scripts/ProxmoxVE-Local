"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;
const ERROR_DURATION_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setEntries((prev) => [...prev, { id, message, variant }]);
      setTimeout(
        () => dismiss(id),
        variant === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS,
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport entries={entries} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  entries,
  onDismiss,
}: {
  entries: ToastEntry[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useState(() => setMounted(true));
  if (!mounted || entries.length === 0) return null;

  return createPortal(
    <div className="fixed right-4 bottom-4 z-[300] flex w-full max-w-sm flex-col gap-2">
      {entries.map((entry) => (
        <ToastCard key={entry.id} entry={entry} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  const styles: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
    success: {
      border: "border-success/40 bg-success/10",
      icon: <CheckCircle2 className="text-success h-5 w-5 shrink-0" />,
    },
    error: {
      border: "border-destructive/40 bg-destructive/10",
      icon: <XCircle className="text-destructive h-5 w-5 shrink-0" />,
    },
    info: {
      border: "border-info/40 bg-info/10",
      icon: <Info className="text-info h-5 w-5 shrink-0" />,
    },
  };
  const style = styles[entry.variant];

  return (
    <div
      className={`bg-card text-foreground flex items-start gap-3 rounded-lg border p-3 shadow-lg ${style.border}`}
    >
      {style.icon}
      <p className="flex-1 text-sm">{entry.message}</p>
      <button
        onClick={() => onDismiss(entry.id)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
