"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { DEFAULT_EMAIL_TEMPLATES, renderSafeHtml, validateTemplate } from "../../../lib/email-templates";
import { createMailTransport, sanitiseMailError } from "../../../lib/email-transport";
import { processEmailOutbox } from "../../../lib/email-delivery";

export type EmailAdminState = { ok: boolean; message: string } | null;

export async function saveEmailSettings(_state: EmailAdminState, formData: FormData): Promise<EmailAdminState> {
  await requireRole(UserRole.ADMIN);
  const values = {
    homeworkEnabled: formData.get("homeworkEnabled") === "on",
    feedbackEnabled: formData.get("feedbackEnabled") === "on",
    homeworkSubjectTemplate: String(formData.get("homeworkSubjectTemplate") ?? "").trim(),
    homeworkBodyTemplate: String(formData.get("homeworkBodyTemplate") ?? "").trim(),
    feedbackSubjectTemplate: String(formData.get("feedbackSubjectTemplate") ?? "").trim(),
    feedbackBodyTemplate: String(formData.get("feedbackBodyTemplate") ?? "").trim(),
  };
  try {
    if (!values.homeworkSubjectTemplate || !values.homeworkBodyTemplate || !values.feedbackSubjectTemplate || !values.feedbackBodyTemplate) throw new Error("Subjects and message bodies cannot be empty.");
    validateTemplate(values.homeworkSubjectTemplate); validateTemplate(values.homeworkBodyTemplate);
    validateTemplate(values.feedbackSubjectTemplate); validateTemplate(values.feedbackBodyTemplate);
    await prisma.emailNotificationSettings.upsert({ where: { id: 1 }, create: { id: 1, ...values }, update: values });
    revalidatePath("/admin/email-notifications");
    return { ok: true, message: "Email notification settings saved. No email was sent." };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not save email settings." }; }
}

export async function resetEmailSettings() {
  await requireRole(UserRole.ADMIN);
  await prisma.emailNotificationSettings.upsert({ where: { id: 1 }, create: { id: 1, homeworkEnabled: true, feedbackEnabled: true, homeworkSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkSubject, homeworkBodyTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkBody, feedbackSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackSubject, feedbackBodyTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackBody }, update: { homeworkSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkSubject, homeworkBodyTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkBody, feedbackSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackSubject, feedbackBodyTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackBody } });
  revalidatePath("/admin/email-notifications");
}

export async function sendTestEmail(_state: EmailAdminState, formData: FormData): Promise<EmailAdminState> {
  await requireRole(UserRole.ADMIN);
  const to = String(formData.get("recipient") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: "Enter a valid trusted test email address." };
  try {
    const transport = await createMailTransport();
    await transport.send({ to, subject: "Clarion email configuration test", text: "This test confirms that Clarion can submit email using its configured server-side transport. Automatic student notifications are unchanged.", html: renderSafeHtml("This test confirms that Clarion can submit email using its configured server-side transport. Automatic student notifications are unchanged.", "https://clarion.invalid", "Clarion SMTP test") });
    return { ok: true, message: `SMTP accepted the test message for ${to}.` };
  } catch (error) { return { ok: false, message: `Test email failed: ${sanitiseMailError(error)}` }; }
}

export async function retryDelivery(formData: FormData) {
  await requireRole(UserRole.ADMIN);
  const id = Number(formData.get("notificationId"));
  if (!Number.isInteger(id)) throw new Error("Choose a valid notification.");
  await processEmailOutbox({ ids: [id] });
  revalidatePath("/admin/email-notifications");
}
