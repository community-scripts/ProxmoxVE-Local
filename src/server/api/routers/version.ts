import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { readFile, writeFile, stat } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { env } from "~/env";
import { existsSync, createWriteStream } from "fs";
import stripAnsi from "strip-ansi";

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
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
            htmlUrl: release.html_url,
            body: release.body
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

  // Get all releases for release notes
  getAllReleases: publicProcedure
    .query(async () => {
      try {
        const response = await fetchGitHubAPI('https://api.github.com/repos/community-scripts/ProxmoxVE-Local/releases');
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const releases: GitHubRelease[] = await response.json();
        
        // Sort by published date (newest first)
        const sortedReleases = releases
          .filter(release => !release.tag_name.includes('beta') && !release.tag_name.includes('alpha'))
          .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
        
        return {
          success: true,
          releases: sortedReleases.map(release => ({
            tagName: release.tag_name,
            name: release.name,
            publishedAt: release.published_at,
            htmlUrl: release.html_url,
            body: release.body
          }))
        };
      } catch (error) {
        console.error('Error fetching all releases:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch releases',
          releases: []
        };
      }
    }),

  // Get update logs from the log file
  getUpdateLogs: publicProcedure
    .query(async () => {
      try {
        const logPath = join(process.cwd(), 'update.log');
        
        if (!existsSync(logPath)) {
          return {
            success: true,
            logs: [],
            isComplete: false,
            logFileModifiedTime: null
          };
        }

        // Get log file modification time for session validation
        let logFileModifiedTime: number | null = null;
        try {
          const stats = await stat(logPath);
          logFileModifiedTime = stats.mtimeMs;
        } catch (statError) {
          // If we can't get stats, continue without timestamp
          console.warn('Could not get log file stats:', statError);
        }

        const logs = await readFile(logPath, 'utf-8');
        const logLines = logs.split('\n')
          .filter(line => line.trim())
          .map(line => stripAnsi(line)); // Strip ANSI color codes
        
        // Check if update is complete by looking for completion indicators
        const isComplete = logLines.some(line => 
          line.includes('Update complete') || 
          line.includes('Server restarting') ||
          line.includes('npm start') ||
          line.includes('Restarting server') ||
          line.includes('Server started') ||
          line.includes('Ready on http') ||
          line.includes('Application started') ||
          line.includes('Service enabled and started successfully') ||
          line.includes('Service is running') ||
          line.includes('Update completed successfully')
        );

        return {
          success: true,
          logs: logLines,
          isComplete,
          logFileModifiedTime
        };
      } catch (error) {
        console.error('Error reading update logs:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read update logs',
          logs: [],
          isComplete: false,
          logFileModifiedTime: null
        };
      }
    }),

  // Execute update script
  executeUpdate: publicProcedure
    .mutation(async () => {
      try {
        const updateScriptPath = join(process.cwd(), 'update.sh');
        const logPath = join(process.cwd(), 'update.log');
        
        // Clear/create the log file
        await writeFile(logPath, '', 'utf-8');
        
        // Spawn the update script as a detached process using nohup
        // This allows it to run independently and kill the parent Node.js process
        // Redirect output to log file
        const child = spawn('bash', [updateScriptPath], {
          cwd: process.cwd(),
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
          detached: true
        });

        // Capture stdout and stderr to log file
        const logStream = createWriteStream(logPath, { flags: 'a' });
        child.stdout?.pipe(logStream);
        child.stderr?.pipe(logStream);

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
