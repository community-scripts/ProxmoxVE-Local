import { vi } from 'vitest'

export const mockSpawn = vi.fn()

export const mockChildProcess = {
  kill: vi.fn(),
  on: vi.fn(),
  killed: false,
  stdout: {
    on: vi.fn(),
  },
  stderr: {
    on: vi.fn(),
  },
  stdin: {
    write: vi.fn(),
    end: vi.fn(),
  },
}

export const resetMocks = () => {
  mockSpawn.mockReset()
  mockSpawn.mockReturnValue(mockChildProcess)
}
