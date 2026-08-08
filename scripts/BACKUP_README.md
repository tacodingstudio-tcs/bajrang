# Backup & Disaster Recovery

## What's protected

`backup.sh` dumps the entire Postgres database nightly (every table:
tenants, invoices, products, parties, stock_ledger — everything), compresses
it, and optionally uploads it to Backblaze B2. This is your only protection
against a permanently destroyed database.

## First-time setup

```bash
chmod +x scripts/*.sh

# Run once manually to confirm it works
./scripts/backup.sh --local-only

# Should create: ./backups/billing_db_YYYYMMDD_HHMMSS.sql.gz

# Install the nightly cron job
./scripts/setup-backup-cron.sh
```

## Enabling cloud upload (recommended before any pilot customer goes live)

1. Create a Backblaze B2 account (backblaze.com/b2) — first 10GB free,
   roughly ₹0.50/GB/month after that. A typical billing database stays
   under 1GB for years at pilot scale.
2. Install the B2 CLI: `pip install b2`
3. Authenticate: `b2 authorize-account <keyID> <applicationKey>`
4. Create a bucket: `b2 create-bucket billing-backups allPrivate`
5. Export the bucket name so backup.sh picks it up:
   ```bash
   export B2_BUCKET=billing-backups
   ```
6. Add that export to your server's `/etc/environment` (not just your
   shell profile — cron does not read `.bashrc`).

## Testing a restore (do this monthly, not just when something breaks)

```bash
./scripts/restore.sh ./backups/billing_db_20250619_030000.sql.gz
```

This creates a SEPARATE test database (`billing_db_restore_test` by
default) from the backup — it never touches your live data. If this
script reports "Restore verification PASSED" with a sensible tenant and
invoice count, your backup pipeline is healthy.

**If you skip this step entirely**, you don't actually have a backup
strategy — you have an unverified hope. The failure modes that monthly
restore testing catches: a silently-broken pg_dump flag, a corrupted B2
upload, disk filling up mid-backup, or a schema migration that breaks
restore compatibility with older dumps.

## Actual disaster recovery (when something has really gone wrong)

```bash
# 1. Download the most recent backup from B2 if not already local
b2 download-file-by-name billing-backups postgres/billing_db_LATEST.sql.gz ./backups/

# 2. Stop the API so nothing writes to the broken database during recovery
pm2 stop billing-api billing-worker   # or: docker compose stop (if API is containerized)

# 3. Restore into a NEW database first to confirm the backup is good
./scripts/restore.sh ./backups/billing_db_LATEST.sql.gz billing_db_recovery_check

# 4. Once confirmed, restore over the real database name
#    (only do this after step 3 has passed verification)
docker exec billing_postgres psql -U postgres -c "DROP DATABASE billing_db;"
docker exec billing_postgres psql -U postgres -c "CREATE DATABASE billing_db OWNER billing_app;"
gunzip -c ./backups/billing_db_LATEST.sql.gz | \
  docker exec -i billing_postgres psql -U billing_app -d billing_db

# 5. Restart the API
pm2 start billing-api billing-worker
```

## What this does NOT protect against

- **Data loss between backups.** A nightly-only backup means up to 24
  hours of invoices could theoretically be lost if disaster strikes right
  before the next scheduled run. For a pilot with under ~50 stores, this
  is an acceptable risk. Once you have real revenue at stake, add WAL
  archiving for point-in-time recovery (see postgresql.conf's
  `archive_command` from the earlier infrastructure planning — this
  becomes relevant once you migrate to Azure PostgreSQL Flexible Server,
  which has PITR built in).
- **A compromised B2 account.** Keep B2 application keys scoped to
  write-only for the backup process; a separate read-capable key for
  manual recovery, stored somewhere other than the server itself.
