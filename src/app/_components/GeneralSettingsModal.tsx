'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Toggle } from './ui/toggle';
import { ContextualHelpIcon } from './ContextualHelpIcon';
import { useTheme } from './ThemeProvider';
import { useRegisterModal } from './modal/ModalStackProvider';

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeneralSettingsModal({ isOpen, onClose }: GeneralSettingsModalProps) {
  useRegisterModal(isOpen, { id: 'general-settings-modal', allowEscape: true, onClose });
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'general' | 'github' | 'auth'>('general');
  const [githubToken, setGithubToken] = useState('');
  const [saveFilter, setSaveFilter] = useState(false);
  const [savedFilters, setSavedFilters] = useState<any>(null);
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
        const data = await response.json();
        setSavedFilters(data.filters);
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
        setMessage({ type: 'error', text: errorData.error ?? 'Failed to save token' });
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
        const data = await response.json() as { username: string; enabled: boolean; hasCredentials: boolean; setupCompleted: boolean };
        setAuthUsername(data.username ?? '');
        setAuthEnabled(data.enabled ?? false);
        setAuthHasCredentials(data.hasCredentials ?? false);
        setAuthSetupCompleted(data.setupCompleted ?? false);
      }
    } catch (error) {
      console.error('Error loading auth credentials:', error);
    } finally {
      setAuthLoading(false);
    }
  };

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
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">Authentication Settings</h3>
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
        </div>
      </div>
    </div>
  );
}
