/**
 * Canonical database types for the PMS schema.
 *
 * These mirror `supabase/migrations/0001_init.sql`. Keep both in sync — the
 * frontend never talks to the database with anything other than these types.
 */

export type UUID = string

/* ------------------------------------------------------------------ */
/* Enumerations                                                        */
/* ------------------------------------------------------------------ */

export const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const PROJECT_ROLES = ['owner', 'manager', 'member', 'viewer'] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

export const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number]

export const STATUS_CATEGORIES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const
export type StatusCategory = (typeof STATUS_CATEGORIES)[number]

export const MILESTONE_STATUSES = ['planned', 'in_progress', 'completed'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const
export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_mentioned',
  'task_due_soon',
  'task_overdue',
  'comment_added',
  'project_invitation',
  'milestone_approaching',
  'member_joined',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const ACTIVITY_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'assigned',
  'unassigned',
  'status_changed',
  'priority_changed',
  'due_date_changed',
  'moved',
  'commented',
  'uploaded',
  'archived',
  'member_added',
  'member_removed',
  'member_role_changed',
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export type EntityType =
  | 'organization'
  | 'project'
  | 'task'
  | 'milestone'
  | 'comment'
  | 'member'
  | 'time_entry'
  | 'attachment'

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

export interface Profile {
  id: UUID
  full_name: string | null
  avatar_url: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Organization {
  id: UUID
  name: string
  slug: string
  logo_url: string | null
  created_by: UUID
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: UUID
  organization_id: UUID
  user_id: UUID
  role: Role
  joined_at: string
}

export interface OrganizationInvitation {
  id: UUID
  organization_id: UUID
  email: string
  role: Role
  token: UUID
  invited_by: UUID
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface Team {
  id: UUID
  organization_id: UUID
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: UUID
  team_id: UUID
  user_id: UUID
  created_at: string
}

export interface Project {
  id: UUID
  organization_id: UUID
  name: string
  key: string
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string | null
  due_date: string | null
  owner_id: UUID | null
  created_by: UUID
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: UUID
  project_id: UUID
  user_id: UUID
  role: ProjectRole
  created_at: string
}

export interface TaskStatus {
  id: UUID
  organization_id: UUID
  project_id: UUID | null
  name: string
  key: string
  category: StatusCategory
  color: string | null
  position: number
  is_default: boolean
  is_completed: boolean
}

export interface Priority {
  id: UUID
  organization_id: UUID
  name: string
  key: string
  level: number
  position: number
}

export interface Label {
  id: UUID
  organization_id: UUID
  name: string
  color: string
}

export interface Task {
  id: UUID
  organization_id: UUID
  project_id: UUID
  parent_task_id: UUID | null
  title: string
  description: string | null
  status_id: UUID
  priority_id: UUID | null
  assignee_id: UUID | null
  reporter_id: UUID
  start_date: string | null
  due_date: string | null
  estimated_minutes: number | null
  position: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskLabel {
  task_id: UUID
  label_id: UUID
}

export interface TaskComment {
  id: UUID
  task_id: UUID
  user_id: UUID
  content: string
  created_at: string
  updated_at: string
}

export interface TaskChecklistItem {
  id: UUID
  task_id: UUID
  title: string
  position: number
  is_completed: boolean
}

export interface TaskAttachment {
  id: UUID
  task_id: UUID
  uploaded_by: UUID
  file_name: string
  storage_path: string
  file_size: number
  mime_type: string
  created_at: string
}

export interface ProjectFile {
  id: UUID
  project_id: UUID
  uploaded_by: UUID
  file_name: string
  storage_path: string
  file_size: number
  mime_type: string
  created_at: string
}

export interface Milestone {
  id: UUID
  project_id: UUID
  organization_id: UUID
  name: string
  description: string | null
  due_date: string
  status: MilestoneStatus
  position: number
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: UUID
  organization_id: UUID
  project_id: UUID
  task_id: UUID | null
  user_id: UUID
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  description: string | null
  is_running: boolean
  created_at: string
}

export interface Notification {
  id: UUID
  user_id: UUID
  organization_id: UUID
  type: NotificationType
  title: string
  message: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface ActivityLog {
  id: UUID
  organization_id: UUID
  user_id: UUID | null
  entity_type: EntityType
  entity_id: UUID
  action: ActivityAction
  metadata: Record<string, unknown>
  created_at: string
}

/* ------------------------------------------------------------------ */
/* Table registry — used to derive typed table access                  */
/* ------------------------------------------------------------------ */

export interface DatabaseSchema {
  profiles: Profile
  organizations: Organization
  organization_members: OrganizationMember
  organization_invitations: OrganizationInvitation
  teams: Team
  team_members: TeamMember
  projects: Project
  project_members: ProjectMember
  task_statuses: TaskStatus
  priorities: Priority
  labels: Label
  tasks: Task
  task_labels: TaskLabel
  task_comments: TaskComment
  task_checklists: TaskChecklistItem
  task_attachments: TaskAttachment
  project_files: ProjectFile
  milestones: Milestone
  time_entries: TimeEntry
  notifications: Notification
  activity_logs: ActivityLog
}

export type TableName = keyof DatabaseSchema