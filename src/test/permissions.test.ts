import { describe, expect, it } from 'vitest'

import { can, hasProjectPermission, hasRolePermission, orgCan, ROLE_PERMISSIONS } from '@/lib/permissions'
import { ROLES } from '@/types/database'

describe('permission matrix', () => {
  it('grants nothing without a role', () => {
    expect(hasRolePermission(null, 'tasks.view')).toBe(false)
    expect(hasRolePermission(undefined, 'projects.create')).toBe(false)
    expect(orgCan(null, 'members.invite')).toBe(false)
  })

  it('keeps viewers read-only', () => {
    expect(hasRolePermission('viewer', 'tasks.view')).toBe(true)
    expect(hasRolePermission('viewer', 'comments.create')).toBe(true)
    expect(hasRolePermission('viewer', 'tasks.update')).toBe(false)
    expect(hasRolePermission('viewer', 'tasks.create')).toBe(false)
    expect(hasRolePermission('viewer', 'projects.create')).toBe(false)
  })

  it('lets members work on tasks but not projects', () => {
    expect(hasRolePermission('member', 'tasks.create')).toBe(true)
    expect(hasRolePermission('member', 'tasks.assign')).toBe(true)
    expect(hasRolePermission('member', 'time.create')).toBe(true)
    expect(hasRolePermission('member', 'projects.create')).toBe(false)
    expect(hasRolePermission('member', 'members.invite')).toBe(false)
  })

  it('gives managers project authority', () => {
    expect(hasRolePermission('manager', 'projects.create')).toBe(true)
    expect(hasRolePermission('manager', 'projects.delete')).toBe(true)
    expect(hasRolePermission('manager', 'members.invite')).toBe(false)
  })

  it('gives admins member management', () => {
    expect(hasRolePermission('admin', 'members.invite')).toBe(true)
    expect(hasRolePermission('admin', 'members.remove')).toBe(true)
    expect(hasRolePermission('admin', 'settings.manage')).toBe(false)
  })

  it('reserves settings.manage and workspace deletion for owners', () => {
    expect(hasRolePermission('owner', 'settings.manage')).toBe(true)
    expect(hasRolePermission('owner', 'organization.delete')).toBe(true)
    expect(hasRolePermission('admin', 'organization.delete')).toBe(false)
  })

  it('is monotonic — every higher role is a superset of the one below', () => {
    const order = ['viewer', 'member', 'manager', 'admin', 'owner'] as const
    for (let index = 1; index < order.length; index += 1) {
      const lower = ROLE_PERMISSIONS[order[index - 1] ?? 'viewer']
      const higher = ROLE_PERMISSIONS[order[index] ?? 'owner']
      for (const permission of lower) {
        expect(higher.has(permission)).toBe(true)
      }
    }
  })

  it('never grants workspace-scoped powers through project membership', () => {
    for (const role of ROLES) {
      expect(orgCan(role, 'members.invite')).toBe(role === 'owner' || role === 'admin')
      expect(orgCan(role, 'organization.update')).toBe(
        role === 'manager' || role === 'admin' || role === 'owner',
      )
      expect(orgCan(role, 'settings.manage')).toBe(role === 'owner')
    }
  })
})

describe('project roles', () => {
  it('limits project viewers', () => {
    expect(hasProjectPermission('viewer', 'tasks.view')).toBe(true)
    expect(hasProjectPermission('viewer', 'tasks.update')).toBe(false)
  })

  it('lets workspace authority win over a narrow project role', () => {
    expect(can('admin', 'viewer', 'tasks.delete')).toBe(true)
    expect(can('manager', 'viewer', 'projects.create')).toBe(true)
  })

  it('does not escalate a workspace viewer through project membership', () => {
    expect(can('viewer', 'owner', 'tasks.delete')).toBe(false)
    expect(can('viewer', 'manager', 'projects.update')).toBe(false)
  })

  it('falls back to workspace authority when there is no project role', () => {
    expect(can('member', null, 'tasks.create')).toBe(true)
    expect(can('member', null, 'projects.create')).toBe(false)
  })
})