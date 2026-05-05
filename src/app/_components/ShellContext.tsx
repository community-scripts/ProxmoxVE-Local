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
  containerId?: string;
  containerName?: string;
  server?: Server;
  containerType?: "lxc" | "vm";
  /** If set, the floating shell runs this backup instead of an interactive shell. */
  backupStorage?: string;
  /** Custom title shown in the floating shell header. */
  title?: string;
  /** Optional key for deduplication/restoring an existing floating session. */
  sessionKey?: string;
  /** Optional generic terminal payload for non-shell executions (generator/install/update). */
  terminal?: {
    scriptPath: string;
    mode?: "local" | "ssh";
    server?: Server;
    isUpdate?: boolean;
    isShell?: boolean;
    isBackup?: boolean;
    isClone?: boolean;
    executeInContainer?: boolean;
    containerId?: string;
    storage?: string;
    backupStorage?: string;
    executionId?: string;
    cloneCount?: number;
    hostnames?: string[];
    containerType?: "lxc" | "vm";
    envVars?: Record<string, string | number | boolean>;
  };
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
      // If a session with the same key already exists, restore it.
      const key =
        s.sessionKey ??
        `${s.containerId ?? "task"}-${s.backupStorage ?? s.terminal?.scriptPath ?? "shell"}`;
      const existing = prev.find(
        (e) =>
          (e.session.sessionKey ??
            `${e.session.containerId ?? "task"}-${e.session.backupStorage ?? e.session.terminal?.scriptPath ?? "shell"}`) ===
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
