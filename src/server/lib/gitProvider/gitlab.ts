import type { DirEntry, GitProvider } from './types';
import { parseRepoUrl } from '../repositoryUrlValidation';

export class GitLabProvider implements GitProvider {
  private getBaseUrl(repoUrl: string): string {
    const { origin } = parseRepoUrl(repoUrl);
    return origin;
  }

  private getProjectId(repoUrl: string): string {
    const { owner, repo } = parseRepoUrl(repoUrl);
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]> {
    const baseUrl = this.getBaseUrl(repoUrl);
    const projectId = this.getProjectId(repoUrl);
    const apiUrl = `${baseUrl}/api/v4/projects/${projectId}/repository/tree?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(branch)}&per_page=100`;
    const headers: Record<string, string> = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.GITLAB_TOKEN;
    if (token) headers['PRIVATE-TOKEN'] = token;

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { type: string; name: string; path: string }[];
    if (!Array.isArray(data)) {
      throw new Error('GitLab API returned unexpected response');
    }
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'tree' ? ('dir' as const) : ('file' as const),
    }));
  }

  async downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const baseUrl = this.getBaseUrl(repoUrl);
    const projectId = this.getProjectId(repoUrl);
    const encodedPath = encodeURIComponent(filePath);
    const rawUrl = `${baseUrl}/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(branch)}`;
    const headers: Record<string, string> = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.GITLAB_TOKEN;
    if (token) headers['PRIVATE-TOKEN'] = token;

    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
}
