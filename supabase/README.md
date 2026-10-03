# Supabase setup

Everything the app needs on the backend lives in
`migrations/0001_init.sql`. It is a single migration so a fresh project can be
taken from empty to fully working in one step.

## Apply the schema

### With the Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### From the dashboard

SQL editor → paste `migrations/0001_init.sql` → run.

Applying the migration creates, for free:

- every table, index, trigger and RLS policy
- the `avatars`, `project-files` and `task-attachments` buckets with their
  storage policies
- realtime publication entries for `tasks`, `task_comments`, `notifications`
  and `activity_logs`
- default task statuses and priorities for every workspace, including the ones
  the `on_auth_user_created` trigger creates going forward

## Authentication

Enable **Email/Password** in Authentication → Providers. Everything else the
app needs (Google, GitHub, magic link) can be switched on later without code
changes.

Email confirmation is on by default; if you turn it off, `signUp` returns a
session immediately and the app routes straight to the dashboard.

## Environment

Put these in `.env.local` (git-ignored) and in your Vercel project settings:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
```

> Never add `SUPABASE_SERVICE_ROLE_KEY` to anything in this repository. Any
> `VITE_`-prefixed value is bundled into the browser. The service-role key is
> only used by database triggers and the SQL functions, which run server-side.

## Verifying RLS

The demo backend enforces tenant isolation in process, but the real check is
against Postgres. Use two accounts in two browsers (or one normal window and
one private window):

1. Sign up as **A** → a workspace is created for you automatically.
2. Create a project and a task in it.
3. Sign up as **B** in a private window. Note B's workspace id (Project
   Settings → API, or the network tab).
4. As B, request A's project directly:

```bash
curl "$VITE_SUPABASE_URL/rest/v1/projects?id=eq.<A_PROJECT_ID>" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <B_ACCESS_TOKEN>"
```

Expect `[]`. Then confirm B can still read their own projects — if B sees
A's rows, the `projects_select` policy is wrong.

Other cases worth checking:

| Case | Expectation |
| --- | --- |
| Viewer tries to `POST` a task | `42501` from `tasks_insert` |
| Member tries to `DELETE` someone else's project | no rows affected |
| Non-member reads `organization_members` for an org they are not in | `[]` |
| Uploading to `task-attachments` with a path in another org | rejected by the storage policy |
| Signed out user reads anything | `[]` or `401` |

The app must be verified this way; frontend tests cannot prove authorization.

## Useful functions

```sql
-- role of the current user in a workspace (null if not a member)
select public.org_role('<org_id>');

-- can this user see this task?
select public.can_read_task('<org_id>', '<project_id>', '<assignee_id>');

-- human-readable activity trail
select created_at, action, entity_type, metadata
from public.activity_logs
where organization_id = '<org_id>'
order by created_at desc
limit 20;
```

`record_activity()` and `notify()` are `security definer` helpers so the client
can write an audit row or a notification without bypassing the membership
check.