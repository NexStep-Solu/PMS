-- =====================================================================
-- PMS — post-apply verification
--
-- Run this after applying migrations/0001_init.sql. Every check should pass.
-- It is read-only: it inspects the catalogue and never changes data.
--
--   Dashboard → SQL Editor → paste → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Every table exists and has RLS enabled.
--    Expect 20 tables, 20 with rowsecurity = true.
-- ---------------------------------------------------------------------
select
  count(*)                                                  as tables_expected,
  count(*) filter (where rowsecurity)                       as rls_enabled,
  count(*) filter (where not rowsecurity)                   as rls_missing,
  case when count(*) = 20 and count(*) filter (where rowsecurity) = 20
    then 'PASS' else 'FAIL' end                             as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in ('spatial_ref_sys', 'geography_columns', 'geometry_columns');

-- ---------------------------------------------------------------------
-- 2. The RLS helper functions live in the non-exposed `private` schema.
--    They must be there: as SECURITY INVOKER in `public` they recursed and
--    Postgres aborted with a max_stack_depth / infinite recursion error.
-- ---------------------------------------------------------------------
select
  n.nspname                                                   as schema,
  p.proname                                                  as function,
  case p.prosecdef when true then 'definer' else 'invoker' end as security,
  p.proconfig                                                 as search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'is_org_member', 'org_role', 'has_org_role', 'is_org_admin',
  'can_read_task', 'can_write_project', 'can_write_task', 'storage_org_id'
)
order by n.nspname, p.proname;
-- Expect: all rows schema = private, security = definer, search_path = {search_path=""}
-- Any row in `public` means the helper edit did not apply.

-- ---------------------------------------------------------------------
-- 3. `anon` must not be able to reach the helpers or create tables.
-- ---------------------------------------------------------------------
select
  has_schema_privilege('anon', 'private', 'USAGE')              as anon_private_usage,
  has_schema_privilege('authenticated', 'private', 'USAGE')     as authed_private_usage,
  has_schema_privilege('anon', 'public', 'CREATE')             as anon_public_create,
  has_function_privilege('anon', 'private.is_org_member(uuid)', 'EXECUTE') as anon_helper_exec,
  has_function_privilege('authenticated', 'private.is_org_member(uuid)', 'EXECUTE') as authed_helper_exec;
-- Expect: anon_private_usage = false, authed_private_usage = true,
--         anon_public_create = false, anon_helper_exec = false, authed_helper_exec = true

-- ---------------------------------------------------------------------
-- 4. Policy coverage. Every table should have at least one policy.
-- ---------------------------------------------------------------------
select
  c.relname                                                  as table,
  count(p.polname)                                           as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'profiles', 'organizations', 'organization_members', 'organization_invitations',
    'teams', 'team_members', 'projects', 'project_members', 'task_statuses',
    'priorities', 'labels', 'tasks', 'task_labels', 'task_comments',
    'task_checklists', 'task_attachments', 'project_files', 'milestones',
    'time_entries', 'notifications', 'activity_logs'
  )
group by c.relname
order by policies, c.relname;
-- Expect: no table with policies = 0.

-- ---------------------------------------------------------------------
-- 5. No policy still references a helper in the old `public` home.
--    These would raise "function does not exist" at query time.
-- ---------------------------------------------------------------------
select policyname, tablename
from pg_policies
where schemaname = 'public'
  and (qual like '%public.is_org_member%'
    or qual like '%public.can_read_task%'
    or qual like '%public.can_write_task%'
    or qual like '%public.can_write_project%'
    or qual like '%public.org_role%'
    or qual like '%public.storage_org_id%'
  );
-- Expect: 0 rows.

-- ---------------------------------------------------------------------
-- 6. Storage buckets exist.
-- ---------------------------------------------------------------------
select id, public, file_size_limit from storage.buckets order by id;
-- Expect: avatars (public), project-files (private), task-attachments (private)

-- ---------------------------------------------------------------------
-- 7. Signup wiring: the trigger and function that create a profile and a
--    personal workspace for every new auth user.
-- ---------------------------------------------------------------------
select
  tgname,
  pg_get_triggerdef(oid) like '%on_auth_user_created%' as on_auth_users,
  tgenabled
from pg_trigger
where tgname in ('on_auth_user_created', 'on_organization_created');
-- Expect: 2 rows, tgenabled = 'O' (origin).

-- ---------------------------------------------------------------------
-- 8. Realtime publication entries.
-- ---------------------------------------------------------------------
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
-- Expect: activity_logs, notifications, task_comments, tasks