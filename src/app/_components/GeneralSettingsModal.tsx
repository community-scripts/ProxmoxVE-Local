"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Toggle } from "./ui/toggle";
import { ContextualHelpIcon } from "./ContextualHelpIcon";
import { useTheme } from "./ThemeProvider";
import { useRegisterModal } from "./modal/ModalStackProvider";
import { useTranslation } from "~/lib/i18n/useTranslation";

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeneralSettingsModal({
  isOpen,
  onClose,
}: GeneralSettingsModalProps) {
  useRegisterModal(isOpen, {
    id: "general-settings-modal",
    allowEscape: true,
    onClose,
  });
  const { t } = useTranslation("settings");
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"general" | "github" | "auth">(
    "general",
  );
  const [githubToken, setGithubToken] = useState("");
  const [saveFilter, setSaveFilter] = useState(false);
  const [savedFilters, setSavedFilters] = useState<any>(null);
  const [colorCodingEnabled, setColorCodingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Auth state
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authHasCredentials, setAuthHasCredentials] = useState(false);
  const [authSetupCompleted, setAuthSetupCompleted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Load existing settings when modal opens
  useEffect(() => {
    if (isOpen) {
      void loadGithubToken();
      void loadSaveFilter();
      void loadSavedFilters();
      void loadAuthCredentials();
      void loadColorCodingSetting();
    }
  }, [isOpen]);

  const loadGithubToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings/github-token");
      if (response.ok) {
        const data = await response.json();
        setGithubToken((data.token as string) ?? "");
      }
    } catch (error) {
      console.error("Error loading GitHub token:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSaveFilter = async () => {
    try {
      const response = await fetch("/api/settings/save-filter");
      if (response.ok) {
        const data = await response.json();
        setSaveFilter((data.enabled as boolean) ?? false);
      }
    } catch (error) {
      console.error("Error loading save filter setting:", error);
    }
  };

  const saveSaveFilter = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/settings/save-filter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setSaveFilter(enabled);
        setMessage({ type: "success", text: t("messages.filterSettingSaved") });

        // If disabling save filters, clear saved filters
        if (!enabled) {
          await clearSavedFilters();
        }
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error ?? t("messages.filterSettingError"),
        });
      }
    } catch {
      setMessage({ type: "error", text: t("messages.filterSettingError") });
    }
  };

  const loadSavedFilters = async () => {
    try {
      const response = await fetch("/api/settings/filters");
      if (response.ok) {
        const data = await response.json();
        setSavedFilters(data.filters);
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  };

  const clearSavedFilters = async () => {
    try {
      const response = await fetch("/api/settings/filters", {
        method: "DELETE",
      });

      if (response.ok) {
        setSavedFilters(null);
        setMessage({
          type: "success",
          text: t("messages.clearFiltersSuccess"),
        });
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error ?? t("messages.clearFiltersError"),
        });
      }
    } catch {
      setMessage({ type: "error", text: t("messages.clearFiltersError") });
    }
  };

  const saveGithubToken = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/github-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: githubToken }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: t("messages.githubTokenSuccess"),
        });
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error ?? t("messages.githubTokenError"),
        });
      }
    } catch {
      setMessage({ type: "error", text: t("messages.githubTokenError") });
    } finally {
      setIsSaving(false);
    }
  };

  const loadColorCodingSetting = async () => {
    try {
      const response = await fetch("/api/settings/color-coding");
      if (response.ok) {
        const data = await response.json();
        setColorCodingEnabled(Boolean(data.enabled));
      }
    } catch (error) {
      console.error("Error loading color coding setting:", error);
    }
  };

  const saveColorCodingSetting = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/settings/color-coding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setColorCodingEnabled(enabled);
        setMessage({
          type: "success",
          text: t("messages.colorCodingSuccess"),
        });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({
          type: "error",
          text: t("messages.colorCodingError"),
        });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error("Error saving color coding setting:", error);
      setMessage({
        type: "error",
        text: t("messages.colorCodingError"),
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const loadAuthCredentials = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch("/api/settings/auth-credentials");
      if (response.ok) {
        const data = (await response.json()) as {
          username: string;
          enabled: boolean;
          hasCredentials: boolean;
          setupCompleted: boolean;
        };
        setAuthUsername(data.username ?? "");
        setAuthEnabled(data.enabled ?? false);
        setAuthHasCredentials(data.hasCredentials ?? false);
        setAuthSetupCompleted(data.setupCompleted ?? false);
      }
    } catch (error) {
      console.error("Error loading auth credentials:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const saveAuthCredentials = async () => {
    if (authPassword !== authConfirmPassword) {
      setMessage({ type: "error", text: t("messages.passwordMismatch") });
      return;
    }

    setAuthLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/auth-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
          enabled: authEnabled,
        }),
      });

      if (response.ok) {
        setMessage({
          type: "success",
          text: t("messages.authCredentialsSuccess"),
        });
        setAuthPassword("");
        setAuthConfirmPassword("");
        void loadAuthCredentials();
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error ?? t("messages.authCredentialsError"),
        });
      }
    } catch {
      setMessage({ type: "error", text: t("messages.authCredentialsError") });
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleAuthEnabled = async (enabled: boolean) => {
    setAuthLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/auth-credentials", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setAuthEnabled(enabled);
        setMessage({
          type: "success",
          text: t("messages.authStatusSuccess", {
            values: {
              status: enabled
                ? t("auth.sections.status.enabled")
                : t("auth.sections.status.disabled"),
            },
          }),
        });
      } else {
        const errorData = await response.json();
        setMessage({
          type: "error",
          text: errorData.error ?? t("messages.authStatusError"),
        });
      }
    } catch {
      setMessage({ type: "error", text: t("messages.authStatusError") });
    } finally {
      setAuthLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="bg-card max-h-[95vh] w-full max-w-4xl overflow-hidden rounded-lg shadow-xl sm:max-h-[90vh]">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-card-foreground text-xl font-bold sm:text-2xl">
              {t("title")}
            </h2>
            <ContextualHelpIcon
              section="general-settings"
              tooltip={t("help")}
            />
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
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

        {/* Tabs */}
        <div className="border-border border-b">
          <nav className="flex flex-col space-y-1 px-4 sm:flex-row sm:space-y-0 sm:space-x-8 sm:px-6">
            <Button
              onClick={() => setActiveTab("general")}
              variant="ghost"
              size="null"
              className={`w-full border-b-2 px-1 py-3 text-sm font-medium sm:w-auto sm:py-4 ${
                activeTab === "general"
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
              }`}
            >
              {t("tabs.general")}
            </Button>
            <Button
              onClick={() => setActiveTab("github")}
              variant="ghost"
              size="null"
              className={`w-full border-b-2 px-1 py-3 text-sm font-medium sm:w-auto sm:py-4 ${
                activeTab === "github"
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
              }`}
            >
              {t("tabs.github")}
            </Button>
            <Button
              onClick={() => setActiveTab("auth")}
              variant="ghost"
              size="null"
              className={`w-full border-b-2 px-1 py-3 text-sm font-medium sm:w-auto sm:py-4 ${
                activeTab === "auth"
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
              }`}
            >
              {t("tabs.auth")}
            </Button>
          </nav>
        </div>

        {/* Content */}
        <div className="max-h-[calc(95vh-180px)] overflow-y-auto p-4 sm:max-h-[calc(90vh-200px)] sm:p-6">
          {activeTab === "general" && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-foreground mb-3 text-base font-medium sm:mb-4 sm:text-lg">
                {t("general.title")}
              </h3>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                {t("general.description")}
              </p>
              <div className="space-y-4">
                <div className="border-border rounded-lg border p-4">
                  <h4 className="text-foreground mb-2 font-medium">
                    {t("general.sections.theme.title")}
                  </h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {t("general.sections.theme.description")}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {t("general.sections.theme.current")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {theme === "light"
                          ? t("general.sections.theme.lightLabel")
                          : t("general.sections.theme.darkLabel")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setTheme("light")}
                        variant={theme === "light" ? "default" : "outline"}
                        size="sm"
                      >
                        {t("general.sections.theme.actions.light")}
                      </Button>
                      <Button
                        onClick={() => setTheme("dark")}
                        variant={theme === "dark" ? "default" : "outline"}
                        size="sm"
                      >
                        {t("general.sections.theme.actions.dark")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-border rounded-lg border p-4">
                  <h4 className="text-foreground mb-2 font-medium">
                    {t("general.sections.filters.title")}
                  </h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {t("general.sections.filters.description")}
                  </p>
                  <Toggle
                    checked={saveFilter}
                    onCheckedChange={saveSaveFilter}
                    label={t("general.sections.filters.toggleLabel")}
                  />

                  {saveFilter && (
                    <div className="bg-muted mt-4 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {t("general.sections.filters.savedTitle")}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {savedFilters
                              ? t("general.sections.filters.savedActive")
                              : t("general.sections.filters.savedEmpty")}
                          </p>
                          {savedFilters && (
                            <div className="text-muted-foreground mt-2 text-xs">
                              <div>
                                {t("general.sections.filters.details.search", {
                                  values: {
                                    value:
                                      savedFilters.searchQuery ??
                                      t(
                                        "general.sections.filters.details.none",
                                      ),
                                  },
                                })}
                              </div>
                              <div>
                                {t("general.sections.filters.details.types", {
                                  values: {
                                    count:
                                      savedFilters.selectedTypes?.length ?? 0,
                                  },
                                })}
                              </div>
                              <div>
                                {t("general.sections.filters.details.sort", {
                                  values: {
                                    field: savedFilters.sortBy,
                                    order: savedFilters.sortOrder,
                                  },
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        {savedFilters && (
                          <Button
                            onClick={clearSavedFilters}
                            variant="outline"
                            size="sm"
                            className="text-error hover:text-error/80"
                          >
                            {t("general.sections.filters.actions.clear")}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-border rounded-lg border p-4">
                  <h4 className="text-foreground mb-2 font-medium">
                    {t("general.sections.colorCoding.title")}
                  </h4>
                  <p className="text-muted-foreground mb-4 text-sm">
                    {t("general.sections.colorCoding.description")}
                  </p>
                  <Toggle
                    checked={colorCodingEnabled}
                    onCheckedChange={saveColorCodingSetting}
                    label={t("general.sections.colorCoding.toggleLabel")}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "github" && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-foreground mb-3 text-base font-medium sm:mb-4 sm:text-lg">
                  {t("github.title")}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  {t("github.description")}
                </p>
                <div className="space-y-4">
                  <div className="border-border rounded-lg border p-4">
                    <h4 className="text-foreground mb-2 font-medium">
                      {t("github.sections.token.title")}
                    </h4>
                    <p className="text-muted-foreground mb-4 text-sm">
                      {t("github.sections.token.description")}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="github-token"
                          className="text-foreground mb-1 block text-sm font-medium"
                        >
                          {t("github.sections.token.tokenLabel")}
                        </label>
                        <Input
                          id="github-token"
                          type="password"
                          placeholder={t("github.sections.token.placeholder")}
                          value={githubToken}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setGithubToken(e.target.value)
                          }
                          disabled={isLoading || isSaving}
                          className="w-full"
                        />
                      </div>

                      {message && (
                        <div
                          className={`rounded-md p-3 text-sm ${
                            message.type === "success"
                              ? "bg-success/10 text-success-foreground border-success/20 border"
                              : "bg-error/10 text-error-foreground border-error/20 border"
                          }`}
                        >
                          {message.text}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={saveGithubToken}
                          disabled={
                            isSaving || isLoading || !githubToken.trim()
                          }
                          className="flex-1"
                        >
                          {isSaving
                            ? t("github.sections.token.actions.saving")
                            : t("github.sections.token.actions.save")}
                        </Button>
                        <Button
                          onClick={loadGithubToken}
                          disabled={isLoading || isSaving}
                          variant="outline"
                        >
                          {isLoading
                            ? t("github.sections.token.actions.loading")
                            : t("github.sections.token.actions.refresh")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "auth" && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-foreground mb-3 text-base font-medium sm:mb-4 sm:text-lg">
                  {t("auth.title")}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                  {t("auth.description")}
                </p>
                <div className="space-y-4">
                  <div className="border-border rounded-lg border p-4">
                    <h4 className="text-foreground mb-2 font-medium">
                      {t("auth.sections.status.title")}
                    </h4>
                    <p className="text-muted-foreground mb-4 text-sm">
                      {authSetupCompleted
                        ? authHasCredentials
                          ? t("auth.sections.status.enabledWithCredentials", {
                              values: {
                                status: authEnabled
                                  ? t("auth.sections.status.enabled")
                                  : t("auth.sections.status.disabled"),
                                username: authUsername,
                              },
                            })
                          : t(
                              "auth.sections.status.enabledWithoutCredentials",
                              {
                                values: {
                                  status: authEnabled
                                    ? t("auth.sections.status.enabled")
                                    : t("auth.sections.status.disabled"),
                                },
                              },
                            )
                        : t("auth.sections.status.notSetup")}
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {t("auth.sections.status.toggleLabel")}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {authEnabled
                              ? t("auth.sections.status.toggleEnabled")
                              : t("auth.sections.status.toggleDisabled")}
                          </p>
                        </div>
                        <Toggle
                          checked={authEnabled}
                          onCheckedChange={toggleAuthEnabled}
                          disabled={authLoading || !authSetupCompleted}
                          label={t("auth.sections.status.toggleLabel")}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-border rounded-lg border p-4">
                    <h4 className="text-foreground mb-2 font-medium">
                      {t("auth.sections.credentials.title")}
                    </h4>
                    <p className="text-muted-foreground mb-4 text-sm">
                      {t("auth.sections.credentials.description")}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="auth-username"
                          className="text-foreground mb-1 block text-sm font-medium"
                        >
                          {t("auth.sections.credentials.usernameLabel")}
                        </label>
                        <Input
                          id="auth-username"
                          type="text"
                          placeholder={t(
                            "auth.sections.credentials.usernamePlaceholder",
                          )}
                          value={authUsername}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAuthUsername(e.target.value)
                          }
                          disabled={authLoading}
                          className="w-full"
                          minLength={3}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auth-password"
                          className="text-foreground mb-1 block text-sm font-medium"
                        >
                          {t("auth.sections.credentials.passwordLabel")}
                        </label>
                        <Input
                          id="auth-password"
                          type="password"
                          placeholder={t(
                            "auth.sections.credentials.passwordPlaceholder",
                          )}
                          value={authPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAuthPassword(e.target.value)
                          }
                          disabled={authLoading}
                          className="w-full"
                          minLength={6}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="auth-confirm-password"
                          className="text-foreground mb-1 block text-sm font-medium"
                        >
                          {t("auth.sections.credentials.confirmPasswordLabel")}
                        </label>
                        <Input
                          id="auth-confirm-password"
                          type="password"
                          placeholder={t(
                            "auth.sections.credentials.confirmPasswordPlaceholder",
                          )}
                          value={authConfirmPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setAuthConfirmPassword(e.target.value)
                          }
                          disabled={authLoading}
                          className="w-full"
                          minLength={6}
                        />
                      </div>

                      {message && (
                        <div
                          className={`rounded-md p-3 text-sm ${
                            message.type === "success"
                              ? "bg-success/10 text-success-foreground border-success/20 border"
                              : "bg-error/10 text-error-foreground border-error/20 border"
                          }`}
                        >
                          {message.text}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={saveAuthCredentials}
                          disabled={
                            authLoading ||
                            !authUsername.trim() ||
                            !authPassword.trim() ||
                            !authConfirmPassword.trim()
                          }
                          className="flex-1"
                        >
                          {authLoading
                            ? t("auth.sections.credentials.actions.updating")
                            : t("auth.sections.credentials.actions.update")}
                        </Button>
                        <Button
                          onClick={loadAuthCredentials}
                          disabled={authLoading}
                          variant="outline"
                        >
                          {authLoading
                            ? t("auth.sections.credentials.actions.loading")
                            : t("auth.sections.credentials.actions.refresh")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
