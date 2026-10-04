/**
 * In-memory implementation of `DatabaseClient`.
 *
 * Used when `VITE_SUPABASE_URL` is not configured so the app is fully usable
 * for demos and tests. It enforces the same tenant boundary as the real RLS
 * policies: a signed-in user only ever sees rows belonging to organisations
 * they are a member of.
 */

import type { DatabaseSchema, TableName } from '@/types/database'

import type {
  AuthApi,
  AuthSession,
  AuthStateResult,
  AuthUser,
  DatabaseClient,
  ListResponse,
  RealtimeApi,
  RealtimeChannel,
  RpcApi,
  RpcResult,
  SelectBuilder,
  SingleResponse,
  StorageApi,
  Subscription,
  TableRef,
  UnitResponse,
} from '../contract'
import { AppError } from '../errors'
import { execute, normaliseFilterOp, parseListValue, rowMatches } from './engine'
import type { Filter, QueryMode, QueryPlan, Store } from './engine'
import { DEMO_PASSWORD, DEMO_USERS, createSeedData } from './seed'

type Row = Record<string, unknown>

/** What the builder resolves to: a list, a single row, or no rows at all. */
type RunResult = {
  data: Row[] | Row | null
  error: AppError | null
  count: number | null
}

const LATENCY_MS = 80

/**
 * The real Supabase client persists the session (`persistSession: true`), so the
 * demo backend must too — otherwise a page refresh, a new tab or a bookmarked
 * deep link drops you back to the sign-in screen.
 */
const SESSION_STORAGE_KEY = 'pms-demo-session'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/* Tenant boundary                                                      */
/* ------------------------------------------------------------------ */

/** Tables that carry their own `organization_id`. */
const ORG_BY_COLUMN = {
  organization_members: 'organization_id',
  organization_invitations: 'organization_id',
  teams: 'organization_id',
  projects: 'organization_id',
  task_statuses: 'organization_id',
  priorities: 'organization_id',
  labels: 'organization_id',
  tasks: 'organization_id',
  milestones: 'organization_id',
  time_entries: 'organization_id',
  notifications: 'organization_id',
  activity_logs: 'organization_id',
} as const satisfies Partial<Record<TableName, string>>

/** Tables that reach an organisation through a parent row. */
const ORG_BY_PARENT = {
  team_members: { table: 'teams', column: 'team_id' },
  project_members: { table: 'projects', column: 'project_id' },
  task_labels: { table: 'tasks', column: 'task_id' },
  task_comments: { table: 'tasks', column: 'task_id' },
  task_checklists: { table: 'tasks', column: 'task_id' },
  task_attachments: { table: 'tasks', column: 'task_id' },
  project_files: { table: 'projects', column: 'project_id' },
} as const satisfies Partial<Record<TableName, { table: string; column: string }>>

/** Tables that are reachable from any workspace the user belongs to. */
const USER_SCOPED = new Set<TableName>(['profiles', 'organization_members', 'organizations'])

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

class MemoryStore implements Store {
  private readonly data: Record<string, Row[]>

  constructor(data: Record<string, Row[]>) {
    this.data = data
  }

  table(name: string): Row[] {
    const existing = this.data[name]
    if (existing) return existing
    const created: Row[] = []
    this.data[name] = created
    return created
  }

