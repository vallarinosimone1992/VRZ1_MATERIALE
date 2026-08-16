-- Permessi inventario v2
-- Capo: view/use/edit/create su tutto
-- R/S: view/use su tutto; edit/create su R/S e Comune
-- E/G: view su tutto; use/edit sulla propria squadriglia; no create

create or replace function public.current_user_squad_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.squad_id
  from public.profiles p
  where p.id = auth.uid() and p.active = true
  limit 1;
$$;

create or replace function public.can_view_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() is not null;
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
  v_squad_id text;
begin
  select p.role, p.squad_id
  into v_role, v_squad_id
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role in ('admin', 'capo') then
    return true;
  end if;

  if v_role = 'rs' then
    return exists (
      select 1 from public.items i
      where i.id = p_item_id and i.branch_id in ('rs', 'comune')
    );
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

drop policy if exists "admin create items" on public.items;
drop policy if exists "create permitted items" on public.items;
create policy "create permitted items" on public.items
for insert to authenticated
with check (
  public.current_user_role() in ('admin', 'capo')
  or (public.current_user_role() = 'rs' and branch_id in ('rs', 'comune'))
);

drop policy if exists "edit permitted items" on public.items;
create policy "edit permitted items" on public.items
for update to authenticated
using (
  public.current_user_role() in ('admin', 'capo')
  or (public.current_user_role() = 'rs' and branch_id in ('rs', 'comune'))
  or (
    public.current_user_role() = 'eg'
    and branch_id = 'eg'
    and squad_id = public.current_user_squad_id()
  )
)
with check (
  public.current_user_role() in ('admin', 'capo')
  or (public.current_user_role() = 'rs' and branch_id in ('rs', 'comune'))
  or (
    public.current_user_role() = 'eg'
    and branch_id = 'eg'
    and squad_id = public.current_user_squad_id()
  )
);

revoke all on function public.current_user_squad_id() from public, anon;
grant execute on function public.current_user_squad_id() to authenticated;
