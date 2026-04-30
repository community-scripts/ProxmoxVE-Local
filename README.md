# PVE Scripts Local 🚀

A modern web-based management interface for Proxmox VE (PVE) helper scripts. This tool provides a user-friendly way to discover, download, and execute community-sourced Proxmox scripts locally with real-time terminal output streaming. No more need for curl -> bash calls, it all happens in your enviroment.


<img width="1725" height="1088" alt="image" src="https://github.com/user-attachments/assets/75323765-7375-4346-a41e-08d219275248" />



## 🎯 Deployment Options

This application can be deployed in multiple ways to suit different environments:

- **📦 Debian LXC Container**: Deploy inside a Debian LXC container for better isolation
- **🔧 Helper Script**: Use the automated helper script for easy setup

All deployment methods provide the same functionality and web interface.

## 🌟 Features

- **Web-based Interface**: Modern React/Next.js frontend with real-time terminal emulation
- **Script Discovery**: Browse and search through community Proxmox scripts from GitHub
- **One-Click Execution**: Run scripts directly from the web interface with live output
- **Real-time Terminal**: Full terminal emulation with xterm.js for interactive script execution
- **Script Management**: Download, update, and manage local script collections
- **Security**: Sandboxed script execution with path validation and time limits
- **Database Integration**: PostgreSQL backend for script metadata and execution history
- **WebSocket Communication**: Real-time bidirectional communication for script execution
- 

## 🏗️ Architecture

### Frontend
- **Next.js 15** with React 19
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **xterm.js** for terminal emulation
- **tRPC** for type-safe API communication

### Backend
- **Node.js** server with WebSocket support
- **WebSocket Server** for real-time script execution
- **Script Downloader Service** for GitHub integration

### Scripts
- **Core Functions**: Shared utilities and build functions
- **Container Scripts**: Pre-configured LXC container setups
- **Installation Scripts**: System setup and configuration tools

### Database
- **SQLite Database**: Local database stored at `data/settings.db`
- **Server Management**: Stores Proxmox server configurations and credentials
- **Automatic Setup**: Database and tables are created automatically on first run
- **Data Persistence**: Settings persist across application restarts

## 📋 Prerequisites

### For All Deployment Methods
- **Node.js** 22+ and npm
- **Git** for cloning the repository
- **Proxmox VE environment** (host or access to Proxmox cluster)
- **SQLite** (included with Node.js better-sqlite3 package)


### For Debian LXC Container Installation
- **Debian LXC container** (Debian 11+ recommended)
- **build-essentials**: `apt install build-essential`
- Container with sufficient resources (2GB RAM, 4GB storage minimum)
- Network access from container to Proxmox host
- Optional: Privileged container for full Proxmox integration

## 🚀 Installation

Choose the installation method that best fits your environment:

### Option 1: Debian LXC Container Installation

For better isolation and security, you can run PVE Scripts Local inside a Debian LXC container:

#### Step 1: Create Debian LXC Container

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/debian.sh)"
```

#### Step 2: Install Dependencies in Container
```bash
# Enter the container
pct enter 100

# Update and install dependencies
apt update && apt install -y build-essential git curl

# Install Node.js 24.x
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
```

#### Step 3: Clone and Setup Application
```bash
# Clone the repository
git clone https://github.com/community-scripts/ProxmoxVE-Local.git /opt/PVESciptslocal
cd /opt/PVESciptslocal

# Install dependencies and build
npm install
cp .env.example .env
npm run build

# Create database directory
mkdir -p data
chmod 755 data
```

#### Step 4: Start the Application
```bash
# Start in production mode
npm start

# Or create a systemd service (optional)
# Create systemd service for easy management
```

**Access the application:**
- 🌐 Container IP: `http://<CONTAINER_IP>:3000`
- 🔧 Container management: `pct start 100`, `pct stop 100`, `pct status 100`

### Option 2: Use the helper script

