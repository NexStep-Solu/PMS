import { formatDistanceToNowStrict } from 'date-fns'

import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { ActivityAction } from '@/types/database'

import type { ActivityEntry } from '../queries'

/**
 * Human-readable activity list. Verbs come from the metadata written by the
 * mutations, so the feed reads like a sentence rather than a database row.
 */
export function ActivityFeed({
  entries,
  emptyMessage = 'No activity yet.',
  className,
}: {
  entries: ActivityEntry[]
  emptyMessage?: string
  className?: string
}) {
  if (entries.length === 0) {
    return (
      <p
        className={cn(
          'rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {emptyMessage}
      </p>
    )
  }

  return (
    <ol className={cn('space-y-3', className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2.5">
          <UserAvatar person={entry.profiles ?? null} size={24} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{entry.profiles?.full_name ?? 'Someone'}</span>{' '}
              <span className="text-muted-foreground">
                {describe(entry.action, entry.metadata, entry.entity_type)}
              </span>
            </p>
            <time
              dateTime={entry.created_at}
              className="text-xs text-muted-foreground"
              title={new Date(entry.created_at).toLocaleString()}
            >
              {formatDistanceToNowStrict(new Date(entry.created_at), { addSuffix: true })}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}

function describe(
  action: ActivityAction,
  metadata: Record<string, unknown>,
  entityType: string,
): string {
  const from = typeof metadata.from === 'string' ? metadata.from : null
  const to = typeof metadata.to === 'string' ? metadata.to : null
  const title = typeof metadata.title === 'string' ? metadata.title : null
  const name = typeof metadata.name === 'string' ? metadata.name : null
  const subject = title ?? name

  switch (action) {
    case 'created':
      return `created ${subject ? `“${subject}”` : entityType}`
    case 'assigned':
      return `assigned ${subject ? `“${subject}”` : 'a task'} to a teammate`
    case 'unassigned':
      return 'removed an assignee'
    case 'status_changed':
      return from && to
        ? `moved “${subject ?? entityType}” from ${from} to ${to}`
        : 'changed a status'
    case 'due_date_changed':
      return `changed the due date to ${to ?? 'none'}`
    case 'priority_changed':
      return `changed the priority to ${to ?? 'none'}`
    case 'member_added':
      return 'added a member'
    case 'member_removed':
      return 'removed a member'
    case 'member_role_changed':
      return `changed a member role to ${to ?? 'none'}`
    case 'archived':
      return 'archived an item'
    case 'deleted':
      return `deleted ${subject ? `“${subject}”` : entityType}`
    default:
      return `updated ${subject ? `“${subject}”` : entityType}`
  }
}
