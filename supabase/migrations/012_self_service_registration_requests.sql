create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  requested_role public.user_role not null,
  request_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  check (requested_role <> 'admin')
);

create index if not exists registration_requests_status_date_idx
  on public.registration_requests(status, created_at desc);

alter table public.registration_requests enable row level security;

create policy "registration requests read own or admin"
on public.registration_requests for select to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select on public.registration_requests to authenticated;
revoke insert, update, delete on public.registration_requests from authenticated, anon;

create or replace function public.handle_self_service_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'registration_source', '') <> 'self_service' then
    return new;
  end if;

  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_name is null then
    raise exception 'Nome obbligatorio per la richiesta di registrazione';
  end if;

  begin
    v_role := (new.raw_user_meta_data ->> 'requested_role')::public.user_role;
  exception when others then
    raise exception 'Ruolo richiesto non valido';
  end;

  if v_role = 'admin' then
    raise exception 'Non è possibile richiedere il ruolo Admin';
  end if;

  insert into public.registration_requests(user_id, email, full_name, requested_role, request_note)
  values (
    new.id,
    coalesce(new.email, ''),
    v_name,
    v_role,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'request_note', '')), '')
  );

  return new;
end;
$$;

drop trigger if exists auth_user_self_service_registration on auth.users;
create trigger auth_user_self_service_registration
after insert on auth.users
for each row execute function public.handle_self_service_registration();

revoke all on function public.handle_self_service_registration() from public, anon, authenticated;

create or replace function public.approve_registration_request(
  p_request_id uuid,
  p_role public.user_role,
  p_unit_id text default null,
  p_squad_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.registration_requests;
begin
  if not public.is_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  if p_role = 'admin' then
    raise exception 'Le richieste di registrazione non possono essere approvate come Admin';
  end if;

  select * into v_request
  from public.registration_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'La richiesta è già stata gestita';
  end if;

  insert into public.profiles(id, email, full_name, role, unit_id, squad_id, active)
  values (
    v_request.user_id,
    v_request.email,
    v_request.full_name,
    p_role,
    nullif(p_unit_id, ''),
    case when p_role = 'eg' then nullif(p_squad_id, '') else null end,
    true
  );

  update public.registration_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;
end;
$$;

create or replace function public.reject_registration_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  update public.registration_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Richiesta non trovata o già gestita';
  end if;
end;
$$;

revoke all on function public.approve_registration_request(uuid, public.user_role, text, text) from public, anon;
revoke all on function public.reject_registration_request(uuid) from public, anon;
grant execute on function public.approve_registration_request(uuid, public.user_role, text, text) to authenticated;
grant execute on function public.reject_registration_request(uuid) to authenticated;
