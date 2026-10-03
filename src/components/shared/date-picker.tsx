import { CalendarIcon } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * `yyyy-MM-dd` in local time. Avoids the UTC shift you get from
 * `date.toISOString().slice(0, 10)`, which is what caused past due-date bugs.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  clearable = true,
  disabled,
  id,
  className,
}: {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  id?: string
  className?: string
}) {
  const selected = parseDateKey(value)
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('w-full justify-start font-normal', !selected && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {selected ? format(selected, 'd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" value={selected} onSelect={setOpenValue(onChange, setOpen)} />
        {clearable && value ? (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function setOpenValue(
  onChange: (value: string | null) => void,
  setOpen: (open: boolean) => void,
) {
  return (date: Date | undefined) => {
    onChange(date ? toDateKey(date) : null)
    setOpen(false)
  }
}

/* ------------------------------------------------------------------ */
/* Calendar grid                                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function MonthGrid({
  month,
  selected,
  onSelect,
  renderDay,
  className,
}: {
  month: Date
  selected?: string | null
  onSelect?: (key: string) => void
  renderDay?: (day: Date, key: string) => React.ReactNode
  className?: string
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  return (
    <div className={cn('select-none', className)}>
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day)
          const outside = !isSameMonth(day, month)
          const isSelected = selected === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect?.(key)}
              aria-pressed={isSelected}
              aria-label={format(day, 'd MMMM yyyy')}
              className={cn(
                'min-h-16 border-r border-b p-1 text-left align-top transition-colors last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                outside && 'bg-muted/30 text-muted-foreground/60',
                !outside && 'hover:bg-accent/60',
                isSelected && 'bg-accent',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full text-xs tabular',
                  isToday(day) && 'bg-primary font-semibold text-primary-foreground',
                  !isToday(day) && isSelected && 'ring-1 ring-ring',
                )}
              >
                {format(day, 'd')}
              </span>
              {renderDay ? <div className="mt-1 space-y-1">{renderDay(day, key)}</div> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MonthHeader({
  month,
  onChange,
  className,
}: {
  month: Date
  onChange: (month: Date) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
      >
        ‹
      </Button>
      <div className="text-sm font-medium">{format(month, 'MMMM yyyy')}</div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        onClick={() => onChange(addMonths(month, 1))}
      >
        ›
      </Button>
    </div>
  )
}

export { isSameDay }