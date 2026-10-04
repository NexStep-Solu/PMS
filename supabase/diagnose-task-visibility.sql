-- Read-only diagnostics for "task assignee / project not visible in the UI".
-- Paste into the Supabase SQL editor. Safe to run: it only reads.
-- Re-run 0001_init.sql first; the checks below compare live state to the
-- policy definitions the app now relies on.

\echo '== 1. Tables and columns the app selects =='
select
  to_regclass('public.tasks')    is not null as has_tasks,
  to_regclass('public.profiles') is not null as has_profiles,
  to_regclass('public.projects') is not null as has_projects;

select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by column_name;

\echo '== 2. Tasks missing an assignee profile row =='
-- Non-zero here means the auth.users trigger never ran for those accounts, so
-- every assignee embed resolves to null in the UI.
select t.id, t.title, t.assignee_id
from public.tasks t
where t.assignee_id is not null
  and not exists (select 1 from public.profiles p where p.id = t.assignee_id);

\echo '== 3. Tasks with a null assignee_id or project_id =='
-- If your freshly created task appears here, the write path is dropping values.
select id, title, assignee_id, project_id, created_at
from public.tasks
where assignee_id is null or project_id is null
order by created_at desc
limit 20;

\echo '== 4. RLS enabled everywhere it should be =='
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;

\echo '== 5. profiles select policy =='
-- Must include private.shares_workspace(id); an older `id = auth.uid()` only
-- version hides every other member, which is what blanks the Assignee column.
select policyname, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles';

\echo '== 6. Helper functions the policies depend on =='
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
order by p.proname;

\echo '== 7. Members per organization =='
-- handle_new_user creates a separate organization per signup. Two people who
-- signed up separately are in different organizations and cannot see or be
-- assigned to each other, even though both accounts work fine.
select o.name as organization, count(om.user_id) as members
from public.organizations o
left join public.organization_members om on om.organization_id = o.id
group by o.name
order by members desc, o.name;

\echo '== 8. Pending invitations =='
-- useInviteMember only writes here. It does not create an
-- organization_members row, so a pending invitee will not appear in any
-- assignee picker until they accept.
select email, role, status, created_at
from public.organization_invitations
order by created_at desc
limit 20;