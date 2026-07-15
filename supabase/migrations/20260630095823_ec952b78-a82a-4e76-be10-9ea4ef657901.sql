
-- Restrict SECURITY DEFINER functions
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.attendance_guard() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
-- touch_updated_at is invoker, but lock anyway
alter function public.touch_updated_at() security invoker;