This creates the LXC and installs the APP for you.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/pve-scripts-local.sh)"
```

## 🎯 Usage

### 1. Access the Web Interface

The web interface is accessible regardless of your deployment method:

- **LXC Container Installation**: `http://<CONTAINER_IP>:3000`
- **Custom Installation**: `http://<YOUR_IP>:3000`

### 2. Service Management

#### For helper-script installations (systemd service):
```bash
# Start the service
systemctl start pvescriptslocal

# Stop the service
systemctl stop pvescriptslocal

# Check service status
systemctl status pvescriptslocal

# Enable auto-start on boot
systemctl enable pvescriptslocal

# View service logs
journalctl -u pvescriptslocal -f
```


#### For manual installations:
```bash
# Start application
npm start

# Development mode
npm run dev:server

# Build for production
npm run build
```

### 3. Browse Available Scripts

- The main page displays a grid of available Proxmox scripts
- Use the search functionality to find specific scripts
- Scripts are categorized by type (containers, installations, etc.)

### 4. Download Scripts

- Click on any script card to view details
- Use the "Download" button to fetch scripts from the ProxmoxVE GitHub
- Downloaded scripts are stored locally in the `scripts/` directory

### 5. Execute Scripts

- Click "Run Script" on any downloaded script
- A terminal window will open with real-time output
- Interact with the script through the web terminal
- Use the close button to stop execution

### 6. Script Management

- View script execution history
- Update scripts to latest versions
- Manage local script collections

### 7. Database Management

The application uses SQLite for storing server configurations:

- **Database Location**: `data/settings.db`
- **Automatic Creation**: Database and tables are created on first run
- **Server Storage**: Proxmox server credentials and configurations
- **Backup**: Copy `data/settings.db` to backup your server configurations
- **Reset**: Delete `data/settings.db` to reset all server configurations

## 📖 Feature Guide

This section provides detailed information about the application's key features and how to use them effectively.

### Server Settings

Manage your Proxmox VE servers and configure connection settings.

**Adding PVE Servers:**
- **Server Name**: A friendly name to identify your server
- **IP Address**: The IP address or hostname of your PVE server
- **Username**: PVE user account (usually root or a dedicated user)
- **SSH Port**: Default is 22, change if your server uses a different port

**Authentication Types:**
- **Password**: Use username and password authentication
- **SSH Key**: Use SSH key pair for secure authentication
- **Both**: Try SSH key first, fallback to password if needed

**Server Color Coding:**
Assign colors to servers for visual distinction throughout the application. This helps identify which server you're working with when managing scripts. This needs to be enabled in the General Settings.

### General Settings

Configure application preferences and behavior.

**Save Filters:**
When enabled, your script filter preferences (search terms, categories, sorting) will be automatically saved and restored when you return to the application:
- Search queries are preserved
- Selected script types are remembered
- Sort preferences are maintained
- Category selections are saved

**Server Color Coding:**
Enable visual color coding for servers throughout the application. This makes it easier to identify which server you're working with.

**GitHub Integration:**
Add a GitHub Personal Access Token to increase API rate limits and improve performance:
- Bypasses GitHub's rate limiting for unauthenticated requests
- Improves script loading and syncing performance
- Token is stored securely and only used for API calls

**Authentication:**
Secure your application with username and password authentication:
- Set up username and password for app access
- Enable/disable authentication as needed
- Credentials are stored securely

### Sync Button

Synchronize script metadata from the ProxmoxVE GitHub repository.

**What Does Syncing Do?**
- **Updates Script Metadata**: Downloads the latest script information (JSON files)
- **Refreshes Available Scripts**: Updates the list of scripts you can download
- **Updates Categories**: Refreshes script categories and organization
- **Checks for Updates**: Identifies which downloaded scripts have newer versions

**Important Notes:**
- **Metadata Only**: Syncing only updates script information, not the actual script files
- **No Downloads**: Script files are downloaded separately when you choose to install them
- **Last Sync Time**: Shows when the last successful sync occurred
- **Rate Limits**: GitHub API limits may apply without a personal access token

