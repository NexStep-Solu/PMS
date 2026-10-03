import { useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

/** The `role`/`tabIndex`/`aria-*` pair dnd-kit hands to a draggable node. */
type DraggableAttributes = ReturnType<typeof useSortable>['attributes']
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { CalendarClock, GripVertical, MessageSquare, Paperclip, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { LabelBadge, PriorityBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { friendlyMessage } from '@/lib/db/errors'
import type { TaskStatus } from '@/types/database'

import { useUpdateTask } from '../queries'
import { useTaskDialog } from '../task-dialog-context'
import { dueLabel, dueState, positionBetween } from '../utils'
import type { TaskWithMeta } from '../utils'

/**
 * Board interactions:
 *   • drag a card between columns (changes status + position)
 *   • reorder inside a column
 *   • keyboard: focus a card, press Space to lift, arrows to move, Space to drop
 *
 * The drop position uses fractional ordering so two cards never share a
 * `position` value.
 */
export function KanbanBoard({
  tasks,
  statuses,
  canUpdate,
}: {
  tasks: TaskWithMeta[]
  statuses: TaskStatus[]
  canUpdate: boolean
}) {
  const [activeTask, setActiveTask] = useState<TaskWithMeta | null>(null)
  const { openTask, openCreate } = useTaskDialog()
  const updateTask = useUpdateTask()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columns = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  )

  const byStatus = useMemo(() => {
    const map = new Map<string, TaskWithMeta[]>()
    for (const status of columns) map.set(status.id, [])
    for (const task of tasks) {
      const list = map.get(task.status_id)
      if (list) list.push(task)
      else map.set(task.status_id, [task])
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position)
    return map
  }, [columns, tasks])

  const applyMove = (task: TaskWithMeta, statusId: string, before: number | null, after: number | null) => {
    if (!canUpdate) {
      toast.error("You don't have permission to move tasks in this project.")
      return
    }

    const position = positionBetween(before, after)
    const statusChanged = task.status_id !== statusId

    updateTask.mutate(
      { statusId, position, task },
      {
        onError: (error) => toast.error("Couldn't move task.", { description: friendlyMessage(error as never) }),
        onSuccess: () => {
          if (statusChanged) {
            const status = columns.find((entry) => entry.id === statusId)
            toast.success(`Task moved to ${status?.name ?? 'new status'}`)
          }
        },
      },
    )
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over) return

    const taskId = String(active.id)
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) return

    const overId = String(over.id)
    const overTask = tasks.find((entry) => entry.id === overId)

    // Dropped on a card: insert relative to it.
    if (overTask) {
      const siblings = (byStatus.get(overTask.status_id) ?? []).filter((entry) => entry.id !== taskId)
      const index = siblings.findIndex((entry) => entry.id === overTask.id)
      const before = index === -1 ? null : (siblings[index]?.position ?? null)
      const after = index === -1 ? (siblings[0]?.position ?? null) : (siblings[index + 1]?.position ?? null)
      applyMove(task, overTask.status_id, before, after)
      return
    }

    // Dropped on a column: append to the end.
    const list = byStatus.get(overId) ?? []
    const last = list[list.length - 1]
    applyMove(task, overId, last?.position ?? null, null)
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const task = tasks.find((entry) => entry.id === String(active.id))
    if (!task || canUpdate === false) return

    const overId = String(over.id)
    const overTask = tasks.find((entry) => entry.id === overId)
    if (!overTask || overTask.status_id === task.status_id) return

    const siblings = (byStatus.get(overTask.status_id) ?? []).filter((entry) => entry.id !== task.id)
    const index = siblings.findIndex((entry) => entry.id === overTask.id)

    updateTask.mutate({
      statusId: overTask.status_id,
      position: positionBetween(
        index === -1 ? null : (siblings[index]?.position ?? null),
        index === -1 ? (siblings[0]?.position ?? null) : (siblings[index + 1]?.position ?? null),
      ),
      task,
    })
  }

  const total = tasks.length

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => {
        setActiveTask(tasks.find((entry) => entry.id === String(active.id)) ?? null)
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div
        className="scrollbar-thin -mx-4 flex h-full min-h-0 gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        role="list"
        aria-label="Task board"
      >
        {columns.map((status) => {
          const list = byStatus.get(status.id) ?? []
          return (
            <BoardColumn
              key={status.id}
              status={status}
              tasks={list}
              canUpdate={canUpdate}
              onOpenTask={openTask}
              onAddTask={() => openCreate({ projectId: tasks[0]?.project_id })}
              isTotalEmpty={total === 0}
            />
          )
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 140, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {activeTask ? (
          <div className="rotate-1 opacity-95">
            <TaskCard task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ------------------------------------------------------------------ */
/* Column                                                              */
/* ------------------------------------------------------------------ */

function BoardColumn({
  status,
  tasks,
  canUpdate,
  onOpenTask,
  onAddTask,
  isTotalEmpty,
}: {
  status: TaskStatus
  tasks: TaskWithMeta[]
  canUpdate: boolean
  onOpenTask: (taskId: string) => void
  onAddTask: () => void
  isTotalEmpty: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  const totalPoints = tasks.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0)

  return (
    <section
      ref={setNodeRef}
      aria-label={`${status.name}, ${tasks.length} tasks`}
      className={cn(
        'flex w-[18rem] shrink-0 flex-col rounded-xl border bg-card/40 transition-colors sm:w-[19rem]',
        isOver && 'border-primary/50 bg-primary/5',
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            status.category === 'done'
              ? 'bg-status-done'
              : status.category === 'in_progress'
                ? 'bg-status-progress'
                : status.category === 'review'
                  ? 'bg-status-review'
                  : status.category === 'cancelled'
                    ? 'bg-status-cancelled'
                    : 'bg-muted-foreground/50',
          )}
        />
        <h3 className="text-[13px] font-semibold">{status.name}</h3>
        <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground tabular">{tasks.length}</span>
        {totalPoints > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground tabular">
            {Math.round(totalPoints / 60)}h
          </span>
        ) : null}
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              canUpdate={canUpdate}
              onOpen={() => onOpenTask(task.id)}
            />
          ))}

          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              {isTotalEmpty ? 'No tasks yet' : 'Nothing here'}
            </p>
          ) : null}
        </div>
      </SortableContext>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onAddTask}
          disabled={!canUpdate}
        >
          <Plus aria-hidden />
          Add task
        </Button>
      </div>
    </section>
  )
}

