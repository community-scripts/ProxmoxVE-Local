import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Create mock functions using vi.hoisted
const mockReaddir = vi.hoisted(() => vi.fn())
const mockStat = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockSpawn = vi.hoisted(() => vi.fn())

// Mock the dependencies before importing ScriptManager
vi.mock('fs/promises', () => ({
  readdir: mockReaddir,
  stat: mockStat,
  readFile: mockReadFile,
  default: {
    readdir: mockReaddir,
    stat: mockStat,
    readFile: mockReadFile,
  }
}))

vi.mock('child_process', () => ({
  spawn: mockSpawn,
  default: {
    spawn: mockSpawn,
  }
}))

vi.mock('~/env.js', () => ({
  env: {
    SCRIPTS_DIRECTORY: '/test/scripts',
    ALLOWED_SCRIPT_EXTENSIONS: '.sh,.py,.js,.ts',
    ALLOWED_SCRIPT_PATHS: '/,/ct/',
    MAX_SCRIPT_EXECUTION_TIME: '30000',
  },
}))

vi.mock('~/server/services/localScripts', () => ({
  localScriptsService: {
    getScriptBySlug: vi.fn(),
  },
}))

// Import after mocking
import { ScriptManager } from '../scripts'

describe('ScriptManager', () => {
  let scriptManager: ScriptManager

  beforeEach(async () => {
    vi.clearAllMocks()
    scriptManager = new ScriptManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      const info = scriptManager.getScriptsDirectoryInfo()
      
      expect(info.path).toBe('/test/scripts')
      expect(info.allowedExtensions).toEqual(['.sh', '.py', '.js', '.ts'])
      expect(info.allowedPaths).toEqual(['/', '/ct/'])
      expect(info.maxExecutionTime).toBe(30000)
    })
  })

  describe('getScripts', () => {
    it('should return empty array when directory read fails', async () => {
      mockReaddir.mockRejectedValue(new Error('Directory not found'))

      const scripts = await scriptManager.getScripts()

      expect(scripts).toEqual([])
    })

    it('should return scripts with correct properties', async () => {
      const mockFiles = ['script1.sh', 'script2.py', 'script3.js', 'readme.txt']
      
      mockReaddir.mockResolvedValue(mockFiles)
      mockStat.mockImplementation((filePath) => {
        // Mock different responses based on file path
        if (filePath.includes('script1.sh') || filePath.includes('script2.py') || filePath.includes('script3.js')) {
          return Promise.resolve({
            isFile: () => true,
            isDirectory: () => false,
            size: 1024,
            mtime: new Date('2024-01-01T00:00:00Z'),
            mode: 0o755, // executable permissions
          } as any)
        }
        return Promise.resolve({
          isFile: () => false,
          isDirectory: () => true,
          size: 0,
          mtime: new Date('2024-01-01T00:00:00Z'),
          mode: 0o755,
        } as any)
      })

      const scripts = await scriptManager.getScripts()

      expect(scripts).toHaveLength(3) // Only .sh, .py, .js files
      expect(scripts[0]).toMatchObject({
        name: 'script1.sh',
        path: '/test/scripts/script1.sh',
        extension: '.sh',
        size: 1024,
        executable: true,
      })
      expect(scripts[1]).toMatchObject({
        name: 'script2.py',
        path: '/test/scripts/script2.py',
        extension: '.py',
        size: 1024,
        executable: true,
      })
      expect(scripts[2]).toMatchObject({
        name: 'script3.js',
        path: '/test/scripts/script3.js',
        extension: '.js',
        size: 1024,
        executable: true,
      })
    })

    it('should sort scripts alphabetically', async () => {
      const mockFiles = ['z_script.sh', 'a_script.sh', 'm_script.sh']
      
      mockReaddir.mockResolvedValue(mockFiles)
      mockStat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date('2024-01-01T00:00:00Z'),
        mode: 0o755,
      } as any)

      const scripts = await scriptManager.getScripts()

      expect(scripts.map(s => s.name)).toEqual(['a_script.sh', 'm_script.sh', 'z_script.sh'])
    })
  })

  describe('getCtScripts', () => {
    it('should return ct scripts with slug and logo', async () => {
      const mockFiles = ['test-script.sh']
      
      // Mock readdir for the ct directory
      mockReaddir.mockImplementation((dirPath) => {
        if (dirPath.includes('/ct')) {
          return Promise.resolve(mockFiles)
        }
        return Promise.resolve([])
      })
      
      mockStat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date('2024-01-01T00:00:00Z'),
        mode: 0o755,
      } as any)

      // Mock the localScriptsService
      const { localScriptsService } = await import('~/server/services/localScripts')
      vi.mocked(localScriptsService.getScriptBySlug).mockResolvedValue({
        logo: 'test-logo.png',
        name: 'Test Script',
        description: 'A test script',
      } as { logo: string; name: string; description: string })

      const scripts = await scriptManager.getCtScripts()

      expect(scripts).toHaveLength(1)
      expect(scripts[0]).toMatchObject({
        name: 'test-script.sh',
        path: '/test/scripts/ct/test-script.sh',
        slug: 'test-script',
        logo: 'test-logo.png',
      })
    })

    it('should handle missing logo gracefully', async () => {
      const mockFiles = ['test-script.sh']
      
      // Mock readdir for the ct directory
      mockReaddir.mockImplementation((dirPath) => {
        if (dirPath.includes('/ct')) {
          return Promise.resolve(mockFiles)
        }
        return Promise.resolve([])
      })
      
      mockStat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date('2024-01-01T00:00:00Z'),
        mode: 0o755,
      } as any)

      const { localScriptsService } = await import('~/server/services/localScripts')
      vi.mocked(localScriptsService.getScriptBySlug).mockRejectedValue(new Error('Not found'))

      const scripts = await scriptManager.getCtScripts()

      expect(scripts).toHaveLength(1)
      expect(scripts[0].logo).toBeUndefined()
    })
  })

  describe('validateScriptPath', () => {
    it('should validate correct script path', () => {
      const result = scriptManager.validateScriptPath('/test/scripts/valid-script.sh')
      
      expect(result.valid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    it('should reject path outside scripts directory', () => {
      const result = scriptManager.validateScriptPath('/other/path/script.sh')
      
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Script path is not within the allowed scripts directory')
    })

    it('should reject path not in allowed paths', () => {
      const result = scriptManager.validateScriptPath('/test/scripts/forbidden/script.sh')
      
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Script path is not in the allowed paths list')
    })

    it('should reject invalid file extension', () => {
      const result = scriptManager.validateScriptPath('/test/scripts/script.exe')
      
      expect(result.valid).toBe(false)
      expect(result.message).toContain('File extension')
    })

    it('should accept ct subdirectory paths', () => {
      const result = scriptManager.validateScriptPath('/test/scripts/ct/script.sh')
      
      expect(result.valid).toBe(true)
    })
  })

  describe('executeScript', () => {
    it('should execute bash script correctly', async () => {
      const mockChildProcess = {
        kill: vi.fn(),
        on: vi.fn(),
        killed: false,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
      }
      mockSpawn.mockReturnValue(mockChildProcess as any)

      const childProcess = await scriptManager.executeScript('/test/scripts/script.sh')

      expect(mockSpawn).toHaveBeenCalledWith('bash', ['/test/scripts/script.sh'], {
        cwd: '/test/scripts',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })
      expect(childProcess).toBe(mockChildProcess)
    })

    it('should execute python script correctly', async () => {
      const mockChildProcess = {
        kill: vi.fn(),
        on: vi.fn(),
        killed: false,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
      }
      mockSpawn.mockReturnValue(mockChildProcess as any)

      await scriptManager.executeScript('/test/scripts/script.py')

      expect(mockSpawn).toHaveBeenCalledWith('python', ['/test/scripts/script.py'], {
        cwd: '/test/scripts',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })
    })

    it('should throw error for invalid script path', async () => {
      await expect(scriptManager.executeScript('/invalid/path/script.sh'))
        .rejects.toThrow('Script path is not within the allowed scripts directory')
    })

    it('should set up timeout correctly', async () => {
      vi.useFakeTimers()
      const mockChildProcess = {
        kill: vi.fn(),
        on: vi.fn(),
        killed: false,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: { write: vi.fn(), end: vi.fn() },
      }
      mockSpawn.mockReturnValue(mockChildProcess as any)

      await scriptManager.executeScript('/test/scripts/script.sh')

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(30001)

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')
      
      vi.useRealTimers()
    })
  })

  describe('getScriptContent', () => {
    it('should return script content', async () => {
      const mockContent = '#!/bin/bash\necho "Hello World"'
      mockReadFile.mockResolvedValue(mockContent)

      const content = await scriptManager.getScriptContent('/test/scripts/script.sh')

      expect(content).toBe(mockContent)
      expect(mockReadFile).toHaveBeenCalledWith('/test/scripts/script.sh', 'utf-8')
    })

    it('should throw error for invalid script path', async () => {
      await expect(scriptManager.getScriptContent('/invalid/path/script.sh'))
        .rejects.toThrow('Script path is not within the allowed scripts directory')
    })
  })

  describe('getScriptsDirectoryInfo', () => {
    it('should return correct directory information', () => {
      const info = scriptManager.getScriptsDirectoryInfo()

      expect(info).toEqual({
        path: '/test/scripts',
        allowedExtensions: ['.sh', '.py', '.js', '.ts'],
        allowedPaths: ['/', '/ct/'],
        maxExecutionTime: 30000,
      })
    })
  })
})