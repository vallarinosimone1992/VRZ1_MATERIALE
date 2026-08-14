revoke execute on function public.can_edit_item(uuid) from authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
