import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { MemberSelect } from '@/components/shared/member-select'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { friendlyMessage } from '@/lib/db/errors'
import { useMemberOptions } from '@/features/organizations/queries'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import type { ProjectRole } from '@/types/database'

import {
  useAddProjectMember,
  useProjectMembers,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from '../queries'

const PROJECT_ROLES: ProjectRole[] = ['owner', 'manager', 'member', 'viewer']

export function ProjectMembersDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { projectId } = useProjectIdFromRoute()
  const { data: members } = useProjectMembers(projectId)
  const memberOptions = useMemberOptions()
  const { can } = usePermission()
  const { organizationName } = useWorkspace()
  const addMember = useAddProjectMember(projectId ?? '')
  const updateRole = useUpdateProjectMemberRole(projectId ?? '')
  const removeMember = useRemoveProjectMember(projectId ?? '')

  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<ProjectRole>('member')
  const [error, setError] = useState<string | null>(null)

  const existing = new Set((members ?? []).map((member) => member.user_id))
  const available = memberOptions.filter((option) => !existing.has(option.id))

  const submit = () => {
    if (!userId) return
    setError(null)
    addMember.mutate(
      { userId, role },
      {
        onSuccess: () => {
          setUserId(null)
          setRole('member')
        },
        onError: (mutationError) => setError(friendlyMessage(mutationError as never)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project members</DialogTitle>
          <DialogDescription>
            People added here can see this project even if they are viewers in{' '}
            {organizationName ?? 'the workspace'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <ul className="divide-y rounded-lg border">
            {(members ?? []).map((member) => {
              const profile = (
                member as unknown as {
                  profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
                }
              ).profiles

              return (
                <li key={member.id} className="flex items-center gap-2 px-3 py-2">
                  <UserAvatar person={profile} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {profile?.full_name ?? 'Unknown'}
                  </span>

                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      updateRole.mutate(
                        { memberId: member.id, role: value as ProjectRole },
                        { onError: () => toast.error("Couldn't update that role.") },
                      )
                    }
                    disabled={!can('projects.update')}
                  >
                    <SelectTrigger size="sm" className="w-28" aria-label="Project role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_ROLES.map((entry) => (
                        <SelectItem key={entry} value={entry}>
                          {entry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {can('projects.update') ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        removeMember.mutate(
                          { memberId: member.id, memberName: profile?.full_name ?? 'Member' },
                          { onError: () => toast.error("Couldn't remove that member.") },
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {can('projects.update') ? (
            <div className="flex flex-wrap items-center gap-2">
              <MemberSelect
                members={available}
                value={userId}
                onChange={setUserId}
                placeholder="Add a person"
                className="min-w-40 flex-1"
                emptyLabel="Everyone is already a member"
              />
              <Select value={role} onValueChange={(value) => setRole(value as ProjectRole)}>
                <SelectTrigger size="sm" className="w-28" aria-label="Role to grant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ROLES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={submit} disabled={!userId || addMember.isPending}>
                <UserPlus aria-hidden />
                Add
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useProjectIdFromRoute() {
  return useParams<{ projectId: string }>()
}