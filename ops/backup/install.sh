#!/bin/bash
set -Eeuo pipefail
[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "Run this installer as root" >&2; exit 1; }
readonly SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install -d -m 0700 /var/backups/clarion /etc/clarion
install -m 0755 "$SOURCE_DIR/clarion-backup" /usr/local/sbin/clarion-backup
install -m 0755 "$SOURCE_DIR/clarion-restore-test" /usr/local/sbin/clarion-restore-test
install -m 0644 "$SOURCE_DIR/clarion-backup.service" /etc/systemd/system/clarion-backup.service
install -m 0644 "$SOURCE_DIR/clarion-backup.timer" /etc/systemd/system/clarion-backup.timer
node "$SOURCE_DIR/create-pgpass.mjs" /opt/clarion/.env.production /etc/clarion/backup.pgpass
systemctl daemon-reload
systemctl enable --now clarion-backup.timer
echo "Clarion backup timer installed. Run 'systemctl start clarion-backup.service' to create the first backup."
