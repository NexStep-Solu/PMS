import { useCallback, useMemo, useState } from 'react'

/**
 * Offset pagination for list screens.
 *
 * Every paginated query takes `page` (1-based) and a page size, and returns the
 * exact total alongside the rows so the control can show "1-25 of 310" instead of
 * guessing. Page size changes reset to the first page, because staying on page 9
 * of a now-shorter list shows an empty screen.
 */

export const PAGE_SIZES = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export interface Pagination {
  page: number
  pageSize: PageSize
  /** Zero-based offset for the query. */
  from: number
  to: number
  setPage: (page: number) => void
  setPageSize: (size: PageSize) => void
  /** Clamps `page` into range after the total shrinks. */
  syncTotal: (total: number) => void
  reset: () => void
}

export function usePagination(initialPageSize: PageSize = 25): Pagination {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState<PageSize>(initialPageSize)

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, Math.floor(next) || 1))
  }, [])

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size)
    setPageState(1)
  }, [])

  const syncTotal = useCallback(
    (total: number) => {
      const lastPage = Math.max(1, Math.ceil(total / pageSize))
      setPageState((current) => (current > lastPage ? lastPage : current))
    },
    [pageSize],
  )

  const reset = useCallback(() => {
    setPageState(1)
  }, [])

  return useMemo(
    () => ({
      page,
      pageSize,
      from: (page - 1) * pageSize,
      to: page * pageSize - 1,
      setPage,
      setPageSize,
      syncTotal,
      reset,
    }),
    [page, pageSize, setPage, setPageSize, syncTotal, reset],
  )
}

export interface PageSummary {
  /** 1-based index of the first row on this page, or 0 when empty. */
  first: number
  /** 1-based index of the last row on this page. */
  last: number
  total: number
  page: number
  pageCount: number
  canPrev: boolean
  canNext: boolean
}

export function pageSummary(
  total: number,
  page: number,
  pageSize: number,
  rowCount: number,
): PageSummary {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safeTotal = Math.max(0, total)
  const first = safeTotal === 0 || rowCount === 0 ? 0 : (page - 1) * pageSize + 1
  const last = safeTotal === 0 ? 0 : Math.min(safeTotal, (page - 1) * pageSize + rowCount)

  return {
    first,
    last,
    total: safeTotal,
    page,
    pageCount,
    canPrev: page > 1,
    canNext: page < pageCount,
  }
}