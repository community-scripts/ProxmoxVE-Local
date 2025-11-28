'use client';

import { useState, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from './ui/button';
import type { Script } from '../../types/script';

interface TextViewerProps {
  scriptName: string;
  isOpen: boolean;
  onClose: () => void;
  script?: Script | null;
}

interface ScriptContent {
  mainScript?: string;
  installScript?: string;
  alpineMainScript?: string;
  alpineInstallScript?: string;
}

export function TextViewer({ scriptName, isOpen, onClose, script }: TextViewerProps) {
  const [scriptContent, setScriptContent] = useState<ScriptContent>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'install'>('main');
  const [selectedVersion, setSelectedVersion] = useState<'default' | 'alpine'>('default');

  // Extract slug from script name (remove .sh extension)
  const slug = scriptName.replace(/\.sh$/, '').replace(/^alpine-/, '');
  
  // Get default and alpine install methods
  const defaultMethod = script?.install_methods?.find(method => method.type === 'default');
  const alpineMethod = script?.install_methods?.find(method => method.type === 'alpine');
  
  // Check if alpine variant exists
  const hasAlpineVariant = !!alpineMethod;
  
  // Get script paths from install_methods
  const defaultScriptPath = defaultMethod?.script;
  const alpineScriptPath = alpineMethod?.script;
  
  // Determine if install scripts exist (only for ct/ scripts typically)
  const hasInstallScript = (defaultScriptPath?.startsWith('ct/') ?? false) || (alpineScriptPath?.startsWith('ct/') ?? false);
  
  // Get script names for display
  const defaultScriptName = scriptName.replace(/^alpine-/, '');

  const loadScriptContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build fetch requests based on actual script paths from install_methods
      const requests: Promise<Response>[] = [];
      const requestTypes: Array<'default-main' | 'default-install' | 'alpine-main' | 'alpine-install'> = [];

      // Default main script (ct/, vm/, tools/, etc.)
      if (defaultScriptPath) {
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: defaultScriptPath } }))}`)
        );
        requestTypes.push('default-main');
      }
      
      // Default install script (only for ct/ scripts)
      if (hasInstallScript && defaultScriptPath?.startsWith('ct/')) {
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `install/${slug}-install.sh` } }))}`)
        );
        requestTypes.push('default-install');
      }
      
      // Alpine main script
      if (hasAlpineVariant && alpineScriptPath) {
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: alpineScriptPath } }))}`)
        );
        requestTypes.push('alpine-main');
      }
      
      // Alpine install script (only for ct/ scripts)
      if (hasAlpineVariant && hasInstallScript && alpineScriptPath?.startsWith('ct/')) {
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `install/alpine-${slug}-install.sh` } }))}`)
        );
        requestTypes.push('alpine-install');
      }
      
      const responses = await Promise.allSettled(requests);
      const content: ScriptContent = {};

      // Process responses based on their types
      await Promise.all(responses.map(async (response, index) => {
        if (response.status === 'fulfilled' && response.value.ok) {
          try {
            const data = await response.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
            const type = requestTypes[index];
            if (data.result?.data?.json?.success && data.result.data.json.content) {
              switch (type) {
                case 'default-main':
                  content.mainScript = data.result.data.json.content;
                  break;
                case 'default-install':
                  content.installScript = data.result.data.json.content;
                  break;
                case 'alpine-main':
                  content.alpineMainScript = data.result.data.json.content;
                  break;
                case 'alpine-install':
                  content.alpineInstallScript = data.result.data.json.content;
                  break;
              }
            }
          } catch {
            // Ignore errors
          }
        }
      }));

      setScriptContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load script content');
    } finally {
      setIsLoading(false);
    }
  }, [defaultScriptPath, alpineScriptPath, slug, hasAlpineVariant, hasInstallScript]);

  useEffect(() => {
    if (isOpen && scriptName) {
      void loadScriptContent();
    }
  }, [isOpen, scriptName, loadScriptContent]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col border border-border mx-4 sm:mx-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-4 flex-1">
            <h2 className="text-2xl font-bold text-foreground">
              Script Viewer: {defaultScriptName}
            </h2>
            {hasAlpineVariant && (
              <div className="flex space-x-2">
                <Button
                  variant={selectedVersion === 'default' ? 'default' : 'outline'}
                  onClick={() => setSelectedVersion('default')}
                  className="px-3 py-1 text-sm"
                >
                  Default
                </Button>
                <Button
                  variant={selectedVersion === 'alpine' ? 'default' : 'outline'}
                  onClick={() => setSelectedVersion('alpine')}
                  className="px-3 py-1 text-sm"
                >
                  Alpine
                </Button>
              </div>
            )}
            {((selectedVersion === 'default' && (scriptContent.mainScript ?? scriptContent.installScript)) ?? false) ||
              (selectedVersion === 'alpine' && (scriptContent.alpineMainScript ?? scriptContent.alpineInstallScript))  && (
              <div className="flex space-x-2">
                <Button
                  variant={activeTab === 'main' ? 'outline' : 'ghost'}
                  onClick={() => setActiveTab('main')}
                  className="px-3 py-1 text-sm"
                >
                  Script
                </Button>
                {hasInstallScript && (
                  <Button
                    variant={activeTab === 'install' ? 'outline' : 'ghost'}
                    onClick={() => setActiveTab('install')}
                    className="px-3 py-1 text-sm"
                  >
                    Install Script
                  </Button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg text-muted-foreground">Loading script content...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg text-destructive">Error: {error}</div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {activeTab === 'main' && (
                selectedVersion === 'default' && scriptContent.mainScript ? (
                  <SyntaxHighlighter
                    language="bash"
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '100%'
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                  >
                    {scriptContent.mainScript}
                  </SyntaxHighlighter>
                ) : selectedVersion === 'alpine' && scriptContent.alpineMainScript ? (
                  <SyntaxHighlighter
                    language="bash"
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '100%'
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                  >
                    {scriptContent.alpineMainScript}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-lg text-muted-foreground">
                      {selectedVersion === 'default' ? 'Default script not found' : 'Alpine script not found'}
                    </div>
                  </div>
                )
              )}
              {activeTab === 'install' && (
                selectedVersion === 'default' && scriptContent.installScript ? (
                  <SyntaxHighlighter
                    language="bash"
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '100%'
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                  >
                    {scriptContent.installScript}
                  </SyntaxHighlighter>
                ) : selectedVersion === 'alpine' && scriptContent.alpineInstallScript ? (
                  <SyntaxHighlighter
                    language="bash"
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '100%'
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                  >
                    {scriptContent.alpineInstallScript}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-lg text-muted-foreground">
                      {selectedVersion === 'default' ? 'Default install script not found' : 'Alpine install script not found'}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
