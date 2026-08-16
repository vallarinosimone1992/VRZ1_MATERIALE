-- E/G può creare nuovo materiale esclusivamente per la propria squadriglia.
drop policy if exists "create items by role" on public.items;
create policy "create items by role" on public.items
for insert to authenticated
with check (
  public.current_user_role() in ('admin','capo')
  or (
    public.current_user_role() = 'rs'
    and branch_id in ('rs','comune')
  )
  or (
    public.current_user_role() = 'eg'
    and branch_id = 'eg'
    and squad_id is not null
    and squad_id = (
      select p.squad_id from public.profiles p
      where p.id = auth.uid() and p.active = true
    )
    and unit_id = (
      select p.unit_id from public.profiles p
      where p.id = auth.uid() and p.active = true
    )
  )
);
