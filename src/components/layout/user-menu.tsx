import { useState } from 'react'
import { LogOut, Monitor, Moon, Settings, Sun, User, Palette } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useTheme, type Theme } from '@/hooks/use-theme'
import { useAuthActions, useCurrentUser, useProfile } from '@/features/auth/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { ROLE_LABELS } from '@/lib/permissions'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function UserMenu() {
  const user = useCurrentUser()
  const { data: profile } = useProfile(user?.id)
  const { signOut } = useAuthActions()
  const { role } = useWorkspace()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const metadataName = user?.userMetadata.full_name
  const name = profile?.full_name ?? (typeof metadataName === 'string' ? metadataName : null) ?? 'You'
  const email = user?.email ?? ''

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <UserAvatar
            person={{ id: user?.id ?? 'me', full_name: name, avatar_url: profile?.avatar_url ?? null }}
            size={28}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <UserAvatar
            person={{ id: user?.id ?? 'me', full_name: name, avatar_url: profile?.avatar_url ?? null }}
            size={32}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        {role ? (
          <div className="px-2 pb-1.5">
            <span className="text-xs text-muted-foreground">
              Role in this workspace:{' '}
              <span className="font-medium text-foreground">{ROLE_LABELS[role]}</span>
            </span>
          </div>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/app/settings/profile">
            <User aria-hidden />
            Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/settings">
            <Settings aria-hidden />
            Workspace settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Palette className="size-3.5" aria-hidden />
            Appearance
          </p>
          <ThemeSwitcher />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()} disabled={signingOut}>
          <LogOut aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <RadioGroup
      value={theme}
      onValueChange={(value) => setTheme(value as Theme)}
      className={className}
      aria-label="Colour theme"
    >
      <div className="grid grid-cols-3 gap-1">
        {THEMES.map((option) => {
          const Icon = option.icon
          return (
            <Label
              key={option.value}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-input px-1 py-2 text-xs has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
            >
              <RadioGroupItem value={option.value} className="sr-only" />
              <Icon className="size-3.5" aria-hidden />
              {option.label}
            </Label>
          )
        })}
      </div>
    </RadioGroup>
  )
}