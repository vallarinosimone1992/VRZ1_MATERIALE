-- Segnalazioni bug: salvataggio persistente + indirizzo Admin per email.
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text not null check (length(trim(description)) >= 5),
  page text,
  user_agent text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table public.bug_reports enable row level security;

drop policy if exists "users create own bug reports" on public.bug_reports;
create policy "users create own bug reports" on public.bug_reports
for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "admins read bug reports" on public.bug_reports;
create policy "admins read bug reports" on public.bug_reports
for select to authenticated
using (public.is_admin());

drop policy if exists "admins update bug reports" on public.bug_reports;
create policy "admins update bug reports" on public.bug_reports
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.bug_reports to authenticated;

create or replace function public.bug_report_recipient()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.role = 'admin' and p.active = true and p.email is not null
  order by p.created_at
  limit 1;
$$;

revoke all on function public.bug_report_recipient() from public, anon;
grant execute on function public.bug_report_recipient() to authenticated;
