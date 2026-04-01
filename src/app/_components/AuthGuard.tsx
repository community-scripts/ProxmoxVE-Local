"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { AuthModal } from "./AuthModal";
import { SetupModal } from "./SetupModal";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const {
    isAuthenticated,
    isLoading,
    setupCompleted,
    authEnabled,
    refreshConfig,
  } = useAuth();
  const [localSetupCompleted, setLocalSetupCompleted] = useState(false);

  const handleSetupComplete = async () => {
    setLocalSetupCompleted(true);
    await refreshConfig();
  };

  // Show loading while AuthProvider is still checking
  if (isLoading || setupCompleted === null) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup modal if setup has not been completed yet
  if (!setupCompleted && !localSetupCompleted) {
    return <SetupModal isOpen={true} onComplete={handleSetupComplete} />;
  }

  // Show auth modal if auth is enabled but user is not authenticated
  if (authEnabled && !isAuthenticated) {
    return <AuthModal isOpen={true} />;
  }

  // Render children if authenticated or auth is disabled
  return <>{children}</>;
}
