import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Flag, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { MILESTONE_STATUS_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { friendlyMessage } from '@/lib/db/errors'
import { DatePicker } from '@/components/shared/date-picker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionTitle } from '@/components/shared/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermission } from '@/features/organizations/workspace-context'
import type { Milestone, MilestoneStatus } from '@/types/database'

import { useCreateMilestone, useDeleteMilestone, useUpdateMilestone } from '../queries'

export function MilestoneList({
  projectId,
  milestones,
  compact,
}: {
  projectId: string
  milestones: Milestone[]
  compact?: boolean
}) {
  const { can } = usePermission()
  const [createOpen, setCreateOpen] = useState(false)
  const update = useUpdateMilestone(projectId)
  const remove = useDeleteMilestone(projectId)

  const canEdit = can('projects.update')

  return (
    <div className="space-y-2">
      {!compact ? (
        <SectionTitle
          action={
            canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                Add milestone
              </Button>
            ) : null
          }
        >
          Milestones
        </SectionTitle>
      ) : null}

      {milestones.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No milestones yet. Milestones mark a launch, review or delivery date.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {milestones.map((milestone) => {
            const meta = MILESTONE_STATUS_META[milestone.status]
            const overdue =
              milestone.status !== 'completed' && parseISO(milestone.due_date) < new Date()

            return (
              <li key={milestone.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  checked={milestone.status === 'completed'}
                  disabled={!canEdit}
                  aria-label={`Mark ${milestone.name} complete`}
                  onCheckedChange={(value) =>
                    update.mutate(
                      {
                        milestoneId: milestone.id,
                        status: (value === true ? 'completed' : 'planned') as MilestoneStatus,
                      },
                      { onError: () => toast.error("Couldn't update that milestone.") },
                    )
                  }
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      milestone.status === 'completed' && 'text-muted-foreground line-through',
                    )}
                  >
                    {milestone.name}
                  </p>
                  {milestone.description ? (
                    <p className="truncate text-xs text-muted-foreground">{milestone.description}</p>
                  ) : null}
                </div>

                <Badge variant="outline" className={cn('border-transparent', meta.classes)}>
                  <Flag className="size-3" aria-hidden />
                  {meta.label}
                </Badge>

                <span className={cn('shrink-0 text-xs tabular', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  {format(parseISO(milestone.due_date), 'd MMM yyyy')}
                </span>

                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${milestone.name}`}
                    onClick={() =>
                      remove.mutate(
                        { milestoneId: milestone.id },
                        { onError: () => toast.error("Couldn't delete that milestone.") },
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {compact && canEdit ? (
        <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          Add milestone
        </Button>
      ) : null}

      <CreateMilestoneDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}

function CreateMilestoneDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateMilestone(projectId)
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [status, setStatus] = useState<MilestoneStatus>('planned')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) {
      setError('Give the milestone a name.')
      return
    }
    if (!dueDate) {
      setError('Pick a due date.')
      return
    }
    setError(null)
    create.mutate(
      { name: name.trim(), dueDate, status, description: undefined },
      {
        onSuccess: () => {
          setName('')
          setDueDate(null)
          setStatus('planned')
          onOpenChange(false)
        },
        onError: (mutationError) => setError(friendlyMessage(mutationError as never)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New milestone</DialogTitle>
          <DialogDescription>Use milestones for launches and reviews.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="space-y-1.5">
            <label htmlFor="milestone-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="milestone-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Beta launch"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Due date</span>
            <DatePicker value={dueDate} onChange={setDueDate} className="w-full" />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Status</span>
            <Select value={status} onValueChange={(value) => setStatus(value as MilestoneStatus)}>
              <SelectTrigger className="w-full" aria-label="Milestone status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Add milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
