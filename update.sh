#!/bin/bash

# Enhanced update script for ProxmoxVE-Local
# Fetches latest release from GitHub and backs up data directory

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Debug: Show script execution info
echo "Script started at $(date)"
echo "Script PID: $$"
echo "Arguments: $*"

# Add error trap for debugging
trap 'echo "Error occurred at line $LINENO, command: $BASH_COMMAND"' ERR

# Configuration
REPO_OWNER="community-scripts"
REPO_NAME="ProxmoxVE-Local"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"
BACKUP_DIR="/tmp/pve-scripts-backup-$(date +%Y%m%d-%H%M%S)"
DATA_DIR="./data"
LOG_FILE="./update.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if required tools are available
check_dependencies() {
    log "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Get latest release info from GitHub API
get_latest_release() {
    log "Fetching latest release information from GitHub..."
    
    local release_info
    if ! release_info=$(curl -s "$GITHUB_API/releases/latest"); then
        log_error "Failed to fetch release information from GitHub API"
        exit 1
    fi
    
    local tag_name
    local download_url
    local published_at
    
    tag_name=$(echo "$release_info" | jq -r '.tag_name')
    download_url=$(echo "$release_info" | jq -r '.tarball_url')
    published_at=$(echo "$release_info" | jq -r '.published_at')
    
    if [ "$tag_name" = "null" ] || [ "$download_url" = "null" ]; then
        log_error "Failed to parse release information"
        exit 1
    fi
    
    log_success "Latest release: $tag_name (published: $published_at)"
    echo "$tag_name|$download_url"
}

# Backup data directory and .env file
backup_data() {
    log "Creating backup directory at $BACKUP_DIR..."
    
    if ! mkdir -p "$BACKUP_DIR"; then
        log_error "Failed to create backup directory"
        exit 1
    fi
    
    # Backup data directory
    if [ -d "$DATA_DIR" ]; then
        log "Backing up data directory..."
        
        if ! cp -r "$DATA_DIR" "$BACKUP_DIR/"; then
            log_error "Failed to backup data directory"
            exit 1
        else
            log_success "Data directory backed up successfully"
        fi
    else
        log_warning "Data directory not found, skipping backup"
    fi
    
    # Backup .env file
    if [ -f ".env" ]; then
        log "Backing up .env file..."
        if ! cp ".env" "$BACKUP_DIR/.env"; then
            log_error "Failed to backup .env file"
            exit 1
        else
            log_success ".env file backed up successfully"
        fi
    else
        log_warning ".env file not found, skipping backup"
    fi
}

# Download and extract latest release
download_release() {
    local release_info="$1"
    local tag_name="${release_info%|*}"
    local download_url="${release_info#*|}"
    
    log "Downloading release $tag_name..."
    
    local temp_dir="/tmp/pve-scripts-update-$$"
    local archive_file="$temp_dir/release.tar.gz"
    
    # Create temporary directory
    if ! mkdir -p "$temp_dir"; then
        log_error "Failed to create temporary directory"
        exit 1
    fi
    
    # Download release
    if ! curl -L -o "$archive_file" "$download_url"; then
        log_error "Failed to download release"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Extract release
    log "Extracting release..."
    if ! tar -xzf "$archive_file" -C "$temp_dir"; then
        log_error "Failed to extract release"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Debug: List contents after extraction
    log "Contents after extraction:"
    ls -la "$temp_dir" || true
    
    # Find the extracted directory (GitHub tarballs have a root directory)
    local extracted_dir
    extracted_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "${REPO_NAME}-*" | head -1)
    
    # If not found with repo name, try alternative patterns
    if [ -z "$extracted_dir" ]; then
        extracted_dir=$(find "$temp_dir" -maxdepth 1 -type d ! -name "$temp_dir" | head -1)
    fi
    
    # If still not found, list what's in the temp directory for debugging
    if [ -z "$extracted_dir" ]; then
        log_error "Could not find extracted directory"
        log "Contents of temp directory:"
        ls -la "$temp_dir" || true
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_success "Release downloaded and extracted successfully"
    echo "$extracted_dir"
}

