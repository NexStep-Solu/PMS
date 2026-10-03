import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

interface CalendarProps {
  mode: 'single'
  value?: Date | null
  onSelect?: (date: Date) => void
  className?: string
}

function Calendar({ value, onSelect, className }: CalendarProps) {
  const [month, setMonth] = useState(value ?? new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  return (
    <div className={cn('w-64 p-3', className)}>
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-medium">{format(month, 'MMMM yyyy')}</div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const outside = !isSameMonth(day, month)
          const selected = value ? format(value, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') : false
          return (
            <Button
              key={day.toISOString()}
              type="button"
              variant={selected ? 'default' : 'ghost'}
              size="icon-sm"
              aria-pressed={selected}
              aria-label={format(day, 'd MMMM yyyy')}
              onClick={() => onSelect?.(day)}
              className={cn('tabular', outside && 'text-muted-foreground/50', !selected && isToday(day) && 'ring-1 ring-ring')}
            >
              {format(day, 'd')}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
