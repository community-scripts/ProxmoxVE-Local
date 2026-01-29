import type { DirEntry, GitProvider } from "./types";
import { parseRepoUrl } from "../repositoryUrlValidation";

export class CustomProvider implements GitProvider {
  async listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]> {
    const { origin, owner, repo } = parseRepoUrl(repoUrl);
    const apiUrl = `${origin}/api/v1/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    const headers: Record<string, string> = { "User-Agent": "PVEScripts-Local/1.0" };
    const token = process.env.GITEA_TOKEN ?? process.env.GIT_TOKEN;
    if (token) headers.Authorization = `token ${token}`;

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) {
      throw new Error(`Custom Git server: list directory failed (${response.status}).`);
    }
    const data = (await response.json()) as { type: string; name: string; path: string }[];
    if (!Array.isArray(data)) {
      const single = data as unknown as { type?: string; name?: string; path?: string };
      if (single?.name) {
        return [{ name: single.name, path: single.path ?? path, type: single.type === "dir" ? "dir" : "file" }];
      }
      throw new Error("Custom Git server returned unexpected response");
    }
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type === "dir" ? ("dir" as const) : ("file" as const),
    }));
  }

  async downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const { origin, owner, repo } = parseRepoUrl(repoUrl);
    const rawUrl = `${origin}/${owner}/${repo}/raw/${encodeURIComponent(branch)}/${filePath}`;
    const headers: Record<string, string> = { "User-Agent": "PVEScripts-Local/1.0" };
    const token = process.env.GITEA_TOKEN ?? process.env.GIT_TOKEN;
    if (token) headers.Authorization = `token ${token}`;

    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download ${filePath} from custom Git server (${response.status}).`);
    }
    return response.text();
  }
}
