import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import { ROLES, type OrganizationMember, type Role } from '@/types/database'

import { recordActivity } from '@/features/activity/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import type { MemberOption } from '@/components/shared/member-select'

export interface Member extends OrganizationMember {
  profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export interface WorkspaceMember {
  id: string
  user_id: string
  role: Role
  joined_at: string
  profiles: { id: string; full_name: string | null; avatar_url: string | null; timezone: string } | null
}

export function useMembers(options?: { page?: number; pageSize?: number }) {
  const { organizationId } = useWorkspace()
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 0
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const windowed = pageSize > 0

  return useQuery({
    queryKey: [...keys.members(organizationId ?? ''), { page, pageSize }],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<{ rows: WorkspaceMember[]; total: number }> => {
      let query = db()
        .from('organization_members')
        .select('*, profiles!organization_members_user_id_fkey(id, full_name, avatar_url, timezone)', {
          count: 'exact',
        })
        .eq('organization_id', organizationId as string)
        .order('joined_at')

      if (windowed) query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        rows: (data ?? []) as unknown as WorkspaceMember[],
        total: windowed ? (count ?? (data ?? []).length) : (data ?? []).length,
      }
    },
  })
}

/**
 * Flat option list for every assignee picker.
 *
 * Pickers are *not* paginated — an assignee you cannot see is an assignee you
 * cannot assign — so this deliberately reads the whole roster behind a generous
 * cap rather than a page.
 */
export function useMemberOptions(): MemberOption[] {
  const { organizationId } = useWorkspace()

  const { data } = useQuery({
    queryKey: [...keys.members(organizationId ?? ''), 'options'],
    enabled: Boolean(organizationId),
    staleTime: 300_000,
    queryFn: async (): Promise<MemberOption[]> => {
      const { data, error } = await db()
        .from('organization_members')
        .select('user_id, role, profiles!organization_members_user_id_fkey(id, full_name, avatar_url)')
        .eq('organization_id', organizationId as string)
        .order('joined_at')
        .limit(500)
      if (error) throw error

      return ((data ?? []) as unknown as Array<{
        user_id: string
        role: Role
        profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
      }>).map((member) => ({
        id: member.user_id,
        full_name: member.profiles?.full_name ?? null,
        avatar_url: member.profiles?.avatar_url ?? null,
        role: member.role,
      }))
    },
  })

  return data ?? []
}

export function useTeams() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: keys.teams(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('teams')
        .select('id, name, description, team_members(user_id)')
        .eq('organization_id', organizationId as string)
        .order('name')
      if (error) throw error
      return data as unknown as (Member & { name: string; description: string | null; team_members: { user_id: string }[] })[]
    },
  })
}

export function useInvitations() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: keys.invitations(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId as string)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useUpdateMemberRole() {
  const client = useQueryClient()
  const { organizationId, role: actorRole } = useWorkspace()

  return useMutation({
    mutationFn: async ({ memberId, role, memberName }: { memberId: string; role: Role; memberName: string }) => {
      if (role === 'owner' && actorRole !== 'owner') {
        throw new Error('Only an owner can promote someone to owner.')
      }
      const { error } = await db().from('organization_members').update({ role }).eq('id', memberId)
      if (error) throw error

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'member',
        entityId: memberId,
        action: 'member_role_changed',
        metadata: { member: memberName, role },
      })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.members(organizationId ?? '') })
      void client.invalidateQueries({ queryKey: keys.workspaces })
      toast.success('Role updated')
    },
  })
}

export function useRemoveMember() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ memberId, memberName }: { memberId: string; memberName: string }) => {
      const { error } = await db().from('organization_members').delete().eq('id', memberId)
      if (error) throw error

      await recordActivity({
        organizationId: organizationId as string,
        entityType: 'member',
        entityId: memberId,
        action: 'member_removed',
        metadata: { member: memberName },
      })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.members(organizationId ?? '') })
      void client.invalidateQueries({ queryKey: keys.workspaces })
      toast.success('Member removed')
    },
  })
}

export function useInviteMember() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: Role }) => {
      const session = await db().auth.getSession()
      const invitedBy = session.data?.user.id
      if (!invitedBy) throw new Error('You must be signed in to invite members.')

      const normalised = email.trim().toLowerCase()

      // Re-inviting someone who already has a live link would orphan the first
      // one, so refresh the existing invitation instead of stacking duplicates.
      const existing = await db()
        .from('organization_invitations')
        .select('id, token')
        .eq('organization_id', organizationId as string)
        .eq('email', normalised)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (existing.data) {
        const { error } = await db()
          .from('organization_invitations')
          .update({ role, token: crypto.randomUUID() })
          .eq('id', existing.data.id)
        if (error) throw error
        return { email: normalised, token: String(existing.data.token ?? '') }
      }

      const token = crypto.randomUUID()
      const { error } = await db().from('organization_invitations').insert({
        organization_id: organizationId as string,
        email: normalised,
        role,
        invited_by: invitedBy,
        status: 'pending',
        token,
      })
      if (error) throw error
      return { email: normalised, token }
    },
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: keys.invitations(organizationId ?? '') })
      toast.success('Invitation ready', {
        description: `Copy the invite link and send it to ${result.email}.`,
      })
    },
  })
}

/** The absolute link an admin copies and sends to the person they invited. */
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`
}

export interface InvitationPreview {
  organization_name: string
  invited_email: string
  role: Role
  invited_by: string
  is_valid: boolean
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
}

/**
 * Looks up an invite token. Runs before sign-in, so it must work for a signed
 * out visitor; `invitation_preview` is granted to anon for exactly that.
 */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: keys.invitationPreview(token ?? 'none'),
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<InvitationPreview | null> => {
      const { data, error } = await db().rpc<InvitationPreview>('invitation_preview', {
        p_token: token,
      })
      if (error) throw error
      return data
    },
  })
}

export function useAcceptInvitation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await db().rpc<{
        organization_id: string
        organization_name: string
        role: Role
      }>('accept_invitation', { p_token: token })
      if (error) throw error
      if (!data) throw new Error('This invitation is no longer valid.')
      return data
    },
    onSuccess: (result) => {
      // Membership, workspace list and role all just changed.
      void client.invalidateQueries()
      toast.success(`You joined ${result.organization_name}`, {
        description: 'Switch to it from the workspace menu.',
      })
    },
  })
}

export function useRevokeInvitation() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await db().from('organization_invitations').update({ status: 'revoked' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.invitations(organizationId ?? '') })
      toast.success('Invitation revoked')
    },
  })
}

export function useUpdateOrganization() {
  const client = useQueryClient()
  const { organizationId } = useWorkspace()

  return useMutation({
    mutationFn: async (values: { name: string; logo_url: string | null }) => {
      const { error } = await db().from('organizations').update(values).eq('id', organizationId as string)
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.workspaces })
      void client.invalidateQueries({ queryKey: keys.organization(organizationId ?? '') })
      toast.success('Workspace updated')
    },
  })
}

export const assignableRoles = ROLES.filter((role) => role !== 'owner') as Role[]