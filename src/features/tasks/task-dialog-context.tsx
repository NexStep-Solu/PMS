/**
 * The task drawer is opened from many places (board cards, table rows,
 * search, command palette). A tiny context keeps that wiring in one spot
 * instead of threading callbacks through every screen.
 */

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

interface TaskDialogState {
  /** Task currently open in the detail drawer, if any. */
  openTaskId: string | null
  /** Project the quick-create dialog should default to. */
  createProjectId: string | null
  openTask: (taskId: string) => void
  closeTask: () => void
  openCreate: (options?: { projectId?: string }) => void
  closeCreate: () => void
  createOpen: boolean
}

const TaskDialogContext = createContext<TaskDialogState | null>(null)

export function TaskDialogProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const [createProjectId, setCreateProjectId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const openTaskId = params.get('task')

  const setTaskParam = useCallback(
    (value: string | null) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set('task', value)
          else next.delete('task')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const value = useMemo<TaskDialogState>(
    () => ({
      openTaskId,
      createProjectId,
      createOpen,
      openTask: setTaskParam,
      closeTask: () => setTaskParam(null),
      openCreate: (options) => {
        setCreateProjectId(options?.projectId ?? null)
        setCreateOpen(true)
      },
      closeCreate: () => setCreateOpen(false),
    }),
    [openTaskId, createProjectId, createOpen, setTaskParam],
  )

  return <TaskDialogContext value={value}>{children}</TaskDialogContext>
}

export function useTaskDialog(): TaskDialogState {
  const context = use(TaskDialogContext)
  if (!context) throw new Error('useTaskDialog must be used inside <TaskDialogProvider>')
  return context
}

export const useSetTaskDialog = (): ((options?: { projectId?: string }) => void) =>
  useTaskDialog().openCreate