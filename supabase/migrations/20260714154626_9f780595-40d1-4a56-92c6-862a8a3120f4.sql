
create type public.task_category as enum (
  'video_editing','graphic_designing','meta_ads','google_ads',
  'website_development','logo_design','other'
);

alter table public.tasks
  add column category public.task_category not null default 'other',
  add column category_other text,
  add column original_due_date date;

update public.tasks set original_due_date = due_date where original_due_date is null;

create or replace function public.tasks_set_original_due()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.original_due_date is null then NEW.original_due_date := NEW.due_date; end if;
  return NEW;
end $$;

create trigger t_tasks_set_original_due
before insert on public.tasks
for each row execute function public.tasks_set_original_due();

alter table public.attendance
  add column is_late boolean not null default false,
  add column late_minutes integer not null default 0;

create or replace function public.compute_attendance_late()
returns trigger language plpgsql set search_path = public as $$
declare
  cutoff time := time '09:30';
  lt time;
begin
  if NEW.login_time is not null then
    lt := (NEW.login_time at time zone 'Asia/Kolkata')::time;
    if lt > cutoff then
      NEW.is_late := true;
      NEW.late_minutes := greatest(0, floor(extract(epoch from (lt - cutoff))/60))::int;
    else
      NEW.is_late := false;
      NEW.late_minutes := 0;
    end if;
  end if;
  return NEW;
end $$;

create trigger t_attendance_late_ins
before insert on public.attendance
for each row execute function public.compute_attendance_late();

create trigger t_attendance_late_upd
before update on public.attendance
for each row execute function public.compute_attendance_late();

-- backfill without tripping attendance_guard (which is not admin during migration)
alter table public.attendance disable trigger attendance_guard_trg;
update public.attendance
  set is_late = case when ((login_time at time zone 'Asia/Kolkata')::time) > time '09:30' then true else false end,
      late_minutes = case
        when ((login_time at time zone 'Asia/Kolkata')::time) > time '09:30'
          then greatest(0, floor(extract(epoch from (((login_time at time zone 'Asia/Kolkata')::time) - time '09:30'))/60))::int
        else 0 end;
alter table public.attendance enable trigger attendance_guard_trg;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "notifications_own_select" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "notifications_own_update" on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "notifications_own_delete" on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter publication supabase_realtime add table public.notifications;
