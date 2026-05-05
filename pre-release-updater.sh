#!/bin/bash

# ProxmoxVE-Local Pre-Release Updater
# ====================================
# This script allows users to upgrade from stable (e.g. v0.5.8) to pre-release
# versions (v1.0.0-pre1, v1.0.0-pre2, etc.) for testing purposes.
#
# Installation:
#   curl -fsSL https://github.com/community-scripts/ProxmoxVE-Local/releases/download/v1.0.0-pre1/pre-release-updater.sh -o /opt/pve-local-prerelease-updater.sh
#   chmod +x /opt/pve-local-prerelease-updater.sh
#
# Usage:
#   bash /opt/pve-local-prerelease-updater.sh
#
# The script will:
#   1. Fetch all available pre-releases from GitHub
#   2. Display them (newest first) with a numbered menu
#   3. Let the user pick which pre-release to install
#   4. Download and install the selected pre-release

set -euo pipefail

# --- Configuration -----------------------------------------------------------
REPO_OWNER="community-scripts"
REPO_NAME="ProxmoxVE-Local"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"
INSTALL_DIR="/opt/ProxmoxVE-Local"
BACKUP_DIR="/tmp/pve-prerelease-backup-$(date +%Y%m%d-%H%M%S)"
SERVICE_NAME="pve-scripts-local"

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Helper Functions --------------------------------------------------------
msg() { echo -e "${BLUE}[INFO]${NC} $1"; }
msg_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
msg_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
msg_err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

header() {
	echo ""
	echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
	echo -e "${CYAN}║${NC}  ${BOLD}ProxmoxVE-Local Pre-Release Updater${NC}                        ${CYAN}║${NC}"
	echo -e "${CYAN}║${NC}  Test upcoming releases before they go stable               ${CYAN}║${NC}"
	echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
	echo ""
}

