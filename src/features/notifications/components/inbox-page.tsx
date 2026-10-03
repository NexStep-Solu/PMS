import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { BellOff, CheckCheck } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, SkeletonList } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/features/auth/queries'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type ActivityNotification,
} from '@/features/activity/queries'

export function InboxPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data, isPending } = useNotifications(user?.id, 60)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead(user?.id)

  const items = data ?? []
  const unread = items.filter((item) => !item.read_at)

  const open = (item: ActivityNotification) => {
    if (!item.read_at) markRead.mutate({ id: item.id, read: true })
    const taskId = item.data.task_id
    const projectId = item.data.project_id
    if (typeof taskId === 'string' && typeof projectId === 'string') {
      navigate(`/app/projects/${projectId}/board?task=${taskId}`)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Notifications"
        description={
          unread.length > 0
            ? `${unread.length} unread notification${unread.length === 1 ? '' : 's'}.`
            : 'You are all caught up.'
        }
        actions={
          unread.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          ) : null
        }
      />

      {isPending ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-5" aria-hidden />}
          title="No notifications"
          description="Assignments, mentions and due date reminders will appear here."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50',
                  !item.read_at && 'bg-primary/[0.04]',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{item.title}</span>
                  {item.message ? (
                    <span className="mt-0.5 block text-sm text-muted-foreground">{item.message}</span>
                  ) : null}
                  <time dateTime={item.created_at} className="mt-1 block text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
                  </time>
                </span>
                {!item.read_at ? (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
