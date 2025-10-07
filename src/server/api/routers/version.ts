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
          // Run the script directly without nohup to properly monitor it
          const child = spawn('bash', [updateScriptPath], {
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
