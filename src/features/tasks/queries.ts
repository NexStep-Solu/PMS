import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type {
  TaskAttachment,
  TaskChecklistItem,
  TaskComment,
  TaskStatus,
  Label,
  Priority,
} from '@/types/database'

import { notify, recordActivity } from '@/features/activity/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'

import type { CreateTaskValues, UpdateTaskValues } from './schemas'
import type { TaskWithMeta } from './utils'

export type { TaskWithMeta }

const TASK_SELECT = `
  *,
  status:task_statuses!tasks_status_id_fkey(*),
  priority:priorities!tasks_priority_id_fkey(*),
  assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
  labels:task_labels(task_labels!inner(label:labels!task_labels_label_id_fkey(*)))
`

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useTasksByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.projectTasks(projectId ?? 'none'),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<TaskWithMeta[]> => {
      const { data, error } = await db()
        .from('tasks')
        .select(TASK_SELECT)
        .eq('project_id', projectId as string)
        .order('position')

      if (error) throw error
      return normalise(data as unknown as TaskWithMeta[])
    },
  })
}

export function useTasksByOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: [...keys.tasks(organizationId ?? ''), 'all'],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<TaskWithMeta[]> => {
      const { data, error } = await db()
        .from('tasks')
        .select(TASK_SELECT)
        .eq('organization_id', organizationId as string)
        .order('due_date')

      if (error) throw error
      return normalise(data as unknown as TaskWithMeta[])
    },
  })
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.taskDetail(taskId ?? 'none'),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskWithMeta> => {
      const { data, error } = await db()
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', taskId as string)
        .single()
      if (error) throw error
      return normalise([data as unknown as TaskWithMeta])[0] as TaskWithMeta
    },
  })
}

export function useSearchTasks(organizationId: string | null, term: string) {
  const search = term.trim()

  return useQuery({
    queryKey: ['task-search', organizationId, search],
    enabled: Boolean(organizationId) && search.length > 1,
    staleTime: 15_000,
    queryFn: async (): Promise<TaskWithMeta[]> => {
      const { data, error } = await db()
        .from('tasks')
        .select(TASK_SELECT)
        .eq('organization_id', organizationId as string)
        .ilike('title', `%${search}%`)
        .limit(8)
      if (error) throw error
      return normalise(data as unknown as TaskWithMeta[])
    },
  })
}

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.comments(taskId ?? 'none'),
    enabled: Boolean(taskId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('task_comments')
        .select('*, profiles!task_comments_user_id_fkey(id, full_name, avatar_url)')
        .eq('task_id', taskId as string)
        .order('created_at')
      if (error) throw error
      return data as unknown as TaskComment[]
    },
  })
}

