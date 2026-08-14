-- VRZ1 Materiale - schema iniziale Supabase/PostgreSQL
-- Ruoli: admin, capo, rs, eg
-- Quantità: modificabili solo tramite apply_stock_movement (Consuma/Aggiungi)

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
  create type public.user_role as enum ('admin', 'capo', 'rs', 'eg');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.branches (
  id text primary key,
  label text not null unique,
  sort_order integer not null default 0
);

create table if not exists public.units (
  id text primary key,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  label text not null,
  is_common boolean not null default false,
  sort_order integer not null default 0,
  unique (branch_id, label)
);

create table if not exists public.squads (
  id text primary key,
  unit_id text not null references public.units(id) on update cascade on delete restrict,
  label text not null,
  sort_order integer not null default 0,
  unique (unit_id, label)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  unit_id text references public.units(id) on update cascade on delete set null,
  squad_id text references public.squads(id) on update cascade on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  unit_id text not null references public.units(id) on update cascade on delete restrict,
  squad_id text references public.squads(id) on update cascade on delete restrict,
  room_id uuid references public.rooms(id) on update cascade on delete set null,
  location text,
  is_consumable boolean not null default false,
  quantity numeric not null default 0 check (quantity >= 0),
  unit_of_measure text not null default 'pz',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table if not exists public.item_notes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  note text not null check (length(trim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  delta numeric not null check (delta <> 0),
  quantity_before numeric not null,
  quantity_after numeric not null check (quantity_after >= 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  item_id uuid references public.items(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists items_name_trgm_idx on public.items using gin (name gin_trgm_ops);
create index if not exists items_branch_idx on public.items(branch_id);
create index if not exists items_unit_idx on public.items(unit_id);
create index if not exists items_squad_idx on public.items(squad_id);
create index if not exists stock_movements_item_date_idx on public.stock_movements(item_id, created_at desc);
create index if not exists audit_log_item_date_idx on public.audit_log(item_id, created_at desc);
create index if not exists item_notes_item_date_idx on public.item_notes(item_id, created_at desc);

-- Struttura organizzativa ------------------------------------------------------

insert into public.branches (id, label, sort_order) values
  ('comune', 'Comune', 0),
  ('castorini', 'Castorini', 10),
  ('lc', 'L/C', 20),
  ('eg', 'E/G', 30),
  ('rs', 'R/S', 40)
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;

-- Ogni branca ha una voce Unità = Comune. In questo modo sono rappresentabili
-- sia il materiale comune di Gruppo, sia EG/Common, RS/Common, ecc.
insert into public.units (id, branch_id, label, is_common, sort_order) values
  ('comune', 'comune', 'Comune', true, 0),
  ('castorini-comune', 'castorini', 'Comune', true, 0),
  ('terra-di-betula', 'castorini', 'Colonia Terra di Betula', false, 10),
  ('lc-comune', 'lc', 'Comune', true, 0),
  ('branco-seeonee', 'lc', 'Branco Seeonee', false, 10),
  ('branco-san-domenico-savio', 'lc', 'Branco San Domenico Savio', false, 20),
  ('eg-comune', 'eg', 'Comune', true, 0),
  ('reparto-mulino', 'eg', 'Reparto Mulino', false, 10),
  ('reparto-don-bosco', 'eg', 'Reparto Don Bosco', false, 20),
  ('rs-comune', 'rs', 'Comune', true, 0),
  ('noviziato', 'rs', 'Noviziato', false, 10),
  ('clan-ad-navalia', 'rs', 'Clan Ad Navalia', false, 20),
  ('clan-ingegner-novelli', 'rs', 'Clan Ingegner Novelli', false, 30)
on conflict (id) do update set
  branch_id = excluded.branch_id,
  label = excluded.label,
  is_common = excluded.is_common,
  sort_order = excluded.sort_order;

insert into public.squads (id, unit_id, label, sort_order) values
  ('mulino-cobra', 'reparto-mulino', 'Cobra', 10),
  ('mulino-falchi', 'reparto-mulino', 'Falchi', 20),
  ('mulino-pantere', 'reparto-mulino', 'Pantere', 30),
  ('mulino-tigri', 'reparto-mulino', 'Tigri', 40),
  ('don-bosco-aquile', 'reparto-don-bosco', 'Aquile', 10),
  ('don-bosco-antilopi', 'reparto-don-bosco', 'Antilopi', 20),
  ('don-bosco-castori', 'reparto-don-bosco', 'Castori', 30),
  ('don-bosco-scoiattoli', 'reparto-don-bosco', 'Scoiattoli', 40)
on conflict (id) do update set
  unit_id = excluded.unit_id,
  label = excluded.label,
  sort_order = excluded.sort_order;

-- Coerenza gerarchica ---------------------------------------------------------

create or replace function public.validate_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.units u
    where u.id = new.unit_id and u.branch_id = new.branch_id
  ) then
    raise exception 'L''unità % non appartiene alla branca %', new.unit_id, new.branch_id;
  end if;

  if new.squad_id is not null and not exists (
    select 1 from public.squads s
    where s.id = new.squad_id and s.unit_id = new.unit_id
  ) then
    raise exception 'La squadriglia % non appartiene all''unità %', new.squad_id, new.unit_id;
  end if;

  if new.squad_id is not null and new.branch_id <> 'eg' then
    raise exception 'Le squadriglie possono essere associate solo alla branca E/G';
  end if;

  return new;
end;
$$;

drop trigger if exists items_validate_scope on public.items;
create trigger items_validate_scope
before insert or update of branch_id, unit_id, squad_id on public.items
for each row execute function public.validate_item_scope();

create or replace function public.validate_profile_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'eg' and new.squad_id is null then
    raise exception 'Un utente E/G deve essere associato a una squadriglia';
  end if;

  if new.squad_id is not null then
    select s.unit_id into new.unit_id
    from public.squads s
    where s.id = new.squad_id;

    if new.unit_id is null then
      raise exception 'Squadriglia non valida';
    end if;
  end if;

  if new.role <> 'eg' then
    new.squad_id := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_validate_scope on public.profiles;
create trigger profiles_validate_scope
before insert or update on public.profiles
for each row execute function public.validate_profile_scope();

create or replace function public.touch_item_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists items_touch_update on public.items;
create trigger items_touch_update
before update on public.items
for each row execute function public.touch_item_update();

create or replace function public.touch_note_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists item_notes_touch_update on public.item_notes;
create trigger item_notes_touch_update
before update on public.item_notes
for each row execute function public.touch_note_update();

-- Permessi -------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.can_view_item(p_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  v_role := public.current_user_role();

  if v_role in ('admin', 'capo', 'rs') then
    return true;
  end if;

  if v_role = 'eg' then
    return exists (
      select 1 from public.items i
      where i.id = p_item_id and i.branch_id = 'eg'
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_use_item(p_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_squad_id text;
begin
  select p.role, p.squad_id
  into v_role, v_squad_id
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role in ('admin', 'capo', 'rs') then
    return true;
  end if;

  if v_role = 'eg' and v_squad_id is not null then
    return exists (
      select 1 from public.items i
      where i.id = p_item_id
        and i.branch_id = 'eg'
        and i.squad_id = v_squad_id
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_edit_item(p_item_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  v_role := public.current_user_role();

  if v_role in ('admin', 'capo') then
    return true;
  end if;

  if v_role = 'rs' then
    return exists (
      select 1 from public.items i
      where i.id = p_item_id and i.branch_id = 'rs'
    );
  end if;

  return false;
end;
$$;

-- Audit ----------------------------------------------------------------------

create or replace function public.audit_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(item_id, user_id, action, new_data)
    values (new.id, auth.uid(), 'item.created', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(item_id, user_id, action, old_data, new_data)
    values (new.id, auth.uid(), 'item.updated', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log(item_id, user_id, action, old_data)
    values (old.id, auth.uid(), 'item.deleted', to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists items_audit on public.items;
create trigger items_audit
after insert or update or delete on public.items
for each row execute function public.audit_item_change();

create or replace function public.audit_note_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(item_id, user_id, action, new_data)
    values (new.item_id, auth.uid(), 'note.created', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(item_id, user_id, action, old_data, new_data)
    values (new.item_id, auth.uid(), 'note.updated', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log(item_id, user_id, action, old_data)
    values (old.item_id, auth.uid(), 'note.deleted', to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists item_notes_audit on public.item_notes;
create trigger item_notes_audit
after insert or update or delete on public.item_notes
for each row execute function public.audit_note_change();

-- Movimento quantità atomico: unico punto di scrittura di quantity -------------

create or replace function public.apply_stock_movement(
  p_item_id uuid,
  p_delta numeric,
  p_note text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric;
  v_after numeric;
  v_movement public.stock_movements;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'La quantità del movimento deve essere diversa da zero';
  end if;

  if not public.can_use_item(p_item_id) then
    raise exception 'Non hai il permesso USE su questo materiale';
  end if;

  select i.quantity
  into v_before
  from public.items i
  where i.id = p_item_id
  for update;

  if not found then
    raise exception 'Materiale non trovato';
  end if;

  v_after := v_before + p_delta;
  if v_after < 0 then
    raise exception 'Quantità insufficiente: disponibile %, variazione richiesta %', v_before, p_delta;
  end if;

  update public.items
  set quantity = v_after
  where id = p_item_id;

  insert into public.stock_movements(
    item_id, user_id, delta, quantity_before, quantity_after, note
  ) values (
    p_item_id, auth.uid(), p_delta, v_before, v_after, nullif(trim(p_note), '')
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- RLS ------------------------------------------------------------------------

alter table public.branches enable row level security;
alter table public.units enable row level security;
alter table public.squads enable row level security;
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.items enable row level security;
alter table public.item_notes enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated read branches" on public.branches
for select to authenticated using (true);
create policy "admin manage branches" on public.branches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read units" on public.units
for select to authenticated using (true);
create policy "admin manage units" on public.units
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read squads" on public.squads
for select to authenticated using (true);
create policy "admin manage squads" on public.squads
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read profiles" on public.profiles
for select to authenticated using (true);
create policy "admin manage profiles" on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read rooms" on public.rooms
for select to authenticated using (true);
create policy "admin manage rooms" on public.rooms
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "view permitted items" on public.items
for select to authenticated using (public.can_view_item(id));
create policy "admin create items" on public.items
for insert to authenticated with check (public.is_admin());
create policy "edit permitted items" on public.items
for update to authenticated
using (public.can_edit_item(id))
with check (public.can_edit_item(id));
create policy "admin delete items" on public.items
for delete to authenticated using (public.is_admin());

create policy "view permitted notes" on public.item_notes
for select to authenticated using (public.can_view_item(item_id));
create policy "use permitted add notes" on public.item_notes
for insert to authenticated
with check (public.can_use_item(item_id) and author_id = auth.uid());
create policy "author update permitted note" on public.item_notes
for update to authenticated
using (author_id = auth.uid() and public.can_use_item(item_id))
with check (author_id = auth.uid() and public.can_use_item(item_id));
create policy "admin delete notes" on public.item_notes
for delete to authenticated using (public.is_admin());

create policy "view permitted stock movements" on public.stock_movements
for select to authenticated using (public.can_view_item(item_id));

create policy "view permitted audit log" on public.audit_log
for select to authenticated using (item_id is null or public.can_view_item(item_id));

-- Privilegi API ---------------------------------------------------------------
-- RLS decide quali righe sono accessibili; i GRANT limitano anche le operazioni.

revoke all on public.branches, public.units, public.squads, public.profiles,
  public.rooms, public.items, public.item_notes, public.stock_movements,
  public.audit_log from anon;

revoke all on public.branches, public.units, public.squads, public.profiles,
  public.rooms, public.items, public.item_notes, public.stock_movements,
  public.audit_log from authenticated;

grant select, insert, update, delete on public.branches, public.units, public.squads,
  public.profiles, public.rooms to authenticated;

grant select, insert, delete on public.items to authenticated;
grant update (
  name, description, category, branch_id, unit_id, squad_id, room_id,
  location, is_consumable, unit_of_measure, notes
) on public.items to authenticated;

grant select, insert, delete on public.item_notes to authenticated;
grant update (note) on public.item_notes to authenticated;
grant select on public.stock_movements, public.audit_log to authenticated;

revoke all on function public.apply_stock_movement(uuid, numeric, text) from public;
grant execute on function public.apply_stock_movement(uuid, numeric, text) to authenticated;

-- Bootstrap admin -------------------------------------------------------------
-- 1. Crea il primo utente in Supabase Auth.
-- 2. Recupera il suo UUID da auth.users.
-- 3. Esegui dal SQL Editor (sostituendo i valori):
--
-- insert into public.profiles(id, full_name, role)
-- values ('UUID-UTENTE', 'Simone Vallarino', 'admin');
--
-- Gli utenti successivi potranno essere gestiti dall'admin; la creazione di
-- account Auth dal frontend verrà implementata tramite una funzione server-side
-- (Supabase Edge Function), senza esporre service_role nel browser.
