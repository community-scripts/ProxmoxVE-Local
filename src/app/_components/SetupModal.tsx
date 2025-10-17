'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Toggle } from './ui/toggle';
import { Lock, User, Shield, AlertCircle } from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SetupModal({ isOpen, onComplete }: SetupModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enableAuth, setEnableAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Only validate passwords if authentication is enabled
    if (enableAuth && password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: enableAuth ? username : undefined, 
          password: enableAuth ? password : undefined, 
          enabled: enableAuth 
        }),
      });

      if (response.ok) {
        // If authentication is enabled, automatically log in the user
        if (enableAuth) {
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          if (loginResponse.ok) {
            // Login successful, complete setup
            onComplete();
          } else {
            // Setup succeeded but login failed, still complete setup
            console.warn('Setup completed but auto-login failed');
            onComplete();
          }
        } else {
          // Authentication disabled, just complete setup
          onComplete();
        }
      } else {
        const errorData = await response.json() as { error: string };
        setError(errorData.error ?? 'Failed to setup authentication');
      }
    } catch (error) {
      console.error('Setup error:', error);
      setError('Failed to setup authentication');
    }
    
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-success" />
            <h2 className="text-2xl font-bold text-card-foreground">Setup Authentication</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground text-center mb-6">
            Set up authentication to secure your application. This will be required for future access.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="setup-username" className="block text-sm font-medium text-foreground mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="setup-username"
                          type="text"
                          placeholder="Choose a username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={isLoading}
                          className="pl-10"
                          required={enableAuth}
                          minLength={3}
                        />
              </div>
            </div>

            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="setup-password"
                          type="password"
                          placeholder="Choose a password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                          className="pl-10"
                          required={enableAuth}
                          minLength={6}
                        />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={isLoading}
                          className="pl-10"
                          required={enableAuth}
                          minLength={6}
                        />
              </div>
            </div>

            <div className="p-4 border border-border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Enable Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    {enableAuth 
                      ? 'Authentication will be required on every page load'
                      : 'Authentication will be optional (can be enabled later in settings)'
                    }
                  </p>
                </div>
                <Toggle
                  checked={enableAuth}
                  onCheckedChange={setEnableAuth}
                  disabled={isLoading}
                  label="Enable authentication"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-error/10 text-error-foreground border border-error/20 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isLoading || 
                (enableAuth && (!username.trim() || !password.trim() || !confirmPassword.trim()))
              }
              className="w-full"
            >
              {isLoading ? 'Setting Up...' : 'Complete Setup'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
