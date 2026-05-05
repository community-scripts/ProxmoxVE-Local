"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Terminal as TerminalIcon,
  HardDrive,
  ChevronUp,
} from "lucide-react";
import { Terminal } from "./Terminal";
import { useShell } from "./ShellContext";
import type { ShellEntry } from "./ShellContext";

const WIN_W = 820;
const WIN_H = 520;
const STAGGER = 28; // px offset for each subsequent window

// ── Single floating window ────────────────────────────────────────────────────
function FloatingShellWindow({
  entry,
  stackIndex,
  onClose,
  onMinimize,
  isVisible,
}: {
  entry: ShellEntry;
  stackIndex: number;
  onClose: () => void;
  onMinimize: () => void;
  isVisible: boolean;
}) {
  const { session } = entry;
  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startWinX: number;
    startWinY: number;
  } | null>(null);

  // Set initial staggered position on mount
  useEffect(() => {
    const baseX = Math.max(
      0,
      Math.min(
        window.innerWidth / 2 - WIN_W / 2 + stackIndex * STAGGER,
        window.innerWidth - WIN_W,
      ),
    );
    const baseY = Math.max(
      0,
      Math.min(
        window.innerHeight / 2 - WIN_H / 2 + stackIndex * STAGGER,
        window.innerHeight - WIN_H - 40,
      ),
    );
    setPos({ x: baseX, y: baseY });
  }, []); // only on mount

  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMaximized) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();

      const rect = windowRef.current?.getBoundingClientRect();
      const startWinX = rect?.left ?? window.innerWidth / 2 - WIN_W / 2;
      const startWinY = rect?.top ?? window.innerHeight / 2 - WIN_H / 2;

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startWinX,
        startWinY,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startMouseX;
        const dy = ev.clientY - dragRef.current.startMouseY;
        setPos({
          x: Math.max(
            0,
            Math.min(window.innerWidth - WIN_W, dragRef.current.startWinX + dx),
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - 40, dragRef.current.startWinY + dy),
          ),
        });
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [isMaximized],
  );

  const isGenericTerminal = !!session.terminal;
  const isBackupTask = !isGenericTerminal && !!session.backupStorage;

  const title =
    session.title ??
    (isGenericTerminal
      ? (session.terminal?.scriptPath.split("/").pop() ?? "Terminal")
      : isBackupTask
        ? `Backup CT ${session.containerId} → ${session.backupStorage}`
        : session.containerName
          ? `${session.containerName}${session.containerId ? ` (${session.containerId})` : ""}`
          : `Shell${session.containerId ? ` — ${session.containerId}` : ""}`);

  const terminalProps = isGenericTerminal
    ? {
        scriptPath: session.terminal!.scriptPath,
        onClose,
        mode: session.terminal!.mode ?? (session.terminal!.server ? ("ssh" as const) : ("local" as const)),
        server: session.terminal!.server,
        isUpdate: session.terminal!.isUpdate,
        isShell: session.terminal!.isShell,
        isBackup: session.terminal!.isBackup,
        isClone: session.terminal!.isClone,
        executeInContainer: session.terminal!.executeInContainer,
        containerId: session.terminal!.containerId,
        storage: session.terminal!.storage,
        backupStorage: session.terminal!.backupStorage,
        executionId: session.terminal!.executionId,
        cloneCount: session.terminal!.cloneCount,
        hostnames: session.terminal!.hostnames,
        containerType: session.terminal!.containerType,
        envVars: session.terminal!.envVars,
      }
    : isBackupTask
      ? {
          scriptPath: `backup-${session.containerId}-${session.backupStorage}`,
          onClose,
          mode: "ssh" as const,
          server: session.server,
          isBackup: true,
          containerId: session.containerId,
          storage: session.backupStorage,
        }
      : {
          scriptPath: `shell-${session.containerId}`,
          onClose,
          mode: session.server ? ("ssh" as const) : ("local" as const),
          server: session.server,
          isShell: true,
          containerId: session.containerId,
          containerType: session.containerType ?? "lxc",
        };

  const headerIcon = isBackupTask ? (
    <HardDrive className="text-primary h-4 w-4" />
  ) : (
    <TerminalIcon className="text-primary h-4 w-4" />
  );

  const vmHint =
    !isGenericTerminal && !isBackupTask && session.containerType === "vm" && (
    <p className="border-border/40 border-b bg-amber-500/5 px-4 py-2 text-xs text-amber-500">
      VM shell uses the Proxmox serial console. The VM must have a serial port
      configured (e.g.{" "}
      <code className="bg-muted rounded px-1">
        qm set {session.containerId} -serial0 socket
      </code>
      ). Detach with <kbd className="bg-muted rounded px-1">Ctrl+O</kbd>.
    </p>
  );

  const windowStyle: React.CSSProperties = isMaximized
    ? { inset: 0, width: "100vw", height: "100vh", borderRadius: 0 }
    : pos
      ? { left: pos.x, top: pos.y, width: WIN_W, height: WIN_H }
      : {
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: WIN_W,
          height: WIN_H,
        };

  return (
    <div
      ref={windowRef}
      className="bg-card border-border fixed z-[200] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{ ...windowStyle, display: isVisible ? undefined : "none" }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={handleDragStart}
        className={`border-border/60 flex h-10 flex-shrink-0 items-center justify-between border-b px-4 select-none ${!isMaximized ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="text-foreground text-sm font-medium">{title}</span>
          {!isBackupTask && session.containerType === "vm" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider text-amber-500 uppercase">
              VM
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors"
            title="Minimize to bar"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          {isMaximized ? (
            <button
              onClick={() => setIsMaximized(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors"
              title="Restore"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setIsMaximized(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors"
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-destructive hover:bg-accent rounded p-1.5 transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {vmHint}
      <div className="min-h-0 flex-1">
        <Terminal {...terminalProps} />
      </div>
    </div>
  );
}

// ── Root component rendered in app-shell ──────────────────────────────────────
export function FloatingShell() {
  const { sessions, close, minimize, restore } = useShell();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const openSessions = sessions.filter((e) => e.state === "open");
  const minimizedSessions = sessions.filter((e) => e.state === "minimized");

  return createPortal(
    <>
      {/* All windows — minimized ones are hidden via CSS to preserve terminal state */}
      {sessions.map((entry, idx) => {
        const isVisible = entry.state === "open";
        const stackIndex = openSessions.indexOf(entry);
        return (
          <FloatingShellWindow
            key={entry.id}
            entry={entry}
            stackIndex={stackIndex >= 0 ? stackIndex : idx}
            isVisible={isVisible}
            onClose={() => {
              close(entry.id);
              entry.session.onComplete?.();
            }}
            onMinimize={() => minimize(entry.id)}
          />
        );
      })}

      {/* Minimised pills — stacked bottom-right */}
      {minimizedSessions.length > 0 && (
        <div className="fixed right-4 bottom-4 z-[200] flex flex-col items-end gap-2">
          {minimizedSessions.map((entry) => {
            const isBackup = !!entry.session.backupStorage;
            const label =
              entry.session.title ??
              (isBackup
                ? `Backup CT ${entry.session.containerId}`
                : entry.session.containerName
                  ? `${entry.session.containerName}${entry.session.containerId ? ` (${entry.session.containerId})` : ""}`
                  : entry.session.terminal
                    ? (entry.session.title ?? (entry.session.terminal.scriptPath.split("/").pop() ?? "Terminal"))
                    : `Shell${entry.session.containerId ? ` — ${entry.session.containerId}` : ""}`);
            return (
              <button
                key={entry.id}
                onClick={() => restore(entry.id)}
                className="bg-card border-border text-foreground hover:bg-accent flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg transition-colors"
              >
                <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                {isBackup ? (
                  <HardDrive className="h-3.5 w-3.5" />
                ) : (
                  <TerminalIcon className="h-3.5 w-3.5" />
                )}
                <span className="max-w-[200px] truncate">{label}</span>
                <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      )}
    </>,
    document.body,
  );
}
