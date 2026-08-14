-- Sedi fisiche e posizioni gerarchiche.

create table if not exists public.sites (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rooms add column if not exists site_id text references public.sites(id) on update cascade on delete restrict;
alter table public.rooms drop constraint if exists rooms_name_key;

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on update cascade on delete cascade,
  parent_id uuid references public.storage_locations(id) on update cascade on delete restrict,
  name text not null,
  location_type text,
  notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(room_id, parent_id, name)
);

alter table public.items add column if not exists storage_location_id uuid references public.storage_locations(id) on update cascade on delete set null;

insert into public.sites(id, name, sort_order) values
  ('ragioneria', 'Ragioneria', 10),
  ('diga', 'Diga', 20)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.rooms(site_id, name) values
  ('ragioneria', 'Sede RS'),
  ('ragioneria', 'Sede Don Bosco'),
  ('ragioneria', 'Sede Mulino'),
  ('ragioneria', 'Tana Seeonee'),
  ('ragioneria', 'Tana San Domenico Savio'),
  ('ragioneria', 'Sottoscala'),
  ('ragioneria', 'Bagno'),
  ('ragioneria', 'Piano superiore'),
  ('diga', 'Stanza unica')
on conflict do nothing;

alter table public.rooms alter column site_id set not null;

alter table public.sites enable row level security;
alter table public.storage_locations enable row level security;

create policy "authenticated read sites" on public.sites for select to authenticated using (true);
create policy "admin manage sites" on public.sites for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read storage locations" on public.storage_locations for select to authenticated using (true);
create policy "admin manage storage locations" on public.storage_locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.sites, public.storage_locations to authenticated;
grant update (room_id, storage_location_id, location) on public.items to authenticated;
