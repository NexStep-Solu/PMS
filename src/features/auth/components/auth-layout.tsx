import { CheckCircle2, FolderKanban, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { isDemoMode } from '@/lib/client'
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const HIGHLIGHTS = [
  'Kanban, list, calendar and timeline views',
  'Roles, permissions and workspace isolation',
  'Comments, attachments, time tracking and reports',
]

/**
 * Marketing-free auth screen: one column, one primary action, no distraction.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(28rem,34rem)]">
      {/* Form side */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/login" className="inline-flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold tracking-tight">PMS</span>
          </Link>

          <div className="mt-8 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>

      {/* Context side — hidden on small screens to keep the form focused */}
      <aside className="relative hidden flex-col justify-between border-l bg-sidebar p-12 lg:flex">
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="max-w-sm text-lg font-semibold text-balance">
              Plan the work, keep the context, ship on time.
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground text-balance">
              PMS keeps projects, tasks and people in one workspace with the
              permissions to match your organisation.
            </p>
          </div>

          <ul className="space-y-2.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-status-done" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {isDemoMode ? (
            <div className="rounded-lg border border-dashed bg-background/60 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="warning">Demo mode</Badge>
                <span className="text-xs text-muted-foreground">No Supabase credentials loaded</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sign in with any of these accounts — password{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{DEMO_ACCOUNTS.password}</code>.
              </p>
              <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
                {DEMO_ACCOUNTS.users.map((user) => (
                  <li key={user.email}>{user.email}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderKanban className="size-3.5" aria-hidden />
            Multi-tenant by design — Row Level Security on every table.
          </div>
        </div>
      </aside>
    </div>
  )
}

export function AuthSubmitHint({ children }: { children: ReactNode }) {
  return (
    <Button asChild variant="link" className="h-auto p-0 text-xs">
      <span>{children}</span>
    </Button>
  )
}