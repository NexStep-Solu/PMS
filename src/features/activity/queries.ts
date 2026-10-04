import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type { ActivityAction, ActivityLog, EntityType, NotificationType } from '@/types/database'

import { nullable } from '@/lib/utils'
import { useWorkspace } from '@/features/organizations/workspace-context'

/**
 * Activity and notifications are written optimistically from the client so a
 * mutation produces a human-readable trail in the same round trip. In the real
 * backend these should move into database triggers (`record_activity`), which
 * the migration already provides.
 */

type ActorProfile = { id: string; full_name: string | null; avatar_url: string | null }

export interface ActivityEntry extends ActivityLog {
  profiles: ActorProfile | null
}

interface ActivityInput {
  organizationId: string
  entityType: EntityType
  entityId: string
  action: ActivityAction
  metadata?: Record<string, unknown>
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  const session = await db().auth.getSession()
  const userId = session.data?.user.id
  if (!userId) return

  const { error } = await db().from('activity_logs').insert({
    organization_id: input.organizationId,
    user_id: userId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    metadata: input.metadata ?? {},
  })
  if (error) throw error
}

interface NotifyInput {
  userId: string
  organizationId: string
  type: NotificationType
  title: string
  message?: string
  data?: Record<string, unknown>
}

export async function notify(input: NotifyInput): Promise<void> {
  const session = await db().auth.getSession()
  const actorId = session.data?.user.id
  if (!actorId || actorId === input.userId) return

  const { error } = await db().from('notifications').insert({
    user_id: input.userId,
    organization_id: input.organizationId,
    type: input.type,
    title: input.title,
    message: nullable(input.message),
    data: input.data ?? {},
  })
  if (error) throw error
}

/** Fires the notification without blocking the mutation's success path. */
export function useNotify() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (input: Omit<NotifyInput, 'organizationId'> & { organizationId?: string }) =>
      notify({ ...input, organizationId: input.organizationId ?? (organizationId as string) }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useActivity(limit = 30) {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: [...keys.activity(organizationId ?? ''), limit],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await db()
        .from('activity_logs')
        .select('*, profiles!activity_logs_user_id_fkey(id, full_name, avatar_url)')
        .eq('organization_id', organizationId as string)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as unknown as ActivityEntry[]
    },
  })
}

/**
 * The notification inbox, one page at a time.
 *
 * `limit: 0` returns everything and is what the bell's unread badge uses, since a
 * count must reflect the whole list rather than the current page.
 */
export function useNotifications(
  userId: string | undefined,
  options: { limit?: number; page?: number } = {},
) {
  const limit = options.limit ?? 30
  const page = options.page ?? 1
  const windowed = limit > 0
  const from = (page - 1) * limit

  return useQuery({
    queryKey: [...keys.notifications(userId ?? 'anonymous'), { limit, page }],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: async (): Promise<{ rows: ActivityNotification[]; total: number }> => {
      let query = db()
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })

      if (windowed) {
        query = limit === 1 ? query.limit(1, { count: 'exact' }) : query.range(from, from + limit - 1)
      }

      const { data, error, count } = await query
      if (error) throw error

      const rows = (data ?? []) as unknown as ActivityNotification[]
      return { rows, total: windowed ? (count ?? rows.length) : rows.length }
    },
  })
}

export interface ActivityNotification {
  id: string
  user_id: string
  organization_id: string
  type: NotificationType
  title: string
  message: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export function useMarkNotificationRead() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      const { error } = await db()
        .from('notifications')
        .update({ read_at: read ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await db()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId as string)
        .is('read_at', null)
      if (error) throw error
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}