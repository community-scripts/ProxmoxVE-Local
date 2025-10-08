'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Button } from './ui/button';
import { Play, Square, Trash2, X, Send, Keyboard, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface TerminalProps {
  scriptPath: string;
  onClose: () => void;
  mode?: 'local' | 'ssh';
  server?: any;
  isUpdate?: boolean;
  containerId?: string;
}

interface TerminalMessage {
  type: 'start' | 'output' | 'error' | 'end';
  data: string;
  timestamp: number;
}

export function Terminal({ scriptPath, onClose, mode = 'local', server, isUpdate = false, containerId }: TerminalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [showMobileInput, setShowMobileInput] = useState(false);
  const [lastInputSent, setLastInputSent] = useState<string | null>(null);
  const [inWhiptailSession, setInWhiptailSession] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [executionId] = useState(() => `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const isConnectingRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);

  const scriptName = scriptPath.split('/').pop() ?? scriptPath.split('\\').pop() ?? 'Unknown Script';

  const handleMessage = useCallback((message: TerminalMessage) => {
    if (!xtermRef.current) return;

    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] `;
    
    switch (message.type) {
      case 'start':
        xtermRef.current.writeln(`${prefix}[START] ${message.data}`);
        setIsRunning(true);
        break;
      case 'output':
        // Write directly to terminal - xterm.js handles ANSI codes natively
        console.log('=== OUTPUT DEBUG ===');
        console.log('Output data length:', message.data.length);
        console.log('Output preview:', message.data.substring(0, 200));
        console.log('Contains ANSI codes:', message.data.includes('\x1b[') || message.data.includes('\u001b['));
        console.log('Contains clear screen:', message.data.includes('\x1b[2J') || message.data.includes('\x1b[H\x1b[2J'));
        console.log('Contains cursor positioning:', message.data.includes('\x1b[') && message.data.includes('H'));
        console.log('In whiptail session:', inWhiptailSession);
        
        // Detect whiptail sessions
        if (message.data.includes('whiptail') || message.data.includes('dialog') || message.data.includes('Choose an option')) {
          setInWhiptailSession(true);
          console.log('Whiptail session detected!');
        }
        
        // Check for screen clearing sequences and handle them properly
        if (message.data.includes('\x1b[2J') || message.data.includes('\x1b[H\x1b[2J')) {
          // This is a clear screen sequence, ensure it's processed correctly
          console.log('Clear screen detected:', message.data);
          xtermRef.current.write(message.data);
        } else if (message.data.includes('\x1b[') && message.data.includes('H')) {
          // This is a cursor positioning sequence, often implies a redraw of the entire screen
          console.log('Cursor positioning detected (implies redraw):', message.data);
          if (inWhiptailSession) {
            // In whiptail session, be more aggressive about clearing
            console.log('Clearing terminal for whiptail redraw');
            xtermRef.current.clear();
            xtermRef.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
          }
          xtermRef.current.write(message.data);
        } else {
          xtermRef.current.write(message.data);
        }
        break;
      case 'error':
        // Check if this looks like ANSI terminal output (contains escape codes)
        if (message.data.includes('\x1B[') || message.data.includes('\u001b[')) {
          // This is likely terminal output sent to stderr, treat it as normal output
          xtermRef.current.write(message.data);
        } else if (message.data.includes('TERM environment variable not set')) {
          // This is a common warning, treat as normal output
          xtermRef.current.write(message.data);
        } else if (message.data.includes('exit code') && message.data.includes('clear')) {
          // This is a script error, show it with error prefix
          xtermRef.current.writeln(`${prefix}[ERROR] ${message.data}`);
        } else {
          // This is a real error, show it with error prefix
          xtermRef.current.writeln(`${prefix}[ERROR] ${message.data}`);
        }
        break;
      case 'end':
        // Reset whiptail session
        setInWhiptailSession(false);
        
        // Check if this is an LXC creation script
        const isLxcCreation = scriptPath.includes('ct/') || 
                             scriptPath.includes('create_lxc') || 
                             (containerId != null) ||
                             scriptName.includes('lxc') ||
                             scriptName.includes('container');
        
        if (isLxcCreation && message.data.includes('SSH script execution finished with code: 0')) {
          // Display prominent LXC creation completion message
          xtermRef.current.writeln('');
          xtermRef.current.writeln('#########################################');
          xtermRef.current.writeln('########## LXC CREATION FINISHED ########');
          xtermRef.current.writeln('#########################################');
          xtermRef.current.writeln('');
        } else {
          xtermRef.current.writeln(`${prefix}✅ ${message.data}`);
        }
        setIsRunning(false);
        break;
    }
  }, [scriptPath, containerId, scriptName]);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only initialize on client side
    if (!isClient || !terminalRef.current || xtermRef.current) return;

    // Use setTimeout to ensure DOM is fully ready
    const initTerminal = async () => {
      if (!terminalRef.current || xtermRef.current) return;

      // Dynamically import xterm modules to avoid SSR issues
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      // Check if we're on mobile
      const isMobile = window.innerWidth < 768;
      
      const terminal = new XTerm({
        theme: {
          background: '#000000',
          foreground: '#00ff00',
          cursor: '#00ff00',
        },
        fontSize: isMobile ? 10 : 14,
        fontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, Monaco, Menlo, Ubuntu Mono, monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        tabStopWidth: 4,
        allowTransparency: false,
        convertEol: true,
        disableStdin: false,
        macOptionIsMeta: false,
        rightClickSelectsWord: false,
        wordSeparator: ' ()[]{}\'"`<>|',
        // Better ANSI handling
        allowProposedApi: true,
        // Force proper terminal behavior for interactive applications
        cols: isMobile ? 60 : 80,
        rows: isMobile ? 20 : 24,
      });

      // Add addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      
      // Enable better ANSI handling
      terminal.options.allowProposedApi = true;

      // Open terminal
      terminal.open(terminalRef.current);
      
      // Fit after a small delay to ensure proper sizing
      setTimeout(() => {
        fitAddon.fit();
      }, 100);

      // Add resize listener for mobile responsiveness
      const handleResize = () => {
        if (fitAddonRef.current) {
          setTimeout(() => {
            fitAddonRef.current.fit();
          }, 50);
        }
      };

      window.addEventListener('resize', handleResize);
      
      // Store the handler for cleanup
      (terminalRef.current as any).resizeHandler = handleResize;

      // Store references
      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle terminal input
      terminal.onData((data) => {
        console.log('=== KEYBOARD INPUT DEBUG ===');
        console.log('Keyboard input received:', data);
        console.log('Input bytes:', Array.from(data).map(c => c.charCodeAt(0)));
        console.log('WebSocket ref exists:', !!wsRef.current);
        console.log('WebSocket readyState:', wsRef.current?.readyState);
        console.log('Is connected:', wsRef.current?.readyState === WebSocket.OPEN);
        console.log('WebSocket URL:', wsRef.current?.url);
        console.log('WebSocket protocol:', wsRef.current?.protocol);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = {
            action: 'input',
            executionId,
            input: data  // Reverted back to 'input' field - server expects this
          };
          console.log('Sending keyboard WebSocket message:', JSON.stringify(message, null, 2));
          console.log('WebSocket object:', wsRef.current);
          wsRef.current.send(JSON.stringify(message));
          console.log('Keyboard WebSocket message sent successfully');
        } else {
          console.warn('WebSocket not connected for keyboard input');
        }
      });

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
      if (terminalRef.current && (terminalRef.current as any).resizeHandler) {
        window.removeEventListener('resize', (terminalRef.current as any).resizeHandler);
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, [executionId, isClient]);

  useEffect(() => {
    // Prevent multiple connections in React Strict Mode
    if (hasConnectedRef.current || isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = true;
    hasConnectedRef.current = true;

    // Small delay to prevent rapid reconnection
    const connectWithDelay = () => {
      // Connect to WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/script-execution`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        isConnectingRef.current = false;
        
        // Send start message immediately after connection
        const message = {
          action: 'start',
          scriptPath,
          executionId,
          mode,
          server,
          isUpdate,
          containerId
        };
        ws.send(JSON.stringify(message));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as TerminalMessage;
          console.log('WebSocket message received:', message);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (_event) => {
        setIsConnected(false);
        setIsRunning(false);
        isConnectingRef.current = false;
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket readyState:', ws.readyState);
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
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, [scriptPath, executionId, mode, server, isUpdate, containerId, handleMessage]);

  const startScript = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'start',
        scriptPath,
        executionId,
        mode,
        server,
        isUpdate,
        containerId
      }));
    }
  };

  const stopScript = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'stop',
        executionId
      }));
    }
  };

  const clearOutput = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const sendInput = (input: string) => {
    console.log('=== MOBILE INPUT SEND DEBUG ===');
    console.log('Sending input:', input, 'to execution:', executionId);
    console.log('Input bytes:', Array.from(input).map(c => c.charCodeAt(0)));
    console.log('WebSocket ref exists:', !!wsRef.current);
    console.log('WebSocket readyState:', wsRef.current?.readyState);
    console.log('WebSocket OPEN constant:', WebSocket.OPEN);
    console.log('Is connected:', wsRef.current?.readyState === WebSocket.OPEN);
    console.log('WebSocket URL:', wsRef.current?.url);
    console.log('WebSocket protocol:', wsRef.current?.protocol);
    
    setLastInputSent(input);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        action: 'input',
        executionId,
        input: input  // Changed to 'input' field to match server expectations
      };
      console.log('Sending WebSocket message:', JSON.stringify(message, null, 2));
      console.log('WebSocket object:', wsRef.current);
      wsRef.current.send(JSON.stringify(message));
      console.log('WebSocket message sent successfully');
      // Clear the feedback after 2 seconds
      setTimeout(() => setLastInputSent(null), 2000);
    } else {
      console.warn('WebSocket not connected, cannot send input');
      console.warn('WebSocket state:', wsRef.current?.readyState);
    }
  };

  const handleMobileInput = (input: string) => {
    sendInput(input);
    setMobileInput('');
  };

  const handleNumberInput = (number: number) => {
    sendInput(number.toString());
  };

  const handleEnterKey = () => {
    sendInput('\r');
  };

  // Don't render on server side
  if (!isClient) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted px-4 py-2 flex items-center justify-between border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-foreground font-mono text-sm ml-2">
              {scriptName}
            </span>
          </div>
        </div>
        <div className="h-96 w-full flex items-center justify-center">
          <div className="text-muted-foreground">Loading terminal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-muted px-2 sm:px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <div className="flex space-x-1 flex-shrink-0">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-foreground font-mono text-xs sm:text-sm ml-1 sm:ml-2 truncate">
            {scriptName} {mode === 'ssh' && server && `(SSH: ${server.name})`}
          </span>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-muted-foreground text-xs hidden sm:inline">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        className="h-[16rem] sm:h-[24rem] lg:h-[32rem] w-full max-w-4xl mx-auto"
        style={{ minHeight: '256px' }}
      />

      {/* Mobile Input Controls - Only show on mobile */}
      <div className="block sm:hidden bg-muted/50 px-2 py-3 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Mobile Input</span>
            {lastInputSent && (
              <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                Sent: {lastInputSent === '\r' ? 'Enter' : 
                       lastInputSent === ' ' ? 'Space' :
                       lastInputSent === '\b' ? 'Backspace' :
                       lastInputSent === '\x1b[A' ? 'Up' : 
                       lastInputSent === '\x1b[B' ? 'Down' : 
                       lastInputSent === '\x1b[C' ? 'Right' : 
                       lastInputSent === '\x1b[D' ? 'Left' : 
                       lastInputSent}
              </span>
            )}
          </div>
          <Button
            onClick={() => setShowMobileInput(!showMobileInput)}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            <Keyboard className="h-4 w-4 mr-1" />
            {showMobileInput ? 'Hide' : 'Show'} Input
          </Button>
        </div>
        
        {showMobileInput && (
          <div className="space-y-3">
            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  console.log('=== UP BUTTON CLICKED ===');
                  sendInput('\x1b[A');
                }}
                variant="outline"
                size="sm"
                className="text-sm flex items-center justify-center gap-2"
                disabled={!isConnected}
              >
                <ChevronUp className="h-4 w-4" />
                Up
              </Button>
              <Button
                onClick={() => {
                  console.log('=== DOWN BUTTON CLICKED ===');
                  sendInput('\x1b[B');
                }}
                variant="outline"
                size="sm"
                className="text-sm flex items-center justify-center gap-2"
                disabled={!isConnected}
              >
                <ChevronDown className="h-4 w-4" />
                Down
              </Button>
            </div>
            
            {/* Left/Right Navigation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  console.log('=== LEFT BUTTON CLICKED ===');
                  sendInput('\x1b[D');
                }}
                variant="outline"
                size="sm"
                className="text-sm flex items-center justify-center gap-2"
                disabled={!isConnected}
              >
                <ChevronLeft className="h-4 w-4" />
                Left
              </Button>
              <Button
                onClick={() => {
                  console.log('=== RIGHT BUTTON CLICKED ===');
                  sendInput('\x1b[C');
                }}
                variant="outline"
                size="sm"
                className="text-sm flex items-center justify-center gap-2"
                disabled={!isConnected}
              >
                <ChevronRight className="h-4 w-4" />
                Right
              </Button>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => {
                  console.log('=== ENTER BUTTON CLICKED ===');
                  handleEnterKey();
                }}
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={!isConnected}
              >
                Enter
              </Button>
              <Button
                onClick={() => {
                  console.log('=== SPACEBAR BUTTON CLICKED ===');
                  sendInput(' ');
                }}
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={!isConnected}
              >
                Space
              </Button>
              <Button
                onClick={() => {
                  console.log('=== BACKSPACE BUTTON CLICKED ===');
                  sendInput('\b');
                }}
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
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
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
      <div className="bg-muted px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-border">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <Button
            onClick={startScript}
            disabled={!isConnected || isRunning}
            variant="default"
            size="sm"
            className={`text-xs sm:text-sm ${isConnected && !isRunning ? 'bg-green-600 hover:bg-green-700' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Start</span>
            <span className="sm:hidden">▶</span>
          </Button>
          
          <Button
            onClick={stopScript}
            disabled={!isRunning}
            variant="default"
            size="sm"
            className={`text-xs sm:text-sm ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            <Square className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Stop</span>
            <span className="sm:hidden">⏹</span>
          </Button>
          
          <Button
            onClick={clearOutput}
            variant="secondary"
            size="sm"
            className="text-xs sm:text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Clear</span>
            <span className="sm:hidden">🗑</span>
          </Button>
        </div>

        <Button
          onClick={onClose}
          variant="secondary"
          size="sm"
          className="text-xs sm:text-sm bg-gray-600 text-white hover:bg-gray-700 w-full sm:w-auto"
        >
          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          Close
        </Button>
      </div>
    </div>
  );
}