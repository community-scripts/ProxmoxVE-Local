<!-- e1958379-99ce-42d2-8fe6-2c5007b3f52a cd8f1eb6-6ae5-4b21-9ca9-c208d4e80622 -->
# Persistent SSH Keys with Simplified Authentication

## Overview

Simplify SSH authentication to only support password OR key (remove confusing 'both' option). Use persistent key files instead of temporary files. Add on-the-fly key generation with public key viewing/copying.

## Implementation Steps

### 1. Create SSH Keys Directory Structure

- Add `data/ssh-keys/` directory for persistent SSH key files
- Name format: `server_{id}_key` and `server_{id}_key.pub`
- Set permissions: 0700 for directory, 0600 for key files
- Add to `.gitignore` to prevent committing keys

### 2. Update Database Schema (`src/server/database.js`)

- Change auth_type CHECK constraint: only allow 'password' or 'key' (remove 'both')
- Add `ssh_key_path` TEXT column for file path
- Add `key_generated` INTEGER (0/1) to track generated vs user-provided keys
- Migration: Convert existing 'both' auth_type to 'key'
- Update `addServer()`: Write key to persistent file, store path
- Update `updateServer()`: Handle key changes (write new, delete old)
- Update `deleteServer()`: Clean up key files

### 3. SSH Key Generation Feature (`src/server/ssh-service.js`)

- Add `generateKeyPair(serverId)` method using `ssh-keygen` command
- Command: `ssh-keygen -t ed25519 -f data/ssh-keys/server_{id}_key -N "" -C "pve-scripts-local"`
- Return both private and public key content
- Add `getPublicKey(keyPath)` to extract public key from private key

### 4. Backend API Endpoints (New Files)

- `POST /api/servers/generate-keypair` 
- Generate temporary key pair (not yet saved to server)
- Return `{ privateKey, publicKey }`
- `GET /api/servers/[id]/public-key`
- Only if `key_generated === 1`
- Return `{ publicKey, serverName, serverIp }`

### 5. Frontend: ServerForm Component

- **Remove 'both' from auth_type dropdown** - only show Password/SSH Key
- Add "Generate Key Pair" button (visible when auth_type === 'key')
- On generate: populate SSH key field, show modal with public key
- Add PublicKeyModal component with copy-to-clipboard
- Disable manual key entry when using generated key

### 6. Frontend: ServerList Component

- Add "View Public Key" button between Test Connection and Edit
- Only show when `server.key_generated === true`
- Click opens PublicKeyModal with copy button
- Show instructions: "Add this to /root/.ssh/authorized_keys on your server"

### 7. Update SSH Service (`src/server/ssh-service.js`)

- **Remove all 'both' auth_type handling**
- Remove temp file creation from `testWithSSHKey()`
- Use persistent `ssh_key_path` from database
- Simplify `testConnection()`: only handle 'password' or 'key'

### 8. Update SSH Execution Service (`src/server/ssh-execution-service.js`)

- **Remove `createTempKeyFile()` method**
- **Remove all 'both' auth_type cases**
- Update `buildSSHCommand()`: use `ssh_key_path`, only handle 'password'/'key'
- Update `transferScriptsFolder()`: use `ssh_key_path` in rsync
- Update `executeCommand()`: use `ssh_key_path`
- Remove all temp file cleanup code

### 9. Files to Create/Modify

- `src/server/database.js` - Schema changes, persistence
- `src/server/ssh-service.js` - Key generation, remove temp files, remove 'both'
- `src/server/ssh-execution-service.js` - Use persistent keys, remove 'both'
- `src/app/api/servers/generate-keypair/route.ts` - NEW
- `src/app/api/servers/[id]/public-key/route.ts` - NEW
- `src/app/_components/ServerForm.tsx` - Generate button, remove 'both'
- `src/app/_components/ServerList.tsx` - View public key button
- `src/app/_components/PublicKeyModal.tsx` - NEW component
- `.gitignore` - Add `data/ssh-keys/`

### 11. Migration & Initialization

- On startup: create `data/ssh-keys/` if missing
- Existing 'both' servers: convert to 'key' auth_type
- Existing ssh_key content: migrate to persistent files on first use
- Set `key_generated = 0` for migrated servers

## Benefits

- Simpler auth model (no confusing 'both' option)
- Fixes "error in libcrypto" timing issues
- User-friendly key generation
- Easy public key access for setup
- Less code complexity

### To-dos

- [ ] Create data/ssh-keys directory structure and update .gitignore
- [ ] Add ssh_key_path column to database and implement migration
- [ ] Modify addServer/updateServer/deleteServer to handle persistent key files
- [ ] Remove temp key creation from ssh-service.js and use persistent paths
- [ ] Remove createTempKeyFile and update all methods to use persistent keys
- [ ] Test with existing servers that have SSH keys to ensure migration works
- [ ] Modify the HelpModal to reflect the changes Made to the SSH auth
- [ ] Create a fix branch