**When to Sync:**
- When you want to see the latest available scripts
- To check for updates to your downloaded scripts
- If you notice scripts are missing or outdated
- After the ProxmoxVE repository has been updated

### Available Scripts

Browse and discover scripts from the ProxmoxVE repository.

**Browsing Scripts:**
- **Category Sidebar**: Filter scripts by category (Storage, Network, Security, etc.)
- **Search**: Find scripts by name or description
- **View Modes**: Switch between card and list view
- **Sorting**: Sort by name or creation date

**Filtering Options:**
- **Script Types**: Filter by CT (Container) or other script types
- **Update Status**: Show only scripts with available updates
- **Search Query**: Search within script names and descriptions
- **Categories**: Filter by specific script categories

**Script Actions:**
- **View Details**: Click on a script to see full information and documentation
- **Download**: Download script files to your local system
- **Install**: Run scripts directly on your PVE servers
- **Preview**: View script content before downloading

### Downloaded Scripts

Manage scripts that have been downloaded to your local system.

**What Are Downloaded Scripts?**
These are scripts that you've downloaded from the repository and are stored locally on your system:
- Script files are stored in your local scripts directory
- You can run these scripts on your PVE servers
- Scripts can be updated when newer versions are available

**Update Detection:**
The system automatically checks if newer versions of your downloaded scripts are available:
- Scripts with updates available are marked with an update indicator
- You can filter to show only scripts with available updates
- Update detection happens when you sync with the repository

**Managing Downloaded Scripts:**
- **Update Scripts**: Download the latest version of a script
- **View Details**: See script information and documentation
- **Install/Run**: Execute scripts on your PVE servers
- **Filter & Search**: Use the same filtering options as Available Scripts

### Installed Scripts

Track and manage scripts that are installed on your PVE servers.

**Auto-Detection (Primary Feature):**
The system can automatically detect LXC containers that have community-script tags on your PVE servers:
- **Automatic Discovery**: Scans your PVE servers for containers with community-script tags
- **Container Detection**: Identifies LXC containers running Proxmox helper scripts
- **Server Association**: Links detected scripts to the specific PVE server
- **Bulk Import**: Automatically creates records for all detected scripts

**How Auto-Detection Works:**
1. Connects to your configured PVE servers
2. Scans LXC container configurations
3. Looks for containers with community-script tags
4. Creates installed script records automatically

**Manual Script Management:**
- **Add Scripts Manually**: Create records for scripts not auto-detected
- **Edit Script Details**: Update script names and container IDs
- **Delete Scripts**: Remove scripts from tracking
- **Bulk Operations**: Clean up old or invalid script records

**Script Tracking Features:**
- **Installation Status**: Track success, failure, or in-progress installations
- **Server Association**: Know which server each script is installed on
- **Container ID**: Link scripts to specific LXC containers
- **Web UI Access**: Track and access Web UI IP addresses and ports
- **Execution Logs**: View output and logs from script installations
- **Filtering**: Filter by server, status, or search terms

**Managing Installed Scripts:**
- **View All Scripts**: See all tracked scripts across all servers
- **Filter by Server**: Show scripts for a specific PVE server
- **Filter by Status**: Show successful, failed, or in-progress installations
- **Sort Options**: Sort by name, container ID, server, status, or date
- **Update Scripts**: Re-run or update existing script installations

**Web UI Access:**
Automatically detect and access Web UI interfaces for your installed scripts:
- **Auto-Detection**: Automatically detects Web UI URLs from script installation output
- **IP & Port Tracking**: Stores and displays Web UI IP addresses and ports
- **One-Click Access**: Click IP:port to open Web UI in new tab
- **Manual Detection**: Re-detect IP using `hostname -I` inside container
- **Port Detection**: Uses script metadata to get correct port (e.g., actualbudget:5006)
- **Editable Fields**: Manually edit IP and port values as needed

