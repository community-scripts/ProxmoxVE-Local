"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";
import type { Script } from "~/types/script";
import { DiffViewer } from "./DiffViewer";
import { TextViewer } from "./TextViewer";
import { ExecutionModeModal } from "./ExecutionModeModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { ScriptVersionModal } from "./ScriptVersionModal";
import { TypeBadge, UpdateableBadge, PrivilegedBadge, NoteBadge } from "./Badge";
import { Button } from "./ui/button";
import { useRegisterModal } from './modal/ModalStackProvider';

interface ScriptDetailModalProps {
  script: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onInstallScript?: (
    scriptPath: string,
    scriptName: string,
    mode?: "local" | "ssh",
    server?: any,
  ) => void;
}

export function ScriptDetailModal({
  script,
  isOpen,
  onClose,
  onInstallScript,
}: ScriptDetailModalProps) {
  useRegisterModal(isOpen, { id: 'script-detail-modal', allowEscape: true, onClose });
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [textViewerOpen, setTextViewerOpen] = useState(false);
  const [executionModeOpen, setExecutionModeOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedVersionType, setSelectedVersionType] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Check if script files exist locally
  const {
    data: scriptFilesData,
    refetch: refetchScriptFiles,
    isLoading: scriptFilesLoading,
  } = api.scripts.checkScriptFiles.useQuery(
    { slug: script?.slug ?? "" },
    { enabled: !!script && isOpen },
  );

  // Compare local and remote script content (run in parallel, not dependent on scriptFilesData)
  const {
    data: comparisonData,
    refetch: refetchComparison,
    isLoading: comparisonLoading,
  } = api.scripts.compareScriptContent.useQuery(
    { slug: script?.slug ?? "" },
    { enabled: !!script && isOpen },
  );

  // Load script mutation
  const loadScriptMutation = api.scripts.loadScript.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      if (data.success) {
        const message =
          "message" in data ? data.message : "Script loaded successfully";
        setLoadMessage(`[SUCCESS] ${message}`);
        // Refetch script files status and comparison data to update the UI
        void refetchScriptFiles();
        void refetchComparison();
      } else {
        const error = "error" in data ? data.error : "Failed to load script";
        setLoadMessage(`[ERROR] ${error}`);
      }
      // Clear message after 5 seconds
      setTimeout(() => setLoadMessage(null), 5000);
    },
    onError: (error) => {
      setIsLoading(false);
      setLoadMessage(`[ERROR] ${error.message}`);
      setTimeout(() => setLoadMessage(null), 5000);
    },
  });

  // Delete script mutation
  const deleteScriptMutation = api.scripts.deleteScript.useMutation({
    onSuccess: (data) => {
      setIsDeleting(false);
      if (data.success) {
        const message =
          "message" in data ? data.message : "Script deleted successfully";
        setLoadMessage(`[SUCCESS] ${message}`);
        // Refetch script files status and comparison data to update the UI
        void refetchScriptFiles();
        void refetchComparison();
      } else {
        const error = "error" in data ? data.error : "Failed to delete script";
        setLoadMessage(`[ERROR] ${error}`);
      }
      // Clear message after 5 seconds
      setTimeout(() => setLoadMessage(null), 5000);
    },
    onError: (error) => {
      setIsDeleting(false);
      setLoadMessage(`[ERROR] ${error.message}`);
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
    
    // Check if script has multiple variants (default and alpine)
    const installMethods = script.install_methods || [];
    const hasMultipleVariants = installMethods.filter(method => 
      method.type === 'default' || method.type === 'alpine'
    ).length > 1;
    
    if (hasMultipleVariants) {
      // Show version selection modal first
      setVersionModalOpen(true);
    } else {
      // Only one variant, proceed directly to execution mode
      // Use the first available method or default to 'default' type
      const defaultMethod = installMethods.find(method => method.type === 'default');
      const firstMethod = installMethods[0];
      setSelectedVersionType(defaultMethod?.type || firstMethod?.type || 'default');
      setExecutionModeOpen(true);
    }
  };

  const handleVersionSelect = (versionType: string) => {
    setSelectedVersionType(versionType);
    setVersionModalOpen(false);
    setExecutionModeOpen(true);
  };

  const handleExecuteScript = (mode: "local" | "ssh", server?: any) => {
    if (!script || !onInstallScript) return;

    // Find the script path based on selected version type
    const versionType = selectedVersionType || 'default';
    const scriptMethod = script.install_methods?.find(
      (method) => method.type === versionType && method.script,
    ) || script.install_methods?.find(
      (method) => method.script,
    );
    
    if (scriptMethod?.script) {
      const scriptPath = `scripts/${scriptMethod.script}`;
      const scriptName = script.name;

      // Pass execution mode and server info to the parent
      onInstallScript(scriptPath, scriptName, mode, server);

      onClose(); // Close the modal when starting installation
    }
  };

  const handleViewScript = () => {
    setTextViewerOpen(true);
  };

  const handleDeleteScript = () => {
    if (!script) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!script) return;
    setDeleteConfirmOpen(false);
    setIsDeleting(true);
    setLoadMessage(null);
    deleteScriptMutation.mutate({ slug: script.slug });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] min-h-[80vh] overflow-y-auto border border-border mx-2 sm:mx-4 lg:mx-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={64}
                height={64}
                className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg object-contain flex-shrink-0"
                onError={handleImageError}
              />
            ) : (
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                <span className="text-lg sm:text-2xl font-semibold text-muted-foreground">
                  {script.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {script.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                <TypeBadge type={script.type} />
                {script.updateable && <UpdateableBadge />}
                {script.privileged && <PrivilegedBadge />}
              </div>
            </div>
            
            {/* Interface Port*/}
            {script.interface_port && (
              <div className="ml-3 sm:ml-4 flex-shrink-0">
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground mr-2">
                    Port:
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-foreground font-mono">
                    {script.interface_port}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-4"
          >
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 p-4 sm:p-6 border-b border-border">
            {/* Install Button - only show if script files exist */}
            {scriptFilesData?.success &&
              scriptFilesData.ctExists &&
              onInstallScript && (
                <Button
                  onClick={handleInstallScript}
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span>Install</span>
                </Button>
              )}

            {/* View Button - only show if script files exist */}
            {scriptFilesData?.success &&
              (scriptFilesData.ctExists || scriptFilesData.installExists) && (
                <Button
                  onClick={handleViewScript}
                  variant="outline"
                  size="default"
                  className="w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>View</span>
                </Button>
              )}

            {/* Load/Update Script Button */}
            {(() => {
              const hasLocalFiles =
                scriptFilesData?.success &&
                (scriptFilesData.ctExists || scriptFilesData.installExists);
              const hasDifferences =
                comparisonData?.success && comparisonData.hasDifferences;
              const isUpToDate = hasLocalFiles && !hasDifferences;

              if (!hasLocalFiles) {
                // No local files - show Load Script button
                return (
                  <button
                    onClick={handleLoadScript}
                    disabled={isLoading}
                    className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                      isLoading
                        ? "cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-success text-success-foreground hover:bg-success/90"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
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
                    className="flex cursor-not-allowed items-center space-x-2 rounded-lg bg-muted px-4 py-2 font-medium text-muted-foreground transition-colors"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
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
                    className={`flex items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors ${
                      isLoading
                        ? "cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-warning text-warning-foreground hover:bg-warning/90"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        <span>Update Script</span>
                      </>
                    )}
                  </button>
                );
              }
            })()}

            {/* Delete Button - only show if script files exist */}
            {scriptFilesData?.success &&
              (scriptFilesData.ctExists || scriptFilesData.installExists) && (
                <Button
                  onClick={handleDeleteScript}
                  disabled={isDeleting}
                  variant="destructive"
                  size="default"
                  className="w-full sm:w-auto flex items-center justify-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>Delete Script</span>
                    </>
                  )}
                </Button>
              )}
        </div>

        {/* Content */}
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
          {/* Script Files Status */}
          {(scriptFilesLoading || comparisonLoading) && (
            <div className="mb-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                <span>Loading script status...</span>
              </div>
            </div>
          )}

          {scriptFilesData?.success &&
            !scriptFilesLoading &&
            (() => {
              // Determine script type from the first install method
              const firstScript = script?.install_methods?.[0]?.script;
              let scriptType = "Script";
              if (firstScript?.startsWith("ct/")) {
                scriptType = "CT Script";
              } else if (firstScript?.startsWith("tools/")) {
                scriptType = "Tools Script";
              } else if (firstScript?.startsWith("vm/")) {
                scriptType = "VM Script";
              } else if (firstScript?.startsWith("vw/")) {
                scriptType = "VW Script";
              }

              return (
                <div className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`h-2 w-2 rounded-full ${scriptFilesData.ctExists ? "bg-success" : "bg-muted"}`}
                      ></div>
                      <span>
                        {scriptType}:{" "}
                        {scriptFilesData.ctExists ? "Available" : "Not loaded"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`h-2 w-2 rounded-full ${scriptFilesData.installExists ? "bg-success" : "bg-muted"}`}
                      ></div>
                      <span>
                        Install Script:{" "}
                        {scriptFilesData.installExists
                          ? "Available"
                          : "Not loaded"}
                      </span>
                    </div>
                    {scriptFilesData?.success &&
                      (scriptFilesData.ctExists ||
                        scriptFilesData.installExists) &&
                      comparisonData?.success &&
                      !comparisonLoading && (
                        <div className="flex items-center space-x-2">
                          <div
                            className={`h-2 w-2 rounded-full ${comparisonData.hasDifferences ? "bg-warning" : "bg-success"}`}
                          ></div>
                          <span>
                            Status:{" "}
                            {comparisonData.hasDifferences
                              ? "Update available"
                              : "Up to date"}
                          </span>
                        </div>
                      )}
                  </div>
                  {scriptFilesData.files.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground break-words">
                      Files: {scriptFilesData.files.join(", ")}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Load Message */}
          {loadMessage && (
            <div className="mb-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
              {loadMessage}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="mb-2 text-base sm:text-lg font-semibold text-foreground">
              Description
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              {script.description}
            </p>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-base sm:text-lg font-semibold text-foreground">
                Basic Information
              </h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Slug
                  </dt>
                  <dd className="font-mono text-sm text-foreground">
                    {script.slug}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Date Created
                  </dt>
                  <dd className="text-sm text-foreground">
                    {script.date_created}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Categories
                  </dt>
                  <dd className="text-sm text-foreground">
                    {script.categories.join(", ")}
                  </dd>
                </div>
                {script.interface_port && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Interface Port
                    </dt>
                    <dd className="text-sm text-foreground">
                      {script.interface_port}
                    </dd>
                  </div>
                )}
                {script.config_path && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Config Path
                    </dt>
                    <dd className="font-mono text-sm text-foreground">
                      {script.config_path}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-base sm:text-lg font-semibold text-foreground">
                Links
              </h3>
              <dl className="space-y-2">
                {script.website && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Website
                    </dt>
                    <dd className="text-sm">
                      <a
                        href={script.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:text-primary/80"
                      >
                        {script.website}
                      </a>
                    </dd>
                  </div>
                )}
                {script.documentation && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Documentation
                    </dt>
                    <dd className="text-sm">
                      <a
                        href={script.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:text-primary/80"
                      >
                        {script.documentation}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Install Methods - Hide for PVE and ADDON types as they typically don't have install methods */}
          {script.install_methods.length > 0 &&
            script.type !== "pve" &&
            script.type !== "addon" && (
              <div>
                <h3 className="mb-3 text-base sm:text-lg font-semibold text-foreground">
                  Install Methods
                </h3>
                <div className="space-y-4">
                  {script.install_methods.map((method, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border bg-card p-3 sm:p-4"
                    >
                      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0">
                        <h4 className="text-sm sm:text-base font-medium text-foreground capitalize">
                          {method.type}
                        </h4>
                        <span className="font-mono text-xs sm:text-sm text-muted-foreground break-all">
                          {method.script}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm lg:grid-cols-4">
                        <div>
                          <dt className="font-medium text-muted-foreground">
                            CPU
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.cpu} cores
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">
                            RAM
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.ram} MB
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">
                            HDD
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.hdd} GB
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">
                            OS
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.os} {method.resources.version}
                          </dd>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Default Credentials */}
          {(script.default_credentials.username ??
            script.default_credentials.password) && (
            <div>
              <h3 className="mb-3 text-base sm:text-lg font-semibold text-foreground">
                Default Credentials
              </h3>
              <dl className="space-y-2">
                {script.default_credentials.username && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Username
                    </dt>
                    <dd className="font-mono text-sm text-foreground">
                      {script.default_credentials.username}
                    </dd>
                  </div>
                )}
                {script.default_credentials.password && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Password
                    </dt>
                    <dd className="font-mono text-sm text-foreground">
                      {script.default_credentials.password}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Notes */}
          {script.notes.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Notes
              </h3>
              <ul className="space-y-2">
                {script.notes.map((note, index) => {
                  // Handle both object and string note formats
                  const noteText = typeof note === "string" ? note : note.text;
                  const noteType =
                    typeof note === "string" ? "info" : note.type;

                  return (
                    <li
                      key={index}
                      className={`rounded-lg p-3 text-sm ${
                        noteType === "warning"
                          ? "border-l-4 border-warning bg-warning/10 text-warning"
                          : noteType === "error"
                            ? "border-l-4 border-destructive bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-start">
                        <NoteBadge noteType={noteType as 'info' | 'warning' | 'error'} className="mr-2 flex-shrink-0">
                          {noteType}
                        </NoteBadge>
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
          scriptName={
            script.install_methods
              ?.find((method) => method.script?.startsWith("ct/"))
              ?.script?.split("/")
              .pop() ?? `${script.slug}.sh`
          }
          isOpen={textViewerOpen}
          onClose={() => setTextViewerOpen(false)}
        />
      )}

      {/* Version Selection Modal */}
      {script && (
        <ScriptVersionModal
          script={script}
          isOpen={versionModalOpen}
          onClose={() => setVersionModalOpen(false)}
          onSelectVersion={handleVersionSelect}
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

      {/* Delete Confirmation Modal */}
      {script && (
        <ConfirmationModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Script"
          message={`Are you sure you want to delete all downloaded files for "${script.name}"? This action cannot be undone.`}
          variant="simple"
          confirmButtonText="Delete"
          cancelButtonText="Cancel"
        />
      )}
    </div>
  );
}
