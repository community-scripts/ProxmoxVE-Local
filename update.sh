#!/bin/bash

# Enhanced update script for ProxmoxVE-Local
# Fetches latest release from GitHub and backs up data directory

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Add error trap for debugging
trap 'echo "Error occurred at line $LINENO, command: $BASH_COMMAND"' ERR

# Configuration
REPO_OWNER="community-scripts"
REPO_NAME="ProxmoxVE-Local"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"
BACKUP_DIR="/tmp/pve-scripts-backup-$(date +%Y%m%d-%H%M%S)"
DATA_DIR="./data"
LOG_FILE="/tmp/update.log"

# GitHub Personal Access Token for higher rate limits (optional)
# Set GITHUB_TOKEN environment variable or create .github_token file
GITHUB_TOKEN=""

# Global variable to track if service was running before update
SERVICE_WAS_RUNNING=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load GitHub token
load_github_token() {
    # Try environment variable first
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        log "Using GitHub token from environment variable"
        return 0
    fi
    
    # Try .env file
    if [ -f ".env" ]; then
        local env_token
        env_token=$(grep "^GITHUB_TOKEN=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\n\r')
        if [ -n "$env_token" ]; then
            GITHUB_TOKEN="$env_token"
            log "Using GitHub token from .env file"
            return 0
        fi
    fi
    
    # Try .github_token file
    if [ -f ".github_token" ]; then
        GITHUB_TOKEN=$(cat .github_token | tr -d '\n\r')
        log "Using GitHub token from .github_token file"
        return 0
    fi
    
    # Try ~/.github_token file
    if [ -f "$HOME/.github_token" ]; then
        GITHUB_TOKEN=$(cat "$HOME/.github_token" | tr -d '\n\r')
        log "Using GitHub token from ~/.github_token file"
        return 0
    fi
    
    log_warning "No GitHub token found. Using unauthenticated requests (lower rate limits)"
    log_warning "To use a token, add GITHUB_TOKEN=your_token to .env file or set GITHUB_TOKEN environment variable"
    return 1
}

# Initialize log file
init_log() {
    # Clear/create log file
    > "$LOG_FILE"
    log "Starting ProxmoxVE-Local update process..."
    log "Log file: $LOG_FILE"
}

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE" >&2
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
    
    local curl_opts="-s --connect-timeout 15 --max-time 60 --retry 2 --retry-delay 3"
    
    # Add authentication header if token is available
    if [ -n "$GITHUB_TOKEN" ]; then
        curl_opts="$curl_opts -H \"Authorization: token $GITHUB_TOKEN\""
        log "Using authenticated GitHub API request"
    else
        log "Using unauthenticated GitHub API request (lower rate limits)"
    fi
    
    local release_info
    if ! release_info=$(eval "curl $curl_opts \"$GITHUB_API/releases/latest\""); then
        log_error "Failed to fetch release information from GitHub API (timeout or network error)"
        exit 1
    fi
    
    # Check if response is valid JSON
    if ! echo "$release_info" | jq empty 2>/dev/null; then
        log_error "Invalid JSON response from GitHub API"
        log "Response: $release_info"
        exit 1
    fi
    
    local tag_name
    local download_url
    local published_at
    
    tag_name=$(echo "$release_info" | jq -r '.tag_name')
    download_url=$(echo "$release_info" | jq -r '.tarball_url')
    published_at=$(echo "$release_info" | jq -r '.published_at')
    
    if [ "$tag_name" = "null" ] || [ "$download_url" = "null" ] || [ -z "$tag_name" ] || [ -z "$download_url" ]; then
        log_error "Failed to parse release information from API response"
        log "Tag name: $tag_name"
        log "Download URL: $download_url"
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
        
        if ! cp -r "$DATA_DIR" "$BACKUP_DIR/data"; then
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
    
    local temp_dir="/tmp/pve-update-$$"
    local archive_file="$temp_dir/release.tar.gz"
    
    # Create temporary directory
    if ! mkdir -p "$temp_dir"; then
        log_error "Failed to create temporary directory"
        exit 1
    fi
    
    # Download release with timeout and progress
    log "Downloading from: $download_url"
    log "Target file: $archive_file"
    log "Starting curl download..."
    
    # Test if curl is working
    log "Testing curl availability..."
    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl command not found"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Test basic connectivity
    log "Testing basic connectivity..."
    if ! curl -s --connect-timeout 10 --max-time 30 "https://api.github.com" >/dev/null 2>&1; then
        log_error "Cannot reach GitHub API"
        rm -rf "$temp_dir"
        exit 1
    fi
    log_success "Connectivity test passed"
    
    # Create a temporary file for curl output
    local curl_log="/tmp/curl_log_$$.txt"
    
    # Run curl with verbose output
    if curl -L --connect-timeout 30 --max-time 300 --retry 3 --retry-delay 5 -v -o "$archive_file" "$download_url" > "$curl_log" 2>&1; then
        log_success "Curl command completed successfully"
        # Show some of the curl output for debugging
        log "Curl output (first 10 lines):"
        head -10 "$curl_log" | while read -r line; do
            log "CURL: $line"
        done
    else
        local curl_exit_code=$?
        log_error "Curl command failed with exit code: $curl_exit_code"
        log_error "Curl output:"
        cat "$curl_log" | while read -r line; do
            log_error "CURL: $line"
        done
        rm -f "$curl_log"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Clean up curl log
    rm -f "$curl_log"
    
    # Verify download
    if [ ! -f "$archive_file" ] || [ ! -s "$archive_file" ]; then
        log_error "Downloaded file is empty or missing"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    local file_size
    file_size=$(stat -c%s "$archive_file" 2>/dev/null || echo "0")
    log_success "Downloaded release ($file_size bytes)"
    
    # Extract release
    log "Extracting release..."
    if ! tar -xzf "$archive_file" -C "$temp_dir"; then
        log_error "Failed to extract release"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    # Debug: List contents after extraction
    log "Contents after extraction:"
    ls -la "$temp_dir" >&2 || true
    
    # Find the extracted directory (GitHub tarballs have a root directory)
    log "Looking for extracted directory with pattern: ${REPO_NAME}-*"
    local extracted_dir
    extracted_dir=$(timeout 10 find "$temp_dir" -maxdepth 1 -type d -name "${REPO_NAME}-*" 2>/dev/null | head -1)
    
    # If not found with repo name, try alternative patterns
    if [ -z "$extracted_dir" ]; then
        log "Trying pattern: community-scripts-ProxmoxVE-Local-*"
        extracted_dir=$(timeout 10 find "$temp_dir" -maxdepth 1 -type d -name "community-scripts-ProxmoxVE-Local-*" 2>/dev/null | head -1)
    fi
    
    if [ -z "$extracted_dir" ]; then
        log "Trying pattern: ProxmoxVE-Local-*"
        extracted_dir=$(timeout 10 find "$temp_dir" -maxdepth 1 -type d -name "ProxmoxVE-Local-*" 2>/dev/null | head -1)
    fi
    
    if [ -z "$extracted_dir" ]; then
        log "Trying any directory in temp folder"
        extracted_dir=$(timeout 10 find "$temp_dir" -maxdepth 1 -type d ! -name "$temp_dir" 2>/dev/null | head -1)
    fi
    
    # If still not found, error out
    if [ -z "$extracted_dir" ]; then
        log_error "Could not find extracted directory"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_success "Found extracted directory: $extracted_dir"
    log_success "Release downloaded and extracted successfully"
    echo "$extracted_dir"
}

