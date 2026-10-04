import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Building2, Mail, ShieldCheck, TriangleAlert } from 'lucide-react'

import { AuthLayout } from '@/features/auth/components/auth-layout'
import { useAuthSession } from '@/features/auth/queries'
import {
  useAcceptInvitation,
  useInvitationPreview,
} from '@/features/organizations/queries'
import { db } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { Button } from '@/components/ui/button'
import { InlineError, LoadingState } from '@/components/shared/states'
import { ROLE_LABELS } from '@/lib/permissions'

/**
 * `/invite/:token` is the end of the invitation link an admin copies.
 *
 * Three outcomes, and all three are reachable in practice:
 *   - signed out      -> send them to sign up / sign in with `?token=` preserved
 *   - signed in, right email -> accept
 *   - signed in, wrong email -> explain, do not pretend it worked
 */
export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const session = useAuthSession()
  const { data: preview, isPending, isError, error, refetch } = useInvitationPreview(token)
  const accept = useAcceptInvitation()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const switchAccount = async (next: string) => {
    setSigningOut(true)
    try {
      await db().auth.signOut()
      navigate(`/login?next=${encodeURIComponent(next)}`)
    } finally {
      setSigningOut(false)
    }
  }

  if (isPending) {
    return (
      <AuthLayout title="Checking your invitation">
        <LoadingState />
      </AuthLayout>
    )
  }

  if (isError) {
    return (
      <AuthLayout title="We couldn't check that invitation" subtitle="The link may be incomplete.">
        <div className="space-y-4">
          <InlineError message={friendlyMessage(error as never)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // An unknown token returns no rows. Say so plainly rather than showing a shell.
  if (!preview) {
    return (
      <AuthLayout title="Invitation not found" subtitle="This link is not valid.">
        <div className="space-y-4">
          <InlineError message="We couldn't find an invitation for this link. Ask whoever invited you to send a new one." />
          <Button asChild size="sm" variant="outline">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  const userEmail = session.data?.user.email?.toLowerCase() ?? null
  const signedIn = Boolean(session.data)
  const emailMatches = signedIn && userEmail === preview.invited_email.toLowerCase()

  // Signing up through the link joins on the spot (handle_new_user), so the token
  // is already spent by the time this page loads. Say so rather than "expired".
  if (preview.status === 'accepted') {
    return (
      <AuthLayout
        title={`You are in ${preview.organization_name}`}
        subtitle="This invitation has already been accepted."
      >
        <Button asChild size="sm">
          <Link to="/app/dashboard">Go to your dashboard</Link>
        </Button>
      </AuthLayout>
    )
  }

  if (!preview.is_valid) {
    return (
      <AuthLayout title="This invitation has expired" subtitle={`${preview.organization_name} can send you a new one.`}>
        <Button asChild size="sm" variant="outline">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthLayout>
    )
  }

  // `next` survives the auth detour, so signing in returns the user here to accept.
  const next = `/invite/${token}`

  const onAccept = async () => {
    setProblem(null)
    try {
      const result = await accept.mutateAsync(token as string)
      navigate(`/app/projects?workspace=${result.organization_id}`, { replace: true })
    } catch (err) {
      setProblem(friendlyMessage(err as never))
    }
  }

  return (
    <AuthLayout
      title={`Join ${preview.organization_name}`}
      subtitle={`${preview.invited_by} invited you as ${ROLE_LABELS[preview.role].toLowerCase()}.`}
    >
      <div className="space-y-5">
        <ul className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
          <li className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">{preview.organization_name}</span>
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>Role: {ROLE_LABELS[preview.role]}</span>
          </li>
          <li className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">
              {signedIn ? userEmail : preview.invited_email}
            </span>
          </li>
        </ul>

        {problem ? <InlineError message={problem} /> : null}

        {!signedIn ? (
          <>
            <p className="text-sm text-muted-foreground">
              Sign in as <span className="font-medium text-foreground">{preview.invited_email}</span>{' '}
              to accept, or create an account with that address.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in to accept</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/register?token=${token}&next=${encodeURIComponent(next)}`}>
                Create an account
              </Link>
              </Button>
            </div>
          </>
        ) : !emailMatches ? (
          <>
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <p>
                You're signed in as <span className="font-medium">{userEmail}</span>, but this invitation
                was sent to <span className="font-medium">{preview.invited_email}</span>. Sign in with that
                address to accept it.
              </p>
            </div>
            {/* RequireGuest bounces signed-in visitors away from /login, so switch
                accounts explicitly instead of linking to a page they cannot see. */}
            <Button
              size="sm"
              variant="outline"
              loading={signingOut}
              onClick={() => void switchAccount(next)}
            >
              Sign out and switch account
            </Button>
          </>
        ) : (
          <Button size="sm" loading={accept.isPending} onClick={() => void onAccept()}>
            Join {preview.organization_name}
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}