import * as SelectPrimitive from '@radix-ui/react-select'
import { Check } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'

const NONE = '__none__'

export interface MemberOption {
  id: string
  full_name: string | null
  avatar_url: string | null
  role?: string
}

function MemberItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none',
        'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
    >
      {children}
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export function MemberSelect({
  members,
  value,
  onChange,
  placeholder = 'Unassigned',
  className,
  disabled,
  id,
  allowNone = true,
  emptyLabel = 'No members',
  'aria-label': ariaLabel = 'Assignee',
}: {
  members: MemberOption[]
  value: string | null
  onChange: (memberId: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  allowNone?: boolean
  emptyLabel?: string
  'aria-label'?: string
}) {
  const isEmpty = members.length === 0

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled || isEmpty}
    >
      <SelectTrigger id={id} className={className} size="sm" aria-label={ariaLabel}>
        <SelectValue placeholder={isEmpty ? emptyLabel : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? (
          <MemberItem value={NONE}>{isEmpty ? emptyLabel : placeholder}</MemberItem>
        ) : null}
        {members.length > 0 ? (
          <SelectGroup>
            {members.map((member) => (
              <MemberItem key={member.id} value={member.id}>
                <UserAvatar person={member} size={18} />
                <span className="truncate">{member.full_name ?? 'Unknown'}</span>
              </MemberItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  )
}