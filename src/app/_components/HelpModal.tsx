'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { HelpCircle, Server, Settings, RefreshCw, Package, HardDrive, FolderOpen, Search, Download } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

type HelpSection = 'server-settings' | 'general-settings' | 'sync-button' | 'available-scripts' | 'downloaded-scripts' | 'installed-scripts' | 'update-system';

export function HelpModal({ isOpen, onClose, initialSection = 'server-settings' }: HelpModalProps) {
  const [activeSection, setActiveSection] = useState<HelpSection>(initialSection as HelpSection);

  if (!isOpen) return null;

  const sections = [
    { id: 'server-settings' as HelpSection, label: 'Server Settings', icon: Server },
    { id: 'general-settings' as HelpSection, label: 'General Settings', icon: Settings },
    { id: 'sync-button' as HelpSection, label: 'Sync Button', icon: RefreshCw },
    { id: 'available-scripts' as HelpSection, label: 'Available Scripts', icon: Package },
    { id: 'downloaded-scripts' as HelpSection, label: 'Downloaded Scripts', icon: HardDrive },
    { id: 'installed-scripts' as HelpSection, label: 'Installed Scripts', icon: FolderOpen },
    { id: 'update-system' as HelpSection, label: 'Update System', icon: Download },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'server-settings':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Server Settings</h3>
              <p className="text-muted-foreground mb-6">
                Manage your Proxmox VE servers and configure connection settings.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Adding PVE Servers</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Server Name:</strong> A friendly name to identify your server</li>
                  <li>• <strong>IP Address:</strong> The IP address or hostname of your PVE server</li>
                  <li>• <strong>Username:</strong> PVE user account (usually root or a dedicated user)</li>
                  <li>• <strong>SSH Port:</strong> Default is 22, change if your server uses a different port</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Authentication Types</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Password:</strong> Use username and password authentication</li>
                  <li>• <strong>SSH Key:</strong> Use SSH key pair for secure authentication</li>
                  <li>• <strong>Both:</strong> Try SSH key first, fallback to password if needed</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Server Color Coding</h4>
                <p className="text-sm text-muted-foreground">
                  Assign colors to servers for visual distinction throughout the application. 
                  This helps identify which server you&apos;re working with when managing scripts.
                  This needs to be enabled in the General Settings.
                </p>
              </div>
            </div>
          </div>
        );

      case 'general-settings':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">General Settings</h3>
              <p className="text-muted-foreground mb-6">
                Configure application preferences and behavior.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Save Filters</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  When enabled, your script filter preferences (search terms, categories, sorting) 
                  will be automatically saved and restored when you return to the application.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Search queries are preserved</li>
                  <li>• Selected script types are remembered</li>
                  <li>• Sort preferences are maintained</li>
                  <li>• Category selections are saved</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Server Color Coding</h4>
                <p className="text-sm text-muted-foreground">
                  Enable visual color coding for servers throughout the application. 
                  This makes it easier to identify which server you&apos;re working with.
                </p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">GitHub Integration</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Add a GitHub Personal Access Token to increase API rate limits and improve performance.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Bypasses GitHub&apos;s rate limiting for unauthenticated requests</li>
                  <li>• Improves script loading and syncing performance</li>
                  <li>• Token is stored securely and only used for API calls</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Authentication</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Secure your application with username and password authentication.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Set up username and password for app access</li>
                  <li>• Enable/disable authentication as needed</li>
                  <li>• Credentials are stored securely</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'sync-button':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Sync Button</h3>
              <p className="text-muted-foreground mb-6">
                Synchronize script metadata from the ProxmoxVE GitHub repository.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">What Does Syncing Do?</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Updates Script Metadata:</strong> Downloads the latest script information (JSON files)</li>
                  <li>• <strong>Refreshes Available Scripts:</strong> Updates the list of scripts you can download</li>
                  <li>• <strong>Updates Categories:</strong> Refreshes script categories and organization</li>
                  <li>• <strong>Checks for Updates:</strong> Identifies which downloaded scripts have newer versions</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Important Notes</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Metadata Only:</strong> Syncing only updates script information, not the actual script files</li>
                  <li>• <strong>No Downloads:</strong> Script files are downloaded separately when you choose to install them</li>
                  <li>• <strong>Last Sync Time:</strong> Shows when the last successful sync occurred</li>
                  <li>• <strong>Rate Limits:</strong> GitHub API limits may apply without a personal access token</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">When to Sync</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• When you want to see the latest available scripts</li>
                  <li>• To check for updates to your downloaded scripts</li>
                  <li>• If you notice scripts are missing or outdated</li>
                  <li>• After the ProxmoxVE repository has been updated</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'available-scripts':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Available Scripts</h3>
              <p className="text-muted-foreground mb-6">
                Browse and discover scripts from the ProxmoxVE repository.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Browsing Scripts</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Category Sidebar:</strong> Filter scripts by category (Storage, Network, Security, etc.)</li>
                  <li>• <strong>Search:</strong> Find scripts by name or description</li>
                  <li>• <strong>View Modes:</strong> Switch between card and list view</li>
                  <li>• <strong>Sorting:</strong> Sort by name or creation date</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Filtering Options</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Script Types:</strong> Filter by CT (Container) or other script types</li>
                  <li>• <strong>Update Status:</strong> Show only scripts with available updates</li>
                  <li>• <strong>Search Query:</strong> Search within script names and descriptions</li>
                  <li>• <strong>Categories:</strong> Filter by specific script categories</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Script Actions</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>View Details:</strong> Click on a script to see full information and documentation</li>
                  <li>• <strong>Download:</strong> Download script files to your local system</li>
                  <li>• <strong>Install:</strong> Run scripts directly on your PVE servers</li>
                  <li>• <strong>Preview:</strong> View script content before downloading</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'downloaded-scripts':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Downloaded Scripts</h3>
              <p className="text-muted-foreground mb-6">
                Manage scripts that have been downloaded to your local system.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">What Are Downloaded Scripts?</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  These are scripts that you&apos;ve downloaded from the repository and are stored locally on your system.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Script files are stored in your local scripts directory</li>
                  <li>• You can run these scripts on your PVE servers</li>
                  <li>• Scripts can be updated when newer versions are available</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Update Detection</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  The system automatically checks if newer versions of your downloaded scripts are available.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Scripts with updates available are marked with an update indicator</li>
                  <li>• You can filter to show only scripts with available updates</li>
                  <li>• Update detection happens when you sync with the repository</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Managing Downloaded Scripts</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Update Scripts:</strong> Download the latest version of a script</li>
                  <li>• <strong>View Details:</strong> See script information and documentation</li>
                  <li>• <strong>Install/Run:</strong> Execute scripts on your PVE servers</li>
                  <li>• <strong>Filter & Search:</strong> Use the same filtering options as Available Scripts</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'installed-scripts':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Installed Scripts</h3>
              <p className="text-muted-foreground mb-6">
                Track and manage scripts that are installed on your PVE servers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg bg-muted/50 border-primary/20">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Auto-Detection (Primary Feature)
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The system can automatically detect LXC containers that have community-script tags on your PVE servers.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Automatic Discovery:</strong> Scans your PVE servers for containers with community-script tags</li>
                  <li>• <strong>Container Detection:</strong> Identifies LXC containers running Proxmox helper scripts</li>
                  <li>• <strong>Server Association:</strong> Links detected scripts to the specific PVE server</li>
                  <li>• <strong>Bulk Import:</strong> Automatically creates records for all detected scripts</li>
                </ul>
                <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-primary">How Auto-Detection Works:</p>
                  <ol className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>1. Connects to your configured PVE servers</li>
                    <li>2. Scans LXC container configurations</li>
                    <li>3. Looks for containers with community-script tags</li>
                    <li>4. Creates installed script records automatically</li>
                  </ol>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Manual Script Management</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Add Scripts Manually:</strong> Create records for scripts not auto-detected</li>
                  <li>• <strong>Edit Script Details:</strong> Update script names and container IDs</li>
                  <li>• <strong>Delete Scripts:</strong> Remove scripts from tracking</li>
                  <li>• <strong>Bulk Operations:</strong> Clean up old or invalid script records</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Script Tracking Features</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Installation Status:</strong> Track success, failure, or in-progress installations</li>
                  <li>• <strong>Server Association:</strong> Know which server each script is installed on</li>
                  <li>• <strong>Container ID:</strong> Link scripts to specific LXC containers</li>
                  <li>• <strong>Web UI Access:</strong> Track and access Web UI IP addresses and ports</li>
                  <li>• <strong>Execution Logs:</strong> View output and logs from script installations</li>
                  <li>• <strong>Filtering:</strong> Filter by server, status, or search terms</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Managing Installed Scripts</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>View All Scripts:</strong> See all tracked scripts across all servers</li>
                  <li>• <strong>Filter by Server:</strong> Show scripts for a specific PVE server</li>
                  <li>• <strong>Filter by Status:</strong> Show successful, failed, or in-progress installations</li>
                  <li>• <strong>Sort Options:</strong> Sort by name, container ID, server, status, or date</li>
                  <li>• <strong>Update Scripts:</strong> Re-run or update existing script installations</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg bg-blue-900/20 border-blue-700/50">
                <h4 className="font-medium text-foreground mb-2">Web UI Access </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Automatically detect and access Web UI interfaces for your installed scripts.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Auto-Detection:</strong> Automatically detects Web UI URLs from script installation output</li>
                  <li>• <strong>IP & Port Tracking:</strong> Stores and displays Web UI IP addresses and ports</li>
                  <li>• <strong>One-Click Access:</strong> Click IP:port to open Web UI in new tab</li>
                  <li>• <strong>Manual Detection:</strong> Re-detect IP using <code>hostname -I</code> inside container</li>
                  <li>• <strong>Port Detection:</strong> Uses script metadata to get correct port (e.g., actualbudget:5006)</li>
                  <li>• <strong>Editable Fields:</strong> Manually edit IP and port values as needed</li>
                </ul>
                <div className="mt-3 p-3 bg-blue-900/30 rounded-lg border border-blue-700/30">
                  <p className="text-sm font-medium text-blue-300">💡 How it works:</p>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Scripts automatically detect URLs like <code>http://10.10.10.1:3000</code> during installation</li>
                    <li>• Re-detect button runs <code>hostname -I</code> inside the container via SSH</li>
                    <li>• Port defaults to 80, but uses script metadata when available</li>
                    <li>• Web UI buttons are disabled when container is stopped</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg bg-accent/50 dark:bg-accent/20">
                <h4 className="font-medium text-foreground mb-2">Actions Dropdown </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Clean interface with all actions organized in a dropdown menu.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Edit Button:</strong> Always visible for quick script editing</li>
                  <li>• <strong>Actions Dropdown:</strong> Contains Update, Shell, Open UI, Start/Stop, Destroy, Delete</li>
                  <li>• <strong>Smart Visibility:</strong> Dropdown only appears when actions are available</li>
                  <li>• <strong>Color Coding:</strong> Start (green), Stop (red), Update (cyan), Shell (gray), Open UI (blue)</li>
                  <li>• <strong>Auto-Close:</strong> Dropdown closes after clicking any action</li>
                  <li>• <strong>Disabled States:</strong> Actions are disabled when container is stopped</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg bg-accent/50 dark:bg-accent/20">
                <h4 className="font-medium text-foreground mb-2">Container Control</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Directly control LXC containers from the installed scripts page via SSH.
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Start/Stop Button:</strong> Control container state with <code>pct start/stop &lt;ID&gt;</code></li>
                  <li>• <strong>Container Status:</strong> Real-time status indicator (running/stopped/unknown)</li>
                  <li>• <strong>Destroy Button:</strong> Permanently remove LXC container with <code>pct destroy &lt;ID&gt;</code></li>
                  <li>• <strong>Confirmation Modals:</strong> Simple OK/Cancel for start/stop, type container ID to confirm destroy</li>
                  <li>• <strong>SSH Execution:</strong> All commands executed remotely via configured SSH connections</li>
                </ul>
                <div className="mt-3 p-3 bg-muted/30 dark:bg-muted/20 rounded-lg border border-border">
                  <p className="text-sm font-medium text-foreground">⚠️ Safety Features:</p>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Start/Stop actions require simple confirmation</li>
                    <li>• Destroy action requires typing the container ID to confirm</li>
                    <li>• All actions show loading states and error handling</li>
                    <li>• Only works with SSH scripts that have valid container IDs</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'update-system':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Update System</h3>
              <p className="text-muted-foreground mb-6">
                Keep your PVE Scripts Management application up to date with the latest features and improvements.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">What Does Updating Do?</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Downloads Latest Version:</strong> Fetches the newest release from the GitHub repository</li>
                  <li>• <strong>Updates Application Files:</strong> Replaces current files with the latest version</li>
                  <li>• <strong>Installs Dependencies:</strong> Updates Node.js packages and dependencies</li>
                  <li>• <strong>Rebuilds Application:</strong> Compiles the application with latest changes</li>
                  <li>• <strong>Restarts Server:</strong> Automatically restarts the application server</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">How to Update</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-foreground mb-2">Automatic Update (Recommended)</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Click the &quot;Update Now&quot; button when an update is available</li>
                      <li>• The system will handle everything automatically</li>
                      <li>• You&apos;ll see a progress overlay with update logs</li>
                      <li>• The page will reload automatically when complete</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-foreground mb-2">Manual Update (Advanced)</h5>
                    <p className="text-sm text-muted-foreground mb-2">If automatic update fails, you can update manually:</p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                      <div className="text-muted-foreground"># Navigate to the application directory</div>
                      <div>cd $PVESCRIPTLOCAL_DIR</div>
                      <div className="text-muted-foreground"># Pull latest changes</div>
                      <div>git pull</div>
                      <div className="text-muted-foreground"># Install dependencies</div>
                      <div>npm install</div>
                      <div className="text-muted-foreground"># Build the application</div>
                      <div>npm run build</div>
                      <div className="text-muted-foreground"># Start the application</div>
                      <div>npm start</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Update Process</h4>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li><strong>1. Check for Updates:</strong> System automatically checks GitHub for new releases</li>
                  <li><strong>2. Download Update:</strong> Downloads the latest release files</li>
                  <li><strong>3. Backup Current Version:</strong> Creates backup of current installation</li>
                  <li><strong>4. Install New Version:</strong> Replaces files and updates dependencies</li>
                  <li><strong>5. Build Application:</strong> Compiles the updated code</li>
                  <li><strong>6. Restart Server:</strong> Stops old server and starts new version</li>
                  <li><strong>7. Reload Page:</strong> Automatically refreshes the browser</li>
                </ol>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Release Notes</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Click the external link icon next to the update button to view detailed release notes on GitHub.
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• See what&apos;s new in each version</li>
                  <li>• Read about bug fixes and improvements</li>
                  <li>• Check for any breaking changes</li>
                  <li>• View installation requirements</li>
                </ul>
              </div>

              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <h4 className="font-medium text-foreground mb-2">Important Notes</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• <strong>Backup:</strong> Your data and settings are preserved during updates</li>
                  <li>• <strong>Downtime:</strong> Brief downtime occurs during the update process</li>
                  <li>• <strong>Compatibility:</strong> Updates maintain backward compatibility with your data</li>
                  <li>• <strong>Rollback:</strong> If issues occur, you can manually revert to previous version</li>
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
    <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <h2 className="text-xl sm:text-2xl font-bold text-card-foreground flex items-center gap-2">
            <HelpCircle className="w-6 h-6" />
            Help & Documentation
          </h2>
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

        <div className="flex h-[calc(95vh-120px)] sm:h-[calc(90vh-140px)]">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-border bg-muted/30 overflow-y-auto">
            <nav className="p-4 space-y-2">
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
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
