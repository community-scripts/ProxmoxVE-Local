import type { DirEntry, GitProvider } from './types';
import { parseRepoUrl } from '../repositoryUrlValidation';

export class BitbucketProvider implements GitProvider {
  async listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]> {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const listUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${encodeURIComponent(branch)}/${path}`;
    const headers: Record<string, string> = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.BITBUCKET_APP_PASSWORD ?? process.env.BITBUCKET_TOKEN;
    if (token) {
      const auth = Buffer.from(`:${token}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(listUrl, { headers });
    if (!response.ok) {
      throw new Error(`Bitbucket API error: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { values?: { path: string; type: string }[] };
    const data = body.values ?? (Array.isArray(body) ? body : []);
    if (!Array.isArray(data)) {
      throw new Error('Bitbucket API returned unexpected response');
    }
    return data.map((item: { path: string; type: string }) => {
      const name = item.path.split('/').pop() ?? item.path;
      return {
        name,
        path: item.path,
        type: item.type === 'commit_directory' ? ('dir' as const) : ('file' as const),
      };
    });
  }

  async downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const rawUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${encodeURIComponent(branch)}/${filePath}`;
    const headers: Record<string, string> = {
      'User-Agent': 'PVEScripts-Local/1.0',
    };
    const token = process.env.BITBUCKET_APP_PASSWORD ?? process.env.BITBUCKET_TOKEN;
    if (token) {
      const auth = Buffer.from(`:${token}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }
}
