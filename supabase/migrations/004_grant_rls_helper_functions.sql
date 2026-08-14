-- Le policy RLS invocano queste funzioni come utente autenticato.
-- Devono quindi essere eseguibili dal ruolo authenticated.
-- Restano non eseguibili da anon.

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_view_item(uuid) to authenticated;
grant execute on function public.can_use_item(uuid) to authenticated;
grant execute on function public.can_edit_item(uuid) to authenticated;
