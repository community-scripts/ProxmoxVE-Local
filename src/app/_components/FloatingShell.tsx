"use client";

import { useState } from "react";
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

export function FloatingShell() {
  const { session, state, close, minimize, restore } = useShell();
  const [isMaximized, setIsMaximized] = useState(false);

  if (!session || state === "closed") return null;

  const isBackupTask = !!session.backupStorage;

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
        mode: (session.server ? "ssh" : "local") as "ssh" | "local",
        server: session.server,
        isShell: true,
        containerId: session.containerId,
        containerType: session.containerType,
      };

  // ─── Minimized pill pinned to bottom-right ────────────────────────────────
  if (state === "minimized") {
    return createPortal(
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
      </div>,
      document.body,
    );
  }

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

  // ─── Full-screen ──────────────────────────────────────────────────────────
  if (isMaximized) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col bg-black">
        <div className="bg-card border-border flex h-10 flex-shrink-0 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            {headerIcon}
            <span className="text-foreground text-sm font-medium">{title}</span>
            {!isBackupTask && session.containerType === "vm" && (
              <span className="text-muted-foreground rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider text-amber-500 uppercase">
                VM
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={minimize} className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors hover:bg-white/10" title="Minimize">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setIsMaximized(false)} className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors hover:bg-white/10" title="Restore">
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleClose} className="text-muted-foreground hover:text-destructive rounded p-1.5 transition-colors hover:bg-white/10" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {vmHint}
        <div className="min-h-0 flex-1">
          <Terminal {...terminalProps} />
        </div>
      </div>,
      document.body,
    );
  }

  // ─── Centered medium dialog ───────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) minimize(); }}
    >
      <div
        className="bg-card border-border flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ height: "min(560px, 80vh)" }}
      >
        <div className="border-border/60 flex h-10 flex-shrink-0 items-center justify-between border-b px-4">
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
            <button onClick={minimize} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors" title="Minimize to bar">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setIsMaximized(true)} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors" title="Maximize">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleClose} className="text-muted-foreground hover:text-destructive hover:bg-accent rounded p-1.5 transition-colors" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {vmHint}
        <div className="min-h-0 flex-1">
          <Terminal {...terminalProps} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

  const { session, state, close, minimize, restore } = useShell();
  const [isMaximized, setIsMaximized] = useState(false);

  if (!session || state === "closed") return null;

  const title = session.containerName
    ? `${session.containerName} (${session.containerId})`
    : `Shell — ${session.containerId}`;

  // ─── Minimized pill pinned to bottom-right ────────────────────────────────
  if (state === "minimized") {
    return createPortal(
      <div className="fixed right-4 bottom-4 z-[200]">
        <button
          onClick={restore}
          className="bg-card border-border text-foreground hover:bg-accent flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg transition-colors"
        >
          <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
          <TerminalIcon className="h-3.5 w-3.5" />
          <span className="max-w-[160px] truncate">{title}</span>
          <ChevronUp className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      </div>,
      document.body,
    );
  }

  // ─── Full-screen ──────────────────────────────────────────────────────────
  if (isMaximized) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col bg-black">
        {/* Header */}
        <div className="bg-card border-border flex h-10 flex-shrink-0 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            <TerminalIcon className="text-primary h-4 w-4" />
            <span className="text-foreground text-sm font-medium">{title}</span>
            {session.containerType === "vm" && (
              <span className="text-muted-foreground rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider text-amber-500 uppercase">
                VM
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={minimize}
              className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors hover:bg-white/10"
              title="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsMaximized(false)}
              className="text-muted-foreground hover:text-foreground rounded p-1.5 transition-colors hover:bg-white/10"
              title="Restore"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={close}
              className="text-muted-foreground hover:text-destructive rounded p-1.5 transition-colors hover:bg-white/10"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* VM hint */}
        {session.containerType === "vm" && (
          <p className="bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400">
            VM shell uses the Proxmox serial console. The VM must have a serial
            port configured (e.g.{" "}
            <code className="rounded bg-black/30 px-1">
              qm set {session.containerId} -serial0 socket
            </code>
            ). Detach with{" "}
            <kbd className="rounded bg-black/30 px-1">Ctrl+O</kbd>.
          </p>
        )}
        <div className="min-h-0 flex-1">
          <Terminal
            scriptPath={`shell-${session.containerId}`}
            onClose={close}
            mode={session.server ? "ssh" : "local"}
            server={session.server}
            isShell
            containerId={session.containerId}
            containerType={session.containerType}
          />
        </div>
      </div>,
      document.body,
    );
  }

  // ─── Centered medium dialog ───────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) minimize();
      }}
    >
      <div
        className="bg-card border-border flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ height: "min(560px, 80vh)" }}
      >
        {/* Header */}
        <div className="border-border/60 flex h-10 flex-shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <TerminalIcon className="text-primary h-4 w-4" />
            <span className="text-foreground text-sm font-medium">{title}</span>
            {session.containerType === "vm" && (
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
            <button
              onClick={() => setIsMaximized(true)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1.5 transition-colors"
              title="Maximize"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={close}
              className="text-muted-foreground hover:text-destructive hover:bg-accent rounded p-1.5 transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* VM hint */}
        {session.containerType === "vm" && (
          <p className="border-border/40 border-b bg-amber-500/5 px-4 py-2 text-xs text-amber-500">
            VM shell uses the Proxmox serial console. The VM must have a serial
            port configured (e.g.{" "}
            <code className="bg-muted rounded px-1">
              qm set {session.containerId} -serial0 socket
            </code>
            ). Detach with <kbd className="bg-muted rounded px-1">Ctrl+O</kbd>.
          </p>
        )}

        {/* Terminal fills remaining height */}
        <div className="min-h-0 flex-1">
          <Terminal
            scriptPath={`shell-${session.containerId}`}
            onClose={close}
            mode={session.server ? "ssh" : "local"}
            server={session.server}
            isShell
            containerId={session.containerId}
            containerType={session.containerType}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
