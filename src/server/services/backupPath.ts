interface StoragePathConfig {
  name: string;
  path?: unknown;
}

export function getStorageDumpPath(storage: StoragePathConfig): string {
  const configuredPath =
    typeof storage.path === 'string' && storage.path.trim()
      ? storage.path.trim().replace(/\/+$/, '')
      : `/mnt/pve/${storage.name}`;

  return `${configuredPath}/dump/`;
}

export function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
