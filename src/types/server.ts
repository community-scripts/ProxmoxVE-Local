export interface Server {
  id: number;
  name: string;
  ip: string;
  user: string;
  password?: string;
  auth_type?: 'password' | 'key';
  ssh_key?: string;
  ssh_key_passphrase?: string;
  ssh_key_path?: string;
  key_generated?: boolean;
  ssh_port?: number;
  color?: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface CreateServerData {
  name: string;
  ip: string;
  user: string;
  password?: string;
  auth_type?: 'password' | 'key';
  ssh_key?: string;
  ssh_key_passphrase?: string;
  ssh_key_path?: string;
  key_generated?: boolean;
  ssh_port?: number;
  color?: string;
}

export interface UpdateServerData extends CreateServerData {
  id: number;
}

