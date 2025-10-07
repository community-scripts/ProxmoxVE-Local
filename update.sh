#!/bin/bash

# Enhanced update script for ProxmoxVE-Local
# Fetches latest release from GitHub and backs up data directory

set -euo pipefail  # Exit on error, undefined vars, pipe failures

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

# Backup data directory
backup_data() {
    if [ -d "$DATA_DIR" ]; then
        log "Backing up data directory to $BACKUP_DIR..."
        
        if ! mkdir -p "$BACKUP_DIR"; then
            log_error "Failed to create backup directory"
            exit 1
        fi
        
        if ! cp -r "$DATA_DIR"/* "$BACKUP_DIR/" 2>/dev/null; then
            log_warning "No files found in data directory to backup"
        else
            log_success "Data directory backed up successfully"
        fi
    else
        log_warning "Data directory not found, skipping backup"
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
    
    # Find the extracted directory (GitHub tarballs have a root directory)
    local extracted_dir
    extracted_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "${REPO_NAME}-*" | head -1)
    
    if [ -z "$extracted_dir" ]; then
        log_error "Could not find extracted directory"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_success "Release downloaded and extracted successfully"
    echo "$extracted_dir"
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
        "*.log"
        "update.log"
        "*.backup"
        "*.bak"
    )
    
    # Create exclude string for rsync
    local exclude_args=""
    for pattern in "${exclude_patterns[@]}"; do
        exclude_args="$exclude_args --exclude=$pattern"
    done
    
    # Update files using rsync
    if command -v rsync &> /dev/null; then
        if ! rsync -av --delete $exclude_args "$source_dir/" .; then
            log_error "Failed to update files with rsync"
            return 1
        fi
    else
        # Fallback to cp if rsync is not available
        log_warning "rsync not available, using cp (this may not preserve all file permissions)"
        
        # Copy files excluding specified patterns
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
                cp "$file" "$rel_path"
            fi
        done
    fi
    
    log_success "Application files updated successfully"
}

# Install dependencies and build
install_and_build() {
    log "Installing dependencies..."
    if ! npm install; then
        log_error "Failed to install dependencies"
        return 1
    fi
    
    log "Building application..."
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
        if [ -d "$DATA_DIR" ]; then
            rm -rf "$DATA_DIR"
        fi
        mv "$BACKUP_DIR" "$DATA_DIR"
        log_success "Data directory restored from backup"
    fi
    
    log_error "Update failed. Please check the logs and try again."
    exit 1
}

# Main update process
main() {
    log "Starting ProxmoxVE-Local update process..."
    
    # Change to script directory
    cd "$PVESCRIPTLOCAL_DIR" || {
        log_error "Failed to change to PVESCRIPTLOCAL_DIR: $PVESCRIPTLOCAL_DIR"
        exit 1
    }
    
    # Check dependencies
    check_dependencies
    
    # Get latest release info
    local release_info
    release_info=$(get_latest_release)
    
    # Backup data directory
    backup_data
    
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

# Run main function
main "$@"