export function useChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.checklists(taskId ?? 'none'),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskChecklistItem[]> => {
      const { data, error } = await db()
        .from('task_checklists')
        .select('*')
        .eq('task_id', taskId as string)
        .order('position')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: keys.attachments(taskId ?? 'none'),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskAttachment[]> => {
      const { data, error } = await db()
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId as string)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useWorkspaceTaskMeta() {
  const { organizationId } = useWorkspace()

  const statuses = useQuery({
    queryKey: keys.statuses(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<TaskStatus[]> => {
      const { data, error } = await db()
        .from('task_statuses')
        .select('*')
        .eq('organization_id', organizationId as string)
        .order('position')
      if (error) throw error
      return data ?? []
    },
  })

  const priorities = useQuery({
    queryKey: keys.priorities(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<Priority[]> => {
      const { data, error } = await db()
        .from('priorities')
        .select('*')
        .eq('organization_id', organizationId as string)
        .order('level')
      if (error) throw error
      return data ?? []
    },
  })

  const labels = useQuery({
    queryKey: keys.labels(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<Label[]> => {
      const { data, error } = await db()
        .from('labels')
        .select('*')
        .eq('organization_id', organizationId as string)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  return {
    statuses: statuses.data ?? [],
    priorities: priorities.data ?? [],
    labels: labels.data ?? [],
    loading: statuses.isPending || priorities.isPending || labels.isPending,
  }
}

function normalise(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return tasks.map((task) => ({
    ...task,
    status: task.status ?? ({ name: 'Unknown', category: 'todo', is_completed: false } as TaskStatus),
    priority: task.priority ?? null,
    assignee: task.assignee ?? null,
    labels: task.labels ?? [],
  }))
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useCreateTask() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: CreateTaskValues & { userId: string; position?: number }) => {
      const { labelIds, ...rest } = values
      const resolvedLabelIds = labelIds ?? []

      const { data, error } = await db()
        .from('tasks')
        .insert({
          organization_id: organizationId as string,
          project_id: rest.projectId,
          parent_task_id: rest.parentTaskId ?? null,
          title: rest.title,
          description: rest.description || null,
          status_id: rest.statusId,
          priority_id: rest.priorityId ?? null,
          assignee_id: rest.assigneeId ?? null,
          reporter_id: rest.userId,
          start_date: rest.startDate || null,
          due_date: rest.dueDate || null,
          estimated_minutes: rest.estimatedMinutes ?? null,
          position: rest.position ?? 1000,
        })
        .select('id')
        .single()
      if (error) throw error
      if (!data) throw new Error('The task could not be created.')

      if (resolvedLabelIds.length > 0) {
        const link = await db()
          .from('task_labels')
          .insert(resolvedLabelIds.map((labelId) => ({ task_id: data.id, label_id: labelId })))
        if (link.error) throw link.error
      }

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'task',
        entityId: data.id,
        action: 'created',
        metadata: { title: rest.title },
      })

      if (rest.assigneeId) {
        await notify({
          userId: rest.assigneeId,
          organizationId: organizationId as string,
          type: 'task_assigned',
          title: `You were assigned "${rest.title}"`,
          data: { task_id: data.id, project_id: rest.projectId },
        })
      }

      return data
    },
    onSuccess: () => invalidateTaskLists(client, organizationId),
  })
}

/**
 * `taskId` is optional so callers that already hold a task object (drag and
 * drop, the detail drawer) can reuse a single hook instance.
 */
export function useUpdateTask(taskId?: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: UpdateTaskValues & { task: TaskWithMeta }) => {
      const targetId = taskId ?? values.task.id
      const { labelIds, task, ...rest } = values
      void rest.projectId

      const patch: Record<string, unknown> = {}
      if (rest.title !== undefined) patch.title = rest.title
      if (rest.description !== undefined) patch.description = rest.description || null
      if (rest.statusId !== undefined) patch.status_id = rest.statusId
      if (rest.priorityId !== undefined) patch.priority_id = rest.priorityId
      if (rest.assigneeId !== undefined) patch.assignee_id = rest.assigneeId
      if (rest.startDate !== undefined) patch.start_date = rest.startDate || null
      if (rest.dueDate !== undefined) patch.due_date = rest.dueDate || null
      if (rest.estimatedMinutes !== undefined) patch.estimated_minutes = rest.estimatedMinutes
      if (rest.position !== undefined) patch.position = rest.position
      if (rest.parentTaskId !== undefined) patch.parent_task_id = rest.parentTaskId
      if (rest.projectId !== undefined) patch.project_id = rest.projectId

      if (task?.status && rest.statusId && task.status_id !== rest.statusId) {
        const isNowCompleted = await isCompletedStatus(rest.statusId)
        patch.completed_at = isNowCompleted ? new Date().toISOString() : null
      }

      if (Object.keys(patch).length > 0) {
        const { error } = await db().from('tasks').update(patch).eq('id', targetId)
        if (error) throw error
      }

      if (labelIds) {
        await db().from('task_labels').delete().eq('task_id', targetId)
        if (labelIds.length > 0) {
          const link = await db()
            .from('task_labels')
            .insert(labelIds.map((labelId) => ({ task_id: targetId, label_id: labelId })))
          if (link.error) throw link.error
        }
      }

      await logTaskDiff(task, patch, targetId, organizationId as string)

      return patch
    },
    onSuccess: (_data, variables) => {
      invalidateTaskLists(client, organizationId)
      void client.invalidateQueries({ queryKey: keys.taskDetail(taskId ?? variables.task.id) })
    },
  })
}

export function useDeleteTask() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const { error } = await db().from('tasks').delete().eq('id', taskId)
      if (error) throw error
      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'task',
        entityId: taskId,
        action: 'deleted',
        metadata: { title },
      })
    },
    onSuccess: () => invalidateTaskLists(client, organizationId),
  })
}

function invalidateTaskLists(
  client: ReturnType<typeof useQueryClient>,
  organizationId: string | null,
) {
  void client.invalidateQueries({ queryKey: ['project'] })
  void client.invalidateQueries({ queryKey: keys.tasks(organizationId ?? '') })
  void client.invalidateQueries({ queryKey: ['task-search'] })
  void client.invalidateQueries({ queryKey: ['task-rows'] })
  void client.invalidateQueries({ queryKey: ['notifications'] })
}

async function isCompletedStatus(statusId: string): Promise<boolean> {
  const { data, error } = await db().from('task_statuses').select('is_completed').eq('id', statusId).maybeSingle()
  if (error) throw error
  return Boolean(data?.is_completed)
}

