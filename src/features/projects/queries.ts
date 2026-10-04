import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type {
  Label,
  Organization,
  Priority,
  Project,
  ProjectFile,
  ProjectMember,
  ProjectRole,
  TaskStatus,
} from '@/types/database'

import { recordActivity, type ActivityEntry } from '@/features/activity/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'

import type { CreateProjectValues, UpdateProjectValues } from './schemas'

const PROJECT_SELECT = `
  *,
  owner:profiles!projects_owner_id_fkey(id, full_name, avatar_url),
  members:project_members(id, role, user_id, profiles(id, full_name, avatar_url))
`

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export interface ProjectWithMeta extends Project {
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null
  members: {
    id: string
    role: ProjectRole
    user_id: string
    profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
  }[]
}

export function useProjects(options: { includeArchived?: boolean } = {}) {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: [...keys.projects(organizationId ?? ''), options.includeArchived ?? false],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ProjectWithMeta[]> => {
      const query = db()
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('organization_id', organizationId as string)
        .order('updated_at', { ascending: false })

      const { data, error } = options.includeArchived
        ? await query
        : await query.neq('status', 'archived')

      if (error) throw error
      return (data ?? []) as unknown as ProjectWithMeta[]
    },
  })
}

/** Lightweight list for the sidebar and selectors — no embedded resources. */
export function useProjectsSidebar() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: ['sidebar', 'projects', organizationId],
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await db()
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId as string)
        .neq('status', 'archived')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.project(projectId ?? 'none'),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectWithMeta> => {
      const { data, error } = await db()
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('id', projectId as string)
        .single()
      if (error) throw error
      return data as unknown as ProjectWithMeta
    },
  })
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.projectMembers(projectId ?? 'none'),
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('project_members')
        .select('*, profiles!project_members_user_id_fkey(id, full_name, avatar_url)')
        .eq('project_id', projectId as string)
        .order('created_at')
      if (error) throw error
      return data as unknown as ProjectMember[]
    },
  })
}

export function useProjectFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.projectFiles(projectId ?? 'none'),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectFile[]> => {
      const { data, error } = await db()
        .from('project_files')
        .select('*, profiles!project_files_uploaded_by_fkey(id, full_name, avatar_url)')
        .eq('project_id', projectId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ProjectFile[]
    },
  })
}

export function useProjectActivity(projectId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: [...keys.entityActivity(projectId ?? 'none'), limit],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('activity_logs')
        .select('*, profiles!activity_logs_user_id_fkey(id, full_name, avatar_url)')
        .eq('entity_id', projectId as string)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as ActivityEntry[]
    },
  })
}

/* ------------------------------------------------------------------ */
/* Workspace metadata shared by the task form                         */
/* ------------------------------------------------------------------ */

export function useTaskStatuses() {
  const { organizationId } = useWorkspace()
  return useQuery({
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
}

export function usePriorities() {
  const { organizationId } = useWorkspace()
  return useQuery({
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
}

export function useLabels() {
  const { organizationId } = useWorkspace()
  return useQuery({
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
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function projectPatch(values: CreateProjectValues) {
  return {
    name: values.name,
    key: values.key,
    description: values.description ?? null,
    status: values.status,
    priority: values.priority,
    start_date: values.startDate || null,
    due_date: values.dueDate || null,
    owner_id: values.ownerId ?? null,
  }
}

/** Partial update: only the keys the caller actually provided are sent. */
function projectChanges(values: UpdateProjectValues) {
  const changes: Record<string, unknown> = {}
  if (values.name !== undefined) changes.name = values.name
  if (values.key !== undefined) changes.key = values.key
  if (values.description !== undefined) changes.description = values.description || null
  if (values.status !== undefined) changes.status = values.status
  if (values.priority !== undefined) changes.priority = values.priority
  if (values.startDate !== undefined) changes.start_date = values.startDate || null
  if (values.dueDate !== undefined) changes.due_date = values.dueDate || null
  if (values.ownerId !== undefined) changes.owner_id = values.ownerId || null
  return changes
}

export function useCreateProject() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: CreateProjectValues & { userId: string }) => {
      const { data, error } = await db()
        .from('projects')
        .insert({
          ...projectPatch(values),
          organization_id: organizationId as string,
          created_by: values.userId,
        })
        .select('*')
        .single()
      if (error) throw error
      if (!data) throw new Error('The project could not be created.')

      const member = await db().from('project_members').insert({
        project_id: data.id,
        user_id: values.userId,
        role: 'owner',
      })
      if (member.error) throw member.error

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'project',
        entityId: data.id,
        action: 'created',
        metadata: { name: values.name, key: values.key },
      })

      return data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects(organizationId ?? '') })
      void client.invalidateQueries({ queryKey: ['sidebar', 'projects', organizationId] })
      void client.invalidateQueries({ queryKey: keys.activity(organizationId ?? '') })
      toast.success('Project created')
    },
  })
}

export function useUpdateProject(projectId: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: UpdateProjectValues) => {
      const { data, error } = await db()
        .from('projects')
        .update(projectChanges(values))
        .eq('id', projectId)
        .select('*')
        .single()
      if (error) throw error

      const changed = Object.keys(values).filter(
        (key) => key === 'status' || key === 'dueDate' || key === 'name' || key === 'key',
      )

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'project',
        entityId: projectId,
        action: values.status === 'archived' ? 'archived' : 'updated',
        metadata: { fields: changed },
      })

      return data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.project(projectId) })
      void client.invalidateQueries({ queryKey: keys.projects(organizationId ?? '') })
      void client.invalidateQueries({ queryKey: ['sidebar', 'projects', organizationId] })
      toast.success('Project updated')
    },
  })
}

export function useAddProjectMember(projectId: string) {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) => {
      const { error } = await db().from('project_members').insert({ project_id: projectId, user_id: userId, role })
      if (error) throw error
      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'member',
        entityId: projectId,
        action: 'member_added',
        metadata: { userId, role },
      })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projectMembers(projectId) })
      void client.invalidateQueries({ queryKey: keys.project(projectId) })
      toast.success('Member added to project')
    },
  })
}

export function useUpdateProjectMemberRole(projectId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: ProjectRole }) => {
      const { error } = await db().from('project_members').update({ role }).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projectMembers(projectId) })
      void client.invalidateQueries({ queryKey: keys.project(projectId) })
      toast.success('Role updated')
    },
  })
}

export function useRemoveProjectMember(projectId: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId }: { memberId: string; memberName?: string }) => {
      const { error } = await db().from('project_members').delete().eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projectMembers(projectId) })
      void client.invalidateQueries({ queryKey: keys.project(projectId) })
      toast.success('Member removed')
    },
  })
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await db().from('organizations').select('*').eq('id', orgId).maybeSingle()
  if (error) throw error
  return data
}