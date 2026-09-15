"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "../../lib/auth";
import { queueHomeworkReminderRun } from "../../lib/homework-reminders";
import { prisma } from "../../lib/prisma";

export type ReminderState = { ok: boolean; message: string } | null;

export async function sendHomeworkReminders(_state: ReminderState, formData: FormData): Promise<ReminderState> {
  const caller = await requireRole(UserRole.ADMIN, UserRole.TEACHER);
  const runKey = String(formData.get("runKey") ?? "");
  try {
    const result = await prisma.$transaction((tx) => queueHomeworkReminderRun(caller, runKey, tx));
    revalidatePath("/homework-reminders");
    if (result.duplicates === result.students && result.students > 0) return { ok: true, message: "This reminder run was already queued; no duplicate emails were created." };
    return { ok: true, message: `Reminder run saved: ${result.queued} queued, ${result.skipped} safely skipped${result.duplicates ? `, ${result.duplicates} already queued` : ""}. Delivery will continue through the email outbox.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create the reminder run." };
  }
}
