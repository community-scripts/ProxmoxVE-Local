"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Server } from "~/types/server";

export type ShellState = "open" | "minimized" | "closed";

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

interface ShellContextValue {
  session: ShellSession | null;
  state: ShellState;
  open: (session: ShellSession) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ShellSession | null>(null);
  const [state, setState] = useState<ShellState>("closed");

  const open = useCallback((s: ShellSession) => {
    setSession(s);
    setState("open");
  }, []);

  const close = useCallback(() => {
    setSession(null);
    setState("closed");
  }, []);

  const minimize = useCallback(() => setState("minimized"), []);
  const restore = useCallback(() => setState("open"), []);

  const value = useMemo(
    () => ({ session, state, open, close, minimize, restore }),
    [session, state, open, close, minimize, restore],
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
