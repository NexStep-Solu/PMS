import { useNavigate } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  AtSign,
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  MessageSquare,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/features/auth/queries'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type ActivityNotification,
} from '@/features/activity/queries'
import type { NotificationType } from '@/types/database'

const ICONS: Record<NotificationType, LucideIcon> = {
  task_assigned: CheckCircle2,
  task_mentioned: AtSign,
  task_due_soon: CalendarClock,
  task_overdue: CalendarClock,
  comment_added: MessageSquare,
  project_invitation: UserPlus,
  milestone_approaching: Bell,
  member_joined: UserPlus,
}

export function NotificationBell() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data } = useNotifications(user?.id, 15)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead(user?.id)

  const items = data ?? []
  const unread = items.filter((item) => !item.read_at)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : 'Notifications'}
        >
          <Bell className="size-4" aria-hidden />
          {unread.length > 0 ? (
            <span
              className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular"
              aria-hidden
            >
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all read
            </Button>
          ) : null}
        </div>

        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <BellOff className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    onOpen={() => {
                      if (!item.read_at) markRead.mutate({ id: item.id, read: true })
                      const taskId = item.data.task_id
                      if (typeof taskId === 'string') navigate(`/app/projects/${String(item.data.project_id ?? '')}/board?task=${taskId}`)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => navigate('/app/inbox')}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({ item, onOpen }: { item: ActivityNotification; onOpen: () => void }) {
  const Icon = ICONS[item.type] ?? Bell
  const unread = !item.read_at

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
        unread && 'bg-accent/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
          unread ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug">{item.title}</span>
        {item.message ? (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.message}</span>
        ) : null}
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
        </span>
      </span>
      {unread ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
    </button>
  )
}