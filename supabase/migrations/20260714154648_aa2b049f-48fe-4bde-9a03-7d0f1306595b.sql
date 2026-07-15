
alter function public.tasks_set_original_due() security invoker;
alter function public.compute_attendance_late() security invoker;
revoke execute on function public.tasks_set_original_due() from public, authenticated, anon;
revoke execute on function public.compute_attendance_late() from public, authenticated, anon;
