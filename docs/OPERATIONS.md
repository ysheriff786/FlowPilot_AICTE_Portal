# Operations

## Backups
Schedule `pg_dump -Fc flowpilot > backup.dump` (or SQLite `.backup` in dev) daily.

## Restore
`pg_restore -d flowpilot backup.dump`

## Rotating JWT_SECRET
Set a new secret (>=32 chars) and restart. All users are logged out (tokenVersion mismatch).

## SMTP
Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Without SMTP_HOST, emails are logged only.

## Scheduler
Runs hourly via node-cron. Disable with ENABLE_SCHEDULER=false. Trigger manually via POST /api/admin/run-jobs.

## Scheduler failure
Check server logs (pino). Re-run jobs manually; idempotency via ReminderLog prevents duplicates.