import { describe, it, expect, vi } from 'vitest'

// Mock the environment variables
const mockEnv = {
  SCRIPTS_DIRECTORY: '/test/scripts',
  ALLOWED_SCRIPT_EXTENSIONS: '.sh,.py,.js,.ts',
  ALLOWED_SCRIPT_PATHS: '/,/ct/',
  MAX_SCRIPT_EXECUTION_TIME: '30000',
  REPO_URL: 'https://github.com/test/repo',
  NODE_ENV: 'test',
}

vi.mock('~/env.js', () => ({
  env: mockEnv,
}))

describe('Environment Configuration', () => {
  it('should have required environment variables', async () => {
    const { env } = await import('~/env.js')

    expect(env.SCRIPTS_DIRECTORY).toBeDefined()
    expect(env.ALLOWED_SCRIPT_EXTENSIONS).toBeDefined()
    expect(env.ALLOWED_SCRIPT_PATHS).toBeDefined()
    expect(env.MAX_SCRIPT_EXECUTION_TIME).toBeDefined()
  })

  it('should have correct script directory path', async () => {
    const { env } = await import('~/env.js')

    expect(env.SCRIPTS_DIRECTORY).toBe('/test/scripts')
  })

  it('should have correct allowed extensions', async () => {
    const { env } = await import('~/env.js')

    expect(env.ALLOWED_SCRIPT_EXTENSIONS).toBe('.sh,.py,.js,.ts')
  })

  it('should have correct allowed paths', async () => {
    const { env } = await import('~/env.js')

    expect(env.ALLOWED_SCRIPT_PATHS).toBe('/,/ct/')
  })

  it('should have correct max execution time', async () => {
    const { env } = await import('~/env.js')

    expect(env.MAX_SCRIPT_EXECUTION_TIME).toBe('30000')
  })
})
