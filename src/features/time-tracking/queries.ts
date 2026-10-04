import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInMinutes } from 'date-fns'
import { toast } from 'sonner'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type { TimeEntry } from '@/types/database'

import { recordActivity } from '@/features/activity/queries'
import { nullable } from '@/lib/utils'
import { useWorkspace } from '@/features/organizations/workspace-context'

export function useTimeEntries(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.timeEntries(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<TimeEntry[]> => {
      const { data, error } = await db()
        .from('time_entries')
        .select('*, tasks(title)')
        .eq('organization_id', organizationId as string)
        .order('started_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRunningEntry() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: keys.timeEntries(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<TimeEntry | null> => {
      const { data, error } = await db()
        .from('time_entries')
        .select('*')
        .eq('is_running', true)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    select: (entries) => entries ?? null,
  })
}

export function useStartTimer() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ projectId, taskId, description, userId }: {
      projectId: string
      taskId?: string
      description?: string
      userId: string
    }) => {
      const { data, error } = await db()
        .from('time_entries')
        .insert({
          organization_id: organizationId as string,
          project_id: projectId,
          task_id: nullable(taskId),
          user_id: userId,
          started_at: new Date().toISOString(),
          description: nullable(description),
          is_running: true,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as TimeEntry
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.timeEntries(organizationId ?? '') })
      toast.success('Timer started')
    },
  })
}

export function useStopTimer() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (entry: TimeEntry) => {
      const endedAt = new Date()
      const duration = differenceInMinutes(endedAt, new Date(entry.started_at))
      const { error } = await db()
        .from('time_entries')
        .update({ ended_at: endedAt.toISOString(), duration_minutes: Math.max(duration, 0), is_running: false })
        .eq('id', entry.id)
      if (error) throw error

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'time_entry',
        entityId: entry.id,
        action: 'created',
        metadata: { minutes: Math.max(duration, 0) },
      })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.timeEntries(organizationId ?? '') })
      toast.success('Time logged')
    },
  })
}

export function useCreateTimeEntry() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: {
      projectId: string
      taskId?: string
      startedAt: string
      durationMinutes: number
      description?: string
      userId: string
    }) => {
      const { error } = await db().from('time_entries').insert({
        organization_id: organizationId as string,
        project_id: values.projectId,
        task_id: nullable(values.taskId),
        user_id: values.userId,
        started_at: values.startedAt,
        ended_at: new Date(new Date(values.startedAt).getTime() + values.durationMinutes * 60_000).toISOString(),
        duration_minutes: values.durationMinutes,
        description: nullable(values.description),
        is_running: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.timeEntries(organizationId ?? '') })
      toast.success('Time entry added')
    },
  })
}

export function useDeleteTimeEntry() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const { error } = await db().from('time_entries').delete().eq('id', entryId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.timeEntries(organizationId ?? '') })
    },
  })
}
