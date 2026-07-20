# Software Improvements Plan

Big scope — I'll ship it in **two phases** so you can review as we go. Phase 1 fixes the critical Save-button bug and adds the Reports foundation. Phase 2 layers on charts, more exports, and table polish.

## Phase 1 — Critical fixes + Reports foundation

### 1. Scrollable dialogs (fixes Save button bug)
Root cause: shadcn `DialogContent` isn't scrollable by default, so tall forms (New Task, New Client, New Employee, Payment, Attendance edit) push the footer off small screens.

Fix once, applies everywhere:
- Update every dialog to: `max-h-[90vh]` shell, scrollable body (`overflow-y-auto flex-1`), **sticky footer** with Save/Cancel always visible.
- Files touched: `tasks`, `clients`, `employees`, `payments`, `attendance` route dialogs.

### 2. Reports page (`/reports`, admin only)
New route with 4 tabs:
- **Employee report** — per employee: clients assigned, tasks assigned/completed/pending, productivity %
- **Client report** — per client: assigned employee, tasks total/completed/pending, last updated
- **Daily report** — today's task summary + employee performance
- **Monthly report** — month-to-date completion, pending, per-employee breakdown

Filters (top of page): date range, employee, client, status.
Every tab has an **Export to Excel (.xlsx)** button using `xlsx` (SheetJS) — client-side, no server work needed.

### 3. Admin dashboard revamp
Rebuild `admin-dashboard.tsx` widget grid to show:
Total Employees · Total Clients · Active Clients · Total Tasks · Completed · Pending · Overdue · Today Assigned · Today Completed · Late Today · Late This Month.
Add employee-wise progress bars (tasks completed / assigned with % + color).

## Phase 2 (after you approve Phase 1)
- Charts: task completion trend, daily/monthly status, client distribution, pending vs completed (Recharts).
- Table upgrades on Tasks/Clients/Employees/Payments: search box, column sort, pagination (10/25/50), sticky headers, horizontal scroll on mobile.
- Extra exports: pending-task report, client-assignment report, dashboard summary.

## Not touching
- Branch/Department filters — you don't have those fields yet. I'll skip them unless you want me to add the schema.
- PDF export — Excel covers the requested formats; PDF can come in a later pass if needed.

## Technical notes
- Excel export via `xlsx` package (small, browser-side).
- All new queries go through the existing `supabase` browser client — RLS already scoped.
- Sticky footers use `sticky bottom-0 bg-background border-t` inside the scrollable dialog.

Reply **"go"** to start Phase 1, or tell me what to change.