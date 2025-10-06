import { vi } from 'vitest'

export const mockStats = {
  isFile: vi.fn(() => true),
  isDirectory: vi.fn(() => false),
  size: 1024,
  mtime: new Date('2024-01-01T00:00:00Z'),
  mode: 0o755, // executable permissions
}

export const mockReaddir = vi.fn()
export const mockStat = vi.fn()
export const mockReadFile = vi.fn()

export const resetMocks = () => {
  mockReaddir.mockReset()
  mockStat.mockReset()
  mockReadFile.mockReset()
  mockStats.isFile.mockReset()
  mockStats.isDirectory.mockReset()
}
