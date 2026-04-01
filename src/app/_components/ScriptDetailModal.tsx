"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useTransition,
} from "react";
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
  DevBadge,
} from "./Badge";
import { Button } from "./ui/button";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";
import { ScriptNotesPanel } from "./ScriptNotesPanel";
import {
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Trash2,
  Play,
  Eye,
  ExternalLink,
  Server as ServerIcon,
  Loader2,
} from "lucide-react";

function deriveScriptPath(
  scriptType: string,
  methodType: string,
  slug: string,
): string {
  const type = (scriptType || "ct").toLowerCase().trim();
  const method = (methodType || "default").toLowerCase().trim();
  if (method === "alpine" && (type === "ct" || type === "lxc"))
    return `ct/alpine-${slug}.sh`;
  switch (type) {
    case "ct":
    case "lxc":
      return `ct/${slug}.sh`;
    case "pve":
      return `tools/pve/${slug}.sh`;
    case "addon":
      return `tools/addon/${slug}.sh`;
    case "vm":
      return `vm/${slug}.sh`;
    case "turnkey":
      return `turnkey/${slug}.sh`;
    default:
      return `ct/${slug}.sh`;
  }
}

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
  orderedSlugs?: string[];
  onSelectSlug?: (slug: string) => void;
}

export function ScriptDetailModal({
  script,
  isOpen,
  onClose,
  onInstallScript,
  orderedSlugs,
  onSelectSlug,
}: ScriptDetailModalProps) {
  const zIndex = useRegisterModal(isOpen, {
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
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [, startNavTransition] = useTransition();

  useEffect(() => {
    setImageError(false);
    setLoadMessage(null);
    setCopiedCommand(false);
  }, [script?.slug]);

  const activeIndex = useMemo(() => {
    if (!script || !orderedSlugs) return -1;
    return orderedSlugs.indexOf(script.slug);
  }, [script, orderedSlugs]);

  const previousSlug =
    orderedSlugs && activeIndex > 0 ? orderedSlugs[activeIndex - 1] : null;
  const nextSlug =
    orderedSlugs && activeIndex >= 0 && activeIndex < orderedSlugs.length - 1
      ? orderedSlugs[activeIndex + 1]
      : null;

  useEffect(() => {
    if (!isOpen || !onSelectSlug) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (e.key === "ArrowLeft" && previousSlug) {
        e.preventDefault();
        startNavTransition(() => onSelectSlug(previousSlug));
      }
      if (e.key === "ArrowRight" && nextSlug) {
        e.preventDefault();
        startNavTransition(() => onSelectSlug(nextSlug));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onSelectSlug, previousSlug, nextSlug]);

  const installCommand = useMemo(() => {
    if (!script) return null;
    const method = script.install_methods?.[0];
    const scriptFile =
      method?.script ??
      deriveScriptPath(script.type, method?.type ?? "default", script.slug);
    const url = `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/${scriptFile}`;
    return `bash -c "$(curl -fsSL ${url})"`;
  }, [script]);

  const handleCopyCommand = useCallback(async () => {
    if (!installCommand) return;
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } catch {
      /* silent */
    }
  }, [installCommand]);

  const {
    data: scriptFilesData,
    refetch: refetchScriptFiles,
    isLoading: scriptFilesLoading,
  } = api.scripts.checkScriptFiles.useQuery(
    { slug: script?.slug ?? "" },
    { enabled: !!script && isOpen },
  );

  const {
    data: comparisonData,
    refetch: refetchComparison,
    isLoading: comparisonLoading,
  } = api.scripts.compareScriptContent.useQuery(
    { slug: script?.slug ?? "" },
    { enabled: !!script && isOpen, refetchOnMount: true, staleTime: 0 },
  );

  const loadScriptMutation = api.scripts.loadScript.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      if (data.success) {
        setLoadMessage(
          `[SUCCESS] ${"message" in data ? data.message : "Script loaded successfully"}`,
        );
        void refetchScriptFiles();
        void refetchComparison();
      } else {
        setLoadMessage(
          `[ERROR] ${"error" in data ? data.error : "Failed to load script"}`,
        );
      }
      setTimeout(() => setLoadMessage(null), 5000);
    },
    onError: (error) => {
      setIsLoading(false);
      setLoadMessage(`[ERROR] ${error.message}`);
      setTimeout(() => setLoadMessage(null), 5000);
    },
  });

  const deleteScriptMutation = api.scripts.deleteScript.useMutation({
    onSuccess: (data) => {
      setIsDeleting(false);
      if (data.success) {
        setLoadMessage(
          `[SUCCESS] ${"message" in data ? data.message : "Script deleted successfully"}`,
        );
        void refetchScriptFiles();
        void refetchComparison();
      } else {
        setLoadMessage(
          `[ERROR] ${"error" in data ? data.error : "Failed to delete script"}`,
        );
      }
      setTimeout(() => setLoadMessage(null), 5000);
    },
    onError: (error) => {
      setIsDeleting(false);
      setLoadMessage(`[ERROR] ${error.message}`);
      setTimeout(() => setLoadMessage(null), 5000);
    },
  });

  if (!isOpen || !script) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleLoadScript = () => {
    if (!script) return;
    setIsLoading(true);
    setLoadMessage(null);
    loadScriptMutation.mutate({ slug: script.slug });
  };

  const handleInstallScript = () => {
    if (!script) return;
    const installMethods = script.install_methods || [];
    const hasMultipleVariants =
      installMethods.filter((m) => m.type === "default" || m.type === "alpine")
        .length > 1;
    if (hasMultipleVariants) {
      setVersionModalOpen(true);
    } else {
      const defaultMethod = installMethods.find((m) => m.type === "default");
      setSelectedVersionType(
        defaultMethod?.type ?? installMethods[0]?.type ?? "default",
      );
      setExecutionModeOpen(true);
    }
  };

  const handleVersionSelect = (versionType: string) => {
    setSelectedVersionType(versionType);
    setVersionModalOpen(false);
    setExecutionModeOpen(true);
  };

  const handleExecuteScript = (
    mode: "local" | "ssh",
    server?: Server,
    envVars?: Record<string, string | number | boolean>,
  ) => {
    if (!script || !onInstallScript) return;
    const versionType = selectedVersionType ?? "default";
    const scriptMethod =
      script.install_methods?.find((m) => m.type === versionType) ??
      script.install_methods?.[0];
    if (scriptMethod) {
      const scriptFile =
        scriptMethod.script ??
        deriveScriptPath(script.type, scriptMethod.type, script.slug);
      onInstallScript(
        `scripts/${scriptFile}`,
        script.name,
        mode,
        server,
        envVars,
      );
      onClose();
    }
  };

  const handleConfirmDelete = () => {
    if (!script) return;
    setDeleteConfirmOpen(false);
    setIsDeleting(true);
    setLoadMessage(null);
    deleteScriptMutation.mutate({ slug: script.slug });
  };

  const hasLocalFiles =
    scriptFilesData?.success &&
    (scriptFilesData.ctExists || scriptFilesData.installExists);
  const hasDifferences =
    comparisonData?.success && comparisonData.hasDifferences;
  const isUpToDate = hasLocalFiles && !hasDifferences;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={handleBackdropClick}
      >
        <div className="bg-card mx-2 flex h-[100dvh] w-screen flex-col overflow-hidden sm:mx-4 sm:h-[88vh] sm:max-h-[88vh] sm:w-[min(92vw,1100px)] sm:max-w-[min(92vw,1100px)] sm:rounded-2xl sm:border sm:shadow-2xl lg:w-[min(90vw,1240px)] lg:max-w-[min(90vw,1240px)]">
          {/* Header */}
          <div className="border-border/60 flex-shrink-0 border-b px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {script.logo && !imageError ? (
                  <div className="border-border/60 bg-muted/30 relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
                    <Image
                      src={script.logo}
                      alt=""
                      width={56}
                      height={56}
                      className="object-contain p-1.5"
                      unoptimized
                      onError={() => setImageError(true)}
                    />
                  </div>
                ) : (
                  <div className="border-border/60 bg-muted/30 text-muted-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border">
                    <span className="text-xl font-semibold">
                      {script.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-foreground truncate text-[clamp(1.25rem,2vw,1.75rem)] leading-tight font-bold tracking-tight">
                    {script.name}
                  </h2>
                  {script.categories.length > 0 && (
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {script.categories.join(", ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={script.type} />
                    {script.is_dev && <DevBadge />}
                    {script.updateable && <UpdateableBadge />}
                    {script.privileged && <PrivilegedBadge />}
                    {script.has_arm && (
                      <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-600 dark:text-emerald-400">
                        ARM
                      </span>
                    )}
                    {script.version && (
                      <span className="bg-primary/10 text-primary border-primary/20 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">
                        v{script.version}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {orderedSlugs && orderedSlugs.length > 1 && (
                  <div className="border-border bg-muted/20 flex items-center rounded-full border p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() =>
                        previousSlug && onSelectSlug?.(previousSlug)
                      }
                      disabled={!previousSlug}
                      title="Previous (←)"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-muted-foreground hidden px-1.5 text-[0.6875rem] tabular-nums select-none sm:inline">
                      {activeIndex + 1}
                      <span className="text-border mx-0.5">/</span>
                      {orderedSlugs.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => nextSlug && onSelectSlug?.(nextSlug)}
                      disabled={!nextSlug}
                      title="Next (→)"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="bg-border mx-1 hidden h-5 w-px sm:block" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={onClose}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="border-border/60 flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyCommand()}
              className="gap-1.5 text-xs"
            >
              {copiedCommand ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedCommand ? "Copied!" : "Copy Command"}
            </Button>
            {!hasLocalFiles ? (
              <Button
                size="sm"
                onClick={handleLoadScript}
                disabled={isLoading}
                className="bg-success text-success-foreground hover:bg-success/90 gap-1.5 text-xs"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {isLoading ? "Loading..." : "Load Script"}
              </Button>
            ) : isUpToDate ? (
              <Button
                size="sm"
                disabled
                variant="outline"
                className="gap-1.5 text-xs"
              >
                <Check className="h-3.5 w-3.5" /> Up to Date
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleLoadScript}
                disabled={isLoading}
                className="bg-warning text-warning-foreground hover:bg-warning/90 gap-1.5 text-xs"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {isLoading ? "Updating..." : "Update Script"}
              </Button>
            )}
            {hasLocalFiles && onInstallScript && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleInstallScript}
                className="gap-1.5 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> Install
              </Button>
            )}
            {hasLocalFiles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTextViewerOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
            )}
            {hasLocalFiles && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isDeleting}
                className="ml-auto gap-1.5 text-xs"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            )}
          </div>

          {/* Status Messages */}
          {(scriptFilesLoading || comparisonLoading || loadMessage) && (
            <div className="flex-shrink-0 px-4 pt-3 sm:px-6">
              {(scriptFilesLoading || comparisonLoading) && (
                <div className="bg-primary/5 text-primary mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                  script status...
                </div>
              )}
              {loadMessage && (
                <div
                  className={`mb-2 rounded-lg px-3 py-2 text-xs ${loadMessage.startsWith("[SUCCESS]") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                >
                  {loadMessage.replace(/^\[(SUCCESS|ERROR)\]\s*/, "")}
                </div>
              )}
            </div>
          )}

          {/* 2-column content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.55fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1.7fr)_24rem]">
              {/* Left: Main Content */}
              <div className="min-w-0 space-y-4">
                <section className="glass-card-static rounded-2xl border p-5">
                  <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-[0.1em] uppercase">
                    About
                  </h2>
                  <p className="text-foreground text-sm leading-relaxed sm:text-base">
                    {script.description}
                  </p>
                </section>

                {script.notes.length > 0 && (
                  <section className="glass-card-static rounded-2xl border p-5">
                    <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-[0.1em] uppercase">
                      Notes
                    </h2>
                    <ul className="space-y-2">
                      {script.notes.map((note, index) => {
                        const noteText =
                          typeof note === "string" ? note : note.text;
                        const noteType =
                          typeof note === "string" ? "info" : note.type;
                        return (
                          <li
                            key={index}
                            className={`rounded-lg p-3 text-sm ${noteType === "warning" ? "border-warning bg-warning/10 text-warning border-l-4" : noteType === "error" ? "border-destructive bg-destructive/10 text-destructive border-l-4" : "bg-muted text-muted-foreground"}`}
                          >
                            <div className="flex items-start">
                              <NoteBadge
                                noteType={
                                  noteType as "info" | "warning" | "error"
                                }
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
                  </section>
                )}

                {installCommand && (
                  <section className="glass-card-static rounded-2xl border p-5">
                    <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-[0.1em] uppercase">
                      Install
                    </h2>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Run the command below in the Proxmox VE Shell to install{" "}
                      {script.name}.
                    </p>
                    <div className="group relative overflow-hidden rounded-lg bg-[#0c0e14]">
                      <code className="block overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed text-[#f0eeeb] sm:text-sm">
                        {installCommand}
                      </code>
                      <button
                        onClick={() => void handleCopyCommand()}
                        className="absolute top-2 right-2 rounded-md border border-white/10 bg-white/5 p-1.5 text-white/60 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white"
                        title="Copy"
                      >
                        {copiedCommand ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </section>
                )}

                {scriptFilesData?.success && !scriptFilesLoading && (
                  <section className="glass-card-static rounded-2xl border p-5">
                    <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-[0.1em] uppercase">
                      Local Status
                    </h2>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`h-2 w-2 rounded-full ${scriptFilesData.ctExists ? "bg-success" : "bg-muted-foreground/30"}`}
                        />
                        <span className="text-muted-foreground">
                          Script:{" "}
                          <span className="text-foreground font-medium">
                            {scriptFilesData.ctExists
                              ? "Available"
                              : "Not loaded"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div
                          className={`h-2 w-2 rounded-full ${scriptFilesData.installExists ? "bg-success" : "bg-muted-foreground/30"}`}
                        />
                        <span className="text-muted-foreground">
                          Install Script:{" "}
                          <span className="text-foreground font-medium">
                            {scriptFilesData.installExists
                              ? "Available"
                              : "Not loaded"}
                          </span>
                        </span>
                      </div>
                      {hasLocalFiles && (
                        <div className="flex items-center gap-2 text-sm">
                          <div
                            className={`h-2 w-2 rounded-full ${comparisonLoading ? "bg-muted-foreground/30 animate-pulse" : hasDifferences ? "bg-warning" : "bg-success"}`}
                          />
                          <span className="text-muted-foreground">
                            Status:{" "}
                            <span className="text-foreground font-medium">
                              {comparisonLoading
                                ? "Checking..."
                                : hasDifferences
                                  ? "Update available"
                                  : "Up to date"}
                            </span>
                          </span>
                          <button
                            onClick={() => void refetchComparison()}
                            disabled={comparisonLoading}
                            className="hover:bg-accent ml-1 rounded-md p-1 transition-colors disabled:opacity-50"
                            title="Refresh"
                          >
                            <RefreshCw
                              className={`text-muted-foreground h-3 w-3 ${comparisonLoading ? "animate-spin" : ""}`}
                            />
                          </button>
                        </div>
                      )}
                      {scriptFilesData.files.length > 0 && (
                        <div className="text-muted-foreground mt-1 text-xs break-words">
                          Files: {scriptFilesData.files.join(", ")}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <ScriptNotesPanel slug={script.slug} />
              </div>

              {/* Right: Sidebar */}
              <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:self-start">
                <div className="space-y-4">
                  {(script.interface_port ||
                    script.default_credentials.username ||
                    script.default_credentials.password) && (
                    <div className="border-primary/20 bg-primary/5 dark:bg-primary/[0.07] rounded-2xl border p-4">
                      <h3 className="text-primary mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-[0.1em] uppercase">
                        <ServerIcon className="h-3.5 w-3.5" /> Access
                      </h3>
                      <dl className="space-y-2 text-sm">
                        {script.interface_port && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted-foreground">Port</dt>
                            <dd>
                              <code className="bg-background/60 rounded px-2 py-0.5 text-sm font-semibold">
                                :{script.interface_port}
                              </code>
                            </dd>
                          </div>
                        )}
                        {script.default_credentials.username && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted-foreground">User</dt>
                            <dd>
                              <code className="bg-background/60 rounded px-2 py-0.5 font-mono text-sm">
                                {script.default_credentials.username}
                              </code>
                            </dd>
                          </div>
                        )}
                        {script.default_credentials.password && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted-foreground">Password</dt>
                            <dd>
                              <code className="bg-background/60 rounded px-2 py-0.5 font-mono text-sm">
                                {script.default_credentials.password}
                              </code>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  <div className="glass-card-static rounded-2xl border p-5">
                    <h2 className="text-muted-foreground mb-4 text-sm font-semibold tracking-[0.1em] uppercase">
                      Details
                    </h2>
                    <dl className="space-y-3 text-sm">
                      {script.version && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Version</dt>
                          <dd className="text-right font-medium">
                            {script.version}
                          </dd>
                        </div>
                      )}
                      {script.categories.length > 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Category</dt>
                          <dd className="text-primary text-right font-medium">
                            {script.categories.join(", ")}
                          </dd>
                        </div>
                      )}
                      {script.website && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Website</dt>
                          <dd>
                            <a
                              href={script.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              Link <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                      {script.documentation && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Docs</dt>
                          <dd>
                            <a
                              href={script.documentation}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              Link <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                      {script.config_path && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Config</dt>
                          <dd className="text-right font-mono text-xs">
                            {script.config_path}
                          </dd>
                        </div>
                      )}
                      {script.repository_url && (
                        <div className="flex items-start justify-between gap-3">
                          <dt className="text-muted-foreground">Source</dt>
                          <dd>
                            <a
                              href={script.repository_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="text-right font-medium">
                          {new Date(script.date_created).toLocaleDateString(
                            undefined,
                            { dateStyle: "medium" },
                          )}
                        </dd>
                      </div>
                    </dl>

                    {script.install_methods.length > 0 &&
                      script.type !== "pve" &&
                      script.type !== "addon" && (
                        <div className="border-border/60 mt-5 border-t pt-5">
                          <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-[0.1em] uppercase">
                            Install profiles
                          </h3>
                          <div className="space-y-3">
                            {script.install_methods.map((method, index) => (
                              <div
                                key={index}
                                className="border-border bg-muted/30 rounded-xl border p-3 dark:bg-white/[0.04]"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-foreground text-sm font-semibold capitalize">
                                    {method.type}
                                  </span>
                                  {(method.resources.os ||
                                    method.resources.version) && (
                                    <span className="bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-medium dark:bg-white/[0.06]">
                                      {[
                                        method.resources.os,
                                        method.resources.version,
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {method.resources.cpu > 0 && (
                                    <div className="bg-muted/50 flex-1 rounded-lg px-2.5 py-1.5 text-center dark:bg-white/[0.07]">
                                      <div className="text-foreground text-xs font-bold tabular-nums">
                                        {method.resources.cpu}
                                      </div>
                                      <div className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                                        CPU
                                      </div>
                                    </div>
                                  )}
                                  {method.resources.ram > 0 && (
                                    <div className="bg-muted/50 flex-1 rounded-lg px-2.5 py-1.5 text-center dark:bg-white/[0.07]">
                                      <div className="text-foreground text-xs font-bold tabular-nums">
                                        {method.resources.ram}
                                      </div>
                                      <div className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                                        RAM
                                      </div>
                                    </div>
                                  )}
                                  {method.resources.hdd > 0 && (
                                    <div className="bg-muted/50 flex-1 rounded-lg px-2.5 py-1.5 text-center dark:bg-white/[0.07]">
                                      <div className="text-foreground text-xs font-bold tabular-nums">
                                        {method.resources.hdd}
                                      </div>
                                      <div className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                                        HDD
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {method.config_path && (
                                  <div className="bg-muted/20 mt-2 rounded-md px-2 py-1.5 dark:bg-white/[0.03]">
                                    <span className="text-muted-foreground text-[0.625rem] tracking-wider uppercase">
                                      Config:{" "}
                                    </span>
                                    <code className="text-[0.6875rem]">
                                      {method.config_path}
                                    </code>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

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
        {script && (
          <TextViewer
            scriptName={
              script.install_methods
                ?.find(
                  (m) =>
                    m.script &&
                    (m.script.startsWith("ct/") ||
                      m.script.startsWith("vm/") ||
                      m.script.startsWith("tools/")),
                )
                ?.script?.split("/")
                .pop() ?? `${script.slug}.sh`
            }
            script={script}
            isOpen={textViewerOpen}
            onClose={() => setTextViewerOpen(false)}
          />
        )}
        {script && (
          <ScriptVersionModal
            script={script}
            isOpen={versionModalOpen}
            onClose={() => setVersionModalOpen(false)}
            onSelectVersion={handleVersionSelect}
          />
        )}
        {script && (
          <ExecutionModeModal
            scriptName={script.name}
            script={script}
            isOpen={executionModeOpen}
            onClose={() => setExecutionModeOpen(false)}
            onExecute={handleExecuteScript}
          />
        )}
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
    </ModalPortal>
  );
}
