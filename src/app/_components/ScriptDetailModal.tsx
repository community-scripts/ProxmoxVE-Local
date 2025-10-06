'use client';

import { useState } from 'react';
import Image from 'next/image';
import { api } from '~/trpc/react';
import type { Script } from '~/types/script';
import { DiffViewer } from './DiffViewer';
import { TextViewer } from './TextViewer';
import { ExecutionModeModal } from './ExecutionModeModal';

interface ScriptDetailModalProps {
  script: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onInstallScript?: (scriptPath: string, scriptName: string, mode?: 'local' | 'ssh', server?: any) => void;
}

export function ScriptDetailModal({ script, isOpen, onClose, onInstallScript }: ScriptDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [textViewerOpen, setTextViewerOpen] = useState(false);
  const [executionModeOpen, setExecutionModeOpen] = useState(false);

  // Check if script files exist locally
  const { data: scriptFilesData, refetch: refetchScriptFiles, isLoading: scriptFilesLoading } = api.scripts.checkScriptFiles.useQuery(
    { slug: script?.slug ?? '' },
    { enabled: !!script && isOpen }
  );

  // Compare local and remote script content (run in parallel, not dependent on scriptFilesData)
  const { data: comparisonData, refetch: refetchComparison, isLoading: comparisonLoading } = api.scripts.compareScriptContent.useQuery(
    { slug: script?.slug ?? '' },
    { enabled: !!script && isOpen }
  );

  // Load script mutation
  const loadScriptMutation = api.scripts.loadScript.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      if (data.success) {
        const message = 'message' in data ? data.message : 'Script loaded successfully';
        setLoadMessage(`✅ ${message}`);
        // Refetch script files status and comparison data to update the UI
        void refetchScriptFiles();
        void refetchComparison();
      } else {
        const error = 'error' in data ? data.error : 'Failed to load script';
        setLoadMessage(`❌ ${error}`);
      }
      // Clear message after 5 seconds
      setTimeout(() => setLoadMessage(null), 5000);
    },
    onError: (error) => {
      setIsLoading(false);
      setLoadMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setLoadMessage(null), 5000);
    },
  });

  if (!isOpen || !script) return null;

  const handleImageError = () => {
    setImageError(true);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLoadScript = async () => {
    if (!script) return;
    
    setIsLoading(true);
    setLoadMessage(null);
    loadScriptMutation.mutate({ slug: script.slug });
  };

  const handleInstallScript = () => {
    if (!script) return;
    setExecutionModeOpen(true);
  };

  const handleExecuteScript = (mode: 'local' | 'ssh', server?: any) => {
    if (!script || !onInstallScript) return;
    
    // Find the script path (CT or tools)
    const scriptMethod = script.install_methods?.find(method => method.script);
    if (scriptMethod?.script) {
      const scriptPath = `scripts/${scriptMethod.script}`;
      const scriptName = script.name;
      
      // Pass execution mode and server info to the parent
      onInstallScript(scriptPath, scriptName, mode, server);
      
      // Scroll to top of the page to see the terminal
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      onClose(); // Close the modal when starting installation
    }
  };


  const handleViewScript = () => {
    setTextViewerOpen(true);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-gray-500 dark:text-gray-400 text-2xl font-semibold">
                  {script.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{script.name}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  script.type === 'ct' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {script.type.toUpperCase()}
                </span>
                {script.updateable && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Updateable
                  </span>
                )}
                {script.privileged && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Privileged
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Install Button - only show if script files exist */}
            {scriptFilesData?.success && scriptFilesData.ctExists && onInstallScript && (
              <button
                onClick={handleInstallScript}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Install</span>
              </button>
            )}

            {/* View Button - only show if script files exist */}
            {scriptFilesData?.success && (scriptFilesData.ctExists || scriptFilesData.installExists) && (
              <button
                onClick={handleViewScript}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>View</span>
              </button>
            )}
            
            {/* Load/Update Script Button */}
            {(() => {
              const hasLocalFiles = scriptFilesData?.success && (scriptFilesData.ctExists || scriptFilesData.installExists);
              const hasDifferences = comparisonData?.success && comparisonData.hasDifferences;
              const isUpToDate = hasLocalFiles && !hasDifferences;
              
              if (!hasLocalFiles) {
                // No local files - show Load Script button
                return (
                  <button
                    onClick={handleLoadScript}
                    disabled={isLoading}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Load Script</span>
                      </>
                    )}
                  </button>
                );
              } else if (isUpToDate) {
                // Local files exist and are up to date - show disabled Update button
                return (
                  <button
                    disabled
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors bg-gray-400 text-white cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Up to Date</span>
                  </button>
                );
              } else {
                // Local files exist but have differences - show Update button
                return (
                  <button
                    onClick={handleLoadScript}
                    disabled={isLoading}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Update Script</span>
                      </>
                    )}
                  </button>
                );
              }
            })()}
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Load Message */}
        {loadMessage && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
            {loadMessage}
          </div>
        )}

        {/* Script Files Status */}
        {(scriptFilesLoading || comparisonLoading) && (
          <div className="mx-6 mb-4 p-3 rounded-lg bg-blue-50 text-sm">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Loading script status...</span>
            </div>
          </div>
        )}
        
        {scriptFilesData?.success && !scriptFilesLoading && (() => {
          // Determine script type from the first install method
          const firstScript = script?.install_methods?.[0]?.script;
          let scriptType = 'Script';
          if (firstScript?.startsWith('ct/')) {
            scriptType = 'CT Script';
          } else if (firstScript?.startsWith('tools/')) {
            scriptType = 'Tools Script';
          } else if (firstScript?.startsWith('vm/')) {
            scriptType = 'VM Script';
          } else if (firstScript?.startsWith('vw/')) {
            scriptType = 'VW Script';
          }

          return (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${scriptFilesData.ctExists ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>{scriptType}: {scriptFilesData.ctExists ? 'Available' : 'Not loaded'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${scriptFilesData.installExists ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span>Install Script: {scriptFilesData.installExists ? 'Available' : 'Not loaded'}</span>
                </div>
                {scriptFilesData?.success && (scriptFilesData.ctExists || scriptFilesData.installExists) && comparisonData?.success && !comparisonLoading && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${comparisonData.hasDifferences ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                    <span>Status: {comparisonData.hasDifferences ? 'Update available' : 'Up to date'}</span>
                  </div>
                )}
              </div>
              {scriptFilesData.files.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Files: {scriptFilesData.files.join(', ')}
                </div>
              )}
            </div>
          );
        })()}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Description</h3>
            <p className="text-gray-600 dark:text-gray-300">{script.description}</p>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Basic Information</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Slug</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono">{script.slug}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date Created</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{script.date_created}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Categories</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{script.categories.join(', ')}</dd>
                </div>
                {script.interface_port && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Interface Port</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">{script.interface_port}</dd>
                  </div>
                )}
                {script.config_path && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Config Path</dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100 font-mono">{script.config_path}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Links</h3>
              <dl className="space-y-2">
                {script.website && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Website</dt>
                    <dd className="text-sm">
                      <a
                        href={script.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                      >
                        {script.website}
                      </a>
                    </dd>
                  </div>
                )}
                {script.documentation && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Documentation</dt>
                    <dd className="text-sm">
                      <a
                        href={script.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 break-all"
                      >
                        {script.documentation}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Install Methods */}
          {script.install_methods.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Install Methods</h3>
              <div className="space-y-4">
                {script.install_methods.map((method, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">{method.type}</h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{method.script}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">CPU</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{method.resources.cpu} cores</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">RAM</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{method.resources.ram} MB</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">HDD</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{method.resources.hdd} GB</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-gray-500 dark:text-gray-400">OS</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{method.resources.os} {method.resources.version}</dd>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Default Credentials */}
          {(script.default_credentials.username ?? script.default_credentials.password) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Default Credentials</h3>
              <dl className="space-y-2">
                {script.default_credentials.username && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Username</dt>
                    <dd className="text-sm text-gray-900 font-mono">{script.default_credentials.username}</dd>
                  </div>
                )}
                {script.default_credentials.password && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Password</dt>
                    <dd className="text-sm text-gray-900 font-mono">{script.default_credentials.password}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Notes */}
          {script.notes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Notes</h3>
              <ul className="space-y-2">
                {script.notes.map((note, index) => {
                  // Handle both object and string note formats
                  const noteText = typeof note === 'string' ? note : note.text;
                  const noteType = typeof note === 'string' ? 'info' : note.type;
                  
                  return (
                    <li key={index} className={`text-sm p-3 rounded-lg ${
                      noteType === 'warning' 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-l-4 border-yellow-400' 
                        : noteType === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-l-4 border-red-400'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      <div className="flex items-start">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                          noteType === 'warning' 
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' 
                            : noteType === 'error'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        }`}>
                          {noteType}
                        </span>
                        <span>{noteText}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Diff Viewer Modal */}
      {selectedDiffFile && (
        <DiffViewer
          scriptSlug={script.slug}
          filePath={selectedDiffFile}
          isOpen={diffViewerOpen}
          onClose={() => {
            setDiffViewerOpen(false);
            setSelectedDiffFile(null);
          }}
        />
      )}

      {/* Text Viewer Modal */}
      {script && (
        <TextViewer
          scriptName={script.install_methods?.find(method => method.script?.startsWith('ct/'))?.script?.split('/').pop() ?? `${script.slug}.sh`}
          isOpen={textViewerOpen}
          onClose={() => setTextViewerOpen(false)}
        />
      )}

      {/* Execution Mode Modal */}
      {script && (
        <ExecutionModeModal
          scriptName={script.name}
          isOpen={executionModeOpen}
          onClose={() => setExecutionModeOpen(false)}
          onExecute={handleExecuteScript}
        />
      )}
    </div>
  );
}
