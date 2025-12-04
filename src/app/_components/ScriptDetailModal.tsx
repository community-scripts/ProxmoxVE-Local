"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";
import type { Script } from "~/types/script";
import type { Server } from "~/types/server";
import { DiffViewer } from "./DiffViewer";
import { TextViewer } from "./TextViewer";
import { ExecutionModeModal } from "./ExecutionModeModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { ScriptVersionModal } from "./ScriptVersionModal";
import {
  TypeBadge,
  UpdateableBadge,
  PrivilegedBadge,
  NoteBadge,
} from "./Badge";
import { Button } from "./ui/button";
import { useRegisterModal } from "./modal/ModalStackProvider";

interface ScriptDetailModalProps {
  script: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onInstallScript?: (
    scriptPath: string,
    scriptName: string,
    mode?: "local" | "ssh",
    server?: Server,
    envVars?: Record<string, string | number | boolean>,
  ) => void;
}

export function ScriptDetailModal({
  script,
  isOpen,
  onClose,
  onInstallScript,
}: ScriptDetailModalProps) {
  useRegisterModal(isOpen, {
    id: "script-detail-modal",
    allowEscape: true,
    onClose,
  });
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [textViewerOpen, setTextViewerOpen] = useState(false);
  const [executionModeOpen, setExecutionModeOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedVersionType, setSelectedVersionType] = useState<string | null>(
    null,
  );
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
    {
      enabled: !!script && isOpen,
      refetchOnMount: true,
      staleTime: 0,
    },
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
    const hasMultipleVariants =
      installMethods.filter(
        (method) => method.type === "default" || method.type === "alpine",
      ).length > 1;

    if (hasMultipleVariants) {
      // Show version selection modal first
      setVersionModalOpen(true);
    } else {
      // Only one variant, proceed directly to execution mode
      // Use the first available method or default to 'default' type
      const defaultMethod = installMethods.find(
        (method) => method.type === "default",
      );
      const firstMethod = installMethods[0];
      setSelectedVersionType(
        defaultMethod?.type ?? firstMethod?.type ?? "default",
      );
      setExecutionModeOpen(true);
    }
  };

  const handleVersionSelect = (versionType: string) => {
    setSelectedVersionType(versionType);
    setVersionModalOpen(false);
    setExecutionModeOpen(true);
  };

  const handleExecuteScript = (mode: "local" | "ssh", server?: Server, envVars?: Record<string, string | number | boolean>) => {
    if (!script || !onInstallScript) return;

    // Find the script path based on selected version type
    const versionType = selectedVersionType ?? "default";
    const scriptMethod =
      script.install_methods?.find(
        (method) => method.type === versionType && method.script,
      ) ?? script.install_methods?.find((method) => method.script);

    if (scriptMethod?.script) {
      const scriptPath = `scripts/${scriptMethod.script}`;
      const scriptName = script.name;

      // Pass execution mode, server info, and envVars to the parent
      onInstallScript(scriptPath, scriptName, mode, server, envVars);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border-border mx-2 max-h-[95vh] min-h-[80vh] w-full max-w-6xl overflow-y-auto rounded-lg border shadow-xl sm:mx-4 lg:mx-0">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4 sm:p-6">
          <div className="flex min-w-0 flex-1 items-center space-x-3 sm:space-x-4">
            {script.logo && !imageError ? (
              <Image
                src={script.logo}
                alt={`${script.name} logo`}
                width={64}
                height={64}
                className="h-12 w-12 flex-shrink-0 rounded-lg object-contain sm:h-16 sm:w-16"
                onError={handleImageError}
              />
            ) : (
              <div className="bg-muted flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg sm:h-16 sm:w-16">
                <span className="text-muted-foreground text-lg font-semibold sm:text-2xl">
                  {script.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-foreground truncate text-xl font-bold sm:text-2xl">
                {script.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                <TypeBadge type={script.type} />
                {script.updateable && <UpdateableBadge />}
                {script.privileged && <PrivilegedBadge />}
                {script.repository_url && (
                  <a
                    href={script.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-muted text-muted-foreground border-border hover:bg-accent hover:text-foreground rounded border px-2 py-0.5 text-xs transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={`Source: ${script.repository_url}`}
                  >
                    {/github\.com\/([^\/]+)\/([^\/]+)/
                      .exec(script.repository_url)?.[0]
                      ?.replace("https://", "") ?? script.repository_url}
                  </a>
                )}
              </div>
            </div>

            {/* Interface Port*/}
            {script.interface_port && (
              <div className="ml-3 flex-shrink-0 sm:ml-4">
                <div className="bg-primary/10 border-primary/30 rounded-lg border px-3 py-1.5 sm:px-4 sm:py-2">
                  <span className="text-muted-foreground mr-2 text-xs font-medium sm:text-sm">
                    Port:
                  </span>
                  <span className="text-foreground font-mono text-sm font-semibold sm:text-base">
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
            className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0"
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
        <div className="border-border flex flex-col items-stretch space-y-2 border-b p-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 sm:p-6">
          {/* Install Button - only show if script files exist */}
          {scriptFilesData?.success &&
            scriptFilesData.ctExists &&
            onInstallScript && (
              <Button
                onClick={handleInstallScript}
                variant="outline"
                size="default"
                className="flex w-full items-center justify-center space-x-2 sm:w-auto"
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
                className="flex w-full items-center justify-center space-x-2 sm:w-auto"
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
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
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
                  className="bg-muted text-muted-foreground flex cursor-not-allowed items-center space-x-2 rounded-lg px-4 py-2 font-medium transition-colors"
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
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
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
                className="flex w-full items-center justify-center space-x-2 sm:w-auto"
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
        <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
          {/* Script Files Status */}
          {(scriptFilesLoading || comparisonLoading) && (
            <div className="bg-primary/10 text-primary mb-4 rounded-lg p-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
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
                <div className="bg-muted text-muted-foreground mb-4 rounded-lg p-3 text-sm">
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
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
                        scriptFilesData.installExists) && (
                        <div className="flex items-center space-x-2">
                          {comparisonData?.success ? (
                            <>
                              <div
                                className={`h-2 w-2 rounded-full ${comparisonData.hasDifferences ? "bg-warning" : "bg-success"}`}
                              ></div>
                              <span>
                                Status:{" "}
                                {comparisonData.hasDifferences
                                  ? "Update available"
                                  : "Up to date"}
                              </span>
                            </>
                          ) : comparisonLoading ? (
                            <>
                              <div className="bg-muted h-2 w-2 animate-pulse rounded-full"></div>
                              <span>Checking for updates...</span>
                            </>
                          ) : comparisonData?.error ? (
                            <>
                              <div className="bg-destructive h-2 w-2 rounded-full"></div>
                              <span className="text-destructive">
                                Error: {comparisonData.error}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="bg-muted h-2 w-2 rounded-full"></div>
                              <span>Status: Unknown</span>
                            </>
                          )}
                          <button
                            onClick={() => void refetchComparison()}
                            disabled={comparisonLoading}
                            className="hover:bg-accent ml-2 flex items-center justify-center rounded-md p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            title="Refresh comparison"
                          >
                            {comparisonLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                            ) : (
                              <svg
                                className="text-muted-foreground hover:text-foreground h-4 w-4"
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
                            )}
                          </button>
                        </div>
                      )}
                  </div>
                  {scriptFilesData.files.length > 0 && (
                    <div className="text-muted-foreground mt-2 text-xs break-words">
                      Files: {scriptFilesData.files.join(", ")}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Load Message */}
          {loadMessage && (
            <div className="bg-primary/10 text-primary mb-4 rounded-lg p-3 text-sm">
              {loadMessage}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-foreground mb-2 text-base font-semibold sm:text-lg">
              Description
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              {script.description}
            </p>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-foreground mb-3 text-base font-semibold sm:text-lg">
                Basic Information
              </h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Slug
                  </dt>
                  <dd className="text-foreground font-mono text-sm">
                    {script.slug}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Date Created
                  </dt>
                  <dd className="text-foreground text-sm">
                    {script.date_created}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm font-medium">
                    Categories
                  </dt>
                  <dd className="text-foreground text-sm">
                    {script.categories.join(", ")}
                  </dd>
                </div>
                {script.interface_port && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Interface Port
                    </dt>
                    <dd className="text-foreground text-sm">
                      {script.interface_port}
                    </dd>
                  </div>
                )}
                {script.config_path && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Config Path
                    </dt>
                    <dd className="text-foreground font-mono text-sm">
                      {script.config_path}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="text-foreground mb-3 text-base font-semibold sm:text-lg">
                Links
              </h3>
              <dl className="space-y-2">
                {script.website && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Website
                    </dt>
                    <dd className="text-sm">
                      <a
                        href={script.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 break-all"
                      >
                        {script.website}
                      </a>
                    </dd>
                  </div>
                )}
                {script.documentation && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Documentation
                    </dt>
                    <dd className="text-sm">
                      <a
                        href={script.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 break-all"
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
                <h3 className="text-foreground mb-3 text-base font-semibold sm:text-lg">
                  Install Methods
                </h3>
                <div className="space-y-4">
                  {script.install_methods.map((method, index) => (
                    <div
                      key={index}
                      className="border-border bg-card rounded-lg border p-3 sm:p-4"
                    >
                      <div className="mb-3 flex flex-col justify-between space-y-1 sm:flex-row sm:items-center sm:space-y-0">
                        <h4 className="text-foreground text-sm font-medium capitalize sm:text-base">
                          {method.type}
                        </h4>
                        <span className="text-muted-foreground font-mono text-xs break-all sm:text-sm">
                          {method.script}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:gap-4 sm:text-sm lg:grid-cols-4">
                        <div>
                          <dt className="text-muted-foreground font-medium">
                            CPU
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.cpu} cores
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground font-medium">
                            RAM
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.ram} MB
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground font-medium">
                            HDD
                          </dt>
                          <dd className="text-foreground">
                            {method.resources.hdd} GB
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground font-medium">
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
              <h3 className="text-foreground mb-3 text-base font-semibold sm:text-lg">
                Default Credentials
              </h3>
              <dl className="space-y-2">
                {script.default_credentials.username && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Username
                    </dt>
                    <dd className="text-foreground font-mono text-sm">
                      {script.default_credentials.username}
                    </dd>
                  </div>
                )}
                {script.default_credentials.password && (
                  <div>
                    <dt className="text-muted-foreground text-sm font-medium">
                      Password
                    </dt>
                    <dd className="text-foreground font-mono text-sm">
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
              <h3 className="text-foreground mb-3 text-lg font-semibold">
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
                          ? "border-warning bg-warning/10 text-warning border-l-4"
                          : noteType === "error"
                            ? "border-destructive bg-destructive/10 text-destructive border-l-4"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-start">
                        <NoteBadge
                          noteType={noteType as "info" | "warning" | "error"}
                          className="mr-2 flex-shrink-0"
                        >
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
              ?.find(
                (method) =>
                  method.script &&
                  (method.script.startsWith("ct/") ||
                    method.script.startsWith("vm/") ||
                    method.script.startsWith("tools/")),
              )
              ?.script?.split("/")
              .pop() ?? `${script.slug}.sh`
          }
          script={script}
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
          script={script}
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
