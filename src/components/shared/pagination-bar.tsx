import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SIZES, pageSummary, type PageSize } from '@/hooks/use-pagination'

/**
 * Page controls for a server-paginated list.
 *
 * Renders nothing when everything fits on one page, so short lists stay clean.
 * `rowCount` is what actually came back, which keeps "1-25 of 310" honest on the
 * last page where only 10 rows exist.
 */
export function PaginationBar({
  total,
  rowCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = 'results',
  className,
}: {
  total: number
  rowCount: number
  page: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: PageSize) => void
  label?: string
  className?: string
}) {
  const summary = pageSummary(total, page, pageSize, rowCount)

  // One page and no size control requested: the bar would be pure noise.
  if (summary.pageCount <= 1 && !onPageSizeChange) return null

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm ${className ?? ''}`}
      role="navigation"
      aria-label={`${label} pagination`}
    >
      <p className="text-muted-foreground" aria-live="polite">
        {summary.total === 0 ? (
          `No ${label}`
        ) : (
          <>
            <span className="tabular-nums">{`${summary.first}-${summary.last}`}</span>{' '}
            of <span className="tabular-nums">{summary.total}</span> {label}
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(next) => onPageSizeChange(Number(next) as PageSize)}
            >
              <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={!summary.canPrev}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="px-2 text-muted-foreground tabular-nums">
            {`Page ${summary.page} of ${summary.pageCount}`}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={!summary.canNext}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}