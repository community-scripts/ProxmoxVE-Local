export interface ScriptResources {
  cpu: number;
  ram: number;
  hdd: number;
  os: string;
  version: string;
}

export interface ScriptInstallMethod {
  /** Method type: "default", "alpine", etc. */
  type: string;
  resources: ScriptResources;
  config_path?: string;
  /**
   * Optional install script file path (e.g. "ct/adguard.sh").
   * Present in user-defined local JSON scripts.
   * For PocketBase-sourced scripts this field is absent; the downloader derives
   * the path from the script type and slug via `deriveScriptPath()`.
   */
  script?: string;
}

export interface ScriptCredentials {
  username: string | null;
  password: string | null;
}

export interface ScriptNote {
  text: string;
  type: string;
}

export interface Script {
  name: string;
  slug: string;
  /**
   * Category names (strings) when coming from PocketBase, or legacy
   * numeric IDs when coming from local JSON files.
   */
  categories: string[] | number[];
  /** ISO date string (maps to PocketBase script_created). */
  date_created: string;
  /** Script type slug: "ct", "vm", "pve", "addon", "turnkey". */
  type: string;
  updateable: boolean;
  privileged: boolean;
  /** Web UI port (maps to PocketBase port field). */
  interface_port: number | null;
  documentation: string | null;
  website: string | null;
  logo: string | null;
  config_path: string | null;
  description: string;
  install_methods: ScriptInstallMethod[];
  default_credentials: ScriptCredentials;
  notes: ScriptNote[];
  is_dev?: boolean;
  is_disabled?: boolean;
  is_deleted?: boolean;
  has_arm?: boolean;
  version?: string | null;
  /** Only present for user-defined local scripts. */
  repository_url?: string;
}

export interface ScriptCard {
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  /** Script type slug: "ct", "vm", "pve", "addon", "turnkey". */
  type: string;
  updateable: boolean;
  website: string | null;
  isDownloaded?: boolean;
  isUpToDate?: boolean;
  localPath?: string;
  /** Category names for display / filtering. */
  categoryNames?: string[];
  date_created?: string;
  os?: string;
  version?: string;
  interface_port?: number | null;
  /**
   * Basenames of expected install script files (without extension).
   * Used to match a card against scripts already downloaded to disk.
   * Derived from the script type + slug convention.
   */
  install_basenames?: string[];
  /** Repository URL – optional, only set for user-local JSON scripts. */
  repository_url?: string;
  is_dev?: boolean;
  is_disabled?: boolean;
  is_deleted?: boolean;
  has_arm?: boolean;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content?: string;
  encoding?: string;
}
