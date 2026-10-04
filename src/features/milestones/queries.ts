import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type { Milestone, MilestoneStatus } from '@/types/database'

import { recordActivity } from '@/features/activity/queries'
import { nullable } from '@/lib/utils'
import { useWorkspace } from '@/features/organizations/workspace-context'

import type { MilestoneValues } from '@/features/tasks/schemas'

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.milestones(projectId ?? 'none'),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await db()
        .from('milestones')
        .select('*')
        .eq('project_id', projectId as string)
        .order('due_date')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateMilestone(projectId: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: MilestoneValues) => {
      const { data, error } = await db()
        .from('milestones')
        .insert({
          organization_id: organizationId as string,
          project_id: projectId,
          name: values.name,
          description: nullable(values.description),
          due_date: values.dueDate,
          status: values.status,
          position: 0,
        })
        .select('*')
        .single()
      if (error) throw error
      if (!data) throw new Error('The milestone could not be created.')

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'milestone',
        entityId: data.id,
        action: 'created',
        metadata: { name: values.name },
      })
      return data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.milestones(projectId) })
      void client.invalidateQueries({ queryKey: keys.orgMilestones(organizationId ?? '') })
      toast.success('Milestone added')
    },
  })
}

export function useUpdateMilestone(projectId: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({
      milestoneId,
      ...changes
    }: { milestoneId: string } & Partial<MilestoneValues>) => {
      const patch: Record<string, unknown> = {}
      if (changes.name !== undefined) patch.name = changes.name
      if (changes.description !== undefined) patch.description = nullable(changes.description)
      if (changes.dueDate !== undefined) patch.due_date = changes.dueDate
      if (changes.status !== undefined) patch.status = changes.status

      const { error } = await db().from('milestones').update(patch).eq('id', milestoneId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.milestones(projectId) })
      void client.invalidateQueries({ queryKey: keys.orgMilestones(organizationId ?? '') })
    },
  })
}

export function useDeleteMilestone(projectId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ milestoneId }: { milestoneId: string }) => {
      const { error } = await db().from('milestones').delete().eq('id', milestoneId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.milestones(projectId) })
      toast.success('Milestone removed')
    },
  })
}

export function useToggleMilestone(projectId: string) {
  const update = useUpdateMilestone(projectId)
  return (milestone: Milestone) =>
    update.mutate({
      milestoneId: milestone.id,
      status: (milestone.status === 'completed' ? 'planned' : 'completed') as MilestoneStatus,
    })
}
/** All milestones in the workspace, for the dashboard. */
export function useOrgMilestones(organizationId: string | undefined) {
  return useQuery({
    queryKey: keys.orgMilestones(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await db()
        .from('milestones')
        .select('*')
        .eq('organization_id', organizationId as string)
        .order('due_date')
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}
