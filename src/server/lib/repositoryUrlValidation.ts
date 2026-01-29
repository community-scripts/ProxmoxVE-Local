/**
 * Repository URL validation and provider detection.
 * Supports GitHub, GitLab, Bitbucket, and custom Git servers.
 */

const VALID_REPO_URL =
  /^(https?:\/\/)(github\.com|gitlab\.com|bitbucket\.org|[^/]+)\/[^/]+\/[^/]+$/;

export const REPO_URL_ERROR_MESSAGE =
  'Invalid repository URL. Supported: GitHub, GitLab, Bitbucket, and custom Git servers (e.g. https://host/owner/repo).';

export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'custom';

/**
 * Check if a string is a valid repository URL (format only).
 */
export function isValidRepositoryUrl(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  return VALID_REPO_URL.test(url.trim());
}

/**
 * Detect the Git provider from a repository URL.
 */
export function getRepoProvider(url: string): RepoProvider {
  if (!isValidRepositoryUrl(url)) {
    throw new Error(REPO_URL_ERROR_MESSAGE);
  }
  const normalized = url.trim().toLowerCase();
  if (normalized.includes('github.com')) return 'github';
  if (normalized.includes('gitlab.com')) return 'gitlab';
  if (normalized.includes('bitbucket.org')) return 'bitbucket';
  return 'custom';
}

/**
 * Parse owner and repo from a repository URL (path segments).
 * Works for GitHub, GitLab, Bitbucket, and custom (host/owner/repo).
 */
export function parseRepoUrl(url: string): { origin: string; owner: string; repo: string } {
  if (!isValidRepositoryUrl(url)) {
    throw new Error(REPO_URL_ERROR_MESSAGE);
  }
  try {
    const u = new URL(url.trim());
    const pathParts = u.pathname.replace(/^\/+/, '').replace(/\.git\/?$/, '').split('/');
    const owner = pathParts[0] ?? '';
    const repo = pathParts[1] ?? '';
    return {
      origin: u.origin,
      owner,
      repo,
    };
  } catch {
    throw new Error(REPO_URL_ERROR_MESSAGE);
  }
}
