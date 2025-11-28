'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Toggle } from './ui/toggle';
import { ContextualHelpIcon } from './ContextualHelpIcon';
import { useTheme } from './ThemeProvider';
import { useRegisterModal } from './modal/ModalStackProvider';
import { api } from '~/trpc/react';
import { useAuth } from './AuthProvider';
import { Trash2, ExternalLink } from 'lucide-react';
import type { FilterState } from './FilterBar';

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeneralSettingsModal({ isOpen, onClose }: GeneralSettingsModalProps) {
  useRegisterModal(isOpen, { id: 'general-settings-modal', allowEscape: true, onClose });
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, expirationTime, checkAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'github' | 'auth' | 'auto-sync' | 'repositories'>('general');
  const [sessionExpirationDisplay, setSessionExpirationDisplay] = useState<string>('');
  const [githubToken, setGithubToken] = useState('');
  const [saveFilter, setSaveFilter] = useState(false);
  const [savedFilters, setSavedFilters] = useState<Partial<FilterState> | null>(null);
  const [colorCodingEnabled, setColorCodingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Auth state
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authHasCredentials, setAuthHasCredentials] = useState(false);
  const [authSetupCompleted, setAuthSetupCompleted] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionDurationDays, setSessionDurationDays] = useState(7);

  // Auto-sync state
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncIntervalType, setSyncIntervalType] = useState<'predefined' | 'custom'>('predefined');
  const [syncIntervalPredefined, setSyncIntervalPredefined] = useState('1hour');
  const [syncIntervalCron, setSyncIntervalCron] = useState('');
  const [autoDownloadNew, setAutoDownloadNew] = useState(false);
  const [autoUpdateExisting, setAutoUpdateExisting] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [appriseUrls, setAppriseUrls] = useState<string[]>([]);
  const [appriseUrlsText, setAppriseUrlsText] = useState('');
  const [lastAutoSync, setLastAutoSync] = useState('');
  const [lastAutoSyncError, setLastAutoSyncError] = useState<string | null>(null);
  const [lastAutoSyncErrorTime, setLastAutoSyncErrorTime] = useState<string | null>(null);
  const [cronValidationError, setCronValidationError] = useState('');

  // Repository management state
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoEnabled, setNewRepoEnabled] = useState(true);
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [deletingRepoId, setDeletingRepoId] = useState<number | null>(null);

  // Repository queries and mutations
  const { data: repositoriesData, refetch: refetchRepositories } = api.repositories.getAll.useQuery(undefined, {
    enabled: isOpen && activeTab === 'repositories'
  });
  const createRepoMutation = api.repositories.create.useMutation();
  const updateRepoMutation = api.repositories.update.useMutation();
  const deleteRepoMutation = api.repositories.delete.useMutation();

  // Load existing settings when modal opens
  useEffect(() => {
    if (isOpen) {
      void loadGithubToken();
      void loadSaveFilter();
      void loadSavedFilters();
      void loadAuthCredentials();
      void loadColorCodingSetting();
      void loadAutoSyncSettings();
    }
  }, [isOpen]);

  const loadGithubToken = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/github-token');
      if (response.ok) {
        const data = await response.json();
        setGithubToken((data.token as string) ?? '');
      }
    } catch (error) {
      console.error('Error loading GitHub token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSaveFilter = async () => {
    try {
      const response = await fetch('/api/settings/save-filter');
      if (response.ok) {
        const data = await response.json();
        setSaveFilter((data.enabled as boolean) ?? false);
      }
    } catch (error) {
      console.error('Error loading save filter setting:', error);
    }
  };

  const saveSaveFilter = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/settings/save-filter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setSaveFilter(enabled);
        setMessage({ type: 'success', text: 'Save filter setting updated!' });
        
        // If disabling save filters, clear saved filters
        if (!enabled) {
          await clearSavedFilters();
        }
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to save setting' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save setting' });
    }
  };

  const loadSavedFilters = async () => {
    try {
      const response = await fetch('/api/settings/filters');
      if (response.ok) {
        const data = await response.json() as { filters?: Partial<FilterState> };
        setSavedFilters(data.filters ?? null);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const clearSavedFilters = async () => {
    try {
      const response = await fetch('/api/settings/filters', {
        method: 'DELETE',
      });

      if (response.ok) {
        setSavedFilters(null);
        setMessage({ type: 'success', text: 'Saved filters cleared!' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to clear filters' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear filters' });
    }
  };

  const saveGithubToken = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/github-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: githubToken }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'GitHub token saved successfully!' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: (errorData.error as string | undefined) ?? 'Failed to save token' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save token' });
    } finally {
      setIsSaving(false);
    }
  };

  const loadColorCodingSetting = async () => {
    try {
      const response = await fetch('/api/settings/color-coding');
      if (response.ok) {
        const data = await response.json();
        setColorCodingEnabled(Boolean(data.enabled));
      }
    } catch (error) {
      console.error('Error loading color coding setting:', error);
    }
  };

  const saveColorCodingSetting = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/settings/color-coding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setColorCodingEnabled(enabled);
        setMessage({ type: 'success', text: 'Color coding setting saved successfully' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to save color coding setting' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving color coding setting:', error);
      setMessage({ type: 'error', text: 'Failed to save color coding setting' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const loadAuthCredentials = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch('/api/settings/auth-credentials');
      if (response.ok) {
        const data = await response.json() as { username: string; enabled: boolean; hasCredentials: boolean; setupCompleted: boolean; sessionDurationDays?: number };
        setAuthUsername(data.username ?? '');
        setAuthEnabled(data.enabled ?? false);
        setAuthHasCredentials(data.hasCredentials ?? false);
        setAuthSetupCompleted(data.setupCompleted ?? false);
        setSessionDurationDays(data.sessionDurationDays ?? 7);
      }
    } catch (error) {
      console.error('Error loading auth credentials:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  // Format expiration time display
  const formatExpirationTime = (expTime: number | null): string => {
    if (!expTime) return 'No active session';
    
    const now = Date.now();
    const timeUntilExpiration = expTime - now;
    
    if (timeUntilExpiration <= 0) {
      return 'Session expired';
    }
    
    const days = Math.floor(timeUntilExpiration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeUntilExpiration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilExpiration % (1000 * 60 * 60)) / (1000 * 60));
    
    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }
    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }
    if (minutes > 0 && days === 0) {
      parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }
    
    if (parts.length === 0) {
      return 'Less than a minute';
    }
    
    return parts.join(', ');
  };

  // Update expiration display periodically
  useEffect(() => {
    const updateExpirationDisplay = () => {
      if (expirationTime) {
        setSessionExpirationDisplay(formatExpirationTime(expirationTime));
      } else {
        setSessionExpirationDisplay('');
      }
    };

    updateExpirationDisplay();
    
    // Update every minute
    const interval = setInterval(updateExpirationDisplay, 60000);
    
    return () => clearInterval(interval);
  }, [expirationTime]);

  // Refresh auth when tab changes to auth tab
  useEffect(() => {
    if (activeTab === 'auth' && isOpen) {
      void checkAuth();
    }
  }, [activeTab, isOpen, checkAuth]);

  const saveAuthCredentials = async () => {
    if (authPassword !== authConfirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setAuthLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/auth-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: authUsername, 
          password: authPassword,
          enabled: authEnabled 
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Authentication credentials updated successfully!' });
        setAuthPassword('');
        setAuthConfirmPassword('');
        void loadAuthCredentials();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to save credentials' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save credentials' });
    } finally {
      setAuthLoading(false);
    }
  };

  const saveSessionDuration = async (days: number) => {
    if (days < 1 || days > 365) {
      setMessage({ type: 'error', text: 'Session duration must be between 1 and 365 days' });
      return;
    }

    setAuthLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/auth-credentials', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionDurationDays: days }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Session duration updated to ${days} days` });
        setSessionDurationDays(days);
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to update session duration' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update session duration' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setAuthLoading(false);
    }
  };

  const toggleAuthEnabled = async (enabled: boolean) => {
    setAuthLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/auth-credentials', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setAuthEnabled(enabled);
        setMessage({ 
          type: 'success', 
          text: `Authentication ${enabled ? 'enabled' : 'disabled'} successfully!` 
        });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to update auth status' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update auth status' });
    } finally {
      setAuthLoading(false);
    }
  };

  // Auto-sync functions
  const loadAutoSyncSettings = async () => {
    try {
      const response = await fetch('/api/settings/auto-sync');
      if (response.ok) {
        const data = await response.json() as { 
          settings?: {
            autoSyncEnabled?: boolean;
            syncIntervalType?: 'custom' | 'predefined';
            syncIntervalPredefined?: string;
            syncIntervalCron?: string;
            autoDownloadNew?: boolean;
            autoUpdateExisting?: boolean;
            notificationEnabled?: boolean;
            appriseUrls?: string[];
            lastAutoSync?: string;
            lastAutoSyncError?: string | null;
            lastAutoSyncErrorTime?: string | null;
          }
        };
        const settings = data.settings;
        if (settings) {
          setAutoSyncEnabled(settings.autoSyncEnabled ?? false);
          setSyncIntervalType(settings.syncIntervalType ?? 'predefined');
          setSyncIntervalPredefined(settings.syncIntervalPredefined ?? '1hour');
          setSyncIntervalCron(settings.syncIntervalCron ?? '');
          setAutoDownloadNew(settings.autoDownloadNew ?? false);
          setAutoUpdateExisting(settings.autoUpdateExisting ?? false);
          setNotificationEnabled(settings.notificationEnabled ?? false);
          setAppriseUrls(settings.appriseUrls ?? []);
          setAppriseUrlsText((settings.appriseUrls ?? []).join('\n'));
          setLastAutoSync(settings.lastAutoSync ?? '');
          setLastAutoSyncError(settings.lastAutoSyncError ?? null);
          setLastAutoSyncErrorTime(settings.lastAutoSyncErrorTime ?? null);
        }
      }
    } catch (error) {
      console.error('Error loading auto-sync settings:', error);
    }
  };

  const saveAutoSyncSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/settings/auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoSyncEnabled,
          syncIntervalType,
          syncIntervalPredefined,
          syncIntervalCron,
          autoDownloadNew,
          autoUpdateExisting,
          notificationEnabled,
          appriseUrls: appriseUrls
        })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Auto-sync settings saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to save auto-sync settings' });
      }
    } catch (error) {
      console.error('Error saving auto-sync settings:', error);
      setMessage({ type: 'error', text: 'Failed to save auto-sync settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppriseUrlsChange = (text: string) => {
    setAppriseUrlsText(text);
    const urls = text.split('\n').filter(url => url.trim() !== '');
    setAppriseUrls(urls);
  };

  const validateCronExpression = (cron: string) => {
    if (!cron.trim()) {
      setCronValidationError('');
      return true;
    }
    
    // Basic cron validation - you might want to use a library like cron-validator
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/;
    const isValid = cronRegex.test(cron);
    
    if (!isValid) {
      setCronValidationError('Invalid cron expression format');
      return false;
    }
    
    setCronValidationError('');
    return true;
  };

  const handleCronChange = (cron: string) => {
    setSyncIntervalCron(cron);
    validateCronExpression(cron);
  };

  const testNotification = async () => {
    try {
      const response = await fetch('/api/settings/auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testNotification: true })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Test notification sent successfully!' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to send test notification' });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setMessage({ type: 'error', text: 'Failed to send test notification' });
    }
  };

  const triggerManualSync = async () => {
    try {
      const response = await fetch('/api/settings/auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerManualSync: true })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Manual sync triggered successfully!' });
        // Reload settings to get updated last sync time
        await loadAutoSyncSettings();
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to trigger manual sync' });
      }
    } catch (error) {
      console.error('Error triggering manual sync:', error);
      setMessage({ type: 'error', text: 'Failed to trigger manual sync' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-card-foreground">Settings</h2>
            <ContextualHelpIcon section="general-settings" tooltip="Help with General Settings" />
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-8 px-4 sm:px-6">
            <Button
              onClick={() => setActiveTab('general')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'general'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              General
            </Button>
            <Button
              onClick={() => setActiveTab('github')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'github'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              GitHub
            </Button>
            <Button
              onClick={() => setActiveTab('auth')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'auth'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Authentication
            </Button>
            <Button
              onClick={() => setActiveTab('auto-sync')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'auto-sync'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Auto-Sync
            </Button>
            <Button
              onClick={() => setActiveTab('repositories')}
              variant="ghost"
              size="null"
              className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm w-full sm:w-auto ${
                activeTab === 'repositories'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Repositories
            </Button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
          {activeTab === 'general' && (
            <div className="space-y-4 sm:space-y-6">
              
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">General Settings</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Configure general application preferences and behavior.
                </p>
                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Theme</h4>
                    <p className="text-sm text-muted-foreground mb-4">Choose your preferred color theme for the application.</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Current Theme</p>
                        <p className="text-xs text-muted-foreground">
                          {theme === 'light' ? 'Light mode' : 'Dark mode'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setTheme('light')}
                          variant={theme === 'light' ? 'default' : 'outline'}
                          size="sm"
                        >
                          Light
                        </Button>
                        <Button
                          onClick={() => setTheme('dark')}
                          variant={theme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                        >
                          Dark
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Save Filters</h4>
                    <p className="text-sm text-muted-foreground mb-4">Save your configured script filters.</p>
                    <Toggle
                      checked={saveFilter}
                      onCheckedChange={saveSaveFilter}
                      label="Enable filter saving"
                    />
                    
                    {saveFilter && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Saved Filters</p>
                            <p className="text-xs text-muted-foreground">
                              {savedFilters ? 'Filters are currently saved' : 'No filters saved yet'}
                            </p>
                            {savedFilters && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <div>Search: {savedFilters.searchQuery ?? 'None'}</div>
                                <div>Types: {savedFilters.selectedTypes?.length ?? 0} selected</div>
                                <div>Sort: {savedFilters.sortBy} ({savedFilters.sortOrder})</div>
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
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Server Color Coding</h4>
                    <p className="text-sm text-muted-foreground mb-4">Enable color coding for servers to visually distinguish them throughout the application.</p>
                    <Toggle
                      checked={colorCodingEnabled}
                      onCheckedChange={saveColorCodingSetting}
                      label="Enable server color coding"
                    />
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">GitHub Integration</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Configure GitHub integration for script management and updates.
                </p>
                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">GitHub Personal Access Token</h4>
                    <p className="text-sm text-muted-foreground mb-4">Save a GitHub Personal Access Token to circumvent GitHub API rate limits.</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="github-token" className="block text-sm font-medium text-foreground mb-1">
                          Token
                        </label>
                        <Input
                          id="github-token"
                          type="password"
                          placeholder="Enter your GitHub Personal Access Token"
                          value={githubToken}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubToken(e.target.value)}
                          disabled={isLoading || isSaving}
                          className="w-full"
                        />
                      </div>
                      
                      {message && (
                        <div className={`p-3 rounded-md text-sm ${
                          message.type === 'success' 
                            ? 'bg-success/10 text-success-foreground border border-success/20' 
                            : 'bg-error/10 text-error-foreground border border-error/20'
                        }`}>
                          {message.text}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={saveGithubToken}
                          disabled={isSaving || isLoading || !githubToken.trim()}
                          className="flex-1"
                        >
                          {isSaving ? 'Saving...' : 'Save Token'}
                        </Button>
                        <Button
                          onClick={loadGithubToken}
                          disabled={isLoading || isSaving}
                          variant="outline"
                        >
                          {isLoading ? 'Loading...' : 'Refresh'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-medium text-foreground">Authentication Settings</h3>
                  <ContextualHelpIcon section="auth-settings" tooltip="Help with Authentication Settings" />
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Configure authentication to secure access to your application.
                </p>
                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Authentication Status</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      {authSetupCompleted 
                        ? (authHasCredentials 
                          ? `Authentication is ${authEnabled ? 'enabled' : 'disabled'}. Current username: ${authUsername}`
                          : `Authentication is ${authEnabled ? 'enabled' : 'disabled'}. No credentials configured.`)
                        : 'Authentication setup has not been completed yet.'
                      }
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Enable Authentication</p>
                          <p className="text-xs text-muted-foreground">
                            {authEnabled 
                              ? 'Authentication is required on every page load'
                              : 'Authentication is optional'
                            }
                          </p>
                        </div>
                        <Toggle
                          checked={authEnabled}
                          onCheckedChange={toggleAuthEnabled}
                          disabled={authLoading || !authSetupCompleted}
                          label="Enable authentication"
                        />
                      </div>
                    </div>
                  </div>

                  {isAuthenticated && expirationTime && (
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">Session Information</h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Session expires in:</p>
                          <p className="text-sm font-medium text-foreground">{sessionExpirationDisplay}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Expiration date:</p>
                          <p className="text-sm font-medium text-foreground">
                            {new Date(expirationTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Session Duration</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure how long user sessions should last before requiring re-authentication.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="session-duration" className="block text-sm font-medium text-foreground mb-1">
                          Session Duration (days)
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="session-duration"
                            type="number"
                            min="1"
                            max="365"
                            placeholder="Enter days"
                            value={sessionDurationDays}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value)) {
                                setSessionDurationDays(value);
                              }
                            }}
                            disabled={authLoading || !authSetupCompleted}
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">days (1-365)</span>
                          <Button
                            onClick={() => saveSessionDuration(sessionDurationDays)}
                            disabled={authLoading || !authSetupCompleted}
                            size="sm"
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Note: This setting applies to new logins. Current sessions will not be affected.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Update Credentials</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Change your username and password for authentication.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="auth-username" className="block text-sm font-medium text-foreground mb-1">
                          Username
                        </label>
                        <Input
                          id="auth-username"
                          type="text"
                          placeholder="Enter username"
                          value={authUsername}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthUsername(e.target.value)}
                          disabled={authLoading}
                          className="w-full"
                          minLength={3}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="auth-password" className="block text-sm font-medium text-foreground mb-1">
                          New Password
                        </label>
                        <Input
                          id="auth-password"
                          type="password"
                          placeholder="Enter new password"
                          value={authPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthPassword(e.target.value)}
                          disabled={authLoading}
                          className="w-full"
                          minLength={6}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-foreground mb-1">
                          Confirm Password
                        </label>
                        <Input
                          id="auth-confirm-password"
                          type="password"
                          placeholder="Confirm new password"
                          value={authConfirmPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthConfirmPassword(e.target.value)}
                          disabled={authLoading}
                          className="w-full"
                          minLength={6}
                        />
                      </div>
                      
                      {message && (
                        <div className={`p-3 rounded-md text-sm ${
                          message.type === 'success' 
                            ? 'bg-success/10 text-success-foreground border border-success/20' 
                            : 'bg-error/10 text-error-foreground border border-error/20'
                        }`}>
                          {message.text}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={saveAuthCredentials}
                          disabled={authLoading || !authUsername.trim() || !authPassword.trim() || !authConfirmPassword.trim()}
                          className="flex-1"
                        >
                          {authLoading ? 'Saving...' : 'Update Credentials'}
                        </Button>
                        <Button
                          onClick={loadAuthCredentials}
                          disabled={authLoading}
                          variant="outline"
                        >
                          {authLoading ? 'Loading...' : 'Refresh'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'auto-sync' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Auto-Sync Settings</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Configure automatic synchronization of scripts with configurable intervals and notifications.
                </p>
                
                {/* Enable Auto-Sync */}
                <div className="p-4 border border-border rounded-lg mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Enable Auto-Sync</h4>
                      <p className="text-sm text-muted-foreground">Automatically sync JSON files from GitHub at specified intervals</p>
                    </div>
                    <Toggle
                      checked={autoSyncEnabled}
                      onCheckedChange={async (checked) => {
                        setAutoSyncEnabled(checked);
                        
                        // Auto-save when toggle changes
                        try {
                          // If syncIntervalType is custom but no cron expression, fallback to predefined
                          const effectiveSyncIntervalType = (syncIntervalType === 'custom' && !syncIntervalCron) 
                            ? 'predefined' 
                            : syncIntervalType;
                          
                          const response = await fetch('/api/settings/auto-sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              autoSyncEnabled: checked,
                              syncIntervalType: effectiveSyncIntervalType,
                              syncIntervalPredefined: effectiveSyncIntervalType === 'predefined' ? syncIntervalPredefined : undefined,
                              syncIntervalCron: effectiveSyncIntervalType === 'custom' ? syncIntervalCron : undefined,
                              autoDownloadNew,
                              autoUpdateExisting,
                              notificationEnabled,
                              appriseUrls: appriseUrls
                            })
                          });
                          
                          if (response.ok) {
                            // Update local state to reflect the effective sync interval type
                            if (effectiveSyncIntervalType !== syncIntervalType) {
                              setSyncIntervalType(effectiveSyncIntervalType);
                            }
                          }
                        } catch (error) {
                          console.error('Error saving auto-sync toggle:', error);
                        }
                      }}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Sync Interval */}
                {autoSyncEnabled && (
                  <div className="p-4 border border-border rounded-lg mb-4">
                    <h4 className="font-medium text-foreground mb-3">Sync Interval</h4>
                    
                    <div className="space-y-3">
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="syncIntervalType"
                            value="predefined"
                            checked={syncIntervalType === 'predefined'}
                            onChange={(e) => setSyncIntervalType(e.target.value as 'predefined' | 'custom')}
                            className="mr-2"
                          />
                          Predefined
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="syncIntervalType"
                            value="custom"
                            checked={syncIntervalType === 'custom'}
                            onChange={(e) => setSyncIntervalType(e.target.value as 'predefined' | 'custom')}
                            className="mr-2"
                          />
                          Custom Cron
                        </label>
                      </div>

                      {syncIntervalType === 'predefined' && (
                        <div>
                          <select
                            value={syncIntervalPredefined}
                            onChange={(e) => setSyncIntervalPredefined(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-background"
                          >
                            <option value="15min">Every 15 minutes</option>
                            <option value="30min">Every 30 minutes</option>
                            <option value="1hour">Every hour</option>
                            <option value="6hours">Every 6 hours</option>
                            <option value="12hours">Every 12 hours</option>
                            <option value="24hours">Every 24 hours</option>
                          </select>
                        </div>
                      )}

                      {syncIntervalType === 'custom' && (
                        <div>
                          <Input
                            placeholder="0 */6 * * * (every 6 hours)"
                            value={syncIntervalCron}
                            onChange={(e) => handleCronChange(e.target.value)}
                            className="w-full"
                            autoFocus
                            onFocus={() => setCronValidationError('')}
                          />
                          {cronValidationError && (
                            <p className="text-sm text-red-500 mt-1">{cronValidationError}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Format: minute hour day month weekday. See{' '}
                            <a href="https://crontab.guru" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              crontab.guru
                            </a>{' '}
                            for examples
                          </p>
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            <p className="font-medium mb-1">Common examples:</p>
                            <ul className="space-y-1 text-muted-foreground">
                              <li>• <code>* * * * *</code> - Every minute</li>
                              <li>• <code>0 * * * *</code> - Every hour</li>
                              <li>• <code>0 */6 * * *</code> - Every 6 hours</li>
                              <li>• <code>0 0 * * *</code> - Every day at midnight</li>
                              <li>• <code>0 0 * * 0</code> - Every Sunday at midnight</li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-Download Options */}
                {autoSyncEnabled && (
                  <div className="p-4 border border-border rounded-lg mb-4">
                    <h4 className="font-medium text-foreground mb-3">Auto-Download Options</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-foreground">Auto-download new scripts</h5>
                          <p className="text-sm text-muted-foreground">Automatically download scripts that haven&apos;t been downloaded yet</p>
                        </div>
                        <Toggle
                          checked={autoDownloadNew}
                          onCheckedChange={setAutoDownloadNew}
                          disabled={isSaving}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-foreground">Auto-update existing scripts</h5>
                          <p className="text-sm text-muted-foreground">Automatically update scripts that have newer versions available</p>
                        </div>
                        <Toggle
                          checked={autoUpdateExisting}
                          onCheckedChange={setAutoUpdateExisting}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notifications */}
                {autoSyncEnabled && (
                  <div className="p-4 border border-border rounded-lg mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-foreground">Enable Notifications</h4>
                        <p className="text-sm text-muted-foreground">Send notifications when sync completes</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          If you want any other notification service, please open an issue on the GitHub repository.
                        </p>
                      </div>
                      <Toggle
                        checked={notificationEnabled}
                        onCheckedChange={setNotificationEnabled}
                        disabled={isSaving}
                      />
                    </div>

                    {notificationEnabled && (
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="apprise-urls" className="block text-sm font-medium text-foreground mb-1">
                            Apprise URLs
                          </label>
                          <textarea
                            id="apprise-urls"
                            placeholder="http://YOUR_APPRISE_SERVER/notify/apprise&#10;"
                            value={appriseUrlsText}
                            onChange={(e) => handleAppriseUrlsChange(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-background h-24 resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            One URL per line. Supports Discord, Telegram, Email, Slack, and more via{' '}
                            <a href="https://github.com/caronc/apprise" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Apprise
                            </a>
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={testNotification}
                            variant="outline"
                            size="sm"
                            disabled={appriseUrls.length === 0}
                          >
                            Test Notification
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status and Actions */}
                {autoSyncEnabled && (
                  <div className="p-4 border border-border rounded-lg mb-4">
                    <h4 className="font-medium text-foreground mb-3">Status & Actions</h4>
                    
                    <div className="space-y-3">
                      {lastAutoSync && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Last sync: {new Date(lastAutoSync).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {lastAutoSyncError && (
                        <div className="p-3 bg-error/10 text-error-foreground border border-error/20 rounded-md">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium">Last sync error:</p>
                              <p className="text-sm mt-1">{lastAutoSyncError}</p>
                              {lastAutoSyncErrorTime && (
                                <p className="text-xs mt-1 opacity-75">
                                  {new Date(lastAutoSyncErrorTime).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={triggerManualSync}
                          variant="outline"
                          size="sm"
                        >
                          Trigger Sync Now
                        </Button>
                        <Button
                          onClick={saveAutoSyncSettings}
                          disabled={isSaving || (syncIntervalType === 'custom' && !!cronValidationError)}
                          size="sm"
                        >
                          {isSaving ? 'Saving...' : 'Save Settings'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Display */}
                {message && (
                  <div className={`p-3 rounded-md text-sm ${
                    message.type === 'success' 
                      ? 'bg-success/10 text-success-foreground border border-success/20' 
                      : 'bg-error/10 text-error-foreground border border-error/20'
                  }`}>
                    {message.text}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'repositories' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Repository Management</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Manage GitHub repositories for script synchronization. The main repository has priority when enabled.
                </p>
                
                {/* Add New Repository */}
                <div className="p-4 border border-border rounded-lg mb-4">
                  <h4 className="font-medium text-foreground mb-3">Add New Repository</h4>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="new-repo-url" className="block text-sm font-medium text-foreground mb-1">
                        Repository URL
                      </label>
                      <Input
                        id="new-repo-url"
                        type="url"
                        placeholder="https://github.com/owner/repo"
                        value={newRepoUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRepoUrl(e.target.value)}
                        disabled={isAddingRepo}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter a GitHub repository URL (e.g., https://github.com/owner/repo)
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Enable after adding</p>
                        <p className="text-xs text-muted-foreground">Repository will be enabled by default</p>
                      </div>
                      <Toggle
                        checked={newRepoEnabled}
                        onCheckedChange={setNewRepoEnabled}
                        disabled={isAddingRepo}
                        label="Enable repository"
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        if (!newRepoUrl.trim()) {
                          setMessage({ type: 'error', text: 'Please enter a repository URL' });
                          return;
                        }
                        setIsAddingRepo(true);
                        setMessage(null);
                        try {
                          const result = await createRepoMutation.mutateAsync({
                            url: newRepoUrl.trim(),
                            enabled: newRepoEnabled
                          });
                          if (result.success) {
                            setMessage({ type: 'success', text: 'Repository added successfully!' });
                            setNewRepoUrl('');
                            setNewRepoEnabled(true);
                            await refetchRepositories();
                          } else {
                            setMessage({ type: 'error', text: result.error ?? 'Failed to add repository' });
                          }
                        } catch (error) {
                          setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to add repository' });
                        } finally {
                          setIsAddingRepo(false);
                        }
                      }}
                      disabled={isAddingRepo || !newRepoUrl.trim()}
                      className="w-full"
                    >
                      {isAddingRepo ? 'Adding...' : 'Add Repository'}
                    </Button>
                  </div>
                </div>

                {/* Repository List */}
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-3">Repositories</h4>
                  {repositoriesData?.success && repositoriesData.repositories.length > 0 ? (
                    <div className="space-y-3">
                      {repositoriesData.repositories.map((repo) => (
                        <div
                          key={repo.id}
                          className="p-3 border border-border rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-foreground hover:text-primary flex items-center gap-1"
                              >
                                {repo.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              {repo.is_default && (
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                                  {repo.priority === 1 ? 'Main' : 'Dev'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Priority: {repo.priority} {repo.enabled ? '• Enabled' : '• Disabled'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Toggle
                              checked={repo.enabled}
                              onCheckedChange={async (enabled) => {
                                setMessage(null);
                                try {
                                  const result = await updateRepoMutation.mutateAsync({
                                    id: repo.id,
                                    enabled
                                  });
                                  if (result.success) {
                                    setMessage({ type: 'success', text: `Repository ${enabled ? 'enabled' : 'disabled'} successfully!` });
                                    await refetchRepositories();
                                  } else {
                                    setMessage({ type: 'error', text: result.error ?? 'Failed to update repository' });
                                  }
                                } catch (error) {
                                  setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update repository' });
                                }
                              }}
                              disabled={updateRepoMutation.isPending}
                              label={repo.enabled ? 'Disable' : 'Enable'}
                            />
                            <Button
                              onClick={async () => {
                                if (!repo.is_removable) {
                                  setMessage({ type: 'error', text: 'Default repositories cannot be deleted' });
                                  return;
                                }
                                if (!confirm(`Are you sure you want to delete this repository? All scripts from this repository will be removed.`)) {
                                  return;
                                }
                                setDeletingRepoId(repo.id);
                                setMessage(null);
                                try {
                                  const result = await deleteRepoMutation.mutateAsync({ id: repo.id });
                                  if (result.success) {
                                    setMessage({ type: 'success', text: 'Repository deleted successfully!' });
                                    await refetchRepositories();
                                  } else {
                                    setMessage({ type: 'error', text: result.error ?? 'Failed to delete repository' });
                                  }
                                } catch (error) {
                                  setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete repository' });
                                } finally {
                                  setDeletingRepoId(null);
                                }
                              }}
                              disabled={!repo.is_removable || deletingRepoId === repo.id || deleteRepoMutation.isPending}
                              variant="ghost"
                              size="icon"
                              className="text-error hover:text-error/80 hover:bg-error/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No repositories configured</p>
                  )}
                </div>

                {/* Message Display */}
                {message && (
                  <div className={`p-3 rounded-md text-sm ${
                    message.type === 'success' 
                      ? 'bg-success/10 text-success-foreground border border-success/20' 
                      : 'bg-error/10 text-error-foreground border border-error/20'
                  }`}>
                    {message.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
