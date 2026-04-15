# SQLite -> MySQL Schema Report

- Source: `database/database.sqlite`
- Generated migration: `database/migrations/2026_04_15_150000_sqlite_snapshot_schema.php`
- Generated seeders: `database/seeders/*TableSeeder.php`

## Compatibility Notes

- SQLite affinities were mapped to Laravel column methods for MySQL compatibility.
- Integer primary keys with AUTOINCREMENT were mapped to `bigIncrements`.
- `created_at` + `updated_at` were normalized to `timestamps()` where both exist.
- `deleted_at` columns were normalized to `softDeletes()` where present.
- Seeders use `upsert` on primary key columns (idempotent) and `insertOrIgnore` when PK is absent.

## Discovered Tables

### activity_logs
- Columns: 12
- Foreign keys: 1
- Indexes: 2

### allowance_types
- Columns: 5
- Foreign keys: 0
- Indexes: 1

### audit_logs
- Columns: 11
- Foreign keys: 1
- Indexes: 4

### cache
- Columns: 3
- Foreign keys: 0
- Indexes: 2

### cache_locks
- Columns: 3
- Foreign keys: 0
- Indexes: 2

### clients
- Columns: 9
- Foreign keys: 0
- Indexes: 0

### communications
- Columns: 11
- Foreign keys: 2
- Indexes: 0

### daily_office_checkins
- Columns: 14
- Foreign keys: 1
- Indexes: 3

### equipment
- Columns: 6
- Foreign keys: 0
- Indexes: 0

### event_allowances
- Columns: 14
- Foreign keys: 5
- Indexes: 3

### event_checklist_items
- Columns: 11
- Foreign keys: 2
- Indexes: 0

### event_equipment
- Columns: 8
- Foreign keys: 3
- Indexes: 1

### event_expenses
- Columns: 8
- Foreign keys: 2
- Indexes: 1

### event_meals
- Columns: 8
- Foreign keys: 2
- Indexes: 1

### event_notes
- Columns: 6
- Foreign keys: 2
- Indexes: 0

### event_payments
- Columns: 15
- Foreign keys: 3
- Indexes: 1

### event_user
- Columns: 25
- Foreign keys: 4
- Indexes: 1

### event_vehicle
- Columns: 7
- Foreign keys: 3
- Indexes: 1

### events
- Columns: 25
- Foreign keys: 5
- Indexes: 0

### failed_jobs
- Columns: 7
- Foreign keys: 0
- Indexes: 1

### holidays
- Columns: 7
- Foreign keys: 0
- Indexes: 2

### job_batches
- Columns: 10
- Foreign keys: 0
- Indexes: 1

### jobs
- Columns: 7
- Foreign keys: 0
- Indexes: 1

### notifications
- Columns: 8
- Foreign keys: 0
- Indexes: 2

### password_reset_tokens
- Columns: 3
- Foreign keys: 0
- Indexes: 1

### permission_role
- Columns: 2
- Foreign keys: 2
- Indexes: 1

### permissions
- Columns: 5
- Foreign keys: 0
- Indexes: 1

### personal_access_tokens
- Columns: 10
- Foreign keys: 0
- Indexes: 3

### reminder_logs
- Columns: 8
- Foreign keys: 2
- Indexes: 1

### role_user
- Columns: 2
- Foreign keys: 2
- Indexes: 1

### roles
- Columns: 5
- Foreign keys: 0
- Indexes: 1

### sessions
- Columns: 6
- Foreign keys: 0
- Indexes: 3

### settings
- Columns: 4
- Foreign keys: 0
- Indexes: 1

### task_comments
- Columns: 6
- Foreign keys: 2
- Indexes: 0

### task_user
- Columns: 5
- Foreign keys: 2
- Indexes: 1

### tasks
- Columns: 11
- Foreign keys: 2
- Indexes: 0

### time_off_request_attachments
- Columns: 6
- Foreign keys: 1
- Indexes: 0

### time_off_requests
- Columns: 11
- Foreign keys: 2
- Indexes: 0

### users
- Columns: 17
- Foreign keys: 0
- Indexes: 2

### vehicles
- Columns: 8
- Foreign keys: 0
- Indexes: 0
