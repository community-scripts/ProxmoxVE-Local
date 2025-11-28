"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  HelpCircle,
  Server,
  Settings,
  RefreshCw,
  Clock,
  Package,
  HardDrive,
  FolderOpen,
  Search,
  Download,
  Lock,
  GitBranch,
  Archive,
} from "lucide-react";
import { useRegisterModal } from "./modal/ModalStackProvider";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

type HelpSection =
  | "server-settings"
  | "general-settings"
  | "auth-settings"
  | "sync-button"
  | "auto-sync"
  | "available-scripts"
  | "downloaded-scripts"
  | "installed-scripts"
  | "lxc-settings"
  | "update-system"
  | "repositories"
  | "backups";

export function HelpModal({
  isOpen,
  onClose,
  initialSection = "server-settings",
}: HelpModalProps) {
  useRegisterModal(isOpen, { id: "help-modal", allowEscape: true, onClose });
  const [activeSection, setActiveSection] = useState<HelpSection>(
    initialSection as HelpSection,
  );

  if (!isOpen) return null;

  const sections = [
    {
      id: "server-settings" as HelpSection,
      label: "Server Settings",
      icon: Server,
    },
    {
      id: "general-settings" as HelpSection,
      label: "General Settings",
      icon: Settings,
    },
    {
      id: "auth-settings" as HelpSection,
      label: "Authentication Settings",
      icon: Lock,
    },
    { id: "sync-button" as HelpSection, label: "Sync Button", icon: RefreshCw },
    { id: "auto-sync" as HelpSection, label: "Auto-Sync", icon: Clock },
    {
      id: "repositories" as HelpSection,
      label: "Repositories",
      icon: GitBranch,
    },
    {
      id: "available-scripts" as HelpSection,
      label: "Available Scripts",
      icon: Package,
    },
    {
      id: "downloaded-scripts" as HelpSection,
      label: "Downloaded Scripts",
      icon: HardDrive,
    },
    {
      id: "installed-scripts" as HelpSection,
      label: "Installed Scripts",
      icon: FolderOpen,
    },
    {
      id: "lxc-settings" as HelpSection,
      label: "LXC Settings",
      icon: Settings,
    },
    { id: "backups" as HelpSection, label: "LXC Backups", icon: Archive },
    {
      id: "update-system" as HelpSection,
      label: "Update System",
      icon: Download,
    },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "server-settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Server Settings
              </h3>
              <p className="text-muted-foreground mb-6">
                Manage your Proxmox VE servers and configure connection
                settings.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Adding PVE Servers
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Server Name:</strong> A friendly name to identify
                    your server
                  </li>
                  <li>
                    • <strong>IP Address:</strong> The IP address or hostname of
                    your PVE server
                  </li>
                  <li>
                    • <strong>Username:</strong> PVE user account (usually root
                    or a dedicated user)
                  </li>
                  <li>
                    • <strong>SSH Port:</strong> Default is 22, change if your
                    server uses a different port
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Authentication Types
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Password:</strong> Use username and password
                    authentication
                  </li>
                  <li>
                    • <strong>SSH Key:</strong> Use SSH key pair for secure
                    authentication
                  </li>
                </ul>
                <div className="bg-info/10 mt-3 rounded-md p-3">
                  <h5 className="text-info-foreground mb-2 font-medium">
                    SSH Key Features:
                  </h5>
                  <ul className="text-info/80 space-y-1 text-xs">
                    <li>
                      • <strong>Generate Key Pair:</strong> Create new SSH keys
                      automatically
                    </li>
                    <li>
                      • <strong>View Public Key:</strong> Copy public key for
                      server setup
                    </li>
                    <li>
                      • <strong>Persistent Storage:</strong> Keys are stored
                      securely on disk
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Server Color Coding
                </h4>
                <p className="text-muted-foreground text-sm">
                  Assign colors to servers for visual distinction throughout the
                  application. This helps identify which server you&apos;re
                  working with when managing scripts. This needs to be enabled
                  in the General Settings.
                </p>
              </div>
            </div>
          </div>
        );

      case "general-settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                General Settings
              </h3>
              <p className="text-muted-foreground mb-6">
                Configure application preferences and behavior.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Save Filters
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  When enabled, your script filter preferences (search terms,
                  categories, sorting) will be automatically saved and restored
                  when you return to the application.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Search queries are preserved</li>
                  <li>• Selected script types are remembered</li>
                  <li>• Sort preferences are maintained</li>
                  <li>• Category selections are saved</li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Server Color Coding
                </h4>
                <p className="text-muted-foreground text-sm">
                  Enable visual color coding for servers throughout the
                  application. This makes it easier to identify which server
                  you&apos;re working with.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  GitHub Integration
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Add a GitHub Personal Access Token to increase API rate limits
                  and improve performance.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • Bypasses GitHub&apos;s rate limiting for unauthenticated
                    requests
                  </li>
                  <li>• Improves script loading and syncing performance</li>
                  <li>
                    • Token is stored securely and only used for API calls
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "auth-settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Authentication Settings
              </h3>
              <p className="text-muted-foreground mb-6">
                Secure your application with username and password
                authentication and configure session management.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">Overview</h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Authentication settings allow you to secure access to your
                  application with username and password protection. Sessions
                  persist across page refreshes, so users don&apos;t need to log
                  in repeatedly.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• Set up username and password for app access</li>
                  <li>• Enable/disable authentication as needed</li>
                  <li>
                    • Credentials are stored securely using bcrypt hashing
                  </li>
                  <li>• Sessions use secure httpOnly cookies</li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Setting Up Authentication
                </h4>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>Navigate to General Settings → Authentication tab</li>
                  <li>Enter a username (minimum 3 characters)</li>
                  <li>Enter a password (minimum 6 characters)</li>
                  <li>Confirm your password</li>
                  <li>
                    Click &quot;Save Credentials&quot; to save your
                    authentication settings
                  </li>
                  <li>
                    Toggle &quot;Enable Authentication&quot; to activate
                    authentication
                  </li>
                </ol>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Session Duration
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Configure how long user sessions should last before requiring
                  re-authentication.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Configurable Duration:</strong> Set session
                    duration from 1 to 365 days
                  </li>
                  <li>
                    • <strong>Default Duration:</strong> Sessions default to 7
                    days if not configured
                  </li>
                  <li>
                    • <strong>Session Persistence:</strong> Sessions persist
                    across page refreshes and browser restarts
                  </li>
                  <li>
                    • <strong>New Logins Only:</strong> Duration changes apply
                    to new logins, not existing sessions
                  </li>
                </ul>
                <div className="bg-info/10 mt-3 rounded-md p-3">
                  <h5 className="text-info-foreground mb-2 font-medium">
                    How to Configure:
                  </h5>
                  <ol className="text-info/80 list-inside list-decimal space-y-1 text-xs">
                    <li>Go to General Settings → Authentication tab</li>
                    <li>Find the &quot;Session Duration&quot; section</li>
                    <li>Enter the number of days (1-365)</li>
                    <li>Click &quot;Save&quot; to apply the setting</li>
                  </ol>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Session Information
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  When authenticated, you can view your current session
                  information in the Authentication tab.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Time Until Expiration:</strong> See how much time
                    remains before your session expires
                  </li>
                  <li>
                    • <strong>Expiration Date:</strong> View the exact date and
                    time your session will expire
                  </li>
                  <li>
                    • <strong>Auto-Update:</strong> The expiration display
                    updates every minute
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Updating Credentials
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  You can change your username and password at any time from the
                  Authentication tab.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • Update username without changing password (leave password
                    fields empty)
                  </li>
                  <li>
                    • Change password by entering a new password and
                    confirmation
                  </li>
                  <li>• Both username and password can be updated together</li>
                  <li>• Changes take effect immediately after saving</li>
                </ul>
              </div>

              <div className="border-border bg-muted/50 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Security Features
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Password Hashing:</strong> Passwords are hashed
                    using bcrypt before storage
                  </li>
                  <li>
                    • <strong>Secure Cookies:</strong> Authentication tokens
                    stored in httpOnly cookies
                  </li>
                  <li>
                    • <strong>HTTPS in Production:</strong> Cookies are secure
                    (HTTPS-only) in production mode
                  </li>
                  <li>
                    • <strong>SameSite Protection:</strong> Cookies use strict
                    SameSite policy to prevent CSRF attacks
                  </li>
                  <li>
                    • <strong>JWT Tokens:</strong> Sessions use JSON Web Tokens
                    with expiration
                  </li>
                </ul>
              </div>

              <div className="border-border bg-warning/10 border-warning/20 rounded-lg border p-4">
                <h4 className="text-warning-foreground mb-2 font-medium">
                  ⚠️ Important Notes
                </h4>
                <ul className="text-warning/80 space-y-2 text-sm">
                  <li>
                    • <strong>First-Time Setup:</strong> You must complete the
                    initial setup before enabling authentication
                  </li>
                  <li>
                    • <strong>Session Duration:</strong> Changes to session
                    duration only affect new logins
                  </li>
                  <li>
                    • <strong>Logout:</strong> You can log out manually, which
                    immediately invalidates your session
                  </li>
                  <li>
                    • <strong>Lost Credentials:</strong> If you forget your
                    password, you&apos;ll need to reset it manually in the .env
                    file
                  </li>
                  <li>
                    • <strong>Disabling Auth:</strong> Disabling authentication
                    clears all credentials and allows unrestricted access
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "sync-button":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Sync Button
              </h3>
              <p className="text-muted-foreground mb-6">
                Synchronize script metadata from the ProxmoxVE GitHub
                repository.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  What Does Syncing Do?
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Updates Script Metadata:</strong> Downloads the
                    latest script information (JSON files)
                  </li>
                  <li>
                    • <strong>Refreshes Available Scripts:</strong> Updates the
                    list of scripts you can download
                  </li>
                  <li>
                    • <strong>Updates Categories:</strong> Refreshes script
                    categories and organization
                  </li>
                  <li>
                    • <strong>Checks for Updates:</strong> Identifies which
                    downloaded scripts have newer versions
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Important Notes
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Metadata Only:</strong> Syncing only updates
                    script information, not the actual script files
                  </li>
                  <li>
                    • <strong>No Downloads:</strong> Script files are downloaded
                    separately when you choose to install them
                  </li>
                  <li>
                    • <strong>Last Sync Time:</strong> Shows when the last
                    successful sync occurred
                  </li>
                  <li>
                    • <strong>Rate Limits:</strong> GitHub API limits may apply
                    without a personal access token
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  When to Sync
                </h4>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• When you want to see the latest available scripts</li>
                  <li>• To check for updates to your downloaded scripts</li>
                  <li>• If you notice scripts are missing or outdated</li>
                  <li>• After the ProxmoxVE repository has been updated</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "auto-sync":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Auto-Sync
              </h3>
              <p className="text-muted-foreground mb-6">
                Configure automatic synchronization of scripts with configurable
                intervals and notifications.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  What Is Auto-Sync?
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Auto-sync automatically synchronizes script metadata from the
                  ProxmoxVE GitHub repository at specified intervals, and
                  optionally downloads/updates scripts and sends notifications.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Automatic JSON Sync:</strong> Downloads latest
                    script metadata periodically
                  </li>
                  <li>
                    • <strong>Auto-Download:</strong> Automatically download new
                    scripts when available
                  </li>
                  <li>
                    • <strong>Auto-Update:</strong> Automatically update
                    existing scripts to newer versions
                  </li>
                  <li>
                    • <strong>Notifications:</strong> Send notifications when
                    sync completes
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Sync Intervals
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Predefined:</strong> Choose from common intervals
                    (15min, 30min, 1hour, 6hours, 12hours, 24hours)
                  </li>
                  <li>
                    • <strong>Custom Cron:</strong> Use cron expressions for
                    advanced scheduling
                  </li>
                  <li>
                    • <strong>Examples:</strong>
                    <ul className="mt-1 ml-4 space-y-1">
                      <li>
                        • <code>0 */6 * * *</code> - Every 6 hours
                      </li>
                      <li>
                        • <code>0 0 * * *</code> - Daily at midnight
                      </li>
                      <li>
                        • <code>0 9 * * 1</code> - Every Monday at 9 AM
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Auto-Download Options
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Auto-download new scripts:</strong> Automatically
                    download scripts that haven&apos;t been downloaded yet
                  </li>
                  <li>
                    • <strong>Auto-update existing scripts:</strong>{" "}
                    Automatically update scripts that have newer versions
                    available
                  </li>
                  <li>
                    • <strong>Selective Control:</strong> Enable/disable each
                    option independently
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Notifications (Apprise)
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Send notifications when sync completes using Apprise, which
                  supports 80+ notification services. If you want any other
                  notification service, please open an issue on the GitHub
                  repository.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Apprise Server:</strong>{" "}
                    <code>http://YOUR_APPRISE_SERVER/notify/apprise</code>
                  </li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  See the{" "}
                  <a
                    href="https://github.com/caronc/apprise"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Apprise documentation
                  </a>{" "}
                  for more supported services.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Setup Guide
                </h4>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>
                    Enable auto-sync in the General Settings → Auto-Sync tab
                  </li>
                  <li>Choose your sync interval (predefined or custom cron)</li>
                  <li>Configure auto-download options if desired</li>
                  <li>Set up notifications by adding Apprise URLs</li>
                  <li>
                    Test your notification setup using the &quot;Test
                    Notification&quot; button
                  </li>
                  <li>Save your settings to activate auto-sync</li>
                </ol>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Cron Expression Help
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Cron expressions have 5 fields: minute hour day month weekday
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Minute:</strong> 0-59 or *
                  </li>
                  <li>
                    • <strong>Hour:</strong> 0-23 or *
                  </li>
                  <li>
                    • <strong>Day:</strong> 1-31 or *
                  </li>
                  <li>
                    • <strong>Month:</strong> 1-12 or *
                  </li>
                  <li>
                    • <strong>Weekday:</strong> 0-6 (Sunday=0) or *
                  </li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  Use{" "}
                  <a
                    href="https://crontab.guru"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    crontab.guru
                  </a>{" "}
                  to test and learn cron expressions.
                </p>
              </div>
            </div>
          </div>
        );

      case "repositories":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Repositories
              </h3>
              <p className="text-muted-foreground mb-6">
                Manage script repositories (GitHub repositories) and configure
                which repositories to use for syncing scripts.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  What Are Repositories?
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Repositories are GitHub repositories that contain scripts and
                  their metadata. Scripts are organized by repositories,
                  allowing you to add custom repositories or manage which
                  repositories are active.
                </p>
                <p className="text-muted-foreground text-sm">
                  You can add custom repositories or manage existing ones in
                  General Settings &gt; Repositories.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Repository Structure
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  For a repository to work with this system, it must follow this
                  structure:
                </p>
                <ul className="text-muted-foreground ml-4 list-disc space-y-2 text-sm">
                  <li>
                    <strong>JSON files:</strong> Must be located in a{" "}
                    <code className="bg-muted rounded px-1">
                      frontend/public/json/
                    </code>{" "}
                    folder at the repository root. Each JSON file contains
                    metadata for a script (name, description, installation
                    methods, etc.).
                  </li>
                  <li>
                    <strong>Script files:</strong> Must be organized in
                    subdirectories:
                    <ul className="mt-1 ml-4 list-disc space-y-1">
                      <li>
                        <code className="bg-muted rounded px-1">ct/</code> -
                        Container scripts (LXC)
                      </li>
                      <li>
                        <code className="bg-muted rounded px-1">install/</code>{" "}
                        - Installation scripts
                      </li>
                      <li>
                        <code className="bg-muted rounded px-1">tools/</code> -
                        Tool scripts
                      </li>
                      <li>
                        <code className="bg-muted rounded px-1">vm/</code> -
                        Virtual machine scripts
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Default Repositories
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  The system comes with two default repositories that cannot be
                  deleted:
                </p>
                <ul className="text-muted-foreground ml-4 list-disc space-y-2 text-sm">
                  <li>
                    <strong>Main Repository (ProxmoxVE):</strong> The primary
                    repository at{" "}
                    <code className="bg-muted rounded px-1">
                      github.com/community-scripts/ProxmoxVE
                    </code>
                    . This is enabled by default and contains stable,
                    production-ready scripts. This repository cannot be deleted.
                  </li>
                  <li>
                    <strong>Dev Repository (ProxmoxVED):</strong> The
                    development/testing repository at{" "}
                    <code className="bg-muted rounded px-1">
                      github.com/community-scripts/ProxmoxVED
                    </code>
                    . This is disabled by default and contains experimental or
                    in-development scripts. This repository cannot be deleted.
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Enable vs Disable
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  You can enable or disable repositories to control which
                  scripts are available:
                </p>
                <ul className="text-muted-foreground ml-4 list-disc space-y-2 text-sm">
                  <li>
                    <strong>Enabled:</strong> Scripts from this repository are
                    included in the Available Scripts tab and will be synced
                    when you sync repositories. Enabled repositories are checked
                    for updates during sync operations.
                  </li>
                  <li>
                    <strong>Disabled:</strong> Scripts from this repository are
                    excluded from the Available Scripts tab and will not be
                    synced. Scripts already downloaded from a disabled
                    repository remain on your system but won&apos;t appear in
                    the list. Disabled repositories are not checked for updates.
                  </li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  <strong>Note:</strong> Disabling a repository doesn&apos;t
                  delete scripts you&apos;ve already downloaded from it. They
                  remain on your system but are hidden from the Available
                  Scripts list.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Repository Filter Buttons
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  When multiple repositories are enabled, filter buttons appear
                  in the filter bar on the Available Scripts tab.
                </p>
                <ul className="text-muted-foreground ml-4 list-disc space-y-2 text-sm">
                  <li>Each enabled repository gets its own filter button</li>
                  <li>
                    Click a repository button to toggle showing/hiding scripts
                    from that repository
                  </li>
                  <li>Active buttons are highlighted with primary styling</li>
                  <li>Inactive buttons have muted styling</li>
                  <li>
                    This allows you to quickly focus on scripts from specific
                    repositories
                  </li>
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">
                  <strong>Note:</strong> Filter buttons only appear when more
                  than one repository is enabled. If only one repository is
                  enabled, all scripts from that repository are shown by
                  default.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Adding Custom Repositories
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  You can add your own GitHub repositories to access custom
                  scripts:
                </p>
                <ol className="text-muted-foreground ml-4 list-decimal space-y-2 text-sm">
                  <li>Go to General Settings &gt; Repositories</li>
                  <li>
                    Enter the GitHub repository URL (format:{" "}
                    <code className="bg-muted rounded px-1">
                      https://github.com/owner/repo
                    </code>
                    )
                  </li>
                  <li>Choose whether to enable it immediately</li>
                  <li>Click &quot;Add Repository&quot;</li>
                </ol>
                <p className="text-muted-foreground mt-2 text-xs">
                  <strong>Important:</strong> Custom repositories must follow
                  the repository structure described above. Repositories that
                  don&apos;t follow this structure may not work correctly.
                </p>
              </div>
            </div>
          </div>
        );

      case "available-scripts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Available Scripts
              </h3>
              <p className="text-muted-foreground mb-6">
                Browse and discover scripts from the ProxmoxVE repository.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Browsing Scripts
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Category Sidebar:</strong> Filter scripts by
                    category (Storage, Network, Security, etc.)
                  </li>
                  <li>
                    • <strong>Search:</strong> Find scripts by name or
                    description
                  </li>
                  <li>
                    • <strong>View Modes:</strong> Switch between card and list
                    view
                  </li>
                  <li>
                    • <strong>Sorting:</strong> Sort by name or creation date
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Filtering Options
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Script Types:</strong> Filter by CT (Container) or
                    other script types
                  </li>
                  <li>
                    • <strong>Update Status:</strong> Show only scripts with
                    available updates
                  </li>
                  <li>
                    • <strong>Search Query:</strong> Search within script names
                    and descriptions
                  </li>
                  <li>
                    • <strong>Categories:</strong> Filter by specific script
                    categories
                  </li>
                  <li>
                    • <strong>Repositories:</strong> Filter scripts by
                    repository source (only shown when multiple repositories are
                    enabled). Click repository buttons to toggle visibility of
                    scripts from that repository.
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Script Actions
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>View Details:</strong> Click on a script to see
                    full information and documentation
                  </li>
                  <li>
                    • <strong>Download:</strong> Download script files to your
                    local system
                  </li>
                  <li>
                    • <strong>Install:</strong> Run scripts directly on your PVE
                    servers
                  </li>
                  <li>
                    • <strong>Preview:</strong> View script content before
                    downloading
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "downloaded-scripts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Downloaded Scripts
              </h3>
              <p className="text-muted-foreground mb-6">
                Manage scripts that have been downloaded to your local system.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  What Are Downloaded Scripts?
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  These are scripts that you&apos;ve downloaded from the
                  repository and are stored locally on your system.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • Script files are stored in your local scripts directory
                  </li>
                  <li>• You can run these scripts on your PVE servers</li>
                  <li>
                    • Scripts can be updated when newer versions are available
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Update Detection
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  The system automatically checks if newer versions of your
                  downloaded scripts are available.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • Scripts with updates available are marked with an update
                    indicator
                  </li>
                  <li>
                    • You can filter to show only scripts with available updates
                  </li>
                  <li>
                    • Update detection happens when you sync with the repository
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Managing Downloaded Scripts
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Update Scripts:</strong> Download the latest
                    version of a script
                  </li>
                  <li>
                    • <strong>View Details:</strong> See script information and
                    documentation
                  </li>
                  <li>
                    • <strong>Install/Run:</strong> Execute scripts on your PVE
                    servers
                  </li>
                  <li>
                    • <strong>Filter & Search:</strong> Use the same filtering
                    options as Available Scripts
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "installed-scripts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Installed Scripts
              </h3>
              <p className="text-muted-foreground mb-6">
                Track and manage scripts that are installed on your PVE servers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border bg-muted/50 border-primary/20 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 flex items-center gap-2 font-medium">
                  <Search className="h-4 w-4" />
                  Auto-Detection (Primary Feature)
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The system can automatically detect LXC containers that have
                  community-script tags on your PVE servers.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Automatic Discovery:</strong> Scans your PVE
                    servers for containers with community-script tags
                  </li>
                  <li>
                    • <strong>Container Detection:</strong> Identifies LXC
                    containers running Proxmox helper scripts
                  </li>
                  <li>
                    • <strong>Server Association:</strong> Links detected
                    scripts to the specific PVE server
                  </li>
                  <li>
                    • <strong>Bulk Import:</strong> Automatically creates
                    records for all detected scripts
                  </li>
                </ul>
                <div className="bg-primary/10 border-primary/20 mt-3 rounded-lg border p-3">
                  <p className="text-primary text-sm font-medium">
                    How Auto-Detection Works:
                  </p>
                  <ol className="text-muted-foreground mt-1 space-y-1 text-sm">
                    <li>1. Connects to your configured PVE servers</li>
                    <li>2. Scans LXC container configurations</li>
                    <li>3. Looks for containers with community-script tags</li>
                    <li>4. Creates installed script records automatically</li>
                  </ol>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Manual Script Management
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Add Scripts Manually:</strong> Create records for
                    scripts not auto-detected
                  </li>
                  <li>
                    • <strong>Edit Script Details:</strong> Update script names
                    and container IDs
                  </li>
                  <li>
                    • <strong>Delete Scripts:</strong> Remove scripts from
                    tracking
                  </li>
                  <li>
                    • <strong>Bulk Operations:</strong> Clean up old or invalid
                    script records
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Script Tracking Features
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Installation Status:</strong> Track success,
                    failure, or in-progress installations
                  </li>
                  <li>
                    • <strong>Server Association:</strong> Know which server
                    each script is installed on
                  </li>
                  <li>
                    • <strong>Container ID:</strong> Link scripts to specific
                    LXC containers
                  </li>
                  <li>
                    • <strong>Web UI Access:</strong> Track and access Web UI IP
                    addresses and ports
                  </li>
                  <li>
                    • <strong>Execution Logs:</strong> View output and logs from
                    script installations
                  </li>
                  <li>
                    • <strong>Filtering:</strong> Filter by server, status, or
                    search terms
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Managing Installed Scripts
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>View All Scripts:</strong> See all tracked scripts
                    across all servers
                  </li>
                  <li>
                    • <strong>Filter by Server:</strong> Show scripts for a
                    specific PVE server
                  </li>
                  <li>
                    • <strong>Filter by Status:</strong> Show successful,
                    failed, or in-progress installations
                  </li>
                  <li>
                    • <strong>Sort Options:</strong> Sort by name, container ID,
                    server, status, or date
                  </li>
                  <li>
                    • <strong>Update Scripts:</strong> Re-run or update existing
                    script installations
                  </li>
                </ul>
              </div>

              <div className="border-border bg-info/10 border-info/50 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Web UI Access{" "}
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Automatically detect and access Web UI interfaces for your
                  installed scripts.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Auto-Detection:</strong> Automatically detects Web
                    UI URLs from script installation output
                  </li>
                  <li>
                    • <strong>IP & Port Tracking:</strong> Stores and displays
                    Web UI IP addresses and ports
                  </li>
                  <li>
                    • <strong>One-Click Access:</strong> Click IP:port to open
                    Web UI in new tab
                  </li>
                  <li>
                    • <strong>Manual Detection:</strong> Re-detect IP using{" "}
                    <code>hostname -I</code> inside container
                  </li>
                  <li>
                    • <strong>Port Detection:</strong> Uses script metadata to
                    get correct port (e.g., actualbudget:5006)
                  </li>
                  <li>
                    • <strong>Editable Fields:</strong> Manually edit IP and
                    port values as needed
                  </li>
                </ul>
                <div className="bg-info/20 border-info/30 mt-3 rounded-lg border p-3">
                  <p className="text-info text-sm font-medium">
                    💡 How it works:
                  </p>
                  <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                    <li>
                      • Scripts automatically detect URLs like{" "}
                      <code>http://10.10.10.1:3000</code> during installation
                    </li>
                    <li>
                      • Re-detect button runs <code>hostname -I</code> inside
                      the container via SSH
                    </li>
                    <li>
                      • Port defaults to 80, but uses script metadata when
                      available
                    </li>
                    <li>
                      • Web UI buttons are disabled when container is stopped
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-border bg-accent/50 dark:bg-accent/20 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Actions Dropdown{" "}
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Clean interface with all actions organized in a dropdown menu.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Edit Button:</strong> Always visible for quick
                    script editing
                  </li>
                  <li>
                    • <strong>Actions Dropdown:</strong> Contains Update, Shell,
                    Open UI, Start/Stop, Destroy, Delete
                  </li>
                  <li>
                    • <strong>Smart Visibility:</strong> Dropdown only appears
                    when actions are available
                  </li>
                  <li>
                    • <strong>Color Coding:</strong> Start (green), Stop (red),
                    Update (cyan), Shell (gray), Open UI (blue)
                  </li>
                  <li>
                    • <strong>Auto-Close:</strong> Dropdown closes after
                    clicking any action
                  </li>
                  <li>
                    • <strong>Disabled States:</strong> Actions are disabled
                    when container is stopped
                  </li>
                </ul>
              </div>

              <div className="border-border bg-accent/50 dark:bg-accent/20 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Container Control
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Directly control LXC containers from the installed scripts
                  page via SSH.
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Start/Stop Button:</strong> Control container
                    state with <code>pct start/stop &lt;ID&gt;</code>
                  </li>
                  <li>
                    • <strong>Container Status:</strong> Real-time status
                    indicator (running/stopped/unknown)
                  </li>
                  <li>
                    • <strong>Destroy Button:</strong> Permanently remove LXC
                    container with <code>pct destroy &lt;ID&gt;</code>
                  </li>
                  <li>
                    • <strong>Confirmation Modals:</strong> Simple OK/Cancel for
                    start/stop, type container ID to confirm destroy
                  </li>
                  <li>
                    • <strong>SSH Execution:</strong> All commands executed
                    remotely via configured SSH connections
                  </li>
                </ul>
                <div className="bg-muted/30 dark:bg-muted/20 border-border mt-3 rounded-lg border p-3">
                  <p className="text-foreground text-sm font-medium">
                    ⚠️ Safety Features:
                  </p>
                  <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
                    <li>• Start/Stop actions require simple confirmation</li>
                    <li>
                      • Destroy action requires typing the container ID to
                      confirm
                    </li>
                    <li>
                      • All actions show loading states and error handling
                    </li>
                    <li>
                      • Only works with SSH scripts that have valid container
                      IDs
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "update-system":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                Update System
              </h3>
              <p className="text-muted-foreground mb-6">
                Keep your PVE Scripts Management application up to date with the
                latest features and improvements.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  What Does Updating Do?
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Downloads Latest Version:</strong> Fetches the
                    newest release from the GitHub repository
                  </li>
                  <li>
                    • <strong>Updates Application Files:</strong> Replaces
                    current files with the latest version
                  </li>
                  <li>
                    • <strong>Installs Dependencies:</strong> Updates Node.js
                    packages and dependencies
                  </li>
                  <li>
                    • <strong>Rebuilds Application:</strong> Compiles the
                    application with latest changes
                  </li>
                  <li>
                    • <strong>Restarts Server:</strong> Automatically restarts
                    the application server
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  How to Update
                </h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-foreground mb-2 font-medium">
                      Automatic Update (Recommended)
                    </h5>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>
                        • Click the &quot;Update Now&quot; button when an update
                        is available
                      </li>
                      <li>• The system will handle everything automatically</li>
                      <li>
                        • You&apos;ll see a progress overlay with update logs
                      </li>
                      <li>
                        • The page will reload automatically when complete
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-foreground mb-2 font-medium">
                      Manual Update (Advanced)
                    </h5>
                    <p className="text-muted-foreground mb-2 text-sm">
                      If automatic update fails, you can update manually:
                    </p>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                      <div className="text-muted-foreground">
                        # Navigate to the application directory
                      </div>
                      <div>cd $PVESCRIPTLOCAL_DIR</div>
                      <div className="text-muted-foreground">
                        # Pull latest changes
                      </div>
                      <div>git pull</div>
                      <div className="text-muted-foreground">
                        # Install dependencies
                      </div>
                      <div>npm install</div>
                      <div className="text-muted-foreground">
                        # Build the application
                      </div>
                      <div>npm run build</div>
                      <div className="text-muted-foreground">
                        # Start the application
                      </div>
                      <div>npm start</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Update Process
                </h4>
                <ol className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    <strong>1. Check for Updates:</strong> System automatically
                    checks GitHub for new releases
                  </li>
                  <li>
                    <strong>2. Download Update:</strong> Downloads the latest
                    release files
                  </li>
                  <li>
                    <strong>3. Backup Current Version:</strong> Creates backup
                    of current installation
                  </li>
                  <li>
                    <strong>4. Install New Version:</strong> Replaces files and
                    updates dependencies
                  </li>
                  <li>
                    <strong>5. Build Application:</strong> Compiles the updated
                    code
                  </li>
                  <li>
                    <strong>6. Restart Server:</strong> Stops old server and
                    starts new version
                  </li>
                  <li>
                    <strong>7. Reload Page:</strong> Automatically refreshes the
                    browser
                  </li>
                </ol>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Release Notes
                </h4>
                <p className="text-muted-foreground mb-2 text-sm">
                  Click the external link icon next to the update button to view
                  detailed release notes on GitHub.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>• See what&apos;s new in each version</li>
                  <li>• Read about bug fixes and improvements</li>
                  <li>• Check for any breaking changes</li>
                  <li>• View installation requirements</li>
                </ul>
              </div>

              <div className="border-border bg-muted/50 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Important Notes
                </h4>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Backup:</strong> Your data and settings are
                    preserved during updates
                  </li>
                  <li>
                    • <strong>Downtime:</strong> Brief downtime occurs during
                    the update process
                  </li>
                  <li>
                    • <strong>Compatibility:</strong> Updates maintain backward
                    compatibility with your data
                  </li>
                  <li>
                    • <strong>Rollback:</strong> If issues occur, you can
                    manually revert to previous version
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "lxc-settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                LXC Settings
              </h3>
              <p className="text-muted-foreground mb-6">
                Edit LXC container configuration files directly from the
                installed scripts interface. This feature allows you to modify
                container settings without manually accessing the Proxmox VE
                server.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">Overview</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The LXC Settings modal provides a user-friendly interface to
                  edit container configuration files. It parses common settings
                  into editable fields while preserving advanced configurations.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Common Settings:</strong> Edit basic container
                    parameters like cores, memory, network, and storage
                  </li>
                  <li>
                    • <strong>Advanced Settings:</strong> Raw text editing for
                    lxc.* entries and other advanced configurations
                  </li>
                  <li>
                    • <strong>Database Caching:</strong> Configurations are
                    cached locally for faster access
                  </li>
                  <li>
                    • <strong>Change Detection:</strong> Warns when cached
                    config differs from server version
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Common Settings Tab
                </h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-foreground mb-1 text-sm font-medium">
                      Basic Configuration
                    </h5>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>
                        • <strong>Architecture:</strong> Container architecture
                        (usually amd64)
                      </li>
                      <li>
                        • <strong>Cores:</strong> Number of CPU cores allocated
                        to the container
                      </li>
                      <li>
                        • <strong>Memory:</strong> RAM allocation in megabytes
                      </li>
                      <li>
                        • <strong>Swap:</strong> Swap space allocation in
                        megabytes
                      </li>
                      <li>
                        • <strong>Hostname:</strong> Container hostname
                      </li>
                      <li>
                        • <strong>OS Type:</strong> Operating system type (e.g.,
                        debian, ubuntu)
                      </li>
                      <li>
                        • <strong>Start on Boot:</strong> Whether to start
                        container automatically on host boot
                      </li>
                      <li>
                        • <strong>Unprivileged:</strong> Whether the container
                        runs in unprivileged mode
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-foreground mb-1 text-sm font-medium">
                      Network Configuration
                    </h5>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>
                        • <strong>IP Configuration:</strong> Choose between DHCP
                        or static IP assignment
                      </li>
                      <li>
                        • <strong>IP Address:</strong> Static IP with CIDR
                        notation (e.g., 10.10.10.164/24)
                      </li>
                      <li>
                        • <strong>Gateway:</strong> Network gateway for static
                        IP configuration
                      </li>
                      <li>
                        • <strong>Bridge:</strong> Network bridge interface
                        (usually vmbr0)
                      </li>
                      <li>
                        • <strong>MAC Address:</strong> Hardware address for the
                        network interface
                      </li>
                      <li>
                        • <strong>VLAN Tag:</strong> Optional VLAN tag for
                        network segmentation
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-foreground mb-1 text-sm font-medium">
                      Storage & Features
                    </h5>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>
                        • <strong>Root Filesystem:</strong> Storage location and
                        disk identifier
                      </li>
                      <li>
                        • <strong>Size:</strong> Disk size allocation (e.g., 4G,
                        8G)
                      </li>
                      <li>
                        • <strong>Features:</strong> Container capabilities
                        (keyctl, nesting, fuse)
                      </li>
                      <li>
                        • <strong>Tags:</strong> Comma-separated tags for
                        organization
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Advanced Settings Tab
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The Advanced Settings tab provides raw text editing for
                  configurations not covered in the Common Settings tab.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>lxc.* entries:</strong> Low-level LXC
                    configuration options
                  </li>
                  <li>
                    • <strong>Comments:</strong> Configuration file comments and
                    documentation
                  </li>
                  <li>
                    • <strong>Custom settings:</strong> Any other configuration
                    parameters
                  </li>
                  <li>
                    • <strong>Preservation:</strong> All content is preserved
                    when switching between tabs
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Saving Changes
                </h4>
                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    To save configuration changes, you must type the container
                    ID exactly as shown to confirm your changes.
                  </p>
                  <div className="bg-warning/10 border-warning/20 rounded-md border p-3">
                    <h5 className="text-warning-foreground mb-2 font-medium">
                      ⚠️ Important Warnings
                    </h5>
                    <ul className="text-warning/80 space-y-1 text-sm">
                      <li>
                        • Modifying LXC configuration can break your container
                      </li>
                      <li>
                        • Some changes may require container restart to take
                        effect
                      </li>
                      <li>
                        • Always backup your configuration before making changes
                      </li>
                      <li>
                        • Test changes in a non-production environment first
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Sync from Server
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The &quot;Sync from Server&quot; button allows you to refresh
                  the configuration from the actual server file, useful when:
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • Configuration was modified outside of this interface
                  </li>
                  <li>
                    • You want to discard local changes and get the latest
                    server version
                  </li>
                  <li>
                    • The warning banner indicates the cached config differs
                    from server
                  </li>
                  <li>
                    • You want to ensure you&apos;re working with the most
                    current configuration
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Database Caching
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  LXC configurations are cached in the database for improved
                  performance and offline access.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Automatic caching:</strong> Configs are cached
                    during auto-detection and after saves
                  </li>
                  <li>
                    • <strong>Cache expiration:</strong> Cached configs expire
                    after 5 minutes for freshness
                  </li>
                  <li>
                    • <strong>Change detection:</strong> Hash comparison detects
                    external modifications
                  </li>
                  <li>
                    • <strong>Manual sync:</strong> Always available via the
                    &quot;Sync from Server&quot; button
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "backups":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-foreground mb-4 text-xl font-semibold">
                LXC Backups
              </h3>
              <p className="text-muted-foreground mb-6">
                Create backups of your LXC containers before updates or
                on-demand. Backups are created using Proxmox VE&apos;s built-in
                backup system and can be stored on any backup-capable storage.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-border bg-primary/10 border-primary/20 rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">Overview</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The backup feature allows you to create snapshots of your LXC
                  containers before performing updates or at any time. Backups
                  are created using the{" "}
                  <code className="bg-muted rounded px-1">vzdump</code> command
                  via SSH and stored on your configured Proxmox storage.
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Pre-Update Backups:</strong> Automatically create
                    backups before updating containers
                  </li>
                  <li>
                    • <strong>Standalone Backups:</strong> Create backups
                    on-demand from the Actions menu
                  </li>
                  <li>
                    • <strong>Storage Selection:</strong> Choose from available
                    backup-capable storages
                  </li>
                  <li>
                    • <strong>Real-Time Progress:</strong> View backup progress
                    in the terminal output
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Backup Before Update
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  When updating an LXC container, you can choose to create a
                  backup first:
                </p>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>
                    Click the &quot;Update&quot; button for an installed script
                  </li>
                  <li>Confirm that you want to update the container</li>
                  <li>Choose whether to create a backup before updating</li>
                  <li>If yes, select a backup-capable storage from the list</li>
                  <li>
                    The backup will be created, then the update will proceed
                    automatically
                  </li>
                </ol>
                <div className="bg-info/10 mt-3 rounded-md p-3">
                  <h5 className="text-info-foreground mb-2 font-medium">
                    Backup Failure Handling
                  </h5>
                  <p className="text-info/80 text-xs">
                    If a backup fails, you&apos;ll be warned but can still
                    choose to proceed with the update. This ensures updates
                    aren&apos;t blocked by backup issues.
                  </p>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Standalone Backup
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Create a backup at any time without updating:
                </p>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>
                    Open the Actions dropdown menu for an installed script
                  </li>
                  <li>Click &quot;Backup&quot;</li>
                  <li>Select a backup-capable storage from the list</li>
                  <li>Watch the backup progress in the terminal output</li>
                </ol>
                <p className="text-muted-foreground mt-2 text-xs">
                  <strong>Note:</strong> Standalone backups are only available
                  for SSH-enabled scripts with valid container IDs.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Storage Selection
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  The system automatically discovers backup-capable storages
                  from your Proxmox servers:
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>Automatic Discovery:</strong> Storages are fetched
                    from{" "}
                    <code className="bg-muted rounded px-1">
                      /etc/pve/storage.cfg
                    </code>{" "}
                    on each server
                  </li>
                  <li>
                    • <strong>Backup-Capable Only:</strong> Only storages with
                    &quot;backup&quot; in their content are shown
                  </li>
                  <li>
                    • <strong>Cached Results:</strong> Storage lists are cached
                    for 1 hour to improve performance
                  </li>
                  <li>
                    • <strong>Manual Refresh:</strong> Use the &quot;Fetch
                    Storages&quot; button to refresh the list if needed
                  </li>
                </ul>
                <div className="bg-muted/30 mt-3 rounded-md p-3">
                  <h5 className="text-foreground mb-1 font-medium">
                    Storage Types
                  </h5>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li>
                      • <strong>Local:</strong> Backups stored on the Proxmox
                      host
                    </li>
                    <li>
                      • <strong>Storage:</strong> Network-attached storage (NFS,
                      CIFS, etc.)
                    </li>
                    <li>
                      • <strong>PBS:</strong> Proxmox Backup Server storage
                    </li>
                  </ul>
                </div>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Viewing Available Storages
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  You can view all storages for a server, including which ones
                  support backups:
                </p>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>Go to the Server Settings section</li>
                  <li>Find the server you want to check</li>
                  <li>
                    Click the &quot;View Storages&quot; button (database icon)
                  </li>
                  <li>See all storages with backup-capable ones highlighted</li>
                </ol>
                <p className="text-muted-foreground mt-2 text-xs">
                  This helps you identify which storages are available for
                  backups before starting a backup operation.
                </p>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Backup Process
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  When a backup is initiated, the following happens:
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>
                    • <strong>SSH Connection:</strong> Connects to the Proxmox
                    server via SSH
                  </li>
                  <li>
                    • <strong>Command Execution:</strong> Runs{" "}
                    <code className="bg-muted rounded px-1">
                      vzdump &lt;CTID&gt; --storage &lt;STORAGE&gt; --mode
                      snapshot
                    </code>
                  </li>
                  <li>
                    • <strong>Real-Time Output:</strong> Backup progress is
                    streamed to the terminal
                  </li>
                  <li>
                    • <strong>Completion:</strong> Backup completes and shows
                    success/failure status
                  </li>
                  <li>
                    • <strong>Sequential Execution:</strong> If part of update
                    flow, update proceeds after backup completes
                  </li>
                </ul>
              </div>

              <div className="border-border bg-warning/10 border-warning/20 rounded-lg border p-4">
                <h4 className="text-warning-foreground mb-2 font-medium">
                  ⚠️ Important Notes
                </h4>
                <ul className="text-warning/80 space-y-2 text-sm">
                  <li>
                    • <strong>Storage Requirements:</strong> Ensure you have
                    sufficient storage space for backups
                  </li>
                  <li>
                    • <strong>Backup Duration:</strong> Backup time depends on
                    container size and storage speed
                  </li>
                  <li>
                    • <strong>Snapshot Mode:</strong> Backups use snapshot mode,
                    which requires sufficient disk space
                  </li>
                  <li>
                    • <strong>SSH Access:</strong> Backups require valid SSH
                    credentials configured for the server
                  </li>
                  <li>
                    • <strong>Container State:</strong> Containers can be
                    running or stopped during backup
                  </li>
                </ul>
              </div>

              <div className="border-border rounded-lg border p-4">
                <h4 className="text-foreground mb-2 font-medium">
                  Backup Storage Cache
                </h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Storage information is cached to improve performance:
                </p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    • <strong>Cache Duration:</strong> Storage lists are cached
                    for 1 hour
                  </li>
                  <li>
                    • <strong>Automatic Refresh:</strong> Cache expires and
                    refreshes automatically
                  </li>
                  <li>
                    • <strong>Manual Refresh:</strong> Use &quot;Fetch
                    Storages&quot; button to force refresh
                  </li>
                  <li>
                    • <strong>Per-Server Cache:</strong> Each server has its own
                    cached storage list
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="bg-card max-h-[95vh] w-full max-w-6xl overflow-hidden rounded-lg shadow-xl sm:max-h-[90vh]">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4 sm:p-6">
          <h2 className="text-card-foreground flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <HelpCircle className="h-6 w-6" />
            Help & Documentation
          </h2>
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

        <div className="flex h-[calc(95vh-120px)] sm:h-[calc(90vh-140px)]">
          {/* Sidebar Navigation */}
          <div className="border-border bg-muted/30 w-64 overflow-y-auto border-r">
            <nav className="space-y-2 p-4">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    variant={activeSection === section.id ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 text-left"
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
