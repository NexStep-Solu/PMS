import * as SelectPrimitive from '@radix-ui/react-select'
import { Check } from 'lucide-react'
import { FolderKanban } from 'lucide-react'

import { SelectGroup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PrioritySelect, StatusSelect } from '@/components/shared/project-selects'
import { LabelBadge } from '@/components/shared/badges'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Label, Priority, Project, TaskStatus } from '@/types/database'

import { StatusDot } from './project-selects'

export { PrioritySelect, StatusSelect }

/* ------------------------------------------------------------------ */
/* Project                                                             */
/* ------------------------------------------------------------------ */

export function ProjectSelect({
  projects,
  value,
  onChange,
  className,
  disabled,
  id,
  placeholder = 'Choose a project',
}: {
  projects: Pick<Project, 'id' | 'name' | 'key'>[]
  value: string
  onChange: (projectId: string) => void
  className?: string
  disabled?: boolean
  id?: string
  placeholder?: string
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} size="sm" aria-label="Project">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          className="relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          <SelectPrimitive.Viewport className="p-0">
            <SelectGroup>
              {projects.map((project) => (
                <SelectPrimitive.Item
                  key={project.id}
                  value={project.id}
                  className="relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
                >
                  <FolderKanban className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{project.key}</span>
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectGroup>
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export function LabelMultiSelect({
  labels,
  value,
  onChange,
  className,
  disabled,
  id,
}: {
  labels: Label[]
  value: string[]
  onChange: (labelIds: string[]) => void
  className?: string
  disabled?: boolean
  id?: string
}) {
  const selected = labels.filter((label) => value.includes(label.id))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn('w-full justify-start font-normal', selected.length === 0 && 'text-muted-foreground', className)}
        >
          {selected.length === 0 ? (
            'No labels'
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              {selected.slice(0, 2).map((label) => (
                <LabelBadge key={label.id} label={label} />
              ))}
              {selected.length > 2 ? (
                <span className="text-xs text-muted-foreground">+{selected.length - 2}</span>
              ) : null}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {labels.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No labels in this workspace.</p>
          ) : (
            labels.map((label) => {
              const checked = value.includes(label.id)
              return (
                <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange(next === true ? [...value, label.id] : value.filter((entry) => entry !== label.id))
                    }
                  />
                  <LabelBadge label={label} />
                </label>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { StatusDot }

export type { Priority, TaskStatus }