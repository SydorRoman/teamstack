# Admin Panel

Employee absence management system. Stack: React + Node.js (Express) + TypeScript + Prisma + PostgreSQL.

## Quick start

```bash
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
createdb admin_panel
cd backend && npm run prisma:generate && npm run prisma:migrate
cd .. && npm run dev
```

## DB schema (short)

- `users` — employees and admins (relations to `positions`, `projects`, `entitlements`, `work_logs`, `absences`, `settings_change_logs`, `technologies`)
- `positions` — job title directory
- `projects` — projects
- `work_logs` — time tracking by day and project
- `absences` + `absence_files` — absences and attached files
- `entitlements` — balances for vacation/sick/day off
- `technologies` + `user_technologies` + `project_technologies` — user/project tech stack
- `settings` + `settings_change_logs` — global accrual rules and history

## Seeds

- `npm run seed` (`backend/src/seed.ts`) — creates global `settings`, the `Web Development` project, two users (admin/employee), and their entitlements. Default logins: `admin@example.com` / `password123`, `employee@example.com` / `password123`.
- `npm run seed:technologies` (`backend/src/seed-technologies.ts`) — populates `technologies` and skips existing records.

## `settings` table

There is one record with `id = "global"` — global accrual settings.

- `vacationFutureAccrueDays` — vacation days accrued per month (float)
- `sickLeaveWithoutCertificateLimit` — sick leave limit without certificate (days)
- `sickLeaveWithCertificateLimit` — sick leave limit with certificate (days)
- `vacationCarryoverLimit` — how many vacation days can be carried over (days)
- `createdAt`, `updatedAt` — system timestamps