# Stop the application before updating
stop_application() {
    log "Stopping application..."
    
    # Change to the application directory if we're not already there
    local app_dir
    if [ -f "package.json" ] && [ -f "server.js" ]; then
        app_dir="$(pwd)"
    else
        # Try to find the application directory
        app_dir=$(find /root -name "package.json" -path "*/ProxmoxVE-Local*" -exec dirname {} \; 2>/dev/null | head -1)
        if [ -n "$app_dir" ] && [ -d "$app_dir" ]; then
            cd "$app_dir" || {
                log_error "Failed to change to application directory: $app_dir"
                return 1
            }
        else
            log_error "Could not find application directory"
            return 1
        fi
    fi
    
    log "Working from application directory: $(pwd)"
    
    # Try to find and stop the Node.js process
    local pids
    pids=$(pgrep -f "node server.js" 2>/dev/null || true)
    
    # Also check for npm start processes
    local npm_pids
    npm_pids=$(pgrep -f "npm start" 2>/dev/null || true)
    
    # Combine all PIDs
    if [ -n "$npm_pids" ]; then
        pids="$pids $npm_pids"
    fi
    
    if [ -n "$pids" ]; then
        log "Found running application processes: $pids"
        if kill -TERM $pids 2>/dev/null; then
            log "Sent TERM signal to application processes"
            # Wait for graceful shutdown
            sleep 3
            # Force kill if still running
            local remaining_pids
            remaining_pids=$(pgrep -f "node server.js\|npm start" 2>/dev/null || true)
            if [ -n "$remaining_pids" ]; then
                log_warning "Application still running, force killing: $remaining_pids"
                pkill -9 -f "node server.js" 2>/dev/null || true
                pkill -9 -f "npm start" 2>/dev/null || true
            fi
        else
            log_warning "Could not stop application processes"
        fi
    else
        log "No running application processes found"
    fi
}

# Update application files
update_files() {
    local source_dir="$1"
    
    log "Updating application files..."
    
    # List of files/directories to exclude from update
    local exclude_patterns=(
        "data"
        "node_modules"
        ".git"
        ".env"
        "*.log"
        "update.log"
        "*.backup"
        "*.bak"
    )
    
    # Copy files excluding specified patterns (safer than rsync for self-updates)
    find "$source_dir" -type f | while read -r file; do
        local rel_path="${file#$source_dir/}"
        local should_exclude=false
        
        for pattern in "${exclude_patterns[@]}"; do
            if [[ "$rel_path" == $pattern ]]; then
                should_exclude=true
                break
            fi
        done
        
        if [ "$should_exclude" = false ]; then
            local target_dir
            target_dir=$(dirname "$rel_path")
            mkdir -p "$target_dir"
            if ! cp "$file" "$rel_path"; then
                log_error "Failed to copy $rel_path"
                return 1
            fi
        fi
    done
    
    log_success "Application files updated successfully"
}

