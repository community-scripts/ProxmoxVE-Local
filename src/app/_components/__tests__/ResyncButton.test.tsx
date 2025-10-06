import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResyncButton } from '../ResyncButton'

// Mock tRPC
vi.mock('~/trpc/react', () => ({
  api: {
    scripts: {
      resyncScripts: {
        useMutation: vi.fn(),
      },
    },
  },
}))

describe('ResyncButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render resync button', async () => {
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.resyncScripts.useMutation).mockReturnValue({
      mutate: vi.fn(),
    })

    render(<ResyncButton />)

    expect(screen.getByText('Resync Scripts')).toBeInTheDocument()
  })

  it('should show loading state when resyncing', async () => {
    const mockMutate = vi.fn()
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.resyncScripts.useMutation).mockReturnValue({
      mutate: mockMutate,
    })

    render(<ResyncButton />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Syncing...')).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('should handle button click', async () => {
    const mockMutate = vi.fn()
    const { api } = await import('~/trpc/react')
    vi.mocked(api.scripts.resyncScripts.useMutation).mockReturnValue({
      mutate: mockMutate,
    })

    render(<ResyncButton />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(mockMutate).toHaveBeenCalled()
  })
})