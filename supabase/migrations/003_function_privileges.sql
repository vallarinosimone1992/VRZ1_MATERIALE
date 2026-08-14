-- Riduce l'esposizione delle funzioni SECURITY DEFINER.
-- Le funzioni helper sono usate internamente da RLS/trigger e non devono essere
-- invocabili direttamente via Data API. L'unica RPC intenzionalmente esposta
-- agli utenti autenticati è apply_stock_movement (Consuma/Aggiungi).

revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.can_view_item(uuid) from public, anon, authenticated;
revoke execute on function public.can_use_item(uuid) from public, anon, authenticated;
revoke execute on function public.can_edit_item(uuid) from public, anon, authenticated;
revoke execute on function public.audit_item_change() from public, anon, authenticated;
revoke execute on function public.audit_note_change() from public, anon, authenticated;

revoke execute on function public.apply_stock_movement(uuid, numeric, text) from public, anon;
grant execute on function public.apply_stock_movement(uuid, numeric, text) to authenticated;
