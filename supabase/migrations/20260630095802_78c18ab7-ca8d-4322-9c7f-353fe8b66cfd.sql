
-- ENUMS
create type public.app_role as enum ('admin', 'employee');
create type public.task_status as enum ('pending','in_progress','completed');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.task_frequency as enum ('daily','weekly','monthly','one_time');
create type public.payment_status as enum ('paid','pending','overdue','partially_paid');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null,
  email text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- has_role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- current_user_role helper
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(auth.uid(), 'admin') $$;

-- PROFILES policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_insert_admin" on public.profiles
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- USER ROLES policies
create policy "roles_select_own_or_admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "roles_admin_manage" on public.user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- CLIENTS
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  contact_person text,
  phone text,
  email text,
  project_type text,
  assigned_employee_id uuid references public.profiles(id) on delete set null,
  start_date date not null default current_date,
  monthly_deliverables text,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;

create policy "clients_admin_all" on public.clients
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "clients_employee_select_assigned" on public.clients
  for select to authenticated
  using (assigned_employee_id = auth.uid());

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete cascade,
  status task_status not null default 'pending',
  priority task_priority not null default 'medium',
  frequency task_frequency not null default 'daily',
  due_date date,
  completed_at timestamptz,
  incomplete_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;

create policy "tasks_admin_all" on public.tasks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "tasks_employee_select_own" on public.tasks
  for select to authenticated
  using (assigned_to = auth.uid());
create policy "tasks_employee_update_own" on public.tasks
  for update to authenticated
  using (assigned_to = auth.uid())
  with check (assigned_to = auth.uid());

-- ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  login_time timestamptz not null default now(),
  logout_time timestamptz,
  total_hours numeric(5,2),
  created_at timestamptz not null default now(),
  unique(employee_id, work_date)
);
grant select, insert, update on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

create policy "attendance_admin_select" on public.attendance
  for select to authenticated using (public.is_admin() or employee_id = auth.uid());
create policy "attendance_employee_insert" on public.attendance
  for insert to authenticated with check (employee_id = auth.uid());
create policy "attendance_employee_update_own_open" on public.attendance
  for update to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());
create policy "attendance_admin_manage" on public.attendance
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- prevent edits once logout_time set; compute total_hours
create or replace function public.attendance_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if OLD.logout_time is not null and not public.is_admin() then
      raise exception 'Attendance is locked after end of work';
    end if;
    if NEW.logout_time is not null and NEW.login_time is not null then
      NEW.total_hours := round(extract(epoch from (NEW.logout_time - NEW.login_time))/3600.0, 2);
    end if;
  end if;
  return NEW;
end $$;
create trigger attendance_guard_trg
before update on public.attendance
for each row execute function public.attendance_guard();

-- PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_amount numeric(12,2) not null default 0,
  payment_frequency text not null default 'monthly',
  due_date date,
  next_due_date date,
  amount_paid numeric(12,2) not null default 0,
  pending_amount numeric(12,2) not null default 0,
  status payment_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create policy "payments_admin_only" on public.payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ACTIVITY LOG
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "log_admin_select" on public.activity_log
  for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy "log_insert_self" on public.activity_log
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end $$;

create trigger t_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger t_tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger t_payments_touch before update on public.payments for each row execute function public.touch_updated_at();
