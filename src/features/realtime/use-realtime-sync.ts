/**
 * Realtime sync.
 *
 * Subscribed once at the app-shell boundary — not per component — and mapped to
 * cache invalidations. A subscribed `Channel` filters by `organization_id`, so
 * a workspace switch tears the old channel down and opens a new one.
 *
 * The demo backend returns a no-op channel, so this is inert there.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import { useCurrentUser } from '@/features/auth/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'

/** Tables whose changes should refresh which cached slices. */
type QueryKeyLike = readonly unknown[]

const CHANNELS: Array<{
  table: string
  invalidate: (organizationId: string, userId: string) => QueryKeyLike[]
}> = [
  {
    table: 'tasks',
    invalidate: (org) => [keys.tasks(org), ['project'], ['task-rows'], ['task-search']],
  },
  {
    table: 'task_comments',
    invalidate: () => [['task']],
  },
  {
    table: 'milestones',
    invalidate: (org) => [keys.milestones('any'), keys.orgMilestones(org)],
  },
  {
    table: 'time_entries',
    invalidate: (org) => [keys.timeEntries(org)],
  },
  {
    table: 'notifications',
    invalidate: () => [['notifications']],
  },
  {
    table: 'activity_logs',
    invalidate: (org) => [keys.activity(org)],
  },
]

export function useRealtimeSync() {
  const { organizationId } = useWorkspace()
  const userId = useCurrentUser()?.id
  const client = useQueryClient()

  useEffect(() => {
    if (!organizationId || !userId) return

    const channels = CHANNELS.map(({ table, invalidate }) => {
      const channel = db()
        .realtime.channel(`pms:${table}:${organizationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            for (const queryKey of invalidate(organizationId, userId)) {
              void client.invalidateQueries({ queryKey })
            }
          },
        )
        .subscribe()

      return channel
    })

    return () => {
      for (const channel of channels) {
        void db().realtime.removeChannel(channel)
      }
    }
  }, [client, organizationId, userId])
}