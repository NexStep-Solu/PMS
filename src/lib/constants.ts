import type {
  ActivityAction,
  MilestoneStatus,
  ProjectPriority,
  ProjectStatus,
  StatusCategory,
} from '@/types/database'

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export interface StatusMeta {
  label: string
  /** Dot + text, never colour alone. */
  classes: string
  icon: 'circle' | 'loader' | 'eye' | 'check' | 'x'
}

export const STATUS_META: Record<StatusCategory, StatusMeta> = {
  backlog: { label: 'Backlog', classes: 'text-status-todo bg-status-todo-bg', icon: 'circle' },
  todo: { label: 'Todo', classes: 'text-status-todo bg-status-todo-bg', icon: 'circle' },
  in_progress: { label: 'In Progress', classes: 'text-status-progress bg-status-progress-bg', icon: 'loader' },
  review: { label: 'Review', classes: 'text-status-review bg-status-review-bg', icon: 'eye' },
  done: { label: 'Done', classes: 'text-status-done bg-status-done-bg', icon: 'check' },
  cancelled: { label: 'Cancelled', classes: 'text-status-cancelled bg-status-cancelled-bg', icon: 'x' },
}

export const DEFAULT_STATUS_ORDER: StatusCategory[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'cancelled',
]

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export interface PriorityMeta {
  label: string
  classes: string
  bars: number
}

export const PRIORITY_META: Record<ProjectPriority, PriorityMeta> = {
  urgent: { label: 'Urgent', classes: 'text-priority-urgent bg-priority-urgent-bg', bars: 4 },
  high: { label: 'High', classes: 'text-priority-high bg-priority-high-bg', bars: 3 },
  medium: { label: 'Medium', classes: 'text-priority-medium bg-priority-medium-bg', bars: 2 },
  low: { label: 'Low', classes: 'text-priority-low bg-priority-low-bg', bars: 1 },
}

export const PROJECT_PRIORITY_META = PRIORITY_META

export const PROJECT_STATUS_META: Record<ProjectStatus, StatusMeta> = {
  planned: { label: 'Planned', classes: 'text-status-todo bg-status-todo-bg', icon: 'circle' },
  active: { label: 'Active', classes: 'text-status-progress bg-status-progress-bg', icon: 'loader' },
  on_hold: { label: 'On hold', classes: 'text-priority-medium bg-priority-medium-bg', icon: 'eye' },
  completed: { label: 'Completed', classes: 'text-status-done bg-status-done-bg', icon: 'check' },
  archived: { label: 'Archived', classes: 'text-muted-foreground bg-muted', icon: 'x' },
}

export const MILESTONE_STATUS_META: Record<MilestoneStatus, StatusMeta> = {
  planned: { label: 'Planned', classes: 'text-status-todo bg-status-todo-bg', icon: 'circle' },
  in_progress: { label: 'In progress', classes: 'text-status-progress bg-status-progress-bg', icon: 'loader' },
  completed: { label: 'Completed', classes: 'text-status-done bg-status-done-bg', icon: 'check' },
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

export const ACTIVITY_VERBS: Record<ActivityAction, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  assigned: 'assigned',
  unassigned: 'unassigned',
  status_changed: 'changed status of',
  priority_changed: 'changed priority of',
  due_date_changed: 'changed the due date of',
  moved: 'moved',
  commented: 'commented on',
  uploaded: 'uploaded a file to',
  archived: 'archived',
  member_added: 'added member',
  member_removed: 'removed member',
  member_role_changed: 'changed the role of',
}

/* ------------------------------------------------------------------ */
/* Storage & limits                                                    */
/* ------------------------------------------------------------------ */

export const AVATAR_BUCKET = 'avatars'
export const PROJECT_FILES_BUCKET = 'project-files'
export const TASK_ATTACHMENTS_BUCKET = 'task-attachments'

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export const ACCEPTED_UPLOAD_TYPES =
  'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.fig,.sketch'

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts                                                  */
/* ------------------------------------------------------------------ */

export const SHORTCUTS = {
  /** ⌘K / Ctrl+K — open the command palette. */
  commandMenu: 'mod+k',
  /** C — open the quick-create task dialog. */
  createTask: 'c',
} as const