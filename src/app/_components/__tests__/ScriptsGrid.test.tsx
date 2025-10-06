import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScriptsGrid } from '../ScriptsGrid'

// Mock tRPC
vi.mock('~/trpc/react', () => ({
  api: {
    scripts: {
      getScriptCards: {
        useQuery: vi.fn(),
      },
      getCtScripts: {
        useQuery: vi.fn(),
      },
      getScriptBySlug: {
        useQuery: vi.fn(),
      },
    },
  },
}))

// Mock child components
vi.mock('../ScriptCard', () => ({
  ScriptCard: ({ script, onClick }: { script: any; onClick: (script: any) => void }) => (
    <div data-testid={`script-card-${script.slug}`} onClick={() => onClick(script)}>
      {script.name}
    </div>
  ),
}))

vi.mock('../ScriptDetailModal', () => ({
  ScriptDetailModal: ({ isOpen, onClose, onInstallScript }: any) => 
    isOpen ? (
      <div data-testid="script-detail-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={() => { onInstallScript?.('/test/path', 'test-script') }}>Install</button>
      </div>
    ) : null,
}))

describe('ScriptsGrid', () => {
  const mockOnInstallScript = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOnInstallScript.mockClear()
  })

  it('should render loading state', async () => {
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ data: null, isLoading: true, error: null })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: null, isLoading: true, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    expect(screen.getByText('Loading scripts...')).toBeInTheDocument()
  })

  it('should render error state', async () => {
    const mockRefetch = vi.fn()
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ 
      data: null, 
      isLoading: false, 
      error: { message: 'Test error' },
      refetch: mockRefetch
    })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    expect(screen.getByText('Failed to load scripts')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('should render empty state when no scripts', async () => {
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ data: { success: true, cards: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: { scripts: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    expect(screen.getByText('No scripts found')).toBeInTheDocument()
  })

  it('should render scripts grid with search functionality', async () => {
    const mockScripts = [
      { name: 'Test Script 1', slug: 'test-script-1' },
      { name: 'Test Script 2', slug: 'test-script-2' },
    ]

    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ 
      data: { success: true, cards: mockScripts }, 
      isLoading: false, 
      error: null 
    })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: { scripts: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    expect(screen.getByTestId('script-card-test-script-1')).toBeInTheDocument()
    expect(screen.getByTestId('script-card-test-script-2')).toBeInTheDocument()

    // Test search functionality
    const searchInput = screen.getByPlaceholderText('Search scripts by name...')
    await userEvent.type(searchInput, 'Script 1')

    await waitFor(() => {
      expect(screen.getByTestId('script-card-test-script-1')).toBeInTheDocument()
      expect(screen.queryByTestId('script-card-test-script-2')).not.toBeInTheDocument()
    })
  })

  it('should handle script card click and open modal', async () => {
    const mockScripts = [
      { name: 'Test Script', slug: 'test-script' },
    ]

    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ 
      data: { success: true, cards: mockScripts }, 
      isLoading: false, 
      error: null 
    })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: { scripts: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    const scriptCard = screen.getByTestId('script-card-test-script')
    fireEvent.click(scriptCard)

    expect(screen.getByTestId('script-detail-modal')).toBeInTheDocument()
  })

  it('should handle clear search', async () => {
    const mockScripts = [
      { name: 'Test Script', slug: 'test-script' },
    ]

    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ 
      data: { success: true, cards: mockScripts }, 
      isLoading: false, 
      error: null 
    })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: { scripts: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    const searchInput = screen.getByPlaceholderText('Search scripts by name...')
    await userEvent.type(searchInput, 'test')

    // Clear search - the clear button doesn't have accessible text, so we'll click it directly
    const clearButton = screen.getByRole('button')
    fireEvent.click(clearButton)

    expect(searchInput).toHaveValue('')
  })

  it('should show no matching scripts when search returns empty', async () => {
    const mockScripts = [
      { name: 'Test Script', slug: 'test-script' },
    ]

    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.getScriptCards.useQuery).mockReturnValue({ 
      data: { success: true, cards: mockScripts }, 
      isLoading: false, 
      error: null 
    })
    vi.mocked(api.scripts.getCtScripts.useQuery).mockReturnValue({ data: { scripts: [] }, isLoading: false, error: null })
    vi.mocked(api.scripts.getScriptBySlug.useQuery).mockReturnValue({ data: null, isLoading: false, error: null })

    render(<ScriptsGrid onInstallScript={mockOnInstallScript} />)

    const searchInput = screen.getByPlaceholderText('Search scripts by name...')
    await userEvent.type(searchInput, 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText('No matching scripts found')).toBeInTheDocument()
    })
  })
})