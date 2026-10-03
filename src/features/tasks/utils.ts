import { addDays, differenceInCalendarDays, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import type { Label, Priority, Task, TaskStatus } from '@/types/database'

export interface TaskWithMeta extends Task {
  status: TaskStatus
  priority: Priority | null
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  labels: { label_id: string; label: Label | null }[]
  subtaskCount?: number
  commentCount?: number
}

export function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export type DueState = 'none' | 'overdue' | 'today' | 'upcoming' | 'done'

export function dueState(task: Pick<Task, 'due_date' | 'completed_at'>, status?: TaskStatus): DueState {
  if (task.completed_at || status?.is_completed) return 'done'
  if (!task.due_date) return 'none'

  const due = parseDay(task.due_date)
  if (!due) return 'none'

  const today = startOfDay(new Date())
  const target = startOfDay(due)

  if (isBefore(target, today)) return 'overdue'
  if (isSameDay(target, today)) return 'today'
  return 'upcoming'
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function dueLabel(dueDate: string | null, now: Date = new Date()): string {
  if (!dueDate) return 'No due date'
  const due = parseDay(dueDate)
  if (!due) return 'No due date'

  const days = differenceInCalendarDays(due, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days <= 6) return `In ${days} days`
  if (days < -1 && days >= -6) return `${Math.abs(days)} days ago`
  return due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export interface ProgressSummary {
  total: number
  done: number
  inProgress: number
  overdue: number
  percent: number
}

export function summariseProgress(tasks: TaskWithMeta[]): ProgressSummary {
  const total = tasks.length
  const done = tasks.filter((task) => task.status.is_completed && task.status.category !== 'cancelled').length
  const inProgress = tasks.filter((task) => task.status.category === 'in_progress').length
  const overdue = tasks.filter((task) => dueState(task, task.status) === 'overdue').length

  return {
    total,
    done,
    inProgress,
    overdue,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

export function groupByStatus(tasks: TaskWithMeta[], statuses: TaskStatus[]): Map<string, TaskWithMeta[]> {
  const map = new Map<string, TaskWithMeta[]>()
  const ordered = [...statuses].sort((a, b) => a.position - b.position)

  for (const status of ordered) map.set(status.id, [])
  for (const task of tasks) {
    if (!map.has(task.status_id)) map.set(task.status_id, [])
    map.get(task.status_id)?.push(task)
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.position - b.position)
  }

  return map
}

/** Top-level tasks only — subtasks live in the task detail drawer. */
export function topLevelTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return tasks.filter((task) => !task.parent_task_id)
}

export function subtasksOf(tasks: TaskWithMeta[], parentId: string): TaskWithMeta[] {
  return tasks.filter((task) => task.parent_task_id === parentId).sort((a, b) => a.position - b.position)
}

/** Fractional ordering so a card can be inserted between two neighbours. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000
  if (before === null) return (after as number) - 500
  if (after === null) return before + 500
  return (before + after) / 2
}

export function dateRange(start: string | null, end: string | null): { from: Date; to: Date } | null {
  const from = parseDay(start)
  const to = parseDay(end) ?? (from ? addDays(from, 1) : null)
  if (!from || !to) return null
  return { from, to }
}

export function isTaskActive(task: TaskWithMeta): boolean {
  return !task.status.is_completed && task.status.category !== 'cancelled'
}

export function withinDays(days: number, now: Date = new Date()): boolean {
  const limit = addDays(startOfDay(now), days)
  return isAfter(limit, startOfDay(now))
}