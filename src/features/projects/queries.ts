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
  ProjectStatus,
  TaskStatus,
} from '@/types/database'

import { recordActivity, type ActivityEntry } from '@/features/activity/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'

import { projectChanges, projectPatch } from './patch'
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

/**
 * Paginated project list.
 *
 * `pageSize: 0` returns everything, which is what pickers and roll-ups want. The
 * projects *page* passes a real size so the browser never downloads a workspace's
 * entire portfolio to render page one.
 */
export type ProjectSort = 'updated' | 'name' | 'due'

export function useProjects(
  options: {
    includeArchived?: boolean
    page?: number
    pageSize?: number
    /** Free-text filter, applied in the database so paging stays correct. */
    search?: string
    status?: ProjectStatus | 'all'
    sort?: ProjectSort
  } = {},
) {
  const { organizationId } = useWorkspace()
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 0
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const windowed = pageSize > 0
  const search = options.search?.trim() ?? ''
  const status = options.status ?? 'all'
  const sort = options.sort ?? 'updated'

  return useQuery({
    queryKey: [
      ...keys.projects(organizationId ?? ''),
      {
        archived: options.includeArchived ?? false,
        page,
        pageSize,
        search,
        status,
        sort,
      },
    ],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<{ rows: ProjectWithMeta[]; total: number }> => {
      let query = db()
        .from('projects')
        .select(PROJECT_SELECT, { count: 'exact' })
        .eq('organization_id', organizationId as string)

      if (!options.includeArchived) query = query.neq('status', 'archived')
      if (status !== 'all') query = query.eq('status', status)
      if (search) {
        // `*` is PostgREST's wildcard inside `or`; ilike so it is case-insensitive.
        query = query.or(
          `name.ilike.*${search}*,key.ilike.*${search}*,description.ilike.*${search}*`,
        )
      }

      query =
        sort === 'name'
          ? query.order('name', { ascending: true })
          : sort === 'due'
            ? query.order('due_date', { ascending: true, nullsFirst: false })
            : query.order('updated_at', { ascending: false })

      if (windowed) query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      const rows = (data ?? []) as unknown as ProjectWithMeta[]
      return { rows, total: windowed ? (count ?? rows.length) : rows.length }
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
        } as never)
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