# --- Dependency Check --------------------------------------------------------
check_dependencies() {
	local missing=()
	for cmd in curl jq tar node npm; do
		if ! command -v "$cmd" &>/dev/null; then
			missing+=("$cmd")
		fi
	done

	if [ ${#missing[@]} -ne 0 ]; then
		msg_err "Missing dependencies: ${missing[*]}"
		msg_err "Install them with: apt-get install -y ${missing[*]}"
		exit 1
	fi
}

# --- Get Current Version -----------------------------------------------------
get_current_version() {
	if [ -f "${INSTALL_DIR}/VERSION" ]; then
		cat "${INSTALL_DIR}/VERSION" | tr -d '[:space:]'
	else
		echo "unknown"
	fi
}

# --- Fetch Pre-Releases from GitHub ------------------------------------------
fetch_prereleases() {
	msg "Fetching available pre-releases from GitHub..." >&2

	local curl_opts="-fsSL --connect-timeout 15 --max-time 30"

	# Add token if available
	if [ -n "${GITHUB_TOKEN:-}" ]; then
		curl_opts="$curl_opts -H \"Authorization: token $GITHUB_TOKEN\""
	fi

	local releases_json
	if ! releases_json=$(eval "curl $curl_opts \"${GITHUB_API}/releases?per_page=20\""); then
		msg_err "Failed to fetch releases from GitHub API"
		msg_err "Check your internet connection or try again later."
		exit 1
	fi

	# Validate JSON
	if ! echo "$releases_json" | jq empty 2>/dev/null; then
		msg_err "Invalid response from GitHub API"
		exit 1
	fi

	# Filter pre-releases only, sort newest first (already sorted by API)
	local prereleases
	prereleases=$(echo "$releases_json" | jq -r '[.[] | select(.prerelease == true)] | sort_by(.published_at) | reverse')

	local count
	count=$(echo "$prereleases" | jq 'length')

	if [ "$count" -eq 0 ]; then
		msg_warn "No pre-releases found." >&2
		msg "There are currently no pre-release versions available for testing." >&2
		exit 0
	fi

	echo "$prereleases"
}

# --- Display Menu ------------------------------------------------------------
display_menu() {
	local prereleases="$1"
	local current_version="$2"
	local count
	count=$(echo "$prereleases" | jq 'length')

	echo -e "${BOLD}Currently installed:${NC} v${current_version}"
	echo ""
	echo -e "${BOLD}Available Pre-Releases:${NC} (newest first)"
	echo -e "────────────────────────────────────────────────────"
	printf "  ${BOLD}%-4s %-20s %-12s %s${NC}\n" "#" "Version" "Date" "Notes"
	echo -e "────────────────────────────────────────────────────"

	for ((i = 0; i < count; i++)); do
		local tag_name published_at name
		tag_name=$(echo "$prereleases" | jq -r ".[$i].tag_name")
		published_at=$(echo "$prereleases" | jq -r ".[$i].published_at // .[$i].created_at" | cut -d'T' -f1)
		name=$(echo "$prereleases" | jq -r ".[$i].name // .[$i].tag_name" | head -c 30)

		local marker=""
		if [ "$tag_name" = "v${current_version}" ] || [ "$tag_name" = "${current_version}" ]; then
			marker=" ${GREEN}← installed${NC}"
		fi

		printf "  ${CYAN}%-4s${NC} %-20s %-12s %s%b\n" "$((i + 1))" "$tag_name" "$published_at" "$name" "$marker"
	done

	echo -e "────────────────────────────────────────────────────"
	echo ""
}

# --- User Selection ----------------------------------------------------------
get_user_choice() {
	local count="$1"

	while true; do
		echo -ne "${BOLD}Select a pre-release to install [1-${count}] (or 'q' to quit): ${NC}" >&2
		read -r choice

		if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
			msg "Aborted by user." >&2
			exit 0
		fi

		# Validate numeric input
		if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "$count" ]; then
			echo "$choice"
			return 0
		fi

		msg_warn "Invalid choice. Please enter a number between 1 and ${count}." >&2
	done
}

# --- Backup ------------------------------------------------------------------
backup_current() {
	if [ ! -d "$INSTALL_DIR" ]; then
		msg "No existing installation found, skipping backup."
		return 0
	fi

	msg "Backing up current installation..."
	mkdir -p "$BACKUP_DIR"

	# Backup critical data
	if [ -d "${INSTALL_DIR}/data" ]; then
		cp -r "${INSTALL_DIR}/data" "$BACKUP_DIR/data"
	fi
	if [ -f "${INSTALL_DIR}/.env" ]; then
		cp "${INSTALL_DIR}/.env" "$BACKUP_DIR/.env"
	fi
	if [ -d "${INSTALL_DIR}/prisma" ]; then
		# Backup the SQLite database if it exists
		find "${INSTALL_DIR}/prisma" -name "*.db" -exec cp {} "$BACKUP_DIR/" \; 2>/dev/null || true
	fi

	# Backup downloaded scripts so updates never wipe user downloads
	for dir in ct tools vm vw; do
		if [ -d "${INSTALL_DIR}/scripts/${dir}" ]; then
			cp -r "${INSTALL_DIR}/scripts/${dir}" "$BACKUP_DIR/scripts-${dir}"
		fi
	done

	msg_ok "Backup created at: $BACKUP_DIR"
}

restore_downloaded_scripts() {
	for dir in ct tools vm vw; do
		if [ -d "$BACKUP_DIR/scripts-${dir}" ]; then
			mkdir -p "${INSTALL_DIR}/scripts"
			rm -rf "${INSTALL_DIR}/scripts/${dir}" 2>/dev/null || true
			cp -r "$BACKUP_DIR/scripts-${dir}" "${INSTALL_DIR}/scripts/${dir}"
			msg_ok "Restored downloaded scripts directory: scripts/${dir}"
		fi
	done
}

# --- Install Pre-Release -----------------------------------------------------
install_prerelease() {
	local tag_name="$1"

	msg "Installing pre-release: ${tag_name}..."

	local download_url="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/tags/${tag_name}.tar.gz"
	local temp_dir="/tmp/pve-prerelease-$$"

	# Create temp directory
	mkdir -p "$temp_dir"
	trap "rm -rf $temp_dir" EXIT

	# Download
	msg "Downloading ${tag_name}..."
	if ! curl -fsSL --connect-timeout 30 --max-time 300 --retry 3 -o "$temp_dir/release.tar.gz" "$download_url"; then
		msg_err "Failed to download release. Check that the tag '${tag_name}' exists."
		exit 1
	fi

	# Verify download
	if [ ! -s "$temp_dir/release.tar.gz" ]; then
		msg_err "Downloaded file is empty."
		exit 1
	fi

	msg_ok "Downloaded ($(du -h "$temp_dir/release.tar.gz" | cut -f1))"

	# Extract
	msg "Extracting..."
	if ! tar -xzf "$temp_dir/release.tar.gz" -C "$temp_dir"; then
		msg_err "Failed to extract release archive."
		exit 1
	fi

	# Find extracted directory
	local extracted_dir
	extracted_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "${REPO_NAME}-*" | head -1)
	if [ -z "$extracted_dir" ]; then
		msg_err "Could not find extracted directory."
		exit 1
	fi

	# Stop service if running
	local service_was_running=false
	if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
		msg "Stopping ${SERVICE_NAME} service..."
		systemctl stop "$SERVICE_NAME"
		service_was_running=true
	fi

	# Install: sync files (preserve data, .env, node_modules)
	msg "Installing files to ${INSTALL_DIR}..."
	mkdir -p "$INSTALL_DIR"

	# Use rsync if available, otherwise manual copy
	if command -v rsync &>/dev/null; then
		rsync -a --delete \
			--exclude='data/' \
			--exclude='.env' \
			--exclude='node_modules/' \
			--exclude='scripts/ct/' \
			--exclude='scripts/tools/' \
			--exclude='scripts/vm/' \
			--exclude='scripts/vw/' \
			--exclude='prisma/*.db' \
			--exclude='prisma/*.db-journal' \
			"$extracted_dir/" "$INSTALL_DIR/"
	else
		# Manual approach: remove old files (except protected), copy new
		find "$INSTALL_DIR" -mindepth 1 \
			! -path "${INSTALL_DIR}/data*" \
			! -path "${INSTALL_DIR}/.env" \
			! -path "${INSTALL_DIR}/node_modules*" \
			! -name "*.db" \
			! -name "*.db-journal" \
			-delete 2>/dev/null || true
		cp -r "$extracted_dir/"* "$INSTALL_DIR/"
	fi

	# Always restore user-downloaded scripts after copying release files
	restore_downloaded_scripts

	msg_ok "Files installed"

	# Install dependencies (dev deps needed for prisma generate & build)
	msg "Installing npm dependencies..."
	cd "$INSTALL_DIR"
	if ! npm ci 2>/dev/null; then
		msg_warn "npm ci failed, trying npm install..."
		npm install
	fi
	msg_ok "Dependencies installed"

	# Run prisma migrations
	msg "Running database migrations..."
	npx prisma migrate deploy 2>/dev/null || msg_warn "Migration skipped (may already be up to date)"
	msg_ok "Database ready"

	# Build
	msg "Building application..."
	if ! npm run build; then
		msg_err "Build failed! Check the logs above."
		msg_warn "Your backup is at: $BACKUP_DIR"
		exit 1
	fi
	msg_ok "Build complete"

	# Restart service if it was running
	if [ "$service_was_running" = true ]; then
		msg "Restarting ${SERVICE_NAME} service..."
		systemctl start "$SERVICE_NAME"
		msg_ok "Service restarted"
	fi

	echo ""
	echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
	echo -e "${GREEN}║${NC}  ${BOLD}Pre-release ${tag_name} installed successfully!${NC}            ${GREEN}║${NC}"
	echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
	echo ""
	msg "Backup location: $BACKUP_DIR"
	msg "To rollback, restore the backup and run: systemctl restart ${SERVICE_NAME}"
	echo ""
}

# --- Main --------------------------------------------------------------------
main() {
	header

	# Must run as root
	if [ "$(id -u)" -ne 0 ]; then
		msg_err "This script must be run as root (use sudo)."
		exit 1
	fi

	check_dependencies

	local current_version
	current_version=$(get_current_version)

	# Fetch pre-releases
	local prereleases
	prereleases=$(fetch_prereleases)

	local count
	count=$(echo "$prereleases" | jq 'length')

	# Display menu
	display_menu "$prereleases" "$current_version"

	# Get user choice
	local choice
	choice=$(get_user_choice "$count")

	# Get selected tag
	local selected_tag
	selected_tag=$(echo "$prereleases" | jq -r ".[$(($choice - 1))].tag_name")

	# Confirm
	echo ""
	echo -e "${YELLOW}You are about to update:${NC}"
	echo -e "  From: ${BOLD}v${current_version}${NC}"
	echo -e "  To:   ${BOLD}${selected_tag}${NC}"
	echo ""
	echo -ne "${BOLD}Continue? [y/N]: ${NC}"
	read -r confirm

	if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
		msg "Aborted by user."
		exit 0
	fi

	# Backup and install
	backup_current
	install_prerelease "$selected_tag"
}

main "$@"
