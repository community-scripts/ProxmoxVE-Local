'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { AuthModal } from './AuthModal';
import { SetupModal } from './SetupModal';

interface AuthGuardProps {
  children: ReactNode;
}

interface AuthConfig {
  username: string | null;
  enabled: boolean;
  hasCredentials: boolean;
  setupCompleted: boolean;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(false);

  const handleSetupComplete = async () => {
    setSetupCompleted(true);
    // Refresh auth config without reloading the page
    await fetchAuthConfig();
  };

  const fetchAuthConfig = async () => {
    try {
      const response = await fetch('/api/settings/auth-credentials');
      if (response.ok) {
        const config = await response.json() as AuthConfig;
        setAuthConfig(config);
      }
    } catch (error) {
      console.error('Error fetching auth config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    void fetchAuthConfig();
  }, []);

  // Show loading while checking auth status
  if (isLoading || configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup modal if setup has not been completed yet
  if (authConfig && !authConfig.setupCompleted && !setupCompleted) {
    return <SetupModal isOpen={true} onComplete={handleSetupComplete} />;
  }

  // Show auth modal if auth is enabled but user is not authenticated
  if (authConfig && authConfig.enabled && !isAuthenticated) {
    return <AuthModal isOpen={true} />;
  }

  // Render children if authenticated or auth is disabled
  return <>{children}</>;
}
