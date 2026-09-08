# Production backup and restore runbook

Clarion's production backup job creates a PostgreSQL custom-format dump, a compressed archive containing only `/var/lib/clarion/uploads`, and a non-secret manifest. Completed sets live in root-only `/var/backups/clarion/clarion-<timestamp>/`; hidden `.in-progress` directories are never valid backups. Backup creation neither stops PostgreSQL nor restarts `clarion.service`.

> These backups protect against application/database mistakes and many local failures, but they are still stored on the same server. Loss of the entire VM/disk could destroy both production data and local backups.

Encrypted off-host replication needs a separately approved destination and school-data handling policy.

## Install

On the Debian 12 production host, first confirm PostgreSQL 18 clients and required base tools are available without displaying credentials:

```bash
pg_dump --version
pg_restore --version
command -v tar flock node
```

From `/opt/clarion`, install the scripts, restricted directories, protected pgpass file, units, and timer:

```bash
sudo ./ops/backup/install.sh
sudo systemctl start clarion-backup.service
```

The idempotent installer derives `/etc/clarion/backup.pgpass` from the protected `.env.production`, writes it atomically with mode `0600`, and never prints `DATABASE_URL` or the password. Re-run it after the production database password changes. The service runs as root because it must read both the protected credentials and uploaded files; systemd limits its writable path to the backup directory.

## Routine operations

Check automation and recent failures:

```bash
sudo systemctl status clarion-backup.timer --no-pager
sudo systemctl status clarion-backup.service --no-pager
sudo journalctl -u clarion-backup.service -n 100 --no-pager
```

List complete backup sets and disk consumption (hidden in-progress sets are excluded by the glob):

```bash
sudo find /var/backups/clarion -mindepth 1 -maxdepth 1 -type d -name 'clarion-*' -printf '%f\n' | sort
sudo du -sh /var/backups/clarion /var/backups/clarion/clarion-*
```

Trigger one backup and inspect its result:

```bash
sudo systemctl start clarion-backup.service
sudo systemctl status clarion-backup.service --no-pager
```

The timer runs daily around 02:30 (with up to 15 minutes of jitter), catches missed runs after boot, and keeps the newest 14 successful sets. Cleanup begins only after a new validated set is published and only exact Clarion timestamp directory names can be removed. A missing uploads directory is an error; an existing but empty directory produces a valid empty-directory archive.

## Safe restore verification (non-production)

This procedure **does not overwrite `clarion`**. It creates a uniquely named disposable database, checks core Prisma tables and row-count query results, extracts the upload archive beneath `/tmp`, then removes both test targets via an exit trap:

```bash
sudo /usr/local/sbin/clarion-restore-test
# Or select an exact set name, never a path:
sudo /usr/local/sbin/clarion-restore-test clarion-2026-09-08T160000+0800
```

Run this after the first manual backup and periodically thereafter. Success must be recorded operationally (date and selected set) without user data or credentials. The script relies on Debian's local `postgres` peer access to create and drop only a name prefixed `clarion_restore_test_`; it restores using the protected Clarion credential.

## Real disaster recovery (destructive)

The following is intentionally different from restore verification. Have a second administrator review the selected timestamp and commands. If the damaged database or uploads are still readable, first preserve them to a separately named restricted location. Never run these commands against a healthy production system merely to test backups.

1. Confirm `database.dump`, `uploads.tar.gz`, and `manifest.txt` belong to the chosen complete set. Validate with `pg_restore --list` and `tar -tzf`. Check free disk space.
2. Stop **Clarion only** with `sudo systemctl stop clarion.service` so no writes occur during recovery. Do not stop PostgreSQL or unrelated services.
3. Preserve the current broken state where possible: take a separately labelled `pg_dump --format=custom` using the protected pgpass file and copy `/var/lib/clarion/uploads` to restricted storage. Do not present this emergency copy as a known-good scheduled set.
4. As the PostgreSQL administrator, terminate connections to and replace only the explicitly named `clarion` database. Restore the selected dump with `pg_restore --exit-on-error --no-owner --no-privileges`; verify its owner/permissions for the `clarion` role. These destructive commands are deliberately not copy-pasted here: construct and peer-review them for the incident so an unexpanded placeholder cannot target the wrong database.
5. Extract uploads into a new restricted staging directory, inspect paths, ownership, and permissions, then atomically move the damaged uploads aside and put the restored tree at `/var/lib/clarion/uploads`. Never extract over `/var/lib` or from an unvalidated archive.
6. From `/opt/clarion`, run only the normal production sequence (`npm run prisma:deploy`, production build if required by the deployment process, then `sudo systemctl start clarion.service`). Do **not** seed, run `prisma migrate dev`, or run `prisma migrate reset`.
7. Check `clarion.service`, the application health endpoint, login, representative records, and media. Retain the pre-restore state until recovery is accepted.

The backup directory contains sensitive school and account data. Keep it mode `0700`, keep files `0600`, never expose it through Nginx, and never copy manifests or logs containing real record data into tickets.
