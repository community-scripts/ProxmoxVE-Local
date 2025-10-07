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
          // Use nohup to run the script independently of the current process
          const child = spawn('nohup', ['bash', updateScriptPath], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            detached: true
          });

          // Unref the child process so it doesn't keep the parent alive
          child.unref();

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
            child.kill('SIGTERM');
            resolve({
              success: false,
              message: 'Update script timed out',
              output: output,
              error: errorOutput + '\nScript timed out after 5 minutes'
            });
          }, 5 * 60 * 1000); // 5 minutes timeout

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
                message: 'Update failed',
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

          // Give the script a moment to start
          setTimeout(() => {
            resolve({
              success: true,
              message: 'Update script started successfully',
              output: 'Update process initiated. Check /tmp/update.log for progress.',
              error: ''
            });
          }, 2000);
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
