import "server-only";
import { AccountStatus, EmailDeliveryStatus, EmailNotificationType, FeedbackReleaseState, HomeworkAssignmentStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { automaticEmailEnabled, getClarionBaseUrl } from "./email-config";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplateData } from "./email-templates";

type Db = Prisma.TransactionClient;

export async function getEmailSettings(db: Db | typeof prisma = prisma) {
  const stored = await db.emailNotificationSettings.findUnique({ where: { id: 1 } });
  return stored ?? {
    id: 1, homeworkEnabled: true, feedbackEnabled: true,
    homeworkSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkSubject,
    homeworkBodyTemplate: DEFAULT_EMAIL_TEMPLATES.homeworkBody,
    feedbackSubjectTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackSubject,
    feedbackBodyTemplate: DEFAULT_EMAIL_TEMPLATES.feedbackBody,
    updatedAt: new Date(0),
  };
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function queueHomeworkPublication(db: Db, assignmentId: number, publicationVersion: number) {
  if (!automaticEmailEnabled()) return { queued: 0, skipped: 0 };
  const settings = await getEmailSettings(db);
  if (!settings.homeworkEnabled) return { queued: 0, skipped: 0 };
  const assignment = await db.homeworkAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: { id: true, title: true, dueAt: true, class: { select: { name: true, enrollments: { where: { student: { role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE } }, select: { student: { select: { id: true, email: true, displayName: true } } } } } } },
  });
  const baseUrl = getClarionBaseUrl();
  let queued = 0, skipped = 0;
  for (const { student } of assignment.class.enrollments) {
    const status = validEmail(student.email) ? EmailDeliveryStatus.PENDING : EmailDeliveryStatus.SKIPPED;
    await db.emailNotification.upsert({
      where: { idempotencyKey: `homework:${assignment.id}:${publicationVersion}:${student.id}` }, update: {},
      create: { idempotencyKey: `homework:${assignment.id}:${publicationVersion}:${student.id}`, type: EmailNotificationType.HOMEWORK_PUBLISHED, status, recipientUserId: student.id, recipientEmail: student.email, recipientName: student.displayName, assignmentId: assignment.id, lastError: status === EmailDeliveryStatus.SKIPPED ? "Recipient email is missing or invalid." : null, templateData: { studentName: student.displayName, className: assignment.class.name, assignmentTitle: assignment.title, dueDate: assignment.dueAt ? `Due: ${assignment.dueAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "", clarionLink: `${baseUrl}/assignments/${assignment.id}/work` } satisfies EmailTemplateData },
    });
    if (status === EmailDeliveryStatus.PENDING) queued++; else skipped++;
  }
  return { queued, skipped };
}

export async function transitionAssignmentStatus(db: Db, assignmentId: number, status: HomeworkAssignmentStatus) {
  if (status !== HomeworkAssignmentStatus.PUBLISHED) {
    return db.homeworkAssignment.update({ where: { id: assignmentId }, data: { status }, select: { id: true, status: true, publicationVersion: true } });
  }
  const changed = await db.homeworkAssignment.updateMany({ where: { id: assignmentId, status: { not: HomeworkAssignmentStatus.PUBLISHED } }, data: { status, publicationVersion: { increment: 1 } } });
  const assignment = await db.homeworkAssignment.findUniqueOrThrow({ where: { id: assignmentId }, select: { id: true, status: true, publicationVersion: true } });
  if (changed.count === 1) await queueHomeworkPublication(db, assignment.id, assignment.publicationVersion);
  return assignment;
}

export async function queueFeedbackReleases(db: Db, feedbackIds: number[]) {
  if (!automaticEmailEnabled() || feedbackIds.length === 0) return { queued: 0, skipped: 0 };
  const settings = await getEmailSettings(db);
  if (!settings.feedbackEnabled) return { queued: 0, skipped: 0 };
  const rows = await db.participantFeedback.findMany({ where: { id: { in: feedbackIds }, releaseState: FeedbackReleaseState.RELEASED }, select: { id: true, student: { select: { id: true, email: true, displayName: true, role: true, accountStatus: true } }, assignment: { select: { id: true, title: true, class: { select: { name: true } } } } } });
  const baseUrl = getClarionBaseUrl();
  let queued = 0, skipped = 0;
  for (const row of rows) {
    const student = row.student;
    if (!student || student.role !== UserRole.STUDENT || student.accountStatus !== AccountStatus.ACTIVE) continue;
    const status = validEmail(student.email) ? EmailDeliveryStatus.PENDING : EmailDeliveryStatus.SKIPPED;
    await db.emailNotification.upsert({ where: { idempotencyKey: `feedback:${row.id}:${student.id}` }, update: {}, create: { idempotencyKey: `feedback:${row.id}:${student.id}`, type: EmailNotificationType.FEEDBACK_RELEASED, status, recipientUserId: student.id, recipientEmail: student.email, recipientName: student.displayName, assignmentId: row.assignment.id, participantFeedbackId: row.id, lastError: status === EmailDeliveryStatus.SKIPPED ? "Recipient email is missing or invalid." : null, templateData: { studentName: student.displayName, className: row.assignment.class.name, assignmentTitle: row.assignment.title, dueDate: "", clarionLink: `${baseUrl}/assignments/${row.assignment.id}/work` } satisfies EmailTemplateData } });
    if (status === EmailDeliveryStatus.PENDING) queued++; else skipped++;
  }
  return { queued, skipped };
}

export async function releaseFeedback(db: Db, assignmentId: number, releasedById: number) {
  const drafts = await db.participantFeedback.findMany({ where: { assignmentId, releaseState: FeedbackReleaseState.DRAFT }, select: { id: true } });
  if (!drafts.length) return 0;
  const ids = drafts.map(({ id }) => id);
  const result = await db.participantFeedback.updateMany({ where: { id: { in: ids }, releaseState: FeedbackReleaseState.DRAFT }, data: { releaseState: FeedbackReleaseState.RELEASED, releasedAt: new Date(), releasedById } });
  if (result.count) await queueFeedbackReleases(db, ids);
  return result.count;
}
