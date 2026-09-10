# Production email notifications

Clarion uses a PostgreSQL outbox: publishing homework or releasing feedback commits the canonical state and one idempotent notification record in the same transaction. SMTP runs separately, so an unavailable mail server cannot roll back teacher work. Automatic event capture and the worker are guarded by `EMAIL_NOTIFICATIONS_ENABLED=true`; while it is false, events create no dormant backlog.

## Server environment

Keep these values only in the protected `/opt/clarion/.env.production` (never in Git, Prisma, browser-visible variables, tickets, or logs):

| Variable | Meaning |
| --- | --- |
| `EMAIL_NOTIFICATIONS_ENABLED` | Exact `true` enables automatic queueing and worker delivery; default `false`. |
| `SMTP_HOST` / `SMTP_PORT` | Tenant-approved SMTP submission endpoint and port. |
| `SMTP_SECURE` | `true` for implicit TLS; normally `false` when the approved endpoint uses STARTTLS. |
| `SMTP_REQUIRE_TLS` | Defaults to TLS required; set `false` only if school policy explicitly requires it. |
| `SMTP_USER` / `SMTP_PASSWORD` | Server-only mailbox credential. |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | Safe displayed sender identity. |
| `APP_BASE_URL` | Public HTTPS Clarion origin used for authenticated links. |

Confirm the school's Microsoft 365/Exchange Online tenant policy, SMTP AUTH enablement, endpoint and approved authentication mechanism with the tenant administrator. Clarion does not assume Outlook.com settings; transport auth is isolated in `lib/email-transport.ts` for a future OAuth change.

## Smoke test before enablement

With automatic notifications still disabled, send exactly one message to a trusted address:

```bash
cd /opt/clarion
npm run email:test -- trusted.test@example.org
```

The same transport is available on the ADMIN-only **Email Notifications** page. Both paths report SMTP acceptance or a sanitised error and never print credentials. Verify sender identity, delivery, junk filtering, and tenant audit logs before continuing.

## Worker installation and operations

After deploying the additive migration and code:

```bash
cd /opt/clarion
sudo ./ops/email/install.sh
sudo systemctl status clarion-email-outbox.timer --no-pager
```

The timer invokes a bounded processor every two minutes. Inspect it without exposing the environment file:

```bash
sudo systemctl status clarion-email-outbox.service --no-pager
sudo journalctl -u clarion-email-outbox.service -n 100 --no-pager
```

ADMIN users can inspect recent PENDING, SENT, FAILED and SKIPPED records and retry a failed record. Retries update the same unique logical record, stop after five attempts, and use a backoff. Prisma Studio may also inspect `EmailNotification`, but recipient addresses are personal data and must not be pasted into tickets.

## Controlled rollout and emergency stop

1. Deploy migration/code with `EMAIL_NOTIFICATIONS_ENABLED=false`.
2. Configure the tenant-approved server secrets.
3. Send a test to a trusted mailbox and verify identity/deliverability.
4. Use a controlled active STUDENT account and class.
5. Set the desired independent homework/feedback switches on the ADMIN page.
6. Set `EMAIL_NOTIFICATIONS_ENABLED=true`, restart the application so event producers read it, and start/verify the worker timer.
7. Enable homework and feedback types separately after each controlled check.

For an immediate stop, set `EMAIL_NOTIFICATIONS_ENABLED=false`, restart `clarion.service`, and stop the timer:

```bash
sudo systemctl stop clarion-email-outbox.timer
sudo systemctl restart clarion.service
```

Already pending records remain visible but the guarded worker command refuses to deliver while globally disabled. Investigate them before re-enabling to avoid surprises.
