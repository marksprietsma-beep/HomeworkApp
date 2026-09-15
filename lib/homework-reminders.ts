import "server-only";
import { AccountStatus, ClassStatus, EmailDeliveryStatus, EmailNotificationType, HomeworkAssignmentStatus, Prisma, UserRole } from "@prisma/client";
import { getAutomaticNotificationPreparation } from "./email-config";
import { formatSchoolDueDate } from "./email-templates";
import { isValidRecipientEmail } from "./email-notification-policy.mjs";
import { prisma } from "./prisma";
import { consolidateOutstandingAssignments, reminderIdempotencyKey } from "./homework-reminder-core.mjs";

type Db = Prisma.TransactionClient | typeof prisma;
type Caller = { id: number; role: UserRole };

export function reminderAssignmentWhere(caller: Caller): Prisma.HomeworkAssignmentWhereInput {
  return {
    status: HomeworkAssignmentStatus.PUBLISHED,
    class: { status: ClassStatus.ACTIVE, ...(caller.role === UserRole.ADMIN ? {} : { teacherId: caller.id }) },
  };
}

export async function getReminderCandidates(caller: Caller, db: Db = prisma) {
  if (caller.role === UserRole.STUDENT) throw new Error("Only teachers and administrators can send homework reminders.");
  const assignments = await db.homeworkAssignment.findMany({
    where: reminderAssignmentWhere(caller), orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true, dueAt: true, class: { select: { name: true, enrollments: { where: { student: { role: UserRole.STUDENT, accountStatus: AccountStatus.ACTIVE } }, select: { student: { select: { id: true, email: true, displayName: true, role: true, accountStatus: true } } } } } }, submissions: { select: { studentId: true, status: true } } },
  });
  return consolidateOutstandingAssignments(assignments);
}

export async function queueHomeworkReminderRun(caller: Caller, runKey: string, db: Db = prisma) {
  if (!/^[a-f0-9-]{36}$/i.test(runKey)) throw new Error("This reminder request is invalid. Refresh the preview and try again.");
  const candidates = await getReminderCandidates(caller, db);
  const preparation = getAutomaticNotificationPreparation();
  let queued = 0, skipped = 0, duplicates = 0;
  for (const { student, tasks } of candidates) {
    const status = preparation.ok && isValidRecipientEmail(student.email) ? EmailDeliveryStatus.PENDING : EmailDeliveryStatus.SKIPPED;
    const lines = tasks.map((task) => `• ${task.className} — ${task.title}${task.dueAt ? ` (${formatSchoolDueDate(task.dueAt)})` : ""}\n  ${preparation.ok ? `${preparation.baseUrl}/assignments/${task.id}/work` : "Link unavailable"}`);
    const message = `Hi ${student.displayName},\n\nYou still have homework to complete in Clarion:\n\n${lines.join("\n\n")}\n\nHarrow Haikou Clarion\nThis is an automated notification. Please do not reply.`;
    const result = await db.emailNotification.createMany({ data: [{ idempotencyKey: reminderIdempotencyKey(runKey, student.id), type: EmailNotificationType.HOMEWORK_REMINDER, status, recipientUserId: student.id, recipientEmail: student.email, recipientName: student.displayName, lastError: status === EmailDeliveryStatus.SKIPPED ? preparation.ok ? "Recipient email is missing or invalid." : preparation.error : null, templateData: { studentName: student.displayName, message, clarionLink: preparation.ok ? preparation.baseUrl : "" } }], skipDuplicates: true });
    if (!result.count) duplicates++; else if (status === EmailDeliveryStatus.PENDING) queued++; else skipped++;
  }
  return { queued, skipped, duplicates, students: candidates.length, assignments: candidates.reduce((sum, item) => sum + item.tasks.length, 0) };
}
