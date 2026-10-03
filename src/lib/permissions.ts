/**
 * The permission matrix.
 *
 * This is the single source of truth for the UI and application layer. It
 * mirrors (but never replaces) the RLS policies in
 * `supabase/migrations/0001_init.sql` — hiding a button is a usability
 * feature, not a security control.
 */

import { ROLES, type ProjectRole, type Role } from '@/types/database'

export { ROLES }

export const PERMISSIONS = [
  'organization.view',
  'organization.update',
  'organization.delete',
  'members.view',
  'members.invite',
  'members.update',
  'members.remove',
  'teams.manage',
  'projects.view',
  'projects.create',
  'projects.update',
  'projects.delete',
  'tasks.view',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  'tasks.assign',
  'comments.create',
  'comments.delete',
  'files.upload',
  'files.delete',
  'time.view',
  'time.create',
  'time.update',
  'reports.view',
  'settings.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const VIEWER: Permission[] = [
  'organization.view',
  'members.view',
  'projects.view',
  'tasks.view',
  'comments.create',
  'time.view',
  'reports.view',
]

const MEMBER: Permission[] = [
  ...VIEWER,
  'tasks.create',
  'tasks.update',
  'tasks.assign',
  'comments.delete',
  'files.upload',
  'time.create',
  'time.update',
]

const MANAGER: Permission[] = [
  ...MEMBER,
  'organization.update',
  'teams.manage',
  'projects.create',
  'projects.update',
  'projects.delete',
  'tasks.delete',
  'files.delete',
]

const ADMIN: Permission[] = [...MANAGER, 'members.invite', 'members.update', 'members.remove']

const OWNER: Permission[] = [...ADMIN, 'settings.manage', 'organization.delete']

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set(VIEWER),
  member: new Set(MEMBER),
  manager: new Set(MANAGER),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Full control of the workspace, including billing settings and deletion.',
  admin: 'Manages members, teams and every project in the workspace.',
  manager: 'Creates and edits projects, tasks and milestones.',
  member: 'Works on tasks: create, update, comment and track time.',
  viewer: 'Read-only access to projects and tasks.',
}

export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, ReadonlySet<Permission>> = {
  viewer: new Set(['projects.view', 'tasks.view', 'comments.create', 'files.upload', 'time.create']),
  member: new Set([
    'projects.view',
    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.assign',
    'comments.create',
    'comments.delete',
    'files.upload',
    'files.delete',
    'time.view',
    'time.create',
    'time.update',
  ]),
  manager: new Set([
    'projects.view',
    'projects.update',
    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'tasks.assign',
    'comments.create',
    'comments.delete',
    'files.upload',
    'files.delete',
    'time.view',
    'time.create',
    'time.update',
  ]),
  owner: new Set(MANAGER),
}

export function hasRolePermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].has(permission)
}

export function hasProjectPermission(
  role: ProjectRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false
  return PROJECT_ROLE_PERMISSIONS[role].has(permission)
}

/**
 * Org-level authority wins over project membership: a workspace admin can
 * always work inside a project even without an explicit project_members row.
 */
export function can(
  orgRole: Role | null | undefined,
  projectRole: ProjectRole | null | undefined,
  permission: Permission,
): boolean {
  if (hasRolePermission(orgRole, permission)) return true
  // Mirrors `can_write_task` in the RLS migration: a workspace viewer never
  // gains write access through a project membership row.
  if (orgRole === 'viewer' || !projectRole) return false
  return hasProjectPermission(projectRole, permission)
}

/** Permissions that must never be granted purely through project membership. */
const ORG_ONLY: Permission[] = [
  'organization.update',
  'organization.delete',
  'members.invite',
  'members.update',
  'members.remove',
  'teams.manage',
  'settings.manage',
  'reports.view',
]

export function orgCan(role: Role | null | undefined, permission: Permission): boolean {
  if (ORG_ONLY.includes(permission)) return hasRolePermission(role, permission)
  return hasRolePermission(role, permission)
}