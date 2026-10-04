/**
 * Session, profile and workspace resolution.
 *
 * Resolution order after sign-in:
 *   auth user → profile → organisation memberships → active organisation → role
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'
import type { AuthSession, AuthUser } from '@/lib/db/contract'
import type { Organization, Profile, Role } from '@/types/database'

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export function useAuthSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: async (): Promise<AuthSession | null> => {
      const { data, error } = await db().auth.getSession()
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}

export function useCurrentUser(): AuthUser | null {
  return useAuthSession().data?.user ?? null
}

export function useAuthActions() {
  const client = useQueryClient()

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await db().auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      client.clear()
    },
  })

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await db().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })

  const changePassword = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await db().auth.updateUser({ password: newPassword })
      if (error) throw error
    },
  })

  return { signOut, resetPassword, changePassword }
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export function useProfile(userId?: string | undefined) {
  const sessionUserId = useCurrentUser()?.id
  const resolvedUserId = userId ?? sessionUserId

  return useQuery({
    queryKey: keys.profile(resolvedUserId ?? 'anonymous'),
    enabled: Boolean(resolvedUserId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await db()
        .from('profiles')
        .select('*')
        .eq('id', resolvedUserId as string)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, ...values }: { userId: string; full_name: string; timezone: string; avatar_url: string | null }) => {
      const { error } = await db()
        .from('profiles')
        .update({ full_name: values.full_name, timezone: values.timezone, avatar_url: values.avatar_url })
        .eq('id', userId)
      if (error) throw error
      return { userId: userId as string }
    },
    onSuccess: ({ userId }) => {
      void client.invalidateQueries({ queryKey: keys.profile(userId) })
      void client.invalidateQueries({ queryKey: keys.workspaces })
    },
  })
}

/* ------------------------------------------------------------------ */
/* Workspaces                                                          */
/* ------------------------------------------------------------------ */

export interface Workspace {
  organization: Organization
  role: Role
}

export function useWorkspaces(userId?: string | undefined) {
  const sessionUserId = useCurrentUser()?.id
  const resolvedUserId = userId ?? sessionUserId

  return useQuery({
    queryKey: keys.workspaces,
    enabled: Boolean(resolvedUserId),
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await db()
        .from('organization_members')
        .select('role, organizations(id, name, slug, logo_url, created_by, created_at, updated_at)')
        .eq('user_id', resolvedUserId as string)
      if (error) throw error

      type MemberWithOrg = { role: Role; organizations: Organization | Organization[] | null }
      return ((data ?? []) as unknown as MemberWithOrg[])
        .flatMap((row) => {
          if (!row.organizations) return []
          const list = Array.isArray(row.organizations) ? row.organizations : [row.organizations]
          return list.map((organization) => ({ organization, role: row.role }))
        })
        // Workspaces you own come first, then alphabetical — that is also the
        // workspace the app selects on a first visit.
        .sort((a, b) => {
          if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
          return a.organization.name.localeCompare(b.organization.name)
        })
    },
  })
}

export function useCreateWorkspace() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)

      const { data, error } = await db()
        .from('organizations')
        .insert({ name: name.trim(), slug: `${slug || 'workspace'}-${Date.now().toString(36)}`, created_by: userId })
        .select('id')
        .single()
      if (error) throw error
      if (!data) throw new Error('Workspace could not be created.')

      const memberError = await db()
        .from('organization_members')
        .insert({ organization_id: data.id, user_id: userId, role: 'owner' })
      if (memberError.error) throw memberError.error

      return data
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.workspaces })
    },
  })
}