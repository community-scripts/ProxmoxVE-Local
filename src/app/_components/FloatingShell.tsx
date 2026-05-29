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

const WIN_W = 1400;
const WIN_H = 860;
const MIN_W = 480;
const MIN_H = 340;
const STAGGER = 28; // px offset for each subsequent window

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

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
  const [size, setSize] = useState({ w: WIN_W, h: WIN_H });
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

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, dir: ResizeDir) => {
      if (isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startW = size.w;
      const startH = size.h;
      const startX = pos?.x ?? window.innerWidth / 2 - size.w / 2;
      const startY = pos?.y ?? window.innerHeight / 2 - size.h / 2;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startMouseX;
        const dy = ev.clientY - startMouseY;
        let newW = startW;
        let newH = startH;
        let newX = startX;
        let newY = startY;
        if (dir.includes('e')) newW = Math.max(MIN_W, startW + dx);
        if (dir.includes('w')) { newW = Math.max(MIN_W, startW - dx); newX = startX + startW - newW; }
        if (dir.includes('s')) newH = Math.max(MIN_H, startH + dy);
        if (dir.includes('n')) { newH = Math.max(MIN_H, startH - dy); newY = startY + startH - newH; }
        setSize({ w: newW, h: newH });
        setPos({ x: newX, y: newY });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      const cursors: Record<ResizeDir, string> = {
        n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
        ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
      };
      document.body.style.cursor = cursors[dir];
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isMaximized, size, pos],
  );

  const windowStyle: React.CSSProperties = isMaximized
    ? { inset: 0, width: "100vw", height: "100vh", borderRadius: 0 }
    : pos
      ? { left: pos.x, top: pos.y, width: size.w, height: size.h }
      : {
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: size.w,
          height: size.h,
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
        <Terminal {...terminalProps} fillParent />
      </div>

      {/* Resize handles — only shown when not maximized */}
      {!isMaximized && (
        <>
          {/* Edges */}
          <div onMouseDown={(e) => handleResizeStart(e, 'n')}  className="absolute top-0 left-2 right-2 h-1 cursor-n-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 's')}  className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'e')}  className="absolute right-0 top-2 bottom-2 w-1 cursor-e-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'w')}  className="absolute left-0 top-2 bottom-2 w-1 cursor-w-resize" />
          {/* Corners */}
          <div onMouseDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 h-3 w-3 cursor-nw-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 h-3 w-3 cursor-ne-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize" />
          <div onMouseDown={(e) => handleResizeStart(e, 'se')} className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize" />
        </>
      )}
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
