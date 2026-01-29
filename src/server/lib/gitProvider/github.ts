import type { DirEntry, GitProvider } from './types';
import { parseRepoUrl } from '../repositoryUrlValidation';

export class GitHubProvider implements GitProvider {
  async listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]> {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `token ${token}`;

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      if (response.status === 403) {
        const err = new Error(
          `GitHub API rate limit exceeded. Consider setting GITHUB_TOKEN. Status: ${response.status} ${response.statusText}`
        );
        (err as Error & { name: string }).name = 'RateLimitError';
        throw err;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { type: string; name: string; path: string }[];
    if (!Array.isArray(data)) {
      throw new Error('GitHub API returned unexpected response');
    }
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === 'dir' ? ('dir' as const) : ('file' as const),
    }));
  }

  async downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${filePath}`;
    const headers: Record<string, string> = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `token ${token}`;

    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      if (response.status === 403) {
        const err = new Error(
          `GitHub rate limit exceeded while downloading ${filePath}. Consider setting GITHUB_TOKEN.`
        );
        (err as Error & { name: string }).name = 'RateLimitError';
        throw err;
      }
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
}
