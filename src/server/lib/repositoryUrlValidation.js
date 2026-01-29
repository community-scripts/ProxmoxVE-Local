/**
 * Repository URL validation (JS mirror for server.js).
 */
const VALID_REPO_URL =
  /^(https?:\/\/)(github\.com|gitlab\.com|bitbucket\.org|[^/]+)\/[^/]+\/[^/]+$/;

export const REPO_URL_ERROR_MESSAGE =
  'Invalid repository URL. Supported: GitHub, GitLab, Bitbucket, and custom Git servers (e.g. https://host/owner/repo).';

export function isValidRepositoryUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  return VALID_REPO_URL.test(url.trim());
}

export function getRepoProvider(url) {
  if (!isValidRepositoryUrl(url)) throw new Error(REPO_URL_ERROR_MESSAGE);
  const normalized = url.trim().toLowerCase();
  if (normalized.includes('github.com')) return 'github';
  if (normalized.includes('gitlab.com')) return 'gitlab';
  if (normalized.includes('bitbucket.org')) return 'bitbucket';
  return 'custom';
}

export function parseRepoUrl(url) {
  if (!isValidRepositoryUrl(url)) throw new Error(REPO_URL_ERROR_MESSAGE);
  try {
    const u = new URL(url.trim());
    const pathParts = u.pathname.replace(/^\/+/, '').replace(/\.git\/?$/, '').split('/');
    return {
      origin: u.origin,
      owner: pathParts[0] ?? '',
      repo: pathParts[1] ?? '',
    };
  } catch {
    throw new Error(REPO_URL_ERROR_MESSAGE);
  }
}
