import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface Person {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export function UserAvatar({
  person,
  size = 28,
  className,
}: {
  person?: Person | null
  size?: number
  className?: string
}) {
  const name = person?.full_name ?? null

  return (
    <Avatar
      className={cn('ring-1 ring-border', className)}
      style={{ width: size, height: size }}
      title={name ?? undefined}
    >
      {person?.avatar_url ? (
        <AvatarImage src={person.avatar_url} alt={name ?? 'Member'} />
      ) : null}
      <AvatarFallback name={name} />
    </Avatar>
  )
}

export function UserAvatarName({ person, className }: { person?: Person | null; className?: string }) {
  if (!person) {
    return <span className={cn('text-muted-foreground', className)}>Unassigned</span>
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <UserAvatar person={person} size={20} />
      <span className="truncate">{person.full_name ?? 'Unknown'}</span>
    </span>
  )
}

export function UserAvatarGroup({
  people,
  max = 4,
  size = 24,
}: {
  people: Person[]
  max?: number
  size?: number
}) {
  const visible = people.slice(0, max)
  const overflow = people.length - visible.length

  return (
    <div className="flex items-center">
      {visible.map((person, index) => (
        <Tooltip key={person.id}>
          <TooltipTrigger asChild>
            <span style={{ marginLeft: index === 0 ? 0 : -6 }} className="rounded-full ring-2 ring-background">
              <UserAvatar person={person} size={size} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{person.full_name ?? 'Unknown'}</TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 ? (
        <span
          className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          style={{ marginLeft: -6 }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}