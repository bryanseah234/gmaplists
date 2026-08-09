revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;

revoke all on function public.sync_gmaplist(text, text, jsonb) from public;
revoke all on function public.sync_gmaplist(text, text, jsonb) from anon;
revoke all on function public.sync_gmaplist(text, text, jsonb) from authenticated;

grant execute on function public.sync_gmaplist(text, text, jsonb) to authenticated;
grant execute on function public.sync_gmaplist(text, text, jsonb) to service_role;
