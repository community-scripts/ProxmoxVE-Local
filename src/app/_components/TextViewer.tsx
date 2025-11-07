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
  ctScript?: string;
  installScript?: string;
  alpineCtScript?: string;
  alpineInstallScript?: string;
}

export function TextViewer({ scriptName, isOpen, onClose, script }: TextViewerProps) {
  const [scriptContent, setScriptContent] = useState<ScriptContent>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ct' | 'install'>('ct');
  const [selectedVersion, setSelectedVersion] = useState<'default' | 'alpine'>('default');

  // Extract slug from script name (remove .sh extension)
  const slug = scriptName.replace(/\.sh$/, '').replace(/^alpine-/, '');
  
  // Check if alpine variant exists
  const hasAlpineVariant = script?.install_methods?.some(
    method => method.type === 'alpine' && method.script?.startsWith('ct/')
  );
  
  // Get script names for default and alpine versions
  const defaultScriptName = scriptName.replace(/^alpine-/, '');
  const alpineScriptName = scriptName.startsWith('alpine-') ? scriptName : `alpine-${scriptName}`;

  const loadScriptContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build fetch requests for default version
      const requests: Promise<Response>[] = [];
      
      // Default CT script
      requests.push(
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `ct/${defaultScriptName}` } }))}`)
      );
      
      // Tools, VM, VW scripts
      requests.push(
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `tools/pve/${defaultScriptName}` } }))}`)
      );
      requests.push(
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `vm/${defaultScriptName}` } }))}`)
      );
      requests.push(
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `vw/${defaultScriptName}` } }))}`)
      );
      
      // Default install script
      requests.push(
        fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `install/${slug}-install.sh` } }))}`)
      );
      
      // Alpine versions if variant exists
      if (hasAlpineVariant) {
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `ct/${alpineScriptName}` } }))}`)
        );
        requests.push(
          fetch(`/api/trpc/scripts.getScriptContent?input=${encodeURIComponent(JSON.stringify({ json: { path: `install/alpine-${slug}-install.sh` } }))}`)
        );
      }
      
      const responses = await Promise.allSettled(requests);

      const content: ScriptContent = {};
      let responseIndex = 0;

      // Default CT script
      const ctResponse = responses[responseIndex];
      if (ctResponse?.status === 'fulfilled' && ctResponse.value.ok) {
        const ctData = await ctResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (ctData.result?.data?.json?.success) {
          content.ctScript = ctData.result.data.json.content;
        }
      }

      responseIndex++;
      // Tools script
      const toolsResponse = responses[responseIndex];
      if (toolsResponse?.status === 'fulfilled' && toolsResponse.value.ok) {
        const toolsData = await toolsResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (toolsData.result?.data?.json?.success) {
          content.ctScript = toolsData.result.data.json.content; // Use ctScript field for tools scripts too
        }
      }

      responseIndex++;
      // VM script
      const vmResponse = responses[responseIndex];
      if (vmResponse?.status === 'fulfilled' && vmResponse.value.ok) {
        const vmData = await vmResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (vmData.result?.data?.json?.success) {
          content.ctScript = vmData.result.data.json.content; // Use ctScript field for VM scripts too
        }
      }

      responseIndex++;
      // VW script
      const vwResponse = responses[responseIndex];
      if (vwResponse?.status === 'fulfilled' && vwResponse.value.ok) {
        const vwData = await vwResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (vwData.result?.data?.json?.success) {
          content.ctScript = vwData.result.data.json.content; // Use ctScript field for VW scripts too
        }
      }

      responseIndex++;
      // Default install script
      const installResponse = responses[responseIndex];
      if (installResponse?.status === 'fulfilled' && installResponse.value.ok) {
        const installData = await installResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
        if (installData.result?.data?.json?.success) {
          content.installScript = installData.result.data.json.content;
        }
      }
      responseIndex++;
      // Alpine CT script
      if (hasAlpineVariant) {
        const alpineCtResponse = responses[responseIndex];
        if (alpineCtResponse?.status === 'fulfilled' && alpineCtResponse.value.ok) {
          const alpineCtData = await alpineCtResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
          if (alpineCtData.result?.data?.json?.success) {
            content.alpineCtScript = alpineCtData.result.data.json.content;
          }
        }
        responseIndex++;
      }

      // Alpine install script
      if (hasAlpineVariant) {
        const alpineInstallResponse = responses[responseIndex];
        if (alpineInstallResponse?.status === 'fulfilled' && alpineInstallResponse.value.ok) {
          const alpineInstallData = await alpineInstallResponse.value.json() as { result?: { data?: { json?: { success?: boolean; content?: string } } } };
          if (alpineInstallData.result?.data?.json?.success) {
            content.alpineInstallScript = alpineInstallData.result.data.json.content;
          }
        }
      }

      setScriptContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load script content');
    } finally {
      setIsLoading(false);
    }
  }, [defaultScriptName, alpineScriptName, slug, hasAlpineVariant]);

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
            {((selectedVersion === 'default' && (scriptContent.ctScript || scriptContent.installScript)) ||
              (selectedVersion === 'alpine' && (scriptContent.alpineCtScript || scriptContent.alpineInstallScript))) && (
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
              {activeTab === 'ct' && (
                selectedVersion === 'default' && scriptContent.ctScript ? (
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
                ) : selectedVersion === 'alpine' && scriptContent.alpineCtScript ? (
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
                    {scriptContent.alpineCtScript}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-lg text-muted-foreground">
                      {selectedVersion === 'default' ? 'Default CT script not found' : 'Alpine CT script not found'}
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