# Install dependencies and build
install_and_build() {
    log "Installing dependencies..."
    if ! npm install; then
        log_error "Failed to install dependencies"
        return 1
    fi
    
    # Ensure no processes are running before build
    log "Ensuring no conflicting processes are running..."
    local pids
    pids=$(pgrep -f "node server.js\|npm start" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_warning "Found running processes, stopping them: $pids"
        pkill -9 -f "node server.js" 2>/dev/null || true
        pkill -9 -f "npm start" 2>/dev/null || true
        sleep 2
    fi
    
    log "Building application..."
    # Set NODE_ENV to production for build
    export NODE_ENV=production
    
    if ! npm run build; then
        log_error "Failed to build application"
        return 1
    fi
    
    log_success "Dependencies installed and application built successfully"
}

# Rollback function
rollback() {
    log_warning "Rolling back to previous version..."
    
    if [ -d "$BACKUP_DIR" ]; then
        log "Restoring from backup directory: $BACKUP_DIR"
        
        # Restore data directory
        if [ -d "$BACKUP_DIR/data" ]; then
            log "Restoring data directory..."
            if [ -d "$DATA_DIR" ]; then
                rm -rf "$DATA_DIR"
            fi
            if mv "$BACKUP_DIR/data" "$DATA_DIR"; then
                log_success "Data directory restored from backup"
            else
                log_error "Failed to restore data directory"
            fi
        else
            log_warning "No data directory backup found"
        fi
        
        # Restore .env file
        if [ -f "$BACKUP_DIR/.env" ]; then
            log "Restoring .env file..."
            if [ -f ".env" ]; then
                rm -f ".env"
            fi
            if mv "$BACKUP_DIR/.env" ".env"; then
                log_success ".env file restored from backup"
            else
                log_error "Failed to restore .env file"
            fi
        else
            log_warning "No .env file backup found"
        fi
        
        # Clean up backup directory
        log "Cleaning up backup directory..."
        rm -rf "$BACKUP_DIR"
    else
        log_error "No backup directory found for rollback"
    fi
    
    log_error "Update failed. Please check the logs and try again."
    exit 1
}

# Main update process
main() {
    log "Starting ProxmoxVE-Local update process..."
    
    # Debug: Show current directory and environment
    log "Current directory: $(pwd)"
    log "Script location: $(dirname "$(readlink -f "$0")")"
    log "PVE_UPDATE_RELOCATED: ${PVE_UPDATE_RELOCATED:-not set}"
    
    # Check if we're running from the application directory and not already relocated
    echo "DEBUG: Checking for package.json and server.js files..."
    log "Checking for package.json and server.js files..."
    if [ -f "package.json" ]; then
        echo "DEBUG: Found package.json"
        log "Found package.json"
    else
        echo "DEBUG: package.json not found"
        log "package.json not found"
    fi
    
    if [ -f "server.js" ]; then
        echo "DEBUG: Found server.js"
        log "Found server.js"
    else
        echo "DEBUG: server.js not found"
        log "server.js not found"
    fi
    
    echo "DEBUG: Checking if condition..."
    echo "DEBUG: PVE_UPDATE_RELOCATED is empty: $([ -z "$PVE_UPDATE_RELOCATED" ] && echo "YES" || echo "NO")"
    echo "DEBUG: package.json exists: $([ -f "package.json" ] && echo "YES" || echo "NO")"
    echo "DEBUG: server.js exists: $([ -f "server.js" ] && echo "YES" || echo "NO")"
    
    if [ -z "$PVE_UPDATE_RELOCATED" ] && [ -f "package.json" ] && [ -f "server.js" ]; then
        echo "DEBUG: Entering relocation logic"
        log "Detected running from application directory"
        log "Copying update script to temporary location for safe execution..."
        
        local temp_script="/tmp/pve-scripts-update-$$.sh"
        echo "DEBUG: About to copy script to $temp_script"
        if ! cp "$0" "$temp_script"; then
            echo "DEBUG: Copy failed"
            log_error "Failed to copy update script to temporary location"
            exit 1
        fi
        echo "DEBUG: Copy successful"
        
        echo "DEBUG: About to chmod script"
        chmod +x "$temp_script"
        echo "DEBUG: chmod successful"
        
        log "Executing update from temporary location: $temp_script"
        
        # Set flag to prevent infinite loop and execute from temporary location
        export PVE_UPDATE_RELOCATED=1
        echo "DEBUG: About to exec new script"
        exec "$temp_script" "$@"
    fi
    
    echo "DEBUG: Skipping relocation, continuing with update process"
    
    # Ensure we're in the application directory
    local app_dir
    app_dir=$(find /root -name "package.json" -path "*/ProxmoxVE-Local*" -exec dirname {} \; 2>/dev/null | head -1)
    if [ -n "$app_dir" ] && [ -d "$app_dir" ]; then
        cd "$app_dir" || {
            log_error "Failed to change to application directory: $app_dir"
            exit 1
        }
        log "Changed to application directory: $(pwd)"
    else
        log_error "Could not find application directory"
        exit 1
    fi
    
    # Check dependencies
    check_dependencies
    
    # Get latest release info
    local release_info
    release_info=$(get_latest_release)
    
    # Backup data directory
    backup_data
    
    # Stop the application before updating (now running from /tmp/)
    stop_application
    
    # Double-check that no processes are running
    local remaining_pids
    remaining_pids=$(pgrep -f "node server.js\|npm start" 2>/dev/null || true)
    if [ -n "$remaining_pids" ]; then
        log_warning "Some processes still running, force killing: $remaining_pids"
        pkill -9 -f "node server.js" 2>/dev/null || true
        pkill -9 -f "npm start" 2>/dev/null || true
        sleep 2
    fi
    
    # Download and extract release
    local source_dir
    source_dir=$(download_release "$release_info")
    
    # Update files
    if ! update_files "$source_dir"; then
        rollback
    fi
    
    # Install dependencies and build
    if ! install_and_build; then
        rollback
    fi
    
    # Cleanup
    log "Cleaning up temporary files..."
    rm -rf "$source_dir"
    rm -rf "/tmp/pve-scripts-update-$$"
    
    # Clean up temporary script if it exists
    if [ -f "/tmp/pve-scripts-update-$$.sh" ]; then
        rm -f "/tmp/pve-scripts-update-$$.sh"
    fi
    
    log_success "Update completed successfully!"
    log "You can now start the application with: npm start"
    
    # Ask if user wants to start the application
    echo -e "${YELLOW}Do you want to start the application now? (y/N):${NC} "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log "Starting application..."
        npm start
    else
        log "Update complete. Start the application manually when ready."
    fi
}

# Run main function with error handling
if ! main "$@"; then
    log_error "Update script failed with exit code $?"
    exit 1
fi