export interface ScriptResources {
  cpu: number;
  ram: number;
  hdd: number;
  os: string;
  version: string;
}

export interface ScriptInstallMethod {
  type: string;
  script: string;
  resources: ScriptResources;
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
  categories: number[];
  date_created: string;
  type: string;
  updateable: boolean;
  privileged: boolean;
  interface_port: number | null;
  documentation: string | null;
  website: string | null;
  logo: string | null;
  config_path: string;
  description: string;
  install_methods: ScriptInstallMethod[];
  default_credentials: ScriptCredentials;
  notes: (ScriptNote | string)[];
}

export interface ScriptCard {
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  type: string;
  updateable: boolean;
  website: string | null;
  source?: 'github' | 'local';
  isDownloaded?: boolean;
  localPath?: string;
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