/**
 * The card itself is the single interactive element: it carries the drag
 * attributes from dnd-kit, its own click handler and its keyboard handler.
 * Wrapping it in another `role="button"` would nest two buttons and swallow
 * the click.
 */
function SortableTaskCard({
  task,
  canUpdate,
  onOpen,
}: {
  task: TaskWithMeta
  canUpdate: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canUpdate,
  })

  return (
    <TaskCard
      task={task}
      onOpen={onOpen}
      canDrag={canUpdate}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

interface TaskCardProps {
  task: TaskWithMeta
  onOpen?: () => void
  canDrag?: boolean
  isOverlay?: boolean
  isDragging?: boolean
  setNodeRef?: (node: HTMLElement | null) => void
  style?: CSSProperties
  dragAttributes?: DraggableAttributes
  dragListeners?: SyntheticListenerMap | undefined
}

export function TaskCard({
  task,
  onOpen,
  canDrag,
  isOverlay,
  isDragging,
  setNodeRef,
  style,
  dragAttributes,
  dragListeners,
}: TaskCardProps) {
  const overdue = dueState(task, task.status) === 'overdue'
  const hasLabels = task.labels.some((link) => link.label)
  const interactive = Boolean(onOpen)

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card p-2.5 text-left transition-shadow',
        canDrag && 'cursor-grab active:cursor-grabbing',
        interactive && 'hover:border-ring/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        isDragging && 'opacity-40',
        isOverlay && 'shadow-lg',
        task.status.category === 'cancelled' && 'opacity-60',
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) return
        if (event.key === 'Enter') {
          event.preventDefault()
          onOpen()
          return
        }
        // Space lifts the card for keyboard dragging (dnd-kit handles the move).
        if (event.key === ' ') {
          event.preventDefault()
          ;(event.target as HTMLElement)?.click?.()
        }
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-roledescription={canDrag ? 'Draggable task' : undefined}
      aria-label={`${task.title}${overdue ? ', overdue' : ''}`}
      {...dragAttributes}
      {...dragListeners}
    >
      {task.priority ? (
        <div className="mb-1.5">
          <PriorityBadge priority={task.priority} size="sm" />
        </div>
      ) : null}

      <p className="line-clamp-3 text-sm leading-snug">{task.title}</p>

      {hasLabels ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels
            .filter((link) => link.label)
            .slice(0, 3)
            .map((link) => (
              <LabelBadge key={link.label_id} label={link.label as { name: string; color: string }} />
            ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        {canDrag ? (
          <GripVertical
            className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
            aria-hidden
          />
        ) : null}

        {task.due_date ? (
          <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-destructive')}>
            <CalendarClock className="size-3.5" aria-hidden />
            {dueLabel(task.due_date)}
          </span>
        ) : null}

        <span className="ml-auto flex items-center gap-2">
          {task.commentCount ? (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3.5" aria-hidden />
              {task.commentCount}
            </span>
          ) : null}
          {task.subtaskCount ? (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="size-3.5" aria-hidden />
              {task.subtaskCount}
            </span>
          ) : null}
          <UserAvatar person={task.assignee} size={20} />
        </span>
      </div>
    </article>
  )
}
