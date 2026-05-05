"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { Button } from "./ui/button";
import {
  Play,
  Square,
  Trash2,
  X,
  Send,
  Keyboard,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Palette,
} from "lucide-react";

import type { Server } from "~/types/server";

interface TerminalProps {
  scriptPath: string;
  onClose: () => void;
  mode?: "local" | "ssh";
  server?: Server;
  isUpdate?: boolean;
  isShell?: boolean;
  isBackup?: boolean;
  isClone?: boolean;
  /** When true the script is executed INSIDE the target container via pct exec,
   *  rather than on the PVE host. Requires containerId + containerType. */
  executeInContainer?: boolean;
  containerId?: string;
  storage?: string;
  backupStorage?: string;
  executionId?: string;
  cloneCount?: number;
  hostnames?: string[];
  containerType?: "lxc" | "vm";
  envVars?: Record<string, string | number | boolean>;
}

interface TerminalMessage {
  type: "start" | "output" | "error" | "end";
  data: string;
  timestamp: number;
}

type TerminalThemeMode = "midnight" | "matrix" | "amber" | "paper";

const TERMINAL_THEMES: Record<TerminalThemeMode, any> = {
  midnight: {
    background: "#0d1117",
    foreground: "#e6edf3",
    cursor: "#58a6ff",
    cursorAccent: "#0d1117",
    selectionBackground: "#264f78",
    selectionForeground: "#ffffff",
    black: "#484f58",
    red: "#f85149",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39d353",
    white: "#b1bac4",
    brightBlack: "#6e7681",
    brightRed: "#ff7b72",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#56d364",
    brightWhite: "#f0f6fc",
  },
  matrix: {
    background: "#030806",
    foreground: "#8cff9f",
    cursor: "#39ff14",
    cursorAccent: "#030806",
    selectionBackground: "#145a1f",
    selectionForeground: "#d7ffe0",
    black: "#0f2615",
    red: "#5cff7b",
    green: "#39ff14",
    yellow: "#89ff6b",
    blue: "#16c172",
    magenta: "#6cffaa",
    cyan: "#41e29d",
    white: "#baffc8",
    brightBlack: "#235f33",
    brightRed: "#87ff9d",
    brightGreen: "#7dff63",
    brightYellow: "#b6ff8a",
    brightBlue: "#2fe59a",
    brightMagenta: "#8fffc9",
    brightCyan: "#9dffd8",
    brightWhite: "#e9fff0",
  },
  amber: {
    background: "#1a1203",
    foreground: "#ffcf66",
    cursor: "#ff9e00",
    cursorAccent: "#1a1203",
    selectionBackground: "#7a4f00",
    selectionForeground: "#ffe1a3",
    black: "#3a2500",
    red: "#ff8b32",
    green: "#ffb347",
    yellow: "#ffd166",
    blue: "#ff9f43",
    magenta: "#ffbe76",
    cyan: "#ffb86b",
    white: "#ffe0a8",
    brightBlack: "#7a4f00",
    brightRed: "#ff9f43",
    brightGreen: "#ffc46d",
    brightYellow: "#ffe08a",
    brightBlue: "#ffb861",
    brightMagenta: "#ffd190",
    brightCyan: "#ffe1b0",
    brightWhite: "#fff0d0",
  },
  paper: {
    background: "#f7f3e9",
    foreground: "#2f2a1f",
    cursor: "#0b68d1",
    cursorAccent: "#f7f3e9",
    selectionBackground: "#cfe3ff",
    selectionForeground: "#1e3a5f",
    black: "#3d382c",
    red: "#b53a2d",
    green: "#2f7a45",
    yellow: "#9a6b12",
    blue: "#275fc4",
    magenta: "#8a3fa0",
    cyan: "#1c7e8c",
    white: "#f7f3e9",
    brightBlack: "#6b6455",
    brightRed: "#cc4c3d",
    brightGreen: "#3f9659",
    brightYellow: "#b6872e",
    brightBlue: "#3e79de",
    brightMagenta: "#a157bc",
    brightCyan: "#2f9eae",
    brightWhite: "#ffffff",
  },
};

