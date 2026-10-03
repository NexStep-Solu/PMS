/**
 * Explicit relationship graph used by the demo (in-memory) backend.
 *
 * Mirrors the foreign keys declared in `supabase/migrations/0001_init.sql`.
 * The Supabase backend resolves joins with PostgREST instead, but the same
 * select syntax (`alias:table!hint(cols)`) is used by the app either way.
 */

export interface Relation {
  /** Table that holds the foreign key. */
  childTable: string
  /** Column on the child table. */
  childColumn: string
  /** Table that holds the referenced primary key. */
  parentTable: string
  /** Column on the parent table. */
  parentColumn: string
}

export const RELATIONS: Relation[] = [
  { childTable: 'profiles', childColumn: 'id', parentTable: 'organizations', parentColumn: 'id' },

  { childTable: 'organization_members', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'organization_members', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'organization_invitations', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'organization_invitations', childColumn: 'invited_by', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'teams', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'team_members', childColumn: 'team_id', parentTable: 'teams', parentColumn: 'id' },
  { childTable: 'team_members', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'projects', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'projects', childColumn: 'owner_id', parentTable: 'profiles', parentColumn: 'id' },
  { childTable: 'projects', childColumn: 'created_by', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'project_members', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },
  { childTable: 'project_members', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'task_statuses', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'task_statuses', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },

  { childTable: 'priorities', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'labels', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },

  { childTable: 'tasks', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'parent_task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'status_id', parentTable: 'task_statuses', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'priority_id', parentTable: 'priorities', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'assignee_id', parentTable: 'profiles', parentColumn: 'id' },
  { childTable: 'tasks', childColumn: 'reporter_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'task_labels', childColumn: 'task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'task_labels', childColumn: 'label_id', parentTable: 'labels', parentColumn: 'id' },

  { childTable: 'task_comments', childColumn: 'task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'task_comments', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'task_checklists', childColumn: 'task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'task_checklists', childColumn: 'id', parentTable: 'task_checklists', parentColumn: 'id' },

  { childTable: 'task_attachments', childColumn: 'task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'task_attachments', childColumn: 'uploaded_by', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'project_files', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },
  { childTable: 'project_files', childColumn: 'uploaded_by', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'milestones', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },
  { childTable: 'milestones', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },

  { childTable: 'time_entries', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'time_entries', childColumn: 'project_id', parentTable: 'projects', parentColumn: 'id' },
  { childTable: 'time_entries', childColumn: 'task_id', parentTable: 'tasks', parentColumn: 'id' },
  { childTable: 'time_entries', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },

  { childTable: 'notifications', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },
  { childTable: 'notifications', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },

  { childTable: 'activity_logs', childColumn: 'organization_id', parentTable: 'organizations', parentColumn: 'id' },
  { childTable: 'activity_logs', childColumn: 'user_id', parentTable: 'profiles', parentColumn: 'id' },
]

export function resolveRelation(
  childTable: string,
  parentTable: string,
  hint?: string,
): Relation | undefined {
  const candidates = RELATIONS.filter(
    (r) => r.childTable === childTable && r.parentTable === parentTable,
  )
  if (candidates.length <= 1) return candidates[0]
  if (hint) {
    const normalised = hint.replace(/_fkey$/, '')
    const matched = candidates.find(
      (r) => `${r.childTable}_${r.childColumn}` === normalised,
    )
    if (matched) return matched
  }
  return candidates[0]
}