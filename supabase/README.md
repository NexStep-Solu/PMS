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

## Applying it to a project you already touched

The migration is written to be re-runnable for policies
(`drop policy if exists` precedes every `create policy`), but `create table` is
not idempotent. If a first attempt failed part-way — for example with
`infinite recursion detected in policy for relation "organization_members"` —
the cleanest fix while still in development is:

**Dashboard → Database → Reset** (or `supabase db reset`), then paste the file
once more into a clean database.

That recursion error is the reason the RLS helper functions live in a
non-exposed `private` schema as `SECURITY DEFINER`: a policy on
`organization_members` has to call `is_org_member()`, and if that function were
`SECURITY INVOKER` its own query would re-enter the policy on
`organization_members` until Postgres gave up with a stack-depth failure. See
the long comment above the helpers in the migration.

## Environment

Put these in `.env.local` (git-ignored) and in your Vercel project settings:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or publishable key>
```

> Never add `SUPABASE_SERVICE_ROLE_KEY` to anything in this repository. Any
> `VITE_`-prefixed value is bundled into the browser. The service-role key is
> only used by database triggers and the SQL functions, which run server-side.

## Why my confirmation email sends me to localhost:3000

`http://localhost:3000` is Supabase's default **Site URL**, and it is not your
code. Two settings decide where a confirmation or recovery link lands:

**1. Authentication → URL Configuration → Site URL.** This is the *default*
redirect target used when the client does not send a `redirectTo`. It ships as
`http://localhost:3000`. Set it to your production URL.

**2. The email template.** Authentication → Emails → Templates → *Confirm
signup*. Supabase's own note on this: when you pass a `redirectTo`, a template
using `{{ .SiteURL }}` will ignore it. Either of these fixes it:

```html
<!-- preferred: honours redirectTo, falls back to SiteURL -->
<a href="{{ .ConfirmationURL }}">Confirm email address</a>

<!-- or the older explicit form -->
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Confirm email address
</a>
```

If the link still goes to `localhost:3000` after fixing both, the template is
the culprit — `{{ .SiteURL }}` wins over anything the client sends.

**Allowlist.** Any `redirectTo` you send must also match the Redirect URLs
list, or Supabase ignores it and falls back to SiteURL. Ours are
`${window.location.origin}/app/dashboard` on sign-up and
`${window.location.origin}/reset-password` on recovery, so the list needs
`http://localhost:5173/**`, your production domain, and the Vercel preview
pattern.

**Already-used links.** Confirmation and recovery links are single-use, and
corporate email scanners routinely `GET` them before the user clicks. The app
reads `error_code`/`error_description` out of the URL fragment and explains
what happened instead of landing on a dead form.

## Deploying to Vercel

Three settings are separate from your local `.env.local` and are the usual
reason a deployed build "ignores" Supabase:

1. **Environment variables live in the Vercel project**, not in a file you
   pushed. Project → Settings → Environment Variables, add both `VITE_` values
   for Production/Preview/Development, then redeploy. If they are missing the
   app does not crash — it silently falls back to the in-memory demo backend.
   Look for the "Demo mode" badge on the sign-in page to tell which backend is
   live.
2. **Allow the redirect origins.** Authentication → URL Configuration → Redirect
   URLs needs `http://localhost:5173/**`, your production domain, and the
   preview pattern (`https://<project>-*.vercel.app/**`) if you test previews.
   Without this, email confirmation and password-reset links are rejected.
3. **SPA rewrites.** `vercel.json` in this repo rewrites unknown paths to
   `index.html` so a hard refresh on `/app/projects/:id/board` works.

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
| `anon` calls `private.is_org_member(...)` | not reachable over the Data API |
| Member A calls `public.notify()` for a non-member of the org | `42501` |

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