# Clear the original directory before updating
clear_original_directory() {
    log "Clearing original directory..."
    
    # List of files/directories to preserve (already backed up)
    local preserve_patterns=(
        "data"
        ".env"
        "*.log"
        "update.log"
        "*.backup"
        "*.bak"
        "node_modules"
        ".git"
    )
    
    # Remove all files except preserved ones
    while IFS= read -r file; do
        local should_preserve=false
        local filename=$(basename "$file")
        
        for pattern in "${preserve_patterns[@]}"; do
            if [[ "$filename" == $pattern ]]; then
                should_preserve=true
                break
            fi
        done
        
        if [ "$should_preserve" = false ]; then
            rm -f "$file"
        fi
    done < <(find . -maxdepth 1 -type f ! -name ".*")
    
    # Remove all directories except preserved ones
    while IFS= read -r dir; do
        local should_preserve=false
        local dirname=$(basename "$dir")
        
        for pattern in "${preserve_patterns[@]}"; do
            if [[ "$dirname" == $pattern ]]; then
                should_preserve=true
                break
            fi
        done
        
        if [ "$should_preserve" = false ]; then
            rm -rf "$dir"
        fi
    done < <(find . -maxdepth 1 -type d ! -name "." ! -name "..")
    
    log_success "Original directory cleared"
}

# Restore backup files before building
restore_backup_files() {
    log "Restoring .env and data directory from backup..."
    
    if [ -d "$BACKUP_DIR" ]; then
        # Restore .env file
        if [ -f "$BACKUP_DIR/.env" ]; then
            if [ -f ".env" ]; then
                rm -f ".env"
            fi
            if mv "$BACKUP_DIR/.env" ".env"; then
                log_success ".env file restored from backup"
            else
                log_error "Failed to restore .env file"
                return 1
            fi
        else
            log_warning "No .env file backup found"
        fi
        
        # Restore data directory
        if [ -d "$BACKUP_DIR/data" ]; then
            if [ -d "data" ]; then
                rm -rf "data"
            fi
            if mv "$BACKUP_DIR/data" "data"; then
                log_success "Data directory restored from backup"
            else
                log_error "Failed to restore data directory"
                return 1
            fi
        else
            log_warning "No data directory backup found"
        fi
    else
        log_error "No backup directory found for restoration"
        return 1
    fi
}

