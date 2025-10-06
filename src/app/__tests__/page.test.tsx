import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Home from '../page'

// Mock tRPC
vi.mock('~/trpc/react', () => ({
  api: {
    scripts: {
      getRepoStatus: {
        useQuery: vi.fn(() => ({
          data: { isRepo: true, isBehind: false, branch: 'main', lastCommit: 'abc123' },
          refetch: vi.fn(),
        })),
      },
      getScriptCards: {
        useQuery: vi.fn(() => ({
          data: { success: true, cards: [] },
          isLoading: false,
          error: null,
        })),
      },
      getCtScripts: {
        useQuery: vi.fn(() => ({
          data: { scripts: [] },
          isLoading: false,
          error: null,
        })),
      },
      getScriptBySlug: {
        useQuery: vi.fn(() => ({
          data: null,
        })),
      },
      checkProxmoxVE: {
        useQuery: vi.fn(() => ({
          data: { success: true, isProxmoxVE: true },
          isLoading: false,
          error: null,
        })),
      },
      fullUpdateRepo: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
        })),
      },
    },
  },
}))

// Mock child components
vi.mock('../_components/ScriptsGrid', () => ({
  ScriptsGrid: ({ onInstallScript }: { onInstallScript?: (path: string, name: string) => void }) => (
    <div data-testid="scripts-grid">
      <button onClick={() => onInstallScript?.('/test/path', 'test-script')}>
        Run Script
      </button>
    </div>
  ),
}))

vi.mock('../_components/ResyncButton', () => ({
  ResyncButton: () => <div data-testid="resync-button">Resync Button</div>,
}))

vi.mock('../_components/Terminal', () => ({
  Terminal: ({ scriptPath, onClose }: { scriptPath: string; onClose: () => void }) => (
    <div data-testid="terminal">
      <div>Terminal for: {scriptPath}</div>
      <button onClick={onClose}>Close Terminal</button>
    </div>
  ),
}))

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render main page elements', () => {
    render(<Home />)

    expect(screen.getByText('🚀 PVE Scripts Management')).toBeInTheDocument()
    expect(screen.getByText('Manage and execute Proxmox helper scripts locally with live output streaming')).toBeInTheDocument()
    expect(screen.getByTestId('resync-button')).toBeInTheDocument()
    expect(screen.getByTestId('scripts-grid')).toBeInTheDocument()
  })

  it('should not show terminal initially', () => {
    render(<Home />)

    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument()
  })

  it('should show terminal when script is run', () => {
    render(<Home />)

    const runButton = screen.getByText('Run Script')
    fireEvent.click(runButton)

    expect(screen.getByTestId('terminal')).toBeInTheDocument()
    expect(screen.getByText('Terminal for: /test/path')).toBeInTheDocument()
  })

  it('should close terminal when close button is clicked', () => {
    render(<Home />)

    // First run a script to show terminal
    const runButton = screen.getByText('Run Script')
    fireEvent.click(runButton)

    expect(screen.getByTestId('terminal')).toBeInTheDocument()

    // Then close the terminal
    const closeButton = screen.getByText('Close Terminal')
    fireEvent.click(closeButton)

    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument()
  })

  it('should handle multiple script runs', () => {
    render(<Home />)

    // Run first script
    const runButton = screen.getByText('Run Script')
    fireEvent.click(runButton)

    expect(screen.getByText('Terminal for: /test/path')).toBeInTheDocument()

    // Close terminal
    const closeButton = screen.getByText('Close Terminal')
    fireEvent.click(closeButton)

    expect(screen.queryByTestId('terminal')).not.toBeInTheDocument()

    // Run second script
    fireEvent.click(runButton)

    expect(screen.getByText('Terminal for: /test/path')).toBeInTheDocument()
  })
})
