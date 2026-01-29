import type { DirEntry, GitProvider } from "./types";
import { getRepoProvider } from "../repositoryUrlValidation";
import { GitHubProvider } from "./github";
import { GitLabProvider } from "./gitlab";
import { BitbucketProvider } from "./bitbucket";
import { CustomProvider } from "./custom";

const providers: Record<string, GitProvider> = {
  github: new GitHubProvider(),
  gitlab: new GitLabProvider(),
  bitbucket: new BitbucketProvider(),
  custom: new CustomProvider(),
};

export type { DirEntry, GitProvider };
export { getRepoProvider };

export function getGitProvider(repoUrl: string): GitProvider {
  return providers[getRepoProvider(repoUrl)]!;
}

export async function listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]> {
  return getGitProvider(repoUrl).listDirectory(repoUrl, path, branch);
}

export async function downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string> {
  return getGitProvider(repoUrl).downloadRawFile(repoUrl, filePath, branch);
}
