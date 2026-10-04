-- =====================================================================
-- PMS — post-apply verification
--
-- Run after migrations/0001_init.sql. Dashboard → SQL Editor → Run.
--
-- Read-only: inspects the catalogue, never changes data.
--
-- Every check is written to return the *offending rows*, so an empty result
-- is the pass condition. Nothing here asserts a hardcoded row count, which
-- would risk reporting PASS for the wrong reason if the schema grew.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Any of our tables with RLS switched off.
--    Expect 0 rows. (Empty result = all tables protected.)
-- ---------------------------------------------------------------------
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (
    'spatial_ref_sys', 'geography_columns', 'geometry_columns',
    'spatial_ref_sys_geometry_columns'
  )
  and not c.relrowsecurity
order by c.relname;


-- ---------------------------------------------------------------------
-- 1b. How many of our tables there are, and how many are protected.
--     Informational: expect 21 tables, 21 with RLS.
-- ---------------------------------------------------------------------
select
  count(*)                                          as our_tables,
  count(*) filter (where c.relrowsecurity)          as rls_enabled,
  count(*) filter (where not c.relrowsecurity)      as rls_disabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (
    'spatial_ref_sys', 'geography_columns', 'geometry_columns',
    'spatial_ref_sys_geometry_columns'
  );


-- ---------------------------------------------------------------------
-- 2. RLS helper functions. They MUST be in the private schema and
--    SECURITY DEFINER with an empty search_path.
--    A row showing schema = public means the fix did not apply.
--    Expect all rows: schema = private, security = definer,
--    search_path = {search_path=""}
-- ---------------------------------------------------------------------
select
  n.nspname                                                  as schema,
  p.proname                                                 as function,
  case p.prosecdef when true then 'definer' else 'invoker' end as security,
  p.proconfig                                                as search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
order by p.proname;

-- Sanity: anything left behind in `public`?
-- Expect 0 rows.
select n.nspname as schema, p.proname as function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_org_member', 'org_role', 'has_org_role', 'is_org_admin',
    'can_read_task', 'can_write_project', 'can_write_task', 'current_user_id',
    'project_org', 'team_org', 'task_org', 'is_project_member',
    'can_read_project', 'can_read_task_for', 'can_write_task_for',
    'shares_workspace', 'is_org_member_in', 'storage_org_id'
  )
order by p.proname;


-- ---------------------------------------------------------------------
-- 3. Privileges. `anon` must reach none of it.
--    Expect: anon_private_usage = false, authed_private_usage = true,
--            anon_public_create = false,
--            anon_helper_exec = false, authed_helper_exec = true
-- ---------------------------------------------------------------------
select
  has_schema_privilege('anon', 'private', 'USAGE')                                  as anon_private_usage,
  has_schema_privilege('authenticated', 'private', 'USAGE')                         as authed_private_usage,
  has_schema_privilege('anon', 'public', 'CREATE')                                 as anon_public_create,
  has_function_privilege('anon', 'private.is_org_member(uuid)', 'EXECUTE')         as anon_helper_exec,
  has_function_privilege('authenticated', 'private.is_org_member(uuid)', 'EXECUTE') as authed_helper_exec;


-- ---------------------------------------------------------------------
-- 4. Tables with no policy at all. Such a table denies everything, which
--    looks like a bug ("my rows are empty") rather than a permission error.
--    Expect 0 rows.
-- ---------------------------------------------------------------------
select c.relname as table_without_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy pol on pol.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not in (
    'spatial_ref_sys', 'geography_columns', 'geometry_columns',
    'spatial_ref_sys_geometry_columns'
  )
  and c.relrowsecurity
group by c.relname
having count(pol.polname) = 0
order by c.relname;


-- ---------------------------------------------------------------------
-- 5. Any policy still calling a helper by its old `public.` name.
--    These fail at query time with "function does not exist".
--    Expect 0 rows.
-- ---------------------------------------------------------------------
select policyname, tablename
from pg_policies
where schemaname = 'public'
  and (
       qual        like '%public.is_org_member%'
    or qual        like '%public.can_read_task%'
    or qual        like '%public.can_write_task%'
    or qual        like '%public.can_write_project%'
    or qual        like '%public.org_role%'
    or qual        like '%public.storage_org_id%'
    or with_check  like '%public.is_org_member%'
    or with_check  like '%public.can_read_task%'
    or with_check  like '%public.can_write_task%'
  )
