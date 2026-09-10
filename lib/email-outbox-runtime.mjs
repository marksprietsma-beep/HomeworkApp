import { createRequire } from "node:module";
import core from "./email-core.cjs";
const { automaticEmailEnabled, DEFAULT_EMAIL_TEMPLATES, getMailConfig, renderSafeHtml, renderTemplate, sanitiseMailError } = core;

export const MAX_AUTOMATIC_ATTEMPTS = 5;
export const CLAIM_LEASE_MS = 5 * 60_000;

export async function createMailTransport(env = process.env) {
  const config = getMailConfig(env);
  const nodemailer = createRequire(import.meta.url)("nodemailer");
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, requireTLS: config.requireTLS, auth: config.auth });
  return { verify: () => transport.verify(), send: (message) => transport.sendMail({ ...message, from: config.from }) };
}

export async function claimNotification(db, id, { manual = false, now = new Date() } = {}) {
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  const availability = { OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", leaseUntil: { lte: now } }] };
  const policy = manual ? {} : { attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS }, AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }] };
  const claimed = await db.emailNotification.updateMany({ where: { id, ...availability, ...policy }, data: { status: "PROCESSING", leaseUntil, attemptedAt: now, attemptCount: { increment: 1 } } });
  if (claimed.count !== 1) return null;
  return db.emailNotification.findUnique({ where: { id } });
}

export async function processEmailOutbox({ db, limit = 50, ids, manual = false, transport, now = new Date() } = {}) {
  if (!db) throw new Error("An outbox database client is required.");
  if (!automaticEmailEnabled()) return { processed: 0, sent: 0, failed: 0, skipped: ids?.length ?? 0, message: "Automatic email delivery is disabled." };
  const candidates = await db.emailNotification.findMany({ where: { id: ids ? { in: ids } : undefined, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "PROCESSING", leaseUntil: { lte: now } }], ...(manual ? {} : { attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS }, AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }] }) }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  if (!candidates.length) return { processed: 0, sent: 0, failed: 0, skipped: ids?.length ?? 0, message: manual ? "Notification is not available for retry (it may already be sent or claimed)." : "No eligible notifications." };
  const settings = await db.emailNotificationSettings.findUnique({ where: { id: 1 } });
  const sender = transport ?? await createMailTransport();
  let processed = 0, sent = 0, failed = 0;
  for (const candidate of candidates) {
    const job = await claimNotification(db, candidate.id, { manual, now });
    if (!job) continue;
    processed++;
    const data = job.templateData;
    const homework = job.type === "HOMEWORK_PUBLISHED";
    try {
      const subject = renderTemplate(homework ? settings?.homeworkSubjectTemplate ?? DEFAULT_EMAIL_TEMPLATES.homeworkSubject : settings?.feedbackSubjectTemplate ?? DEFAULT_EMAIL_TEMPLATES.feedbackSubject, data);
      const text = renderTemplate(homework ? settings?.homeworkBodyTemplate ?? DEFAULT_EMAIL_TEMPLATES.homeworkBody : settings?.feedbackBodyTemplate ?? DEFAULT_EMAIL_TEMPLATES.feedbackBody, data);
      await sender.send({ to: job.recipientEmail, subject, text, html: renderSafeHtml(text, data.clarionLink, homework ? "View Homework" : "View Feedback") });
      await db.emailNotification.update({ where: { id: job.id }, data: { status: "SENT", sentAt: now, lastError: null, nextAttemptAt: null, leaseUntil: null } });
      sent++;
    } catch (error) {
      const exhausted = job.attemptCount >= MAX_AUTOMATIC_ATTEMPTS;
      await db.emailNotification.update({ where: { id: job.id }, data: { status: "FAILED", lastError: sanitiseMailError(error), nextAttemptAt: exhausted ? null : new Date(now.getTime() + Math.min(60, 2 ** job.attemptCount) * 60_000), leaseUntil: null } });
      failed++;
    }
  }
  return { processed, sent, failed, skipped: candidates.length - processed, message: processed ? `Processed ${processed}: ${sent} sent, ${failed} failed.` : "Notification was claimed by another worker." };
}

export async function sendTestEmail(to, { transport, env = process.env } = {}) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) throw new Error("Supply one valid explicit test recipient.");
  const sender = transport ?? await createMailTransport(env);
  const text = "This test confirms that Clarion can submit email using its configured server-side transport. Automatic student notifications are unchanged.";
  await sender.send({ to, subject: "Clarion email configuration test", text, html: renderSafeHtml(text, "https://clarion.invalid", "Clarion SMTP test") });
  return `SMTP accepted the test message for ${to}.`;
}
