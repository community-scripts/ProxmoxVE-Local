"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Toggle } from "./ui/toggle";
import { Lock, User, Shield, AlertCircle } from "lucide-react";
import { useRegisterModal, ModalPortal } from "./modal/ModalStackProvider";

interface SetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SetupModal({ isOpen, onComplete }: SetupModalProps) {
  const zIndex = useRegisterModal(isOpen, {
    id: "setup-modal",
    allowEscape: true,
    onClose: () => null,
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enableAuth, setEnableAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Only validate passwords if authentication is enabled
    if (enableAuth && password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: enableAuth ? username : undefined,
          password: enableAuth ? password : undefined,
          enabled: enableAuth,
        }),
      });

      if (response.ok) {
        // If authentication is enabled, automatically log in the user
        if (enableAuth) {
          const loginResponse = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          });

          if (loginResponse.ok) {
            // Login successful, complete setup
            onComplete();
          } else {
            // Setup succeeded but login failed, still complete setup
            console.warn("Setup completed but auto-login failed");
            onComplete();
          }
        } else {
          // Authentication disabled, just complete setup
          onComplete();
        }
      } else {
        const errorData = (await response.json()) as { error: string };
        setError(errorData.error ?? "Failed to setup authentication");
      }
    } catch (error) {
      console.error("Setup error:", error);
      setError("Failed to setup authentication");
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        style={{ zIndex }}
      >
        <div className="bg-card border-border w-full max-w-md rounded-lg border shadow-xl">
          {/* Header */}
          <div className="border-border flex items-center justify-center border-b p-6">
            <div className="flex items-center gap-3">
              <Shield className="text-success h-8 w-8" />
              <h2 className="text-card-foreground text-2xl font-bold">
                Setup Authentication
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-muted-foreground mb-6 text-center">
              Set up authentication to secure your application. This will be
              required for future access.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="setup-username"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
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
                <label
                  htmlFor="setup-password"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
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
                <label
                  htmlFor="confirm-password"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
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

              <div className="border-border bg-muted/30 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-foreground mb-1 font-medium">
                      Enable Authentication
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      {enableAuth
                        ? "Authentication will be required on every page load"
                        : "Authentication will be optional (can be enabled later in settings)"}
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
                <div className="bg-error/10 text-error-foreground border-error/20 flex items-center gap-2 rounded-md border p-3">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  isLoading ||
                  (enableAuth &&
                    (!username.trim() ||
                      !password.trim() ||
                      !confirmPassword.trim()))
                }
                className="w-full"
              >
                {isLoading ? "Setting Up..." : "Complete Setup"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
