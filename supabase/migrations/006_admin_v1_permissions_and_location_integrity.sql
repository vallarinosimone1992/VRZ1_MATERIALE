-- Profili: ciascun utente vede il proprio profilo, l'Admin vede e gestisce tutti.
drop policy if exists "authenticated read profiles" on public.profiles;
create policy "read own or admin profiles" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

-- R/S può modificare esclusivamente materiale che resta nella branca R/S.
drop policy if exists "edit permitted items" on public.items;
create policy "edit permitted items" on public.items
for update to authenticated
using (
  public.current_user_role() in ('admin', 'capo')
  or (public.current_user_role() = 'rs' and branch_id = 'rs')
)
with check (
  public.current_user_role() in ('admin', 'capo')
  or (public.current_user_role() = 'rs' and branch_id = 'rs')
);

create or replace function public.validate_item_storage_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.storage_location_id is not null then
    if new.room_id is null then
      select sl.room_id into new.room_id from public.storage_locations sl where sl.id = new.storage_location_id;
    elsif not exists (
      select 1 from public.storage_locations sl
      where sl.id = new.storage_location_id and sl.room_id = new.room_id
    ) then
      raise exception 'La posizione selezionata non appartiene alla stanza indicata';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists items_validate_storage_scope on public.items;
create trigger items_validate_storage_scope
before insert or update of room_id, storage_location_id on public.items
for each row execute function public.validate_item_storage_scope();

revoke all on function public.validate_item_storage_scope() from public, anon, authenticated;

grant update (
  name, description, category, branch_id, unit_id, squad_id, room_id,
  storage_location_id, location, is_consumable, unit_of_measure, notes
) on public.items to authenticated;
