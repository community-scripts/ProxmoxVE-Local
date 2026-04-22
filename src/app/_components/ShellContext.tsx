"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Server } from "~/types/server";

export type ShellState = "open" | "minimized";

export interface ShellSession {
  containerId: string;
  containerName?: string;
  server?: Server;
  containerType: "lxc" | "vm";
  /** If set, the floating shell runs this backup instead of an interactive shell. */
  backupStorage?: string;
  /** Custom title shown in the floating shell header. */
  title?: string;
  /** Callback fired when the terminal closes (e.g. to trigger re-discovery). */
  onComplete?: () => void;
}

export interface ShellEntry {
  id: string;
  session: ShellSession;
  state: ShellState;
}

interface ShellContextValue {
  sessions: ShellEntry[];
  open: (session: ShellSession) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ShellEntry[]>([]);

  const open = useCallback((s: ShellSession) => {
    setSessions((prev) => {
      // If a session with the same containerId+backupStorage key is already open, restore it
      const key = `${s.containerId}-${s.backupStorage ?? "shell"}`;
      const existing = prev.find(
        (e) =>
          `${e.session.containerId}-${e.session.backupStorage ?? "shell"}` ===
          key,
      );
      if (existing) {
        return prev.map((e) =>
          e.id === existing.id ? { ...e, state: "open" as ShellState } : e,
        );
      }
      const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      return [...prev, { id, session: s, state: "open" }];
    });
  }, []);

  const close = useCallback((id: string) => {
    setSessions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, state: "minimized" as ShellState } : e,
      ),
    );
  }, []);

  const restore = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, state: "open" as ShellState } : e,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({ sessions, open, close, minimize, restore }),
    [sessions, open, close, minimize, restore],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
