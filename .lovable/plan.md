# Foundations rollout

Scope = items 1 (late-login flag only, report comes in phase 2), 2 (task categories), 3 (edit everywhere), 4 (pending carry-over) + the "notify admin each morning for tasks pending >1 day" hook. Reports, dashboard revamp, filters, exports come in follow-up rollouts.

## 1. Database migration

- Add enum `public.task_category`: `video_editing`, `graphic_designing`, `meta_ads`, `google_ads`, `website_development`, `logo_design`, `other`.
- `tasks`: add `category task_category not null default 'other'`, `category_other text` (free text when category = other), `original_due_date date` (set from `due_date` on insert if null; used to show "Assigned on …" when carried over).
- `attendance`: add generated columns
  - `is_late boolean` — true when `login_time::time > '09:30'`.
  - `late_minutes int` — `greatest(0, extract(epoch from (login_time::time - '09:30'))/60)::int`, null when no login.
  Use a trigger (not generated cols) so we can also recompute on update and keep it simple.
- New table `public.notifications` (admin bell): `id, recipient_id (uuid → auth.users), type text, title text, body text, link text, is_read bool default false, created_at`. RLS: recipient can select/update own; service_role all. GRANT authenticated select/update; service_role all.
- `attendance_guard` trigger update: set `is_late` / `late_minutes` on insert & update.

## 2. Server pieces

- New public cron route `src/routes/api/public/hooks/pending-task-digest.ts`
  - Runs each morning, finds tasks where `status != 'completed'` and `original_due_date < today`, groups by admin, inserts one summary notification per admin ("N tasks pending — oldest from …") plus per-task rows if <=10.
- Schedule with `pg_cron` (insert tool) at `30 3 * * *` UTC (~09:00 IST).

## 3. Frontend — Tasks

- `_authenticated.tasks.tsx` (admin):
  - Add **Category** select in create dialog with the 7 options + conditional text input for "Other".
  - Add **Edit** button on each task row → same dialog prefilled, mutation calls update.
  - Show category badge in list.
- `_authenticated.my-tasks.tsx` & `_authenticated.my-targets.tsx` (employee):
  - Show category badge.
  - Include tasks where `original_due_date <= today AND status != 'completed'` (carry-over). Show "Assigned on {original_due_date}" chip when it's before today.
  - When employee marks complete, clear any pending badge automatically (status flip already does it).

## 4. Frontend — Edit for other modules

- Employees page: add Edit dialog (name, email, is_active, role).
- Clients page: Edit dialog (all existing fields).
- Attendance page (admin): Edit dialog for login_time / logout_time / notes; save recomputes late flag via trigger.

## 5. Frontend — Notifications bell

- Add a bell in the header (admin only) showing unread count from `notifications` table, dropdown lists latest 10, click marks read + navigates to `link`.
- Realtime subscription on `notifications` filtered by `recipient_id = admin.id`.

## Technical notes

- Existing `frequency` enum stays untouched.
- Carry-over is purely a query-side concept — no row duplication, no cron needed for that part. The morning digest just *notifies*, it doesn't create tasks.
- All new mutations reuse existing RLS (`is_admin()` for admin-only writes on tasks/clients/employees/attendance).
- No changes to auth/login UX in this phase.

## Out of scope (next rollouts)

- Late-login monthly report page.
- Dashboard revamp (items 6, 12).
- Attendance/task reports pages with filters (7, 8, 10).
- Excel/PDF export (11).
- Broader notification types (9) beyond the pending-task digest.

Reply "go" to build this, or tell me what to change.
