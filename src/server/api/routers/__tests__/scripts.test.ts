import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createCallerFactory } from '~/server/api/trpc'
import { scriptsRouter } from '../scripts'

// Mock dependencies
vi.mock('~/server/lib/scripts', () => ({
  scriptManager: {
    getScripts: vi.fn(),
    getCtScripts: vi.fn(),
    validateScriptPath: vi.fn(),
    getScriptsDirectoryInfo: vi.fn(),
  },
}))

vi.mock('~/server/lib/git', () => ({
  gitManager: {
    getStatus: vi.fn(),
    pullUpdates: vi.fn(),
  },
}))

vi.mock('~/server/services/githubJsonService', () => ({
  githubJsonService: {
    syncJsonFiles: vi.fn(),
    getAllScripts: vi.fn(),
    getScriptBySlug: vi.fn(),
  },
}))

vi.mock('~/server/services/localScripts', () => ({
  localScriptsService: {
    getScriptCards: vi.fn(),
    getAllScripts: vi.fn(),
    getScriptBySlug: vi.fn(),
    saveScriptsFromGitHub: vi.fn(),
  },
}))

vi.mock('~/server/services/scriptDownloader', () => ({
  scriptDownloaderService: {
    loadScript: vi.fn(),
    checkScriptExists: vi.fn(),
    compareScriptContent: vi.fn(),
    getScriptDiff: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

vi.mock('path', () => ({
  join: vi.fn((...args) => {
    // Simulate path.join behavior for security check
    const result = args.join('/')
    // If the path contains '..', it should be considered invalid
    if (result.includes('../')) {
      return '/invalid/path'
    }
    return result
  }),
}))

vi.mock('~/env', () => ({
  env: {
    SCRIPTS_DIRECTORY: '/test/scripts',
  },
}))

describe('scriptsRouter', () => {
  let caller: ReturnType<typeof createCallerFactory<typeof scriptsRouter>>

  beforeEach(() => {
    vi.clearAllMocks()
    caller = createCallerFactory(scriptsRouter)({})
  })

  describe('getScripts', () => {
    it('should return scripts and directory info', async () => {
      const mockScripts = [
        { name: 'test.sh', path: '/test/scripts/test.sh', extension: '.sh' },
      ]
      const mockDirectoryInfo = {
        path: '/test/scripts',
        allowedExtensions: ['.sh'],
        allowedPaths: ['/'],
        maxExecutionTime: 30000,
      }

      const { scriptManager } = await import('~/server/lib/scripts')
      vi.mocked(scriptManager.getScripts).mockResolvedValue(mockScripts)
      vi.mocked(scriptManager.getScriptsDirectoryInfo).mockReturnValue(mockDirectoryInfo)

      const result = await caller.getScripts()

      expect(result).toEqual({
        scripts: mockScripts,
        directoryInfo: mockDirectoryInfo,
      })
    })
  })

  describe('getCtScripts', () => {
    it('should return CT scripts and directory info', async () => {
      const mockScripts = [
        { name: 'ct-test.sh', path: '/test/scripts/ct/ct-test.sh', slug: 'ct-test' },
      ]
      const mockDirectoryInfo = {
        path: '/test/scripts',
        allowedExtensions: ['.sh'],
        allowedPaths: ['/'],
        maxExecutionTime: 30000,
      }

      const { scriptManager } = await import('~/server/lib/scripts')
      vi.mocked(scriptManager.getCtScripts).mockResolvedValue(mockScripts)
      vi.mocked(scriptManager.getScriptsDirectoryInfo).mockReturnValue(mockDirectoryInfo)

      const result = await caller.getCtScripts()

      expect(result).toEqual({
        scripts: mockScripts,
        directoryInfo: mockDirectoryInfo,
      })
    })
  })

  describe('getScriptContent', () => {
    it('should return script content for valid path', async () => {
      const mockContent = '#!/bin/bash\necho "Hello World"'
      const { readFile } = await import('fs/promises')
      vi.mocked(readFile).mockResolvedValue(mockContent)

      const result = await caller.getScriptContent({ path: 'test.sh' })

      expect(result).toEqual({
        success: true,
        content: mockContent,
      })
    })

    it('should return error for invalid path', async () => {
      const result = await caller.getScriptContent({ path: '../../../etc/passwd' })

      expect(result).toEqual({
        success: false,
        error: 'Failed to read script content',
      })
    })
  })

  describe('validateScript', () => {
    it('should return validation result', async () => {
      const mockValidation = { valid: true }
      const { scriptManager } = await import('~/server/lib/scripts')
      vi.mocked(scriptManager.validateScriptPath).mockReturnValue(mockValidation)

      const result = await caller.validateScript({ scriptPath: '/test/scripts/test.sh' })

      expect(result).toEqual(mockValidation)
    })
  })

  describe('getDirectoryInfo', () => {
    it('should return directory information', async () => {
      const mockDirectoryInfo = {
        path: '/test/scripts',
        allowedExtensions: ['.sh'],
        allowedPaths: ['/'],
        maxExecutionTime: 30000,
      }

      const { scriptManager } = await import('~/server/lib/scripts')
      vi.mocked(scriptManager.getScriptsDirectoryInfo).mockReturnValue(mockDirectoryInfo)

      const result = await caller.getDirectoryInfo()

      expect(result).toEqual(mockDirectoryInfo)
    })
  })

  describe('getScriptCards', () => {
    it('should return script cards on success', async () => {
      const mockCards = [
        { name: 'Test Script', slug: 'test-script' },
      ]

      const { localScriptsService } = await import('~/server/services/localScripts')
      vi.mocked(localScriptsService.getScriptCards).mockResolvedValue(mockCards)

      const result = await caller.getScriptCards()

      expect(result).toEqual({
        success: true,
        cards: mockCards,
      })
    })

    it('should return error on failure', async () => {
      const { localScriptsService } = await import('~/server/services/localScripts')
      vi.mocked(localScriptsService.getScriptCards).mockRejectedValue(new Error('Test error'))

      const result = await caller.getScriptCards()

      expect(result).toEqual({
        success: false,
        error: 'Test error',
        cards: [],
      })
    })
  })

  describe('getScriptBySlug', () => {
    it('should return script on success', async () => {
      const mockScript = { name: 'Test Script', slug: 'test-script' }

      const { githubJsonService } = await import('~/server/services/githubJsonService')
      vi.mocked(githubJsonService.getScriptBySlug).mockResolvedValue(mockScript)

      const result = await caller.getScriptBySlug({ slug: 'test-script' })

      expect(result).toEqual({
        success: true,
        script: mockScript,
      })
    })

    it('should return error when script not found', async () => {
      const { githubJsonService } = await import('~/server/services/githubJsonService')
      vi.mocked(githubJsonService.getScriptBySlug).mockResolvedValue(null)

      const result = await caller.getScriptBySlug({ slug: 'nonexistent' })

      expect(result).toEqual({
        success: false,
        error: 'Script not found',
        script: null,
      })
    })
  })

  describe('resyncScripts', () => {
    it('should resync scripts successfully', async () => {
      const { githubJsonService } = await import('~/server/services/githubJsonService')
      
      vi.mocked(githubJsonService.syncJsonFiles).mockResolvedValue({
        success: true,
        message: 'Successfully synced 2 scripts from GitHub using 1 API call + raw downloads',
        count: 2
      })

      const result = await caller.resyncScripts()

      expect(result).toEqual({
        success: true,
        message: 'Successfully synced 2 scripts from GitHub using 1 API call + raw downloads',
        count: 2,
      })
    })

    it('should return error on failure', async () => {
      const { githubJsonService } = await import('~/server/services/githubJsonService')
      vi.mocked(githubJsonService.syncJsonFiles).mockResolvedValue({
        success: false,
        message: 'GitHub error',
        count: 0
      })

      const result = await caller.resyncScripts()

      expect(result).toEqual({
        success: false,
        message: 'GitHub error',
        count: 0,
      })
    })
  })

  describe('loadScript', () => {
    it('should load script successfully', async () => {
      const mockScript = { name: 'Test Script', slug: 'test-script' }
      const mockResult = { success: true, files: ['test.sh'] }

      const { localScriptsService } = await import('~/server/services/localScripts')
      const { scriptDownloaderService } = await import('~/server/services/scriptDownloader')
      
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue(mockScript)
      vi.mocked(scriptDownloaderService.loadScript).mockResolvedValue(mockResult)

      const result = await caller.loadScript({ slug: 'test-script' })

      expect(result).toEqual(mockResult)
    })

    it('should return error when script not found', async () => {
      const { localScriptsService } = await import('~/server/services/localScripts')
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue(null)

      const result = await caller.loadScript({ slug: 'nonexistent' })

      expect(result).toEqual({
        success: false,
        error: 'Script not found',
        files: [],
      })
    })
  })

  describe('checkScriptFiles', () => {
    it('should check script files successfully', async () => {
      const mockScript = { name: 'Test Script', slug: 'test-script' }
      const mockResult = { ctExists: true, installExists: false, files: ['test.sh'] }

      const { localScriptsService } = await import('~/server/services/localScripts')
      const { scriptDownloaderService } = await import('~/server/services/scriptDownloader')
      
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue(mockScript)
      vi.mocked(scriptDownloaderService.checkScriptExists).mockResolvedValue(mockResult)

      const result = await caller.checkScriptFiles({ slug: 'test-script' })

      expect(result).toEqual({
        success: true,
        ...mockResult,
      })
    })
  })

  describe('compareScriptContent', () => {
    it('should compare script content successfully', async () => {
      const mockScript = { name: 'Test Script', slug: 'test-script' }
      const mockResult = { hasDifferences: true, differences: ['line 1'] }

      const { localScriptsService } = await import('~/server/services/localScripts')
      const { scriptDownloaderService } = await import('~/server/services/scriptDownloader')
      
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue(mockScript)
      vi.mocked(scriptDownloaderService.compareScriptContent).mockResolvedValue(mockResult)

      const result = await caller.compareScriptContent({ slug: 'test-script' })

      expect(result).toEqual({
        success: true,
        ...mockResult,
      })
    })
  })

  describe('getScriptDiff', () => {
    it('should get script diff successfully', async () => {
      const mockScript = { name: 'Test Script', slug: 'test-script' }
      const mockResult = { diff: 'diff content' }

      const { localScriptsService } = await import('~/server/services/localScripts')
      const { scriptDownloaderService } = await import('~/server/services/scriptDownloader')
      
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue(mockScript)
      vi.mocked(scriptDownloaderService.getScriptDiff).mockResolvedValue(mockResult)

      const result = await caller.getScriptDiff({ slug: 'test-script', filePath: 'test.sh' })

      expect(result).toEqual({
        success: true,
        ...mockResult,
      })
    })
  })
})