order by tablename, policyname;


-- ---------------------------------------------------------------------
-- 5b. Policies that read another RLS-protected table directly.
--     This is what causes `infinite recursion detected in policy for
--     relation "projects"`: two policies reading each other's table. Every
--     such lookup must go through a private.* SECURITY DEFINER helper.
--     Expect 0 rows.
-- ---------------------------------------------------------------------
with ours as (
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
policy_reads as (
  select policyname, tablename, coalesce(qual, '') || ' ' || coalesce(with_check, '') as body
  from pg_policies
  where schemaname = 'public'
),
edges as (
  select
    pr.policyname,
    pr.tablename,
    m[1] as reads_table
  from policy_reads pr
  cross join lateral regexp_matches(pr.body, 'from public\.(\w+)', 'g') as m
)
select e.policyname, e.tablename, e.reads_table
from edges e
join ours o on o.relname = e.reads_table
where e.reads_table <> e.tablename
order by e.tablename, e.reads_table;


-- ---------------------------------------------------------------------
-- 6. Storage buckets.
--    Expect: avatars (public = true), project-files and task-attachments
--    (public = false).
-- ---------------------------------------------------------------------
select id, public, file_size_limit
from storage.buckets
order by id;


-- ---------------------------------------------------------------------
-- 7. Signup wiring: the triggers that create a profile and a workspace.
--    Expect 2 rows, tgenabled = 'O' (origin).
-- ---------------------------------------------------------------------
select tgname, tgenabled, tgrelid::regclass as on_table
from pg_trigger
where not tgisinternal
  and tgname in ('on_auth_user_created', 'on_organization_created')
order by tgname;


-- ---------------------------------------------------------------------
-- 8. Realtime publication entries.
--    Expect: activity_logs, notifications, task_comments, tasks
-- ---------------------------------------------------------------------
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;


-- ---------------------------------------------------------------------
-- 9. Workspace defaults. seed_workspace_defaults() runs from the
--    on_organization_created trigger, so every workspace gets these.
--    Expect 6 statuses and 4 priorities for one workspace; a second
--    workspace multiplies both.
-- ---------------------------------------------------------------------
select 'statuses' as kind, count(*) from public.task_statuses
union all
select 'priorities', count(*) from public.priorities;
-- Then create a second user to confirm the trigger fires, and re-run.
-- ---------------------------------------------------------------------
-- Invitation join flow
-- ---------------------------------------------------------------------

\echo '== 9. Invitation functions exist and are safe =='
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('accept_invitation', 'invitation_preview'))
   or (n.nspname = 'private' and p.proname in ('current_user_email', 'invitation_for_token'))
order by n.nspname, p.proname;

\echo '== 10. accept_invitation must not be callable by anon =='
-- proacl is null when a function has default (PUBLIC) privileges, which for
-- accept_invitation would be a hole: anon could try to join any workspace.
select
  has_function_privilege('anon', 'public.accept_invitation(uuid)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.accept_invitation(uuid)', 'EXECUTE') as auth_can_execute;

\echo '== 11. Pending invitations =='
select email, role, status, expires_at > now() as unexpired, accepted_at
from public.organization_invitations
order by created_at desc;

\echo '== 12. Invitations already accepted (each should have a membership row) =='
select i.email, i.organization_id, om.user_id
from public.organization_invitations i
left join public.organization_members om
  on om.organization_id = i.organization_id and om.user_id = auth.uid()
where i.status = 'accepted';

\echo '== 13. handle_new_user honours invite_token =='
-- The signup path must branch on the token, otherwise every invited user also
-- gets a stray empty workspace.
select prosrc like '%invite_token%' as reads_invite_token
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'handle_new_user';

\echo '== 14. Reporting aggregates exist and are not public =='
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('workspace_report', 'workspace_time_total', 'invitation_preview', 'accept_invitation')
order by p.proname;