  rows(name: string, filter: (row: Row) => boolean): Row[] {
    return this.table(name).filter(filter)
  }
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

type Builder<T> = SelectBuilder<T, ListResponse<T> & SingleResponse<T> & UnitResponse>

function createBuilder<T>(context: DemoContext, plan: QueryPlan): Builder<T> {
  const add =
    (op: Filter['op']) =>
    (column: string, value: unknown): Builder<T> => {
      plan.filters.push({ op, column, value })
      return builder
    }

  const builder = {
    select(columns?: string, options?: { count?: 'exact' }): Builder<T> {
      plan.select = columns ?? '*'
      if (options?.count === 'exact') plan.countExact = true
      return builder
    },
    eq: add('eq'),
    neq: add('neq'),
    gt: add('gt'),
    gte: add('gte'),
    lt: add('lt'),
    lte: add('lte'),
    like: add('like'),
    ilike: add('ilike'),
    in(column: string, values: readonly unknown[]): Builder<T> {
      plan.filters.push({ op: 'in', column, value: [...values] })
      return builder
    },
    is(column: string, value: null | boolean): Builder<T> {
      plan.filters.push({ op: 'is', column, value })
      return builder
    },
    contains(column: string, value: unknown): Builder<T> {
      plan.filters.push({ op: 'contains', column, value })
      return builder
    },
    overlaps(column: string, values: readonly unknown[]): Builder<T> {
      plan.filters.push({ op: 'overlaps', column, value: [...values] })
      return builder
    },
    or(expression: string): Builder<T> {
      plan.orFilters.push(expression)
      return builder
    },
    filter(column: string, operator: string, value: unknown): Builder<T> {
      const op = normaliseFilterOp(operator)
      plan.filters.push({
        op,
        column,
        value: op === 'in' || op === 'not_in' ? parseListValue(value) : value,
      })
      return builder
    },
    order(column: string, options?: { ascending?: boolean } | boolean): Builder<T> {
      plan.order.push({
        column,
        ascending: typeof options === 'boolean' ? options : (options?.ascending ?? true),
      })
      return builder
    },
    limit(count: number): Builder<T> {
      plan.limit = count
      return builder
    },
    range(from: number, to: number): Builder<T> {
      plan.offset = from
      plan.limit = to - from + 1
      return builder
    },
    throwOnError: (): Builder<T> => builder,
    single(): Builder<T> {
      plan.single = 'single'
      plan.limit = 1
      return builder
    },
    maybeSingle(): Builder<T> {
      plan.single = 'maybeSingle'
      plan.limit = 1
      return builder
    },
    then(
      onfulfilled?: ((value: ListResponse<T> & SingleResponse<T> & UnitResponse) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) {
      return context.run(plan).then(
        (result) =>
          (onfulfilled
            ? onfulfilled(result as ListResponse<T> & SingleResponse<T> & UnitResponse)
            : result) as never,
        onrejected as never,
      )
    },
  } as unknown as Builder<T>

  return builder
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

class DemoContext {
  readonly store: MemoryStore
  private session: AuthSession | null = null
  private readonly listeners = new Set<
    (event: 'SIGNED_IN' | 'SIGNED_OUT', session: AuthSession | null) => void
  >()
  private readonly storage = new Map<string, Map<string, Blob>>()

  constructor() {
    this.store = new MemoryStore(createSeedData() as unknown as Record<string, Row[]>)
    this.restoreSession()
  }

  private restoreSession(): void {
    let userId: string | null = null
    try {
      userId = window.localStorage.getItem(SESSION_STORAGE_KEY)
    } catch {
      return // private mode — stay signed out
    }
    if (!userId) return
    if (!DEMO_USERS.some((user) => user.id === userId)) {
      this.clearStoredSession()
      return
    }
    const user = this.toAuthUser(userId)
    this.session = this.makeSession(user)
  }

  private persistSession(userId: string): void {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, userId)
    } catch {
      /* ignore */
    }
  }

  private clearStoredSession(): void {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  private get currentUserId(): string | null {
    return this.session?.user.id ?? null
  }

  private visibleOrgIds(): Set<string> {
    const userId = this.currentUserId
    if (!userId) return new Set()
    return new Set(
      this.store
        .rows('organization_members', (row) => row.user_id === userId)
        .map((row) => row.organization_id as string),
    )
  }

  /** Filters that restrict a table to the caller's organisations. */
  private tenantFilters(table: TableName): Filter[] {
    const allowed = this.visibleOrgIds()
    const orgIds = [...allowed]
    if (orgIds.length === 0) return [{ op: 'eq', column: 'id', value: '__no_access__' }]

    if (USER_SCOPED.has(table)) {
      // The roster is org-scoped, not self-scoped: members must be able to see
      // every teammate, or the assignee pickers and the members page show only
      // the signed-in user. Mirrors the org_members_select policy.
      if (table === 'organization_members') return [{ op: 'in', column: 'organization_id', value: orgIds }]
      if (table === 'organizations') return [{ op: 'in', column: 'id', value: orgIds }]
      return []
    }

    const orgColumn = ORG_BY_COLUMN[table as keyof typeof ORG_BY_COLUMN]
    if (orgColumn) return [{ op: 'in', column: orgColumn, value: orgIds }]

    const parent = ORG_BY_PARENT[table as keyof typeof ORG_BY_PARENT]
    if (!parent) return []
    const parentOrgColumn = ORG_BY_COLUMN[parent.table as keyof typeof ORG_BY_COLUMN]
    const ids = this.store
      .rows(
        parent.table,
        (row) =>
          parentOrgColumn === undefined || orgIds.includes(row[parentOrgColumn] as string),
      )
      .map((row) => row.id as string)
    return [{ op: 'in', column: parent.column, value: ids }]
  }

  async run(plan: QueryPlan): Promise<RunResult> {
    await delay(LATENCY_MS)

    if (!this.currentUserId) {
      return {
        data: null,
        error: new AppError('unauthorized', 'You must be signed in to read this data.'),
        count: null,
      }
    }

    const table = plan.table as TableName

    if (plan.mode === 'insert') {
      const allowed = this.visibleOrgIds()
      const rows = plan.insertRows ?? []
      const foreign = rows.some((row) => !this.belongsToVisibleOrg(table, row, allowed))
      if (foreign) {
        return {
          data: null,
          error: new AppError('forbidden', 'You cannot write to this workspace.'),
          count: null,
        }
      }
    }

    const scoped: QueryPlan = { ...plan, filters: [...plan.filters, ...this.tenantFilters(table)] }
    const total =
      scoped.countExact && scoped.mode === 'select'
        ? this.store
            .table(scoped.table)
            .filter((row) => rowMatches(row, scoped.filters, scoped.orFilters)).length
        : null

    const outcome = execute(scoped, this.store)
    return this.respond(scoped, outcome.data, total)
  }

  /** Can `row` be written by the caller? Mirrors the RLS organisation check. */
  private belongsToVisibleOrg(table: TableName, row: Row, allowed: Set<string>): boolean {
    const orgId = row.organization_id
    if (typeof orgId === 'string') return allowed.has(orgId)

    const parent = ORG_BY_PARENT[table as keyof typeof ORG_BY_PARENT]
    if (!parent) return true

    const parentRow = this.store.rows(parent.table, (r) => r.id === row[parent.column])[0]
    if (!parentRow) return false

    const parentOrgColumn = ORG_BY_COLUMN[parent.table as keyof typeof ORG_BY_COLUMN]
    if (parentOrgColumn === undefined) return true
    return allowed.has(parentRow[parentOrgColumn] as string)
  }

  private respond(plan: QueryPlan, rows: Row[], count: number | null): RunResult {
    if (plan.single) {
      const first = rows[0]
      if (!first) {
        return {
          data: null,
          error:
            plan.single === 'single'
              ? new AppError('not_found', 'Row not found', { code: 'PGRST116' })
              : null,
          count: 0,
        }
      }
      return { data: first, error: null, count: count ?? 1 }
    }

    return { data: rows, error: null, count }
  }

  /* ---------------------------------------------------------- auth */

  /* ---------------------------------------------------------------- */
  /* Workspaces                                                        */
  /* ---------------------------------------------------------------- */

  private createPersonalWorkspace(userId: string, email: string): string {
    const orgId = `org-${userId}`
    const label = email.split('@')[0] ?? 'workspace'
    this.store.table('organizations').push({
      id: orgId,
      name: `${label}'s workspace`,
      slug: `${label}-${userId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      logo_url: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    this.store.table('organization_members').push({
      id: `om-${userId}`,
      organization_id: orgId,
      user_id: userId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })
    return orgId
  }

  /** Returns false when the token is dead or addressed to someone else. */
  private joinByToken(token: string, userId: string, email: string): boolean {
    const invite = this.store
      .rows('organization_invitations', (row) => row.token === token)
      .find(
        (row) => row.status === 'pending' && new Date(row.expires_at as string).getTime() > Date.now(),
      )
    if (!invite) return false
    if ((invite.email as string).toLowerCase() !== email) return false

    this.store.table('organization_members').push({
      id: `om-${userId}-${invite.organization_id}`,
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role,
      joined_at: new Date().toISOString(),
    })
    invite.status = 'accepted'
    invite.accepted_at = new Date().toISOString()
    return true
  }

  /**
   * Mirrors `public.workspace_report`: one row per task shape rather than one row
   * per task, so the reports page never has to hold the whole task table.
   */
  private workspaceReport<T>(orgId: string): RpcResult<T> {
    const statuses = new Map(
      this.store.rows('task_statuses', () => true).map((row) => [row.id as string, row]),
    )
    const projects = new Map(
      this.store.rows('projects', () => true).map((row) => [row.id as string, row]),
    )

    const buckets = new Map<
      string,
      {
        project_id: string | null
        project_key: string | null
        status_id: string
        priority_id: string | null
        assignee_id: string | null
        total: number
        done: number
        in_progress: number
        overdue: number
      }
    >()

    const today = new Date().toISOString().slice(0, 10)

    for (const task of this.store.rows('tasks', (row) => row.organization_id === orgId)) {
      const status = statuses.get(task.status_id as string)
      // Mirror the SQL's inner join: a task with no matching status is not counted.
      if (!status) continue

      const isDone = status.is_completed === true && status.category !== 'cancelled'
      const isCancelled = status.category === 'cancelled'
      const key = [
        task.project_id ?? 'none',
        task.status_id,
        task.priority_id ?? 'none',
        task.assignee_id ?? 'none',
      ].join('|')

      const bucket = buckets.get(key) ?? {
        project_id: (task.project_id as string | null) ?? null,
        project_key:
          task.project_id === null ? null : ((projects.get(task.project_id as string)?.key as string) ?? null),
        status_id: task.status_id as string,
        priority_id: (task.priority_id as string | null) ?? null,
        assignee_id: (task.assignee_id as string | null) ?? null,
        total: 0,
        done: 0,
        in_progress: 0,
        overdue: 0,
      }

      bucket.total += 1
      if (isDone) bucket.done += 1
      if (status.category === 'in_progress') bucket.in_progress += 1
      const due = (task.due_date as string | null) ?? null
      if (due !== null && due < today && !isDone && !isCancelled) bucket.overdue += 1

      buckets.set(key, bucket)
    }

    return { data: [...buckets.values()] as T, error: null }
  }

  private workspaceTimeTotal<T>(orgId: string): RpcResult<T> {
    let trackedMinutes = 0
    let runningEntries = 0
    let loggedEntries = 0

    for (const entry of this.store.rows('time_entries', (row) => row.organization_id === orgId)) {
      if (entry.is_running) {
        runningEntries += 1
      } else {
        trackedMinutes += Number(entry.duration_minutes ?? 0)
        loggedEntries += 1
      }
    }

    return {
      data: {
        tracked_minutes: trackedMinutes,
        running_entries: runningEntries,
        logged_entries: loggedEntries,
      } as T,
      error: null,
    }
  }

  /* ---------------------------------------------------------------- */
  /* Postgres functions                                                */
  /* ---------------------------------------------------------------- */

  async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<RpcResult<T>> {
    switch (fn) {
      case 'invitation_preview':
        return this.invitationPreview<T>(args.p_token as string)
      case 'accept_invitation':
        return this.acceptInvitation<T>(args.p_token as string)
      case 'workspace_report':
        return this.workspaceReport<T>(args.p_org as string)
      case 'workspace_time_total':
        return this.workspaceTimeTotal<T>(args.p_org as string)
      default:
        return {
          data: null as T,
          error: new AppError('not_found', `Unknown function "${fn}".`, { code: '42883' }),
        }
    }
  }

  private invitationPreview<T>(token: string): RpcResult<T> {
    const invite = this.store.rows('organization_invitations', (row) => row.token === token)[0]
    if (!invite) return { data: null as T, error: null }

    const org = this.store
      .rows('organizations', (row) => row.id === invite.organization_id)[0]
    const inviter = this.store.rows('profiles', (row) => row.id === invite.invited_by)[0]

    return {
      data: {
        organization_name: org?.name ?? 'this workspace',
        invited_email: invite.email,
        role: invite.role,
        invited_by: inviter?.full_name ?? 'A teammate',
        is_valid: invite.status === 'pending' && new Date(invite.expires_at as string).getTime() > Date.now(),
        status: invite.status,
      } as T,
      error: null,
    }
  }

  private acceptInvitation<T>(token: string): RpcResult<T> {
    const email = (this.session?.user.email ?? '').toLowerCase()
    const invite = this.store
      .rows('organization_invitations', (row) => row.token === token)
      .find(
        (row) => row.status === 'pending' && new Date(row.expires_at as string).getTime() > Date.now(),
      )

    if (!token) {
      return { data: null as T, error: new AppError('not_found', 'Invitation not found.') }
    }
    if (!invite) {
      return {
        data: null as T,
        error: new AppError('not_found', 'This invitation is no longer valid.', { code: 'no_data_found' }),
      }
    }
    if ((invite.email as string).toLowerCase() !== email) {
      return {
        data: null as T,
        error: new AppError(
          'validation',
          `This invitation was sent to ${invite.email}.`,
          { code: 'insufficient_privilege' },
        ),
      }
    }

    const userId = this.session!.user.id
    this.joinByToken(token, userId, email)
    const org = this.store.rows('organizations', (row) => row.id === invite.organization_id)[0]

    return {
      data: {
        organization_id: invite.organization_id,
        organization_name: org?.name ?? 'this workspace',
        role: invite.role,
      } as T,
      error: null,
    }
  }

  signIn(
    email: string,
    password: string,
  ): AuthStateResult<{ user: AuthUser | null; session: AuthSession | null }> {
    const normalised = email.trim().toLowerCase()
    const match = DEMO_USERS.find((user) => user.email === normalised)
    const invalid = new AppError('validation', 'Incorrect email or password.', {
      code: 'invalid_credentials',
    })
    if (!match) return { data: { user: null, session: null }, error: invalid }
    if (password !== DEMO_PASSWORD) return { data: { user: null, session: null }, error: invalid }

    const user = this.toAuthUser(match.id)
    const session = this.makeSession(user)
    this.session = session
    this.persistSession(user.id)
    this.emit('SIGNED_IN', session)
    return { data: { user, session }, error: null }
  }

  signUp(
    email: string,
    inviteToken?: string,
  ): AuthStateResult<{ user: AuthUser | null; session: AuthSession | null }> {
    const normalised = email.trim().toLowerCase()
    if (DEMO_USERS.some((user) => user.email === normalised)) {
      return {
        data: { user: null, session: null },
        error: new AppError('conflict', 'An account with this email already exists.', {
          code: 'email_exists',
        }),
      }
    }
    const id = `u-${(normalised.split('@')[0] ?? 'member').replace(/[^a-z0-9-]/gi, '')}`
    this.store.table('profiles').push({
      id,
      full_name: normalised.split('@')[0] ?? 'New member',
      avatar_url: null,
      timezone: 'UTC',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    const user = this.toAuthUser(id, normalised)
    const session = this.makeSession(user)
    this.session = session
    this.persistSession(user.id)

    // Same order of preference as handle_new_user: an invited signup joins the
    // existing workspace, otherwise it gets a personal one. Without this a demo
    // signup would land with no workspace at all.
    const joined = inviteToken ? this.joinByToken(inviteToken, id, normalised) : false
    if (!joined) this.createPersonalWorkspace(id, normalised)

    this.emit('SIGNED_IN', session)
    return { data: { user, session }, error: null }
  }

  private toAuthUser(id: string, fallbackEmail?: string): AuthUser {
    const seed = DEMO_USERS.find((user) => user.id === id)
    const profile = this.store.rows('profiles', (row) => row.id === id)[0]
    return {
      id,
      email: seed?.email ?? fallbackEmail ?? `${id}@pms.dev`,
      emailConfirmedAt: new Date().toISOString(),
      userMetadata: { full_name: seed?.fullName ?? (profile?.full_name as string | undefined) ?? 'New member' },
      createdAt: (profile?.created_at as string | undefined) ?? new Date().toISOString(),
    }
  }

  private makeSession(user: AuthUser): AuthSession {
    return { user, accessToken: `demo.${user.id}`, expiresAt: Date.now() + 60 * 60 * 1000 }
  }

  signOut(): { error: AppError | null } {
    this.session = null
    this.clearStoredSession()
    this.emit('SIGNED_OUT', null)
    return { error: null }
  }

  getSession(): AuthStateResult<AuthSession | null> {
    return { data: this.session, error: null }
  }

  getUser(): AuthStateResult<AuthUser | null> {
    return { data: this.session?.user ?? null, error: null }
  }

  updateUser(attributes: {
    email?: string
    password?: string
    data?: Record<string, unknown>
  }): AuthStateResult<AuthUser | null> {
    if (!this.session) return { data: null, error: new AppError('unauthorized', 'No active session.') }
    let session = this.session
    if (attributes.email) session = { ...session, user: { ...session.user, email: attributes.email } }
    if (attributes.data?.full_name) {
      const profile = this.store.rows('profiles', (row) => row.id === session.user.id)[0]
      if (profile) {
        profile.full_name = attributes.data.full_name
        profile.updated_at = new Date().toISOString()
      }
      session = { ...session, user: { ...session.user, userMetadata: attributes.data } }
    }
    this.session = session
    return { data: session.user, error: null }
  }

  onAuthStateChange(
    callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: AuthSession | null) => void,
  ): Subscription {
    this.listeners.add(callback)
    return { unsubscribe: () => this.listeners.delete(callback) }
  }

  private emit(event: 'SIGNED_IN' | 'SIGNED_OUT', session: AuthSession | null): void {
    for (const listener of this.listeners) listener(event, session)
  }

  /* ------------------------------------------------------- storage */

  bucket(name: string): Map<string, Blob> {
    const existing = this.storage.get(name)
    if (existing) return existing
    const created = new Map<string, Blob>()
    this.storage.set(name, created)
    return created
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export function createDemoClient(): DatabaseClient {
  const context = new DemoContext()

  const auth: AuthApi = {
    signUp: (params) =>
      Promise.resolve(
        context.signUp(params.email, params.options?.data?.invite_token as string | undefined),
      ),
    signInWithPassword: (params) => Promise.resolve(context.signIn(params.email, params.password)),
    signOut: () => Promise.resolve(context.signOut()),
    getUser: () => Promise.resolve(context.getUser()),
    getSession: () => Promise.resolve(context.getSession()),
    updateUser: (attributes) => Promise.resolve(context.updateUser(attributes)),
    resetPasswordForEmail: () => Promise.resolve({ error: null }),
    onAuthStateChange: (callback) =>
      context.onAuthStateChange((event, session) => callback(event, session)),
  }

  const storage: StorageApi = {
    from: (bucket) => ({
      upload: async (path, file) => {
        await delay(220)
        context.bucket(bucket).set(path, file)
        return { path, error: null }
      },
      remove: async (paths) => {
        for (const path of paths) context.bucket(bucket).delete(path)
        return { error: null }
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `/demo-storage/${path}` } }),
      createSignedUrl: async (path) => ({
        data: { signedUrl: `/demo-storage/${path}` },
        error: null,
      }),
    }),
  }

  const realtime: RealtimeApi = {
    channel: (): RealtimeChannel => {
      const channel: RealtimeChannel = {
        on: () => channel,
        subscribe: () => channel,
        unsubscribe: () => Promise.resolve({ error: null }),
      }
      return channel
    },
    removeChannel: () => Promise.resolve({ error: null }),
  }

  const from = <K extends TableName>(table: K): TableRef<DatabaseSchema[K]> => {
    const plan = (mode: QueryMode): QueryPlan => ({
      table,
      mode,
      select: mode === 'select' ? '*' : null,
      countExact: false,
      filters: [],
      orFilters: [],
      order: [],
      limit: null,
      offset: 0,
      single: null,
      insertRows: null,
      patch: null,
    })

    const ref = {
      select: (columns?: string, options?: { count?: 'exact' }) => {
        const next = plan('select')
        next.select = columns ?? '*'
        next.countExact = options?.count === 'exact'
        return createBuilder<DatabaseSchema[K]>(context, next)
      },
      insert: (values: unknown) => {
        const next = plan('insert')
        next.insertRows = Array.isArray(values) ? (values as Row[]) : [values as Row]
        return createBuilder<DatabaseSchema[K]>(context, next)
      },
      update: (values: unknown) => {
        const next = plan('update')
        next.patch = values as Row
        return createBuilder<DatabaseSchema[K]>(context, next)
      },
      upsert: (values: unknown) => {
        const rows = Array.isArray(values) ? (values as Row[]) : [values as Row]
        const id = rows[0]?.id
        const existing = id ? context.store.rows(table, (row) => row.id === id) : []
        const next = plan(existing.length > 0 ? 'update' : 'insert')
        if (existing.length > 0 && rows[0]) {
          const target = existing[0] as Row
          Object.assign(target, rows[0], { updated_at: new Date().toISOString() })
          next.patch = null
          next.insertRows = [target]
          next.select = '*'
          return createBuilder<DatabaseSchema[K]>(context, next)
        }
        next.insertRows = rows
        return createBuilder<DatabaseSchema[K]>(context, next)
      },
      delete: () => createBuilder<DatabaseSchema[K]>(context, plan('delete')),
    }
    return ref as unknown as TableRef<DatabaseSchema[K]>
  }

  const rpc: RpcApi = (fn, args) => context.rpc(fn, args ?? {})

  return { from, rpc, auth, storage, realtime }
}