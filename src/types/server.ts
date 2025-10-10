export interface Server {
  id: number;
  name: string;
  ip: string;
  user: string;
  password?: string;
  auth_type?: 'password' | 'key' | 'both';
  ssh_key?: string;
  ssh_key_passphrase?: string;
  ssh_port?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateServerData {
  name: string;
  ip: string;
  user: string;
  password?: string;
  auth_type?: 'password' | 'key' | 'both';
  ssh_key?: string;
  ssh_key_passphrase?: string;
  ssh_port?: number;
}

export interface UpdateServerData extends CreateServerData {
  id: number;
}

