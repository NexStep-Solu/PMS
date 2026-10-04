import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { resetDbClient, db } from '@/lib/client'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { pageSummary, usePagination } from '@/hooks/use-pagination'

/**
 * Pagination is only correct if the offset maths, the exact count and the window
 * query all agree. These cover the maths and the control directly, then drive the
 * real projects page with more rows than fit on one page.
 */

describe('pageSummary', () => {
  it('describes the first, middle and last pages', () => {
    expect(pageSummary(310, 1, 25, 25)).toMatchObject({
      first: 1,
      last: 25,
      total: 310,
      pageCount: 13,
      canPrev: false,
      canNext: true,
    })

    expect(pageSummary(310, 7, 25, 25)).toMatchObject({ first: 151, last: 175, canPrev: true, canNext: true })

    // A short final page must not claim rows that do not exist.
    expect(pageSummary(310, 13, 25, 10)).toMatchObject({
      first: 301,
      last: 310,
      canPrev: true,
      canNext: false,
    })
  })

  it('reports an empty result set without inventing row 1', () => {
    expect(pageSummary(0, 1, 25, 0)).toMatchObject({ first: 0, last: 0, total: 0, pageCount: 1 })
    expect(pageSummary(0, 1, 25, 0).canPrev).toBe(false)
    expect(pageSummary(0, 1, 25, 0).canNext).toBe(false)
  })

  it('treats a stale page number as the last page', () => {
    // The total shrank under us; clamping keeps "Page 4 of 2" from rendering.
    expect(pageSummary(30, 4, 25, 5).pageCount).toBe(2)
  })
})

describe('usePagination', () => {
  it('converts a page into a zero-based range', () => {
    const { result } = renderHook(() => usePagination(25))
    expect(result.current).toMatchObject({ page: 1, from: 0, to: 24 })

    act(() => result.current.setPage(3))
    expect(result.current).toMatchObject({ page: 3, from: 50, to: 74 })
  })

  it('resets to page 1 when the page size changes', () => {
    const { result } = renderHook(() => usePagination(25))
    act(() => result.current.setPage(4))
    act(() => result.current.setPageSize(50))

    expect(result.current.page).toBe(1)
    expect(result.current.from).toBe(0)
    expect(result.current.to).toBe(49)
  })

  it('pulls back to the last page when the total shrinks', () => {
    const { result } = renderHook(() => usePagination(25))
    act(() => result.current.setPage(5))
    act(() => result.current.syncTotal(30))

    expect(result.current.page).toBe(2)
  })

  it('ignores nonsense page numbers', () => {
    const { result } = renderHook(() => usePagination(25))
    act(() => result.current.setPage(0))
    expect(result.current.page).toBe(1)
    act(() => result.current.setPage(-4))
    expect(result.current.page).toBe(1)
  })
})

describe('PaginationBar', () => {
  const setup = (props: Partial<Parameters<typeof PaginationBar>[0]> = {}) => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(
      <PaginationBar
        total={310}
        rowCount={25}
        page={2}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        {...props}
      />,
    )
    return { onPageChange, onPageSizeChange }
  }

  it('states the visible range and the true total', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: /results pagination/i })
    // Rendered with page=2, so the window is rows 26-50 of 310.
    expect(within(nav).getByText('26-50')).toBeInTheDocument()
    expect(within(nav).getByText('310')).toBeInTheDocument()
    expect(within(nav).getByText('Page 2 of 13')).toBeInTheDocument()
  })

  it('steps forwards and backwards', async () => {
    const user = userEvent.setup()
    const { onPageChange } = setup()

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('disables the edges on the first and last pages', () => {
    setup({ page: 1 })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    cleanupAndSetup({ page: 13, rowCount: 10 })
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('stays out of the way when everything fits on one page', () => {
    setup({ total: 4, rowCount: 4, page: 1, onPageSizeChange: undefined })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  function cleanupAndSetup(props: Partial<Parameters<typeof PaginationBar>[0]>) {
    cleanup()
    setup(props)
  }
})

/* ------------------------------------------------------------------ */
/* Integration: paging the real projects page                          */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
  window.history.pushState({}, '', '/login')
})

const TIMEOUT = 30000

async function signIn() {
  render(<App />)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email', undefined, { timeout: TIMEOUT }), 'arkarmin@pms.dev')
  await user.type(await screen.findByLabelText('Password', undefined, { timeout: TIMEOUT }), 'password123')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('navigation', { name: 'Main' }, { timeout: TIMEOUT })
  return user
}

/** Grows the workspace past one page so paging has something to do. */
async function seedProjects(count: number) {
  const session = await db().auth.getSession()
  for (let i = 0; i < count; i += 1) {
    await db().from('projects').insert({
      organization_id: 'org-nextstep',
      name: `Bulk Project ${String(i).padStart(3, '0')}`,
      key: `B${String(i).padStart(3, '0')}`,
      description: null,
      status: 'active',
      priority: 'medium',
      created_by: session.data!.user.id,
    })
  }
}

describe('projects page paging', () => {
  it('loads one page at a time and reports the full total', async () => {
    await signIn()
    await seedProjects(30)

    window.history.pushState({}, '', '/app/projects')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('main', {}, { timeout: TIMEOUT })

    const nav = await screen.findByRole('navigation', { name: /projects pagination/i }, { timeout: TIMEOUT })

    // The bar renders from the first result, so wait for the refetch that sees
    // the bulk rows rather than asserting against a stale total.
    // 4 active projects in the seed + 30 bulk, on pages of 25.
    await waitFor(() => expect(within(nav).getByText('Page 1 of 2')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    })
    expect(within(nav).getByText('34')).toBeInTheDocument()
    expect(within(nav).getByText('1-25')).toBeInTheDocument()

    // Only a page's worth of cards is rendered, not the whole set. Assert against
    // the total rather than a magic number, since the count includes seeded rows.
    const shown = screen.getAllByText(/Bulk Project \d{3}/)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(34)

    await userEvent.setup().click(within(nav).getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument(), { timeout: TIMEOUT })
  })

  it('finds a project by search even when it is not on the first page', async () => {
    const user = await signIn()
    await seedProjects(30)

    window.history.pushState({}, '', '/app/projects')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('main', {}, { timeout: TIMEOUT })
    await screen.findByRole('navigation', { name: /projects pagination/i }, { timeout: TIMEOUT })

    // The target sorts last, so it can only be found if search runs in the database.
    await user.type(screen.getByPlaceholderText(/search/i), 'Bulk Project 029')

    // Typing is debounced and the query key changes, so `data` is briefly
    // undefined while the next page loads. Wait for the settled result.
    await waitFor(() => expect(screen.getByText('Bulk Project 029')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    })

    // Re-query the bar each time: a refetch can swap the DOM node, and a captured
    // reference then points at a detached tree.
    const bar = () => within(screen.getByRole('navigation', { name: /projects pagination/i }))
    await waitFor(() => expect(bar().getByText('Page 1 of 1')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    })
    expect(bar().getByText('1-1')).toBeInTheDocument()
  })
})
