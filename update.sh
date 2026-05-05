#!/bin/bash

# ProxmoxVE-Local Bootstrap Updater
# This is a thin, stable wrapper that self-updates the actual update engine
# before running it. Do NOT put complex logic here - keep it minimal.
#
# How it works:
#   1. Fetches UPDATER_VERSION from the main branch on GitHub
#   2. Compares with the local UPDATER_VERSION
#   3. If different -> downloads the new update-engine.sh from main
#   4. Executes update-engine.sh with all original arguments

set -euo pipefail

# --- Configuration -----------------------------------------------------------
REPO_OWNER="community-scripts"
REPO_NAME="ProxmoxVE-Local"
RAW_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_FILE="${SCRIPT_DIR}/update-engine.sh"
LOCAL_VERSION_FILE="${SCRIPT_DIR}/UPDATER_VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- Helper -------------------------------------------------------------------
msg()     { echo -e "${BLUE}[bootstrap]${NC} $1"; }
msg_ok()  { echo -e "${GREEN}[bootstrap]${NC} $1"; }
msg_warn(){ echo -e "${YELLOW}[bootstrap]${NC} $1"; }
msg_err() { echo -e "${RED}[bootstrap]${NC} $1" >&2; }

# --- Self-update logic --------------------------------------------------------
self_update() {
    msg "Checking for update-engine updates..."

    # Read local version (default to "0" if missing)
    local local_version="0"
    if [ -f "$LOCAL_VERSION_FILE" ]; then
        local_version=$(tr -d '[:space:]' < "$LOCAL_VERSION_FILE")
    fi

    # Fetch remote version from main branch
    local remote_version
    local http_status
    remote_version=$(curl -sSL --connect-timeout 10 --max-time 15 \
            -w "\n%{http_code}" "${RAW_BASE}/UPDATER_VERSION" 2>/dev/null) || true
    http_status=$(echo "$remote_version" | tail -1)
    remote_version=$(echo "$remote_version" | head -1 | tr -d '[:space:]')

    # If fetch failed or file doesn't exist on remote (404), skip self-update
    # and proceed with the local engine. This is expected during pre-releases
    # before the branch is merged into main.
    if [ "$http_status" != "200" ] || [ -z "$remote_version" ]; then
        msg_warn "Cannot reach remote UPDATER_VERSION (HTTP ${http_status:-err}). Skipping engine self-update."
        return 0
    fi

    # Compare versions
    if [ "$local_version" = "$remote_version" ]; then
        msg_ok "Update engine is current (v${local_version})"
        return 0
    fi

    msg_warn "Update engine outdated: local v${local_version} -> remote v${remote_version}"
    msg "Downloading latest update-engine.sh from main branch..."

    # Download new engine to a temp file first (atomic replace)
    local tmp_engine
    tmp_engine=$(mktemp "${ENGINE_FILE}.XXXXXX")

    if ! curl -fsSL --connect-timeout 15 --max-time 60 \
            "${RAW_BASE}/update-engine.sh" -o "$tmp_engine" 2>/dev/null; then
        rm -f "$tmp_engine"
        msg_err "Failed to download update-engine.sh. Aborting."
        exit 1
    fi

    # Basic sanity check - must start with shebang
    if ! head -1 "$tmp_engine" | grep -q '^#!/bin/bash'; then
        rm -f "$tmp_engine"
        msg_err "Downloaded engine failed sanity check (no shebang). Aborting."
        exit 1
    fi

    # Atomic replace
    chmod +x "$tmp_engine"
    mv -f "$tmp_engine" "$ENGINE_FILE"

    # Update local version file
    echo "$remote_version" > "$LOCAL_VERSION_FILE"

    # Also download the new UPDATER_VERSION (in case the bootstrap itself
    # needs to be aware of schema changes in future versions)
    msg_ok "Update engine updated to v${remote_version}"
}

# --- Main ---------------------------------------------------------------------
main() {
    msg "ProxmoxVE-Local Bootstrap Updater"

    # Step 1: Self-update the engine
    self_update

    # Step 2: Verify engine exists
    if [ ! -f "$ENGINE_FILE" ]; then
        msg_err "update-engine.sh not found at: $ENGINE_FILE"
        msg_err "This should not happen. Re-download the release manually."
        exit 1
    fi

    if [ ! -x "$ENGINE_FILE" ]; then
        chmod +x "$ENGINE_FILE"
    fi

    # Step 3: Hand off to the engine with all arguments
    msg "Handing off to update-engine.sh..."
    echo ""
    exec "$ENGINE_FILE" "$@"
}

main "$@"