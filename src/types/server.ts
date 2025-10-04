export interface Server {
  id: number;
  name: string;
  ip: string;
  user: string;
  password?: string;
  ssh_key?: string;
  auth_method: 'password' | 'ssh_key';
  created_at: string;
  updated_at: string;
}

export interface CreateServerData {
  name: string;
  ip: string;
  user: string;
  password?: string;
  ssh_key?: string;
  auth_method?: 'password' | 'ssh_key';
}

export interface UpdateServerData extends CreateServerData {
  id: number;
}

