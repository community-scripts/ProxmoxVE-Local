'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  expirationTime: number | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expirationTime, setExpirationTime] = useState<number | null>(null);

  const checkAuthInternal = async (retryCount = 0) => {
    try {
      // First check if setup is completed
      const setupResponse = await fetch('/api/settings/auth-credentials');
      if (setupResponse.ok) {
        const setupData = await setupResponse.json() as { setupCompleted: boolean; enabled: boolean };
        
        // If setup is not completed or auth is disabled, don't verify
        if (!setupData.setupCompleted || !setupData.enabled) {
          setIsAuthenticated(false);
          setUsername(null);
          setExpirationTime(null);
          setIsLoading(false);
          return;
        }
      }

      // Only verify authentication if setup is completed and auth is enabled
      const response = await fetch('/api/auth/verify', {
        credentials: 'include', // Ensure cookies are sent
      });
      if (response.ok) {
        const data = await response.json() as { 
          username: string; 
          expirationTime?: number | null;
          timeUntilExpiration?: number | null;
        };
        setIsAuthenticated(true);
        setUsername(data.username);
        setExpirationTime(data.expirationTime ?? null);
      } else {
        setIsAuthenticated(false);
        setUsername(null);
        setExpirationTime(null);
        
        // Retry logic for failed auth checks (max 2 retries)
        if (retryCount < 2) {
          setTimeout(() => {
            void checkAuthInternal(retryCount + 1);
          }, 500);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
      setUsername(null);
      setExpirationTime(null);
      
      // Retry logic for network errors (max 2 retries)
      if (retryCount < 2) {
        setTimeout(() => {
          void checkAuthInternal(retryCount + 1);
        }, 500);
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = useCallback(() => {
    return checkAuthInternal(0);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Ensure cookies are received
      });

      if (response.ok) {
        const data = await response.json() as { username: string };
        setIsAuthenticated(true);
        setUsername(data.username);
        
        // Check auth again to get expiration time
        await checkAuth();
        return true;
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData.error);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    // Clear the auth cookie by setting it to expire
    document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setIsAuthenticated(false);
    setUsername(null);
    setExpirationTime(null);
  };

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        isLoading,
        expirationTime,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