async function logTaskDiff(
  before: TaskWithMeta,
  patch: Record<string, unknown>,
  taskId: string,
  organizationId: string,
): Promise<void> {
  const entries: Array<{ action: Parameters<typeof recordActivity>[0]['action']; metadata: Record<string, unknown> }> = []

  if (patch.status_id !== undefined && patch.status_id !== before.status_id) {
    entries.push({ action: 'status_changed', metadata: { from: before.status.name, to: patch.status_id } })
  }
  if (patch.assignee_id !== undefined && patch.assignee_id !== before.assignee_id) {
    entries.push({
      action: patch.assignee_id ? 'assigned' : 'unassigned',
      metadata: { from: before.assignee?.full_name ?? null, to: patch.assignee_id },
    })
  }
  if (patch.due_date !== undefined && patch.due_date !== before.due_date) {
    entries.push({ action: 'due_date_changed', metadata: { from: before.due_date, to: patch.due_date } })
  }
  if (patch.priority_id !== undefined && patch.priority_id !== before.priority_id) {
    entries.push({ action: 'priority_changed', metadata: { from: before.priority?.name ?? null, to: patch.priority_id } })
  }

  if (entries.length === 0) {
    if (Object.keys(patch).length > 0) {
      entries.push({ action: 'updated', metadata: { fields: Object.keys(patch) } })
    }
  }

  for (const entry of entries) {
    await recordActivity({
      organizationId,
      entityType: 'task',
      entityId: taskId,
      action: entry.action,
      metadata: entry.metadata,
    })
  }

  if (patch.assignee_id && typeof patch.assignee_id === 'string') {
    await notify({
      userId: patch.assignee_id,
      organizationId,
      type: 'task_assigned',
      title: `You were assigned "${before.title}"`,
      data: { task_id: taskId, project_id: before.project_id },
    })
  }
}

/* ------------------------------------------------------------------ */
/* Comments / checklist / attachments                                  */
/* ------------------------------------------------------------------ */

export function useAddComment(taskId: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ content, userId, taskTitle }: { content: string; userId: string; taskTitle: string }) => {
      const { error } = await db().from('task_comments').insert({ task_id: taskId, user_id: userId, content })
      if (error) throw error

      const task = await db().from('tasks').select('assignee_id, reporter_id').eq('id', taskId).maybeSingle()
      const recipients = new Set([task.data?.assignee_id, task.data?.reporter_id].filter((id): id is string => Boolean(id) && id !== userId))

      await Promise.all(
        [...recipients].map((recipient) =>
          notify({
            userId: recipient,
            organizationId: organizationId as string,
            type: 'comment_added',
            title: `New comment on "${taskTitle}"`,
            message: content.slice(0, 160),
            data: { task_id: taskId },
          }),
        ),
      )
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.comments(taskId) })
      void client.invalidateQueries({ queryKey: ['notifications'] })
      void client.invalidateQueries({ queryKey: keys.taskDetail(taskId) })
    },
  })
}

export function useDeleteComment(taskId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const { error } = await db().from('task_comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.comments(taskId) })
    },
  })
}

export function useChecklistMutations(taskId: string) {
  const client = useQueryClient()

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: keys.checklists(taskId) })
    void client.invalidateQueries({ queryKey: keys.taskDetail(taskId) })
  }

  const add = useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const { error } = await db()
        .from('task_checklists')
        .insert({ task_id: taskId, title, position: 0, is_completed: false })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const toggle = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      const { error } = await db().from('task_checklists').update({ is_completed: isCompleted }).eq('id', itemId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      const { error } = await db().from('task_checklists').delete().eq('id', itemId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { add, toggle, remove }
}

export function useUploadAttachment(taskId: string, organizationId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, userId }: { file: File; userId: string }) => {
      const projectId = await resolveProjectId(taskId)
      const path = `organizations/${organizationId}/projects/${projectId}/tasks/${taskId}/${Date.now()}-${file.name}`

      const upload = await db()
        .storage.from('task-attachments')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upload.error) throw upload.error

      const { error } = await db().from('task_attachments').insert({
        task_id: taskId,
        uploaded_by: userId,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      })
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.attachments(taskId) })
      void client.invalidateQueries({ queryKey: keys.taskDetail(taskId) })
    },
  })
}

export function useDeleteAttachment(taskId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ attachmentId, path }: { attachmentId: string; path: string }) => {
      const removed = await db().storage.from('task-attachments').remove([path])
      if (removed.error) throw removed.error
      const { error } = await db().from('task_attachments').delete().eq('id', attachmentId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.attachments(taskId) })
    },
  })
}

async function resolveProjectId(taskId: string): Promise<string> {
  const { data, error } = await db().from('tasks').select('project_id').eq('id', taskId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Task not found.')
  return data.project_id
}
