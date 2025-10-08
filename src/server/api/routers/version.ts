import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { readFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { env } from "~/env";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
}

// Helper function to fetch from GitHub API with optional authentication
async function fetchGitHubAPI(url: string) {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ProxmoxVE-Local'
  };
  
  // Add authentication header if token is available
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `token ${env.GITHUB_TOKEN}`;
  }
  
  return fetch(url, { headers });
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
        const response = await fetchGitHubAPI('https://api.github.com/repos/community-scripts/ProxmoxVE-Local/releases/latest');
        
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
        

        const response = await fetchGitHubAPI('https://api.github.com/repos/community-scripts/ProxmoxVE-Local/releases/latest');
        
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
        
        // Use setsid to create a completely independent process session
        // This ensures the update script survives when it kills the Node.js process
        // setsid creates a new session, making the process immune to parent termination
        const child = spawn('setsid', ['bash', updateScriptPath], {
          cwd: process.cwd(),
          stdio: ['ignore', 'ignore', 'ignore'],
          shell: false,
          detached: true
        });

        // Unref the child process so it doesn't keep the parent alive
        child.unref();

        // Immediately return success since we can't wait for completion
        // The script will handle its own logging and restart
        return {
          success: true,
          message: 'Update started in background. The server will restart automatically when complete.',
          output: '',
          error: ''
        };
      } catch (error) {
        console.error('Error executing update script:', error);
        return {
          success: false,
          message: `Failed to execute update script: ${error instanceof Error ? error.message : 'Unknown error'}`,
          output: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
});
