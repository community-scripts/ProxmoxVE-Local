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

const WIN_W = 820;
const WIN_H = 520;

export function FloatingShell() {
  const { session, state, close, minimize, restore } = useShell();
  const [isMaximized, setIsMaximized] = useState(false);
  // null = use CSS centering; set = absolute pixel position after drag
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startWinX: number;
    startWinY: number;
  } | null>(null);
  const prevSessionKey = useRef<string | null>(null);

  // Reset position/maximized when a genuinely new session opens
  useEffect(() => {
    if (!session) return;
    const key = `${session.containerId}-${session.backupStorage ?? "shell"}`;
    if (key !== prevSessionKey.current) {
      prevSessionKey.current = key;
      setPos(null);
      setIsMaximized(false);
    }
  }, [session]);

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

      const onMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startMouseX;
        const dy = e.clientY - dragRef.current.startMouseY;
        setPos({
          x: Math.max(
            0,
            Math.min(
              window.innerWidth - WIN_W,
              dragRef.current.startWinX + dx,
            ),
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

  if (!session || state === "closed") return null;

  const isBackupTask = !!session.backupStorage;
  const isMinimized = state === "minimized";

  const title =
    session.title ??
    (isBackupTask
      ? `Backup CT ${session.containerId} → ${session.backupStorage}`
      : session.containerName
        ? `${session.containerName} (${session.containerId})`
        : `Shell — ${session.containerId}`);

  const handleClose = () => {
    close();
    session.onComplete?.();
  };

  const terminalProps = isBackupTask
    ? {
        scriptPath: `backup-${session.containerId}-${session.backupStorage}`,
        onClose: handleClose,
        mode: "ssh" as const,
        server: session.server,
        isBackup: true,
        containerId: session.containerId,
        storage: session.backupStorage,
      }
    : {
        scriptPath: `shell-${session.containerId}`,
        onClose: handleClose,
        mode: session.server ? ("ssh" as const) : ("local" as const),
        server: session.server,
        isShell: true,
        containerId: session.containerId,
        containerType: session.containerType,
      };

  const headerIcon = isBackupTask ? (
    <HardDrive className="text-primary h-4 w-4" />
  ) : (
    <TerminalIcon className="text-primary h-4 w-4" />
  );

  const vmHint = !isBackupTask && session.containerType === "vm" && (
    <p className="border-border/40 border-b bg-amber-500/5 px-4 py-2 text-xs text-amber-500">
      VM shell uses the Proxmox serial console. The VM must have a serial port
      configured (e.g.{" "}
      <code className="bg-muted rounded px-1">
        qm set {session.containerId} -serial0 socket
      </code>
      ). Detach with <kbd className="bg-muted rounded px-1">Ctrl+O</kbd>.
    </p>
  );

  // Window position: maximized covers viewport; otherwise pixel-positioned or
  // CSS-centered (when pos is null, i.e. not yet dragged)
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

  return createPortal(
    <>
      {/* ── Floating window ───────────────────────────────────────────────────
          Always mounted so Terminal (WebSocket) is never destroyed on minimize.
          Hidden via visibility:hidden + pointer-events:none when minimized,
          which keeps xterm.js dimensions intact and the connection live.     */}
      <div
        ref={windowRef}
        className="bg-card border-border fixed z-[200] flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          ...windowStyle,
          visibility: isMinimized ? "hidden" : "visible",
          pointerEvents: isMinimized ? "none" : "auto",
        }}
      >
        {/* Header — acts as drag handle */}
        <div
          onMouseDown={handleDragStart}
          className={`border-border/60 flex h-10 flex-shrink-0 select-none items-center justify-between border-b px-4 ${!isMaximized ? "cursor-grab active:cursor-grabbing" : ""}`}
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
              onClick={minimize}
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
              onClick={handleClose}
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

      {/* ── Minimized pill ────────────────────────────────────────────────── */}
      {isMinimized && (
        <div className="fixed right-4 bottom-4 z-[200]">
          <button
            onClick={restore}
            className="bg-card border-border text-foreground hover:bg-accent flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg transition-colors"
          >
            <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
            {isBackupTask ? (
              <HardDrive className="h-3.5 w-3.5" />
            ) : (
              <TerminalIcon className="h-3.5 w-3.5" />
            )}
            <span className="max-w-[200px] truncate">{title}</span>
            <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>,
    document.body,
  );
}

