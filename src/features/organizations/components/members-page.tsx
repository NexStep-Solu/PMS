import { useState } from 'react'
import { Mail, Shield, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState, ErrorState, SkeletonList } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '@/lib/permissions'
import { friendlyMessage } from '@/lib/db/errors'
import { isDemoMode } from '@/lib/client'
import { useCurrentUser } from '@/features/auth/queries'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import type { Role } from '@/types/database'

import {
  useInviteMember,
  useInvitations,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
} from '../queries'

export function MembersPage() {
  const user = useCurrentUser()
  const { organizationName } = useWorkspace()
  const { can } = usePermission()
  const { data: members, isPending, isError, refetch } = useMembers()
  const { data: invitations } = useInvitations()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const revoke = useRevokeInvitation()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null)

  const canManage = can('members.update')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Members"
        description={`${members?.length ?? 0} people have access to ${organizationName ?? 'this workspace'}.`}
        actions={
          can('members.invite') ? (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden />
              Invite
            </Button>
          ) : null
        }
      />

      {isPending ? (
        <SkeletonList rows={5} />
      ) : isError ? (
        <ErrorState title="Couldn't load members" onRetry={() => void refetch()} />
      ) : (
        <ul className="divide-y rounded-xl border">
          {(members ?? []).map((member) => {
            const profile = member.profiles
            const isSelf = member.user_id === user?.id

            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                <UserAvatar person={profile} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {profile?.full_name ?? 'Unknown'}
                    {isSelf ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{profile?.timezone}</p>
                </div>

                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    updateRole.mutate(
                      { memberId: member.id, role: value as Role, memberName: profile?.full_name ?? 'Member' },
                      { onError: (error) => toast.error(friendlyMessage(error as never)) },
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${profile?.full_name ?? 'member'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {canManage && !isSelf ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setPendingRemoval({ id: member.id, name: profile?.full_name ?? 'this member' })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {(invitations ?? []).length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            Pending invitations
          </h2>
          <ul className="divide-y rounded-xl border">
            {(invitations ?? []).map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-3 py-2.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{invitation.email}</span>
                <Badge variant="muted">{ROLE_LABELS[invitation.role]}</Badge>
                {canManage ? (
                  <Button variant="ghost" size="sm" onClick={() => revoke.mutate({ id: invitation.id })}>
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isDemoMode ? (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          Demo mode: invitations are stored locally and no email is sent. Connect Supabase to send real
          invites.
        </p>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => (open ? undefined : setPendingRemoval(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemoval?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to every project in this workspace. Their tasks stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingRemoval) return
                removeMember.mutate(
                  { memberId: pendingRemoval.id, memberName: pendingRemoval.name },
                  { onError: () => toast.error("Couldn't remove that member.") },
                )
                setPendingRemoval(null)
              }}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const invite = useInviteMember()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail('')
          setRole('member')
          onOpenChange(false)
        },
        onError: (mutationError) => setError(friendlyMessage(mutationError as never)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            They will be able to sign in with this email and join the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Role</span>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger className="w-full" aria-label="Role to invite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((entry) => entry !== 'owner').map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {ROLE_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={invite.isPending}>
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Roles reference                                                     */
/* ------------------------------------------------------------------ */

export function RolesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Roles"
        description="What each role can do in this workspace. The same rules are enforced by database policies."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <li key={role} className="rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">{ROLE_LABELS[role]}</h2>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </li>
        ))}
      </ul>

      <EmptyState
        title="Custom roles"
        description="Per-project roles (owner, manager, member, viewer) are managed from each project's members dialog."
      />
    </div>
  )
}