'use client';

import { useState, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from './ui/button';

interface TextViewerProps {
  scriptName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ScriptContent {
  ctScript?: string;
  installScript?: string;
}

export function TextViewer({ scriptName, isOpen, onClose }: TextViewerProps) {
  const [scriptContent, setScriptContent] = useState<ScriptContent>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ct' | 'install'>('ct');

  // Extract slug from script name (remove .sh extension)
  const slug = scriptName.replace(/\.sh$/, '');

  const loadScriptContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to load from different possible locations
      const [ctResponse, toolsResponse, vmResponse, vwResponse, installResponse] = await Promise.allSettled([
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `ct/${scriptName}` } }))}`),
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `tools/pve/${scriptName}` } }))}`),
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `vm/${scriptName}` } }))}`),
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `vw/${scriptName}` } }))}`),
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `install/${slug}-install.sh` } }))}`)
      ]);

      const content: ScriptContent = {};

      if (ctResponse.status === 'fulfilled' && ctResponse.value.ok) {
        const ctData = await ctResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (ctData.result?.data?.json?.success) {
          content.ctScript = ctData.result.data.json.content;
        }
      }

      if (toolsResponse.status === 'fulfilled' && toolsResponse.value.ok) {
        const toolsData = await toolsResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (toolsData.result?.data?.json?.success) {
          content.ctScript = toolsData.result.data.json.content; // Use ctScript field for tools scripts too
        }
      }

      if (vmResponse.status === 'fulfilled' && vmResponse.value.ok) {
        const vmData = await vmResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (vmData.result?.data?.json?.success) {
          content.ctScript = vmData.result.data.json.content; // Use ctScript field for VM scripts too
        }
      }

      if (vwResponse.status === 'fulfilled' && vwResponse.value.ok) {
        const vwData = await vwResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (vwData.result?.data?.json?.success) {
          content.ctScript = vwData.result.data.json.content; // Use ctScript field for VW scripts too
        }
      }

      if (installResponse.status === 'fulfilled' && installResponse.value.ok) {
        const installData = await installResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (installData.result?.data?.json?.success) {
          content.installScript = installData.result.data.json.content;
        }
      }

      setScriptContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load script content');
    } finally {
      setIsLoading(false);
    }
  }, [scriptName, slug]);

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
      <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-bold text-foreground">
              Script Viewer: {scriptName}
            </h2>
            {scriptContent.ctScript && scriptContent.installScript && (
              <div className="flex space-x-2">
                <Button
                  variant={activeTab === 'ct' ? 'outline' : 'ghost'}
                  onClick={() => setActiveTab('ct')}
                  className="px-3 py-1 text-sm"
                >
                  CT Script
                </Button>
                <Button
                  variant={activeTab === 'install' ? 'outline' : 'ghost'}
                  onClick={() => setActiveTab('install')}
                  className="px-3 py-1 text-sm"
                >
                  Install Script
                </Button>
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
              {activeTab === 'ct' && scriptContent.ctScript ? (
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
                  {scriptContent.ctScript}
                </SyntaxHighlighter>
              ) : activeTab === 'install' && scriptContent.installScript ? (
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
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-lg text-gray-600">
                    {activeTab === 'ct' ? 'CT script not found' : 'Install script not found'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
