/**
 * The active workspace ("current organisation") and the permissions derived
 * from it. Everything tenant-scoped reads this, which is why it lives above
 * the router rather than inside a feature.
 */

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

import type { Workspace } from '@/features/auth/queries'
import type { Permission } from '@/lib/permissions'
import { hasRolePermission, orgCan } from '@/lib/permissions'
import type { Organization, Role } from '@/types/database'

const ACTIVE_ORG_STORAGE_KEY = 'pms-active-organization'

interface WorkspaceContextValue {
  workspaces: Workspace[]
  workspace: Workspace | null
  organization: Organization | null
  organizationName: string | null
  organizationId: string | null
  role: Role | null
  loading: boolean
  /** Switch workspace; every scoped query key changes with the organisation. */
  setActiveOrganization: (id: string) => void
  can: (permission: Permission) => boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function readActiveOrg(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
}

export function WorkspaceProvider({
  workspaces,
  children,
}: {
  workspaces: Workspace[] | undefined
  children: ReactNode
}) {
  const [chosenId, setChosenId] = useState<string | null>(readActiveOrg)

  const loading = workspaces === undefined

  // Derived rather than synchronised: if the remembered workspace is gone (or
  // this is a first visit) fall back to the first available one.
  const workspace = useMemo(() => {
    const available = workspaces ?? []
    if (available.length === 0) return null
    return available.find((item) => item.organization.id === chosenId) ?? (available[0] ?? null)
  }, [workspaces, chosenId])

  const setActiveOrganization = useCallback((id: string) => {
    window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, id)
    setChosenId(id)
  }, [])

  const role = workspace?.role ?? null

  const can = useCallback(
    (permission: Permission) => orgCan(role, permission),
    [role],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces: workspaces ?? [],
      workspace,
      organization: workspace?.organization ?? null,
      organizationName: workspace?.organization.name ?? null,
      organizationId: workspace?.organization.id ?? null,
      role,
      loading,
      setActiveOrganization,
      can,
    }),
    [workspaces, workspace, role, loading, setActiveOrganization, can],
  )

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = use(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return context
}

/** Convenience hook for permission checks. */
export function usePermission(): {
  role: Role | null
  can: (permission: Permission) => boolean
  canRole: (permission: Permission) => boolean
} {
  const { role, can } = useWorkspace()
  return { role, can, canRole: (permission) => hasRolePermission(role, permission) }
}
