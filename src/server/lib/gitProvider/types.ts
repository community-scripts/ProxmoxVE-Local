/**
 * Git provider interface for listing and downloading repository files.
 */

export type DirEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
};

export interface GitProvider {
  listDirectory(repoUrl: string, path: string, branch: string): Promise<DirEntry[]>;
  downloadRawFile(repoUrl: string, filePath: string, branch: string): Promise<string>;
}