const THEME_META: Record<
  TerminalThemeMode,
  {
    label: string;
    subtitle: string;
    bg: string;
    fg: string;
    accent: string;
    sample: string;
  }
> = {
  midnight: {
    label: "Midnight",
    subtitle: "GitHub dark",
    bg: "#0d1117",
    fg: "#e6edf3",
    accent: "#58a6ff",
    sample: "root@pve:~# ./install.sh",
  },
  matrix: {
    label: "Matrix",
    subtitle: "Neon green",
    bg: "#030806",
    fg: "#8cff9f",
    accent: "#39ff14",
    sample: "[OK] Service started",
  },
  amber: {
    label: "Amber",
    subtitle: "Retro CRT",
    bg: "#1a1203",
    fg: "#ffcf66",
    accent: "#ff9e00",
    sample: "Install Arcane? (y/N)",
  },
  paper: {
    label: "Paper",
    subtitle: "High-contrast light",
    bg: "#f7f3e9",
    fg: "#2f2a1f",
    accent: "#0b68d1",
    sample: "container#102 running",
  },
};

export function Terminal({
  scriptPath,
  onClose,
  mode = "local",
  server,
  isUpdate = false,
  isShell = false,
  isBackup = false,
  isClone = false,
  executeInContainer = false,
  containerId,
  storage,
  backupStorage,
  executionId: propExecutionId,
  cloneCount,
  hostnames,
  containerType,
  envVars,
}: TerminalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [showMobileInput, setShowMobileInput] = useState(false);
  const [lastInputSent, setLastInputSent] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [themeMode, setThemeMode] = useState<TerminalThemeMode>("midnight");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  // Close theme picker when clicking outside
  useEffect(() => {
    if (!showThemePicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        themePickerRef.current &&
        !themePickerRef.current.contains(e.target as Node)
      ) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showThemePicker]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputHandlerRef = useRef<((data: string) => void) | null>(null);
  const [executionId, setExecutionId] = useState(
    () =>
      propExecutionId ??
      `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );

  // Update executionId when propExecutionId changes
  useEffect(() => {
    if (propExecutionId) {
      setExecutionId(propExecutionId);
    }
  }, [propExecutionId]);

  const effectiveExecutionId = propExecutionId ?? executionId;
  const isConnectingRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);

  const scriptName =
    scriptPath.split("/").pop() ??
    scriptPath.split("\\").pop() ??
    "Unknown Script";

  const handleMessage = useCallback(
    (message: TerminalMessage) => {
      if (!xtermRef.current) return;

      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      const prefix = `[${timestamp}] `;

      switch (message.type) {
        case "start":
          xtermRef.current.writeln(`${prefix}[START] ${message.data}`);
          setIsRunning(true);
          break;
        case "output":
          // Write directly to terminal - xterm.js handles ANSI codes natively
          xtermRef.current.write(message.data);
          break;
        case "error":
          // Check if this looks like ANSI terminal output (contains escape codes)
          if (
            message.data.includes("\x1B[") ||
            message.data.includes("\u001b[")
          ) {
            // This is likely terminal output sent to stderr, treat it as normal output
            xtermRef.current.write(message.data);
          } else if (
            message.data.includes("TERM environment variable not set")
          ) {
            // This is a common warning, treat as normal output
            xtermRef.current.write(message.data);
          } else if (
            message.data.includes("exit code") &&
            message.data.includes("clear")
          ) {
            // This is a script error, show it with error prefix
            xtermRef.current.writeln(`${prefix}[ERROR] ${message.data}`);
          } else {
            // This is a real error, show it with error prefix
            xtermRef.current.writeln(`${prefix}[ERROR] ${message.data}`);
          }
          break;
        case "end":
          setIsRunning(false);

          // Check if this is an LXC creation script
          const isLxcCreation =
            scriptPath.includes("ct/") ||
            scriptPath.includes("create_lxc") ||
            containerId != null ||
            scriptName.includes("lxc") ||
            scriptName.includes("container");

          if (
            isLxcCreation &&
            message.data.includes("SSH script execution finished with code: 0")
          ) {
            // Display prominent LXC creation completion message
            xtermRef.current.writeln("");
            xtermRef.current.writeln(
              "#########################################",
            );
            xtermRef.current.writeln(
              "########## LXC CREATION FINISHED ########",
            );
            xtermRef.current.writeln(
              "#########################################",
            );
            xtermRef.current.writeln("");
          } else {
            xtermRef.current.writeln(`${prefix}✅ ${message.data}`);
          }
          break;
      }
    },
    [scriptPath, containerId, scriptName],
  );

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
    // Detect mobile on mount
    setIsMobile(window.innerWidth < 768);

    const storedTheme = window.localStorage.getItem("terminalTheme");
    if (
      storedTheme === "midnight" ||
      storedTheme === "matrix" ||
      storedTheme === "amber" ||
      storedTheme === "paper"
    ) {
      setThemeMode(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;
    window.localStorage.setItem("terminalTheme", themeMode);
    if (xtermRef.current) {
      xtermRef.current.setOption("theme", TERMINAL_THEMES[themeMode]);
      xtermRef.current.refresh(0, xtermRef.current.rows - 1);
    }
  }, [themeMode, isClient]);

  useEffect(() => {
    // Only initialize on client side
    if (!isClient || !terminalRef.current || xtermRef.current) return;

    // Store ref value to avoid stale closure
    const terminalElement = terminalRef.current;

    // Use setTimeout to ensure DOM is fully ready
    const initTerminal = async () => {
      if (!terminalElement || xtermRef.current) return;

      // Dynamically import xterm modules to avoid SSR issues
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      // Use the mobile state

      const terminal = new XTerm({
        theme: TERMINAL_THEMES[themeMode],
        fontSize: isMobile ? 7 : 14,
        fontFamily:
          "JetBrains Mono, Fira Code, Cascadia Code, Monaco, Menlo, Ubuntu Mono, monospace",
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 1000,
        tabStopWidth: 4,
        allowTransparency: false,
        convertEol: true,
        disableStdin: false,
        macOptionIsMeta: false,
        rightClickSelectsWord: false,
        wordSeparator: " ()[]{}'\"`<>|",
        // Better ANSI handling
        allowProposedApi: true,
        // Force proper terminal behavior for interactive applications
        // Use smaller dimensions on mobile but ensure proper fit
        cols: isMobile ? 45 : 80,
        rows: isMobile ? 18 : 24,
      });

      // Add addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      // Enable better ANSI handling
      terminal.options.allowProposedApi = true;

      // Open terminal
      terminal.open(terminalElement);

      // Ensure proper terminal rendering
      setTimeout(() => {
        terminal.refresh(0, terminal.rows - 1);
        // Ensure cursor is properly positioned
        terminal.focus();

        // Force focus on the terminal element
        terminalElement.focus();
        terminalElement.click();

        // Add click handler to ensure terminal stays focused
        const focusHandler = () => {
          terminal.focus();
          terminalElement.focus();
        };
        terminalElement.addEventListener("click", focusHandler);

        // Store the handler for cleanup
        (terminalElement as any).focusHandler = focusHandler;
      }, 100);

      // Fit after a small delay to ensure proper sizing
      setTimeout(() => {
        fitAddon.fit();
        // Force fit multiple times for mobile to ensure proper sizing
        if (isMobile) {
          setTimeout(() => {
            fitAddon.fit();
            setTimeout(() => {
              fitAddon.fit();
            }, 200);
          }, 300);
        }
      }, 100);

      // Add resize listener for mobile responsiveness
      const handleResize = () => {
        if (fitAddonRef.current) {
          setTimeout(() => {
            fitAddonRef.current.fit();
          }, 50);
        }
      };

      window.addEventListener("resize", handleResize);

      // Store the handler for cleanup
      (terminalElement as any).resizeHandler = handleResize;

      // Store references
      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Mark terminal as ready
      setIsTerminalReady(true);

      return () => {
        terminal.dispose();
      };
    };

    // Initialize with a small delay
    const timeoutId = setTimeout(() => {
      void initTerminal();
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (terminalElement && (terminalElement as any).resizeHandler) {
        window.removeEventListener(
          "resize",
          (terminalElement as any).resizeHandler as (
            this: Window,
            ev: UIEvent,
          ) => any,
        );
      }
      if (terminalElement && (terminalElement as any).focusHandler) {
        terminalElement.removeEventListener(
          "click",
          (terminalElement as any).focusHandler as (
            this: HTMLDivElement,
            ev: PointerEvent,
          ) => any,
        );
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
        setIsTerminalReady(false);
      }
    };
  }, [isClient, isMobile, themeMode]);

  // Handle terminal input with current executionId
  useEffect(() => {
    if (!isTerminalReady || !xtermRef.current) {
      return;
    }

    const terminal = xtermRef.current;

    const handleData = (data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message = {
          action: "input",
          executionId: effectiveExecutionId,
          input: data,
        };
        wsRef.current.send(JSON.stringify(message));
      }
    };

    // Store the handler reference
    inputHandlerRef.current = handleData;
    terminal.onData(handleData);

    return () => {
      // Clear the handler reference
      inputHandlerRef.current = null;
    };
  }, [executionId, isTerminalReady]); // Depend on terminal ready state

  useEffect(() => {
    // Prevent multiple connections in React Strict Mode
    if (
      hasConnectedRef.current ||
      isConnectingRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = true;
    const isInitialConnection = !hasConnectedRef.current;
    hasConnectedRef.current = true;

    // Small delay to prevent rapid reconnection
    const connectWithDelay = () => {
      // Connect to WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/script-execution`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        isConnectingRef.current = false;

        // Only auto-start on initial connection, not on reconnections
        if (isInitialConnection && !isRunning) {
          // Use propExecutionId if provided, otherwise generate a new one
          const newExecutionId =
            propExecutionId ??
            `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          if (!propExecutionId) {
            setExecutionId(newExecutionId);
          }

          const message = {
            action: "start",
            scriptPath,
            executionId: newExecutionId,
            mode,
            server,
            isUpdate,
            isShell,
            isBackup,
            isClone,
            executeInContainer,
            containerId,
            storage,
            backupStorage,
            cloneCount,
            hostnames,
            containerType,
            envVars,
          };
          ws.send(JSON.stringify(message));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as TerminalMessage;
          handleMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = (_event) => {
        setIsConnected(false);
        setIsRunning(false);
        isConnectingRef.current = false;
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        console.error("WebSocket readyState:", ws.readyState);
        setIsConnected(false);
        isConnectingRef.current = false;
      };
    };

    // Add small delay to prevent rapid reconnection
    const timeoutId = setTimeout(connectWithDelay, 100);

    return () => {
      clearTimeout(timeoutId);
      isConnectingRef.current = false;
      hasConnectedRef.current = false;
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        wsRef.current.close();
      }
    };
  }, [
    scriptPath,
    mode,
    server,
    isUpdate,
    isShell,
    containerId,
    isMobile,
    envVars,
  ]);

  const startScript = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && !isRunning) {
      // Generate a new execution ID for each script run (unless propExecutionId is provided)
      const newExecutionId =
        propExecutionId ??
        `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (!propExecutionId) {
        setExecutionId(newExecutionId);
      }

      setIsStopped(false);
      wsRef.current.send(
        JSON.stringify({
          action: "start",
          scriptPath,
          executionId: newExecutionId,
          mode,
          server,
          envVars,
          isUpdate,
          isShell,
          isBackup,
          isClone,
          containerId,
          storage,
          backupStorage,
          cloneCount,
          hostnames,
          containerType,
        }),
      );
    }
  };

  const stopScript = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsStopped(true);
      setIsRunning(false);
      wsRef.current.send(
        JSON.stringify({
          action: "stop",
          executionId,
        }),
      );
    }
  };

  const clearOutput = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const sendInput = (input: string) => {
    setLastInputSent(input);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        action: "input",
        executionId,
        input: input,
      };
      wsRef.current.send(JSON.stringify(message));
      // Clear the feedback after 2 seconds
      setTimeout(() => setLastInputSent(null), 2000);
    }
  };

  const handleMobileInput = (input: string) => {
    sendInput(input);
    setMobileInput("");
  };

  const handleEnterKey = () => {
    sendInput("\r");
  };

  // Don't render on server side
  if (!isClient) {
    return (
      <div className="glass-card-static overflow-hidden border">
        <div className="bg-secondary/50 border-border/60 flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-foreground ml-2 font-mono text-sm">
              {scriptName}
            </span>
          </div>
        </div>
        <div className="flex h-96 w-full items-center justify-center">
          <div className="text-muted-foreground">Loading terminal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-static overflow-hidden border">
      {/* Terminal Header */}
      <div className="bg-secondary/50 border-border/60 flex items-center justify-between border-b px-2 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          <div className="flex flex-shrink-0 space-x-1">
            <div className="h-2 w-2 rounded-full bg-red-500 sm:h-3 sm:w-3"></div>
            <div className="h-2 w-2 rounded-full bg-yellow-500 sm:h-3 sm:w-3"></div>
            <div className="h-2 w-2 rounded-full bg-green-500 sm:h-3 sm:w-3"></div>
          </div>
          <span className="text-foreground ml-1 truncate font-mono text-xs sm:ml-2 sm:text-sm">
            {scriptName} {mode === "ssh" && server && `(SSH: ${server.name})`}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center space-x-1 sm:space-x-2">
          {/* Theme picker */}
          <div className="relative" ref={themePickerRef}>
            <button
              onClick={() => setShowThemePicker((v) => !v)}
              className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
              title="Change terminal theme"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
            {showThemePicker && (
              <div className="bg-popover border-border absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border p-2 shadow-xl">
                <p className="text-muted-foreground mb-2 px-1 text-[10px] font-medium tracking-wider uppercase">
                  Terminal Theme
                </p>
                <div className="space-y-1.5">
                  {(Object.keys(THEME_META) as TerminalThemeMode[]).map(
                    (key) => {
                      const meta = THEME_META[key];
                      const active = themeMode === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setThemeMode(key);
                            setShowThemePicker(false);
                          }}
                          className={`w-full rounded-md border px-2 py-2 text-left transition-all ${
                            active
                              ? "border-primary ring-primary/30 ring-1"
                              : "border-border hover:border-border/80"
                          }`}
                          style={{ background: meta.bg, color: meta.fg }}
                          title={meta.label}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 flex-shrink-0 rounded-full"
                                style={{ background: meta.accent }}
                              />
                              <div>
                                <div className="text-xs font-semibold">
                                  {meta.label}
                                </div>
                                <div className="opacity-75 text-[10px]">
                                  {meta.subtitle}
                                </div>
                              </div>
                            </div>
                            {active && (
                              <span className="text-[10px] font-semibold opacity-90">
                                Active
                              </span>
                            )}
                          </div>
                          <div
                            className="mt-1 rounded border px-1.5 py-1 font-mono text-[10px]"
                            style={{ borderColor: `${meta.accent}55` }}
                          >
                            {meta.sample}
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
          ></div>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className={`h-[16rem] w-full sm:h-[24rem] lg:h-[32rem] ${isMobile ? "mobile-terminal" : ""}`}
        style={{
          minHeight: "256px",
        }}
      />

      {/* Mobile Input Controls - Only show on mobile */}
      <div className="bg-muted/50 border-border block border-t px-2 py-3 sm:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-medium">
              Mobile Input
            </span>
            {lastInputSent && (
              <span className="rounded bg-green-500/10 px-2 py-1 text-xs text-green-500">
                Sent:{" "}
                {lastInputSent === "\r"
                  ? "Enter"
                  : lastInputSent === " "
                    ? "Space"
                    : lastInputSent === "\b"
                      ? "Backspace"
                      : lastInputSent === "\x1b[A"
                        ? "Up"
                        : lastInputSent === "\x1b[B"
                          ? "Down"
                          : lastInputSent === "\x1b[C"
                            ? "Right"
                            : lastInputSent === "\x1b[D"
                              ? "Left"
                              : lastInputSent}
              </span>
            )}
          </div>
          <Button
            onClick={() => setShowMobileInput(!showMobileInput)}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            <Keyboard className="mr-1 h-4 w-4" />
            {showMobileInput ? "Hide" : "Show"} Input
          </Button>
        </div>

        {showMobileInput && (
          <div className="space-y-3">
            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => sendInput("\x1b[A")}
                variant="outline"
                size="sm"
                className="flex items-center justify-center gap-2 text-sm"
                disabled={!isConnected}
              >
                <ChevronUp className="h-4 w-4" />
                Up
              </Button>
              <Button
                onClick={() => sendInput("\x1b[B")}
                variant="outline"
                size="sm"
                className="flex items-center justify-center gap-2 text-sm"
                disabled={!isConnected}
              >
                <ChevronDown className="h-4 w-4" />
                Down
              </Button>
            </div>

            {/* Left/Right Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => sendInput("\x1b[D")}
                variant="outline"
                size="sm"
                className="flex items-center justify-center gap-2 text-sm"
                disabled={!isConnected}
              >
                <ChevronLeft className="h-4 w-4" />
                Left
              </Button>
              <Button
                onClick={() => sendInput("\x1b[C")}
                variant="outline"
                size="sm"
                className="flex items-center justify-center gap-2 text-sm"
                disabled={!isConnected}
              >
                <ChevronRight className="h-4 w-4" />
                Right
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={handleEnterKey}
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={!isConnected}
              >
                Enter
              </Button>
              <Button
                onClick={() => sendInput(" ")}
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={!isConnected}
              >
                Space
              </Button>
              <Button
                onClick={() => sendInput("\b")}
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={!isConnected}
              >
                ⌫ Backspace
              </Button>
            </div>

            {/* Custom Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="Type command..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleMobileInput(mobileInput);
                  }
                }}
                disabled={!isConnected}
              />
              <Button
                onClick={() => handleMobileInput(mobileInput)}
                variant="default"
                size="sm"
                disabled={!isConnected || !mobileInput.trim()}
                className="px-3"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Controls */}
      <div className="bg-muted border-border flex flex-col items-stretch justify-between gap-2 border-t px-2 py-2 sm:flex-row sm:items-center sm:px-4">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <Button
            onClick={startScript}
            disabled={!isConnected || (isRunning && !isStopped)}
            variant="default"
            size="sm"
            className={`text-xs sm:text-sm ${isConnected && (!isRunning || isStopped) ? "bg-green-600 hover:bg-green-700" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
          >
            <Play className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Start</span>
            <span className="sm:hidden">▶</span>
          </Button>

          <Button
            onClick={stopScript}
            disabled={!isRunning}
            variant="default"
            size="sm"
            className={`text-xs sm:text-sm ${isRunning ? "bg-red-600 hover:bg-red-700" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
          >
            <Square className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Stop</span>
            <span className="sm:hidden">⏹</span>
          </Button>

          <Button
            onClick={clearOutput}
            variant="secondary"
            size="sm"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs sm:text-sm"
          >
            <Trash2 className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Clear</span>
            <span className="sm:hidden">🗑</span>
          </Button>
        </div>

        <Button
          onClick={onClose}
          variant="secondary"
          size="sm"
          className="w-full bg-gray-600 text-xs text-white hover:bg-gray-700 sm:w-auto sm:text-sm"
        >
          <X className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
          Close
        </Button>
      </div>
    </div>
  );
}
