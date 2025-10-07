import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { readFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
}

export const versionRouter = createTRPCRouter({
  // Get current local version
  getCurrentVersion: publicProcedure
    .query(async () => {
      try {
        const versionPath = join(process.cwd(), 'VERSION');
        const version = await readFile(versionPath, 'utf-8');
        return {
          success: true,
          version: version.trim()
        };
      } catch (error) {
        console.error('Error reading VERSION file:', error);
        return {
          success: false,
          error: 'Failed to read VERSION file',
          version: null
        };
      }
    }),

  getLatestRelease: publicProcedure
    .query(async () => {
      try {
        const response = await fetch('https://api.github.com/repos/community-scripts/ProxmoxVE-Local/releases/latest');
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const release: GitHubRelease = await response.json();
        
        return {
          success: true,
          release: {
            tagName: release.tag_name,
            name: release.name,
            publishedAt: release.published_at,
            htmlUrl: release.html_url
          }
        };
      } catch (error) {
        console.error('Error fetching latest release:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch latest release',
          release: null
        };
      }
    }),


  getVersionStatus: publicProcedure
    .query(async () => {
      try {

        const versionPath = join(process.cwd(), 'VERSION');
        const currentVersion = (await readFile(versionPath, 'utf-8')).trim();
        

        const response = await fetch('https://api.github.com/repos/community-scripts/ProxmoxVE-Local/releases/latest');
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const release: GitHubRelease = await response.json();
        const latestVersion = release.tag_name.replace('v', ''); 
        

        const isUpToDate = currentVersion === latestVersion;
        
        return {
          success: true,
          currentVersion,
          latestVersion,
          isUpToDate,
          updateAvailable: !isUpToDate,
          releaseInfo: {
            tagName: release.tag_name,
            name: release.name,
            publishedAt: release.published_at,
            htmlUrl: release.html_url
          }
        };
      } catch (error) {
        console.error('Error checking version status:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check version status',
          currentVersion: null,
          latestVersion: null,
          isUpToDate: false,
          updateAvailable: false,
          releaseInfo: null
        };
      }
    }),

  // Execute update script
  executeUpdate: publicProcedure
    .mutation(async () => {
      try {
        const updateScriptPath = join(process.cwd(), 'update.sh');
        
        return new Promise((resolve) => {
          // Create a safer wrapper script that preserves the web server
          const wrapperScript = `#!/bin/bash
# Wrapper script to run update while preserving the web server process
WEB_SERVER_PID=${process.pid}
LOG_FILE="/tmp/update.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting update process (preserving web server PID: $WEB_SERVER_PID)" | tee -a "$LOG_FILE"

# Create a modified kill function that excludes our web server
safe_kill_node_processes() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping Node.js processes (excluding web server)..." | tee -a "$LOG_FILE"
    
    # Find all node server.js processes except our web server
    local pids
    pids=$(pgrep -f "node server.js" 2>/dev/null | grep -v "^$WEB_SERVER_PID$" || true)
    
    if [ -n "$pids" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found Node.js processes to stop: $pids" | tee -a "$LOG_FILE"
        for pid in $pids; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping PID: $pid" | tee -a "$LOG_FILE"
                kill -TERM "$pid" 2>/dev/null || true
            fi
        done
        
        # Wait for graceful shutdown
        sleep 3
        
        # Force kill any remaining processes (except our web server)
        local remaining
        remaining=$(pgrep -f "node server.js" 2>/dev/null | grep -v "^$WEB_SERVER_PID$" || true)
        if [ -n "$remaining" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Force killing remaining processes: $remaining" | tee -a "$LOG_FILE"
            for pid in $remaining; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] No other Node.js processes found to stop" | tee -a "$LOG_FILE"
    fi
}

# Export the function so the update script can use it
export -f safe_kill_node_processes

# Run the original update script but replace the kill commands
bash -c '
# Source the original update script but override the kill functions
source "${updateScriptPath}" 2>/dev/null || true

# Override the kill_processes function
kill_processes() {
    safe_kill_node_processes
}

# Override the stop_application function to use our safe version
stop_application() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping application (safe mode)..." | tee -a "$LOG_FILE"
    safe_kill_node_processes
}

# Run the main function from the original script
main "$@"
' "${updateScriptPath}" "$@"

EXIT_CODE=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update process completed with exit code: $EXIT_CODE" | tee -a "$LOG_FILE"
exit $EXIT_CODE
`;

          // Write wrapper script to temp file
          const fs = require('fs');
          const wrapperPath = `/tmp/update_wrapper_${process.pid}.sh`;
          fs.writeFileSync(wrapperPath, wrapperScript);
          fs.chmodSync(wrapperPath, '755');

          // Run the wrapper script
          const child = spawn('bash', [wrapperPath], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            detached: false
          });

          let output = '';
          let errorOutput = '';

          child.stdout?.on('data', (data) => {
            output += data.toString();
          });

          child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
          });

          // Set a timeout to avoid hanging indefinitely
          const timeout = setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGTERM');
              // Give it a moment to terminate gracefully
              setTimeout(() => {
                if (!child.killed) {
                  child.kill('SIGKILL');
                }
              }, 5000);
            }
            resolve({
              success: false,
              message: 'Update script timed out',
              output: output,
              error: errorOutput + '\nScript timed out after 10 minutes'
            });
          }, 10 * 60 * 1000); // 10 minutes timeout

          child.on('close', (code) => {
            clearTimeout(timeout);
            // Clean up wrapper script
            try {
              fs.unlinkSync(wrapperPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            
            if (code === 0) {
              resolve({
                success: true,
                message: 'Update completed successfully',
                output: output,
                error: errorOutput
              });
            } else {
              resolve({
                success: false,
                message: `Update failed with exit code ${code}`,
                output: output,
                error: errorOutput
              });
            }
          });

          child.on('error', (error) => {
            clearTimeout(timeout);
            // Clean up wrapper script
            try {
              fs.unlinkSync(wrapperPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            resolve({
              success: false,
              message: 'Failed to execute update script',
              output: output,
              error: error.message
            });
          });
        });
      } catch (error) {
        console.error('Error executing update script:', error);
        return {
          success: false,
          message: 'Failed to execute update script',
          output: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
});