**Actions Dropdown:**
Clean interface with all actions organized in a dropdown menu:
- **Edit Button**: Always visible for quick script editing
- **Actions Dropdown**: Contains Update, Shell, Open UI, Start/Stop, Destroy, Delete
- **Smart Visibility**: Dropdown only appears when actions are available
- **Auto-Close**: Dropdown closes after clicking any action
- **Disabled States**: Actions are disabled when container is stopped

**Container Control:**
Directly control LXC containers from the installed scripts page via SSH:
- **Start/Stop Button**: Control container state with `pct start/stop <ID>`
- **Container Status**: Real-time status indicator (running/stopped/unknown)
- **Destroy Button**: Permanently remove LXC container with `pct destroy <ID>`
- **Confirmation Modals**: Simple OK/Cancel for start/stop, type container ID to confirm destroy
- **SSH Execution**: All commands executed remotely via configured SSH connections

**Safety Features:**
- Start/Stop actions require simple confirmation
- Destroy action requires typing the container ID to confirm
- All actions show loading states and error handling
- Only works with SSH scripts that have valid container IDs

### Update System

Keep your PVE Scripts Management application up to date with the latest features and improvements.

**What Does Updating Do?**
- **Downloads Latest Version**: Fetches the newest release from the GitHub repository
- **Updates Application Files**: Replaces current files with the latest version
- **Installs Dependencies**: Updates Node.js packages and dependencies
- **Rebuilds Application**: Compiles the application with latest changes
- **Restarts Server**: Automatically restarts the application server

**How to Update:**

**Automatic Update (Recommended):**
- Click the "Update Now" button when an update is available
- The system will handle everything automatically
- You'll see a progress overlay with update logs
- The page will reload automatically when complete

**Manual Update (Advanced):**
If automatic update fails, you can update manually:
```bash
# Navigate to the application directory
cd $PVESCRIPTLOCAL_DIR

# Pull latest changes
git pull

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

**Update Process:**
1. **Check for Updates**: System automatically checks GitHub for new releases
2. **Download Update**: Downloads the latest release files
3. **Backup Current Version**: Creates backup of current installation
4. **Install New Version**: Replaces files and updates dependencies
5. **Build Application**: Compiles the updated code
6. **Restart Server**: Stops old server and starts new version
7. **Reload Page**: Automatically refreshes the browser

**Release Notes:**
Click the external link icon next to the update button to view detailed release notes on GitHub:
- See what's new in each version
- Read about bug fixes and improvements
- Check for any breaking changes
- View installation requirements

**Important Notes:**
- **Backup**: Your data and settings are preserved during updates
- **Downtime**: Brief downtime occurs during the update process
- **Compatibility**: Updates maintain backward compatibility with your data
- **Rollback**: If issues occur, you can manually revert to previous version

## 📁 Project Structure

```
PVESciptslocal/
├── scripts/                  # Script collection
│   ├── core/                 # Core utility functions
│   │   ├── build.func        # Build system functions
│   │   ├── tools.func        # Tool installation functions
│   │   └── create_lxc.sh     # LXC container creation
│   ├── ct/                   # Container templates 
│   └── install/              # Installation scripts
├── src/                      # Source code
│   ├── app/                  # Next.js app directory
│   │   ├── _components/      # React components
│   │   └── page.tsx          # Main page
│   └── server/               # Server-side code
│       ├── database.js       # SQLite database service
│       └── services/         # Business logic services
├── data/                     # Database storage
│   └── settings.db           # SQLite database file
├── public/                   # Static assets
├── server.js                 # Main server file
└── package.json              # Dependencies and scripts
```


## 🚀 Development

### Prerequisites for Development
- Node.js 22+
- Git

### Development Commands

```bash
# Install dependencies
npm install
```

# Start development server
```bash
npm run dev:server
```

### Project Structure for Developers

- **Frontend**: React components in `src/app/_components/`
- **Backend**: Server logic in `src/server/`
- **API**: tRPC routers for type-safe API communication
- **Scripts**: Bash scripts in `scripts/` directory

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This is beta software. Use with caution in production environments and always backup your Proxmox configuration before running scripts.
