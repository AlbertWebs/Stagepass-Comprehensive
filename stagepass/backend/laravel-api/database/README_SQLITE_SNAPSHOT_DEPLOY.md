# SQLite Snapshot Deployment Guide

This project now includes generated artifacts from `database/database.sqlite`:

- Migration: `database/migrations/2026_04_15_150000_sqlite_snapshot_schema.php`
- Seeders: `database/seeders/*TableSeeder.php`
- Seeder entrypoint: `database/seeders/DatabaseSeeder.php`
- Schema report: `database/sqlite_mysql_schema_report.md`
- Generator: `scripts/generate_sqlite_snapshot.php`

## Regenerate from SQLite

Run locally whenever `database/database.sqlite` changes:

```bash
php scripts/generate_sqlite_snapshot.php
```

## Live Server (MySQL/phpMyAdmin) Steps

1. Configure `.env` with MySQL credentials:
   - `DB_CONNECTION=mysql`
   - `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
2. Clear caches:
   - `php artisan optimize:clear`
3. Rebuild schema and seed data:
   - `php artisan migrate --seed --force`

If mobile profile save fails with **no such column: address** on `users`, run migrations so `2026_04_14_000101` and/or `2026_04_16_000000_ensure_users_profile_contact_columns` apply (idempotent — safe if columns already exist).

## Safety / Idempotency

- Seeders use `upsert` for tables with PKs and `insertOrIgnore` when PKs are absent.
- Foreign key constraints are temporarily disabled inside migration and seeding phases, then re-enabled.
- Generated migration has reversible `down()` methods (`dropIfExists` in reverse dependency order).