# Check if systemd service exists
check_service() {
    # systemctl status returns 0-3 if service exists (running, exited, failed, etc.)
    # and returns 4 if service unit is not found
    systemctl status pvescriptslocal.service &>/dev/null
    local exit_code=$?
    if [ $exit_code -le 3 ]; then
        return 0
    else
        return 1
    fi
}


# Stop the application before updating
stop_application() {
    log "Stopping application before update..."
    
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
    
    # Check if systemd service is running and disable it temporarily
    if check_service && systemctl is-active --quiet pvescriptslocal.service; then
        log "Disabling systemd service temporarily to prevent auto-restart..."
        if systemctl disable pvescriptslocal.service; then
            log_success "Service disabled successfully"
        else
            log_error "Failed to disable service"
            return 1
        fi
    else
        log "No running systemd service found"
    fi
    
    # Kill any remaining npm/node processes
    log "Killing any remaining npm/node processes..."
    local pids
    pids=$(pgrep -f "node server.js\|npm start" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log "Found running processes: $pids"
        pkill -9 -f "node server.js" 2>/dev/null || true
        pkill -9 -f "npm start" 2>/dev/null || true
        sleep 2
        log_success "Processes killed"
    else
        log "No running processes found"
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
    
    # Find the actual source directory (strip the top-level directory)
    local actual_source_dir
    actual_source_dir=$(find "$source_dir" -maxdepth 1 -type d -name "community-scripts-ProxmoxVE-Local-*" | head -1)
    
    if [ -z "$actual_source_dir" ]; then
        log_error "Could not find the actual source directory in $source_dir"
        return 1
    fi
    
    # Use process substitution instead of pipe to avoid subshell issues
    local files_copied=0
    local files_excluded=0
    
    log "Starting file copy process from: $actual_source_dir"
    
    # Create a temporary file list to avoid process substitution issues
    local file_list="/tmp/file_list_$$.txt"
    find "$actual_source_dir" -type f > "$file_list"
    
    local total_files
    total_files=$(wc -l < "$file_list")
    log "Found $total_files files to process"
    
    while IFS= read -r file; do
        local rel_path="${file#$actual_source_dir/}"
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
            if [ "$target_dir" != "." ]; then
                mkdir -p "$target_dir"
            fi
            
            if ! cp "$file" "$rel_path"; then
                log_error "Failed to copy $rel_path"
                rm -f "$file_list"
                return 1
            else
                files_copied=$((files_copied + 1))
               
            fi
        else
            files_excluded=$((files_excluded + 1))
            log "Excluded: $rel_path"
        fi
    done < "$file_list"
    
    # Clean up temporary file
    rm -f "$file_list"
    
    log "Files processed: $files_copied copied, $files_excluded excluded"
    
    log_success "Application files updated successfully"
}

# Install dependencies and build
install_and_build() {
    log "Installing dependencies..."
    
    # Remove old node_modules to avoid conflicts with new dependencies
    if [ -d "node_modules" ]; then
        log "Removing old node_modules directory for clean install..."
        rm -rf node_modules
        log_success "Old node_modules removed"
    fi
    
    # Remove package-lock.json to avoid version conflicts
    if [ -f "package-lock.json" ]; then
        log "Removing old package-lock.json to avoid conflicts..."
        rm -f package-lock.json
        log_success "Old package-lock.json removed"
    fi
    
    # Clear npm cache to ensure fresh downloads
    log "Clearing npm cache..."
    if npm cache clean --force > /dev/null 2>&1; then
        log_success "npm cache cleared"
    else
        log_warning "Failed to clear npm cache, continuing anyway..."
    fi
    
    # Create temporary file for npm output
    local npm_log="/tmp/npm_install_$$.log"
    
    # Run npm install with verbose output for debugging
    log "Running npm install (this may take a few minutes)..."
    if ! npm install --loglevel=verbose > "$npm_log" 2>&1; then
        log_error "Failed to install dependencies"
        log_error "npm install output:"
        cat "$npm_log" | while read -r line; do
            log_error "NPM: $line"
        done
        rm -f "$npm_log"
        return 1
    fi
    
    # Log success and clean up
    log_success "Dependencies installed successfully"
    rm -f "$npm_log"
    
    log "Building application..."
    # Set NODE_ENV to production for build
    export NODE_ENV=production
    
    # Create temporary file for npm build output
    local build_log="/tmp/npm_build_$$.log"
    
    if ! npm run build > "$build_log" 2>&1; then
        log_error "Failed to build application"
        log_error "npm run build output:"
        cat "$build_log" | while read -r line; do
            log_error "BUILD: $line"
        done
        rm -f "$build_log"
        return 1
    fi
    
    # Log success and clean up
    log_success "Application built successfully"
    rm -f "$build_log"
    
    log_success "Dependencies installed and application built successfully"
}

# Start the application after updating
start_application() {
    log "Starting application..."
    
    # Use the global variable to determine how to start
    if [ "$SERVICE_WAS_RUNNING" = true ] && check_service; then
        log "Service was running before update, re-enabling and starting systemd service..."
        if systemctl enable --now pvescriptslocal.service; then
            log_success "Service enabled and started successfully"
            # Wait a moment and check if it's running
            sleep 2
            if systemctl is-active --quiet pvescriptslocal.service; then
                log_success "Service is running"
            else
                log_warning "Service started but may not be running properly"
            fi
        else
            log_error "Failed to enable/start service, falling back to npm start"
            start_with_npm
        fi
    else
        log "Service was not running before update or no service exists, starting with npm..."
        start_with_npm
    fi
}

# Start application with npm
start_with_npm() {
    log "Starting application with npm start..."
    
    # Start in background
    nohup npm start > server.log 2>&1 &
    local npm_pid=$!
    
    # Wait a moment and check if it started
    sleep 3
    if kill -0 $npm_pid 2>/dev/null; then
        log_success "Application started with PID: $npm_pid"
    else
        log_error "Failed to start application with npm"
        return 1
    fi
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
    # Check if this is the relocated/detached version first
    if [ "${1:-}" = "--relocated" ]; then
        export PVE_UPDATE_RELOCATED=1
        init_log
        log "Running as detached process"
        sleep 3
        
    else
        init_log
    fi
    
    # Check if we're running from the application directory and not already relocated
    if [ -z "${PVE_UPDATE_RELOCATED:-}" ] && [ -f "package.json" ] && [ -f "server.js" ]; then
        log "Detected running from application directory"
        bash "$0" --relocated
        exit $?
    fi
    
    # Ensure we're in the application directory
    local app_dir
    
    # First check if we're already in the right directory
    if [ -f "package.json" ] && [ -f "server.js" ]; then
        app_dir="$(pwd)"
        log "Already in application directory: $app_dir"
    else
        # Try multiple common locations
        for search_path in /opt /root /home /usr/local; do
            if [ -d "$search_path" ]; then
                app_dir=$(find "$search_path" -name "package.json" -path "*/ProxmoxVE-Local*" -exec dirname {} \; 2>/dev/null | head -1)
                if [ -n "$app_dir" ] && [ -d "$app_dir" ]; then
                    break
                fi
            fi
        done
        
        if [ -n "$app_dir" ] && [ -d "$app_dir" ]; then
            cd "$app_dir" || {
                log_error "Failed to change to application directory: $app_dir"
                exit 1
            }
            log "Changed to application directory: $(pwd)"
        else
            log_error "Could not find application directory"
            log "Searched in: /opt, /root, /home, /usr/local"
            exit 1
        fi
    fi
    
    # Check dependencies
    check_dependencies
    
    # Load GitHub token for higher rate limits
    load_github_token
    
    # Check if service was running before update
    if check_service && systemctl is-active --quiet pvescriptslocal.service; then
        SERVICE_WAS_RUNNING=true
        log "Service was running before update, will restart it after update"
    else
        SERVICE_WAS_RUNNING=false
        log "Service was not running before update, will use npm start after update"
    fi
    
    # Get latest release info
    local release_info
    release_info=$(get_latest_release)
    
    # Backup data directory
    backup_data
    
    # Stop the application before updating
    stop_application
    
    # Download and extract release
    local source_dir
    source_dir=$(download_release "$release_info")
    log "Download completed, source_dir: $source_dir"
    
    # Clear the original directory before updating
    log "Clearing original directory..."
    clear_original_directory
    log "Original directory cleared successfully"
    
    # Update files
    log "Starting file update process..."
    if ! update_files "$source_dir"; then
        log_error "File update failed, rolling back..."
        rollback
    fi
    log "File update completed successfully"
    
    # Restore .env and data directory before building
    log "Restoring backup files..."
    restore_backup_files
    log "Backup files restored successfully"
    
    # Install dependencies and build
    log "Starting install and build process..."
    if ! install_and_build; then
        log_error "Install and build failed, rolling back..."
        rollback
    fi
    log "Install and build completed successfully"
    
    # Cleanup
    log "Cleaning up temporary files..."
    rm -rf "$source_dir"
    rm -rf "/tmp/pve-update-$$"
    
    # Start the application
    start_application
    
    log_success "Update completed successfully!"
}

# Run main function with error handling
if ! main "$@"; then
    log_error "Update script failed with exit code $?"
    exit 1
fi