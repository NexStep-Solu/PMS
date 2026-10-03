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

export function useMembers() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: keys.members(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const { data, error } = await db()
        .from('organization_members')
        .select('*, profiles!organization_members_user_id_fkey(id, full_name, avatar_url, timezone)')
        .eq('organization_id', organizationId as string)
        .order('joined_at')
      if (error) throw error
      return (data ?? []) as unknown as WorkspaceMember[]
    },
  })
}

/** Flat option list for every assignee picker. */
export function useMemberOptions(): MemberOption[] {
  const { data } = useMembers()
  return (
    data?.map((member) => ({
      id: member.user_id,
      full_name: member.profiles?.full_name ?? null,
      avatar_url: member.profiles?.avatar_url ?? null,
      role: member.role,
    })) ?? []
  )
}

export function useTeams() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: keys.teams(organizationId ?? ''),
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('teams')
        .select('*, team_members(team_members!inner(user_id))')
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

      const { error } = await db().from('organization_invitations').insert({
        organization_id: organizationId as string,
        email: email.trim().toLowerCase(),
        role,
        invited_by: invitedBy,
        status: 'pending',
        token: crypto.randomUUID(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.invitations(organizationId ?? '') })
      toast.success('Invitation sent', {
        description: 'Share the invite link from the members page.',
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