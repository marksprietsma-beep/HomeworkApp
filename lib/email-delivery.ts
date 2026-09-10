import "server-only";
import { EmailDeliveryStatus, EmailNotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { getEmailSettings } from "./email-notifications";
import { renderSafeHtml, renderTemplate, type EmailTemplateData } from "./email-templates";
import { createMailTransport, sanitiseMailError } from "./email-transport";
import { automaticEmailEnabled } from "./email-config";

export async function processEmailOutbox(options: { limit?: number; ids?: number[]; transport?: Awaited<ReturnType<typeof createMailTransport>> } = {}) {
  if (!automaticEmailEnabled()) return { processed: 0, sent: 0, failed: 0 };
  const now = new Date();
  const jobs = await prisma.emailNotification.findMany({ where: { id: options.ids ? { in: options.ids } : undefined, status: { in: [EmailDeliveryStatus.PENDING, EmailDeliveryStatus.FAILED] }, attemptCount: { lt: 5 }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: options.limit ?? 50 });
  if (!jobs.length) return { processed: 0, sent: 0, failed: 0 };
  const settings = await getEmailSettings();
  const transport = options.transport ?? await createMailTransport();
  let sent = 0, failed = 0;
  for (const job of jobs) {
    const data = job.templateData as EmailTemplateData;
    const homework = job.type === EmailNotificationType.HOMEWORK_PUBLISHED;
    try {
      const subject = renderTemplate(homework ? settings.homeworkSubjectTemplate : settings.feedbackSubjectTemplate, data);
      const text = renderTemplate(homework ? settings.homeworkBodyTemplate : settings.feedbackBodyTemplate, data);
      await transport.send({ to: job.recipientEmail, subject, text, html: renderSafeHtml(text, data.clarionLink, homework ? "View Homework" : "View Feedback") });
      await prisma.emailNotification.update({ where: { id: job.id }, data: { status: EmailDeliveryStatus.SENT, attemptCount: { increment: 1 }, attemptedAt: now, sentAt: now, lastError: null, nextAttemptAt: null } }); sent++;
    } catch (error) {
      const attempts = job.attemptCount + 1;
      await prisma.emailNotification.update({ where: { id: job.id }, data: { status: EmailDeliveryStatus.FAILED, attemptCount: attempts, attemptedAt: now, lastError: sanitiseMailError(error), nextAttemptAt: attempts < 5 ? new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000) : null } }); failed++;
    }
  }
  return { processed: jobs.length, sent, failed };
}
