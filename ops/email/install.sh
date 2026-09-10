#!/bin/bash
set -Eeuo pipefail
[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo "Run this installer as root" >&2; exit 1; }
readonly SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install -m 0644 "$SOURCE_DIR/clarion-email-outbox.service" /etc/systemd/system/clarion-email-outbox.service
install -m 0644 "$SOURCE_DIR/clarion-email-outbox.timer" /etc/systemd/system/clarion-email-outbox.timer
systemctl daemon-reload
systemctl enable --now clarion-email-outbox.timer
echo "Clarion email outbox timer installed. Automatic processing still requires EMAIL_NOTIFICATIONS_ENABLED=true."
