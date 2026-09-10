"use server";

import { ClassStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUserState } from "../../../lib/auth";
import { canManageClasses, isEligibleClassTeacher } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";
import { classCanBePurged, classPurgeConfirmationMatches, nextClassStatus } from "../../../lib/class-lifecycle";

export type AdminClassFormState = { error: string | null; success: string | null };

const statuses = [ClassStatus.ACTIVE, ClassStatus.INACTIVE] as const;

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseStatus(value: string) {
  const status = value as ClassStatus;
  if (!statuses.includes(status as (typeof statuses)[number])) {
    throw new Error("Choose a supported class status.");
  }
  return status;
}

async function assertAdminCanManageClasses() {
  const { selectedUser } = await getCurrentUserState();
  if (!canManageClasses(selectedUser)) {
    throw new Error("Class management is only available to ADMIN users.");
  }
  return selectedUser;
}

async function assertActiveTeacher(teacherId: number) {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new Error("Choose an active teacher for this class.");
  }
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, displayName: true, role: true, accountStatus: true },
  });
  if (!isEligibleClassTeacher(teacher)) {
    throw new Error("Choose an existing active TEACHER or ADMIN as class teacher.");
  }
  return teacher;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function createAdminClass(_previousState: AdminClassFormState, formData: FormData): Promise<AdminClassFormState> {
  try {
    await assertAdminCanManageClasses();
    const name = readTrimmed(formData, "name");
    const subject = readTrimmed(formData, "subject") || "General";
    const description = readTrimmed(formData, "description");
    const teacherId = Number(readTrimmed(formData, "teacherId"));
    const status = parseStatus(readTrimmed(formData, "status") || ClassStatus.ACTIVE);

    if (!name) throw new Error("Enter a class name.");
    if (!subject) throw new Error("Enter a subject.");
    await assertActiveTeacher(teacherId);

    await prisma.class.create({ data: { name, subject, description, teacherId, status } });
    revalidatePath("/admin/classes");
    revalidatePath("/");
    return { error: null, success: `${name} was created.` };
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: "A class with this name already exists.", success: null };
    return { error: error instanceof Error ? error.message : "Could not create this class.", success: null };
  }
}

export async function updateAdminClass(_previousState: AdminClassFormState, formData: FormData): Promise<AdminClassFormState> {
  try {
    await assertAdminCanManageClasses();
    const classId = Number(readTrimmed(formData, "classId"));
    const name = readTrimmed(formData, "name");
    const subject = readTrimmed(formData, "subject") || "General";
    const description = readTrimmed(formData, "description");
    const teacherId = Number(readTrimmed(formData, "teacherId"));
    const status = parseStatus(readTrimmed(formData, "status"));

    if (!Number.isInteger(classId) || classId <= 0) throw new Error("Choose a valid class to update.");
    if (!name) throw new Error("Enter a class name.");
    if (!subject) throw new Error("Enter a subject.");
    await assertActiveTeacher(teacherId);

    await prisma.class.update({ where: { id: classId }, data: { name, subject, description, teacherId, status } });
    revalidatePath("/admin/classes");
    revalidatePath(`/classes/${classId}`);
    revalidatePath("/");
    return { error: null, success: `${name} was updated.` };
  } catch (error) {
    if (isUniqueConstraintError(error)) return { error: "A class with this name already exists.", success: null };
    return { error: error instanceof Error ? error.message : "Could not update this class.", success: null };
  }
}

function revalidateClassLifecycle(classId: number) {
  revalidatePath("/admin/classes");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/");
}

export async function toggleAdminClassStatus(_previousState: AdminClassFormState, formData: FormData): Promise<AdminClassFormState> {
  try {
    await assertAdminCanManageClasses();
    const classId = Number(readTrimmed(formData, "classId"));
    if (!Number.isInteger(classId) || classId <= 0) throw new Error("Choose a valid class.");

    const target = await prisma.class.findUnique({ where: { id: classId }, select: { name: true, status: true } });
    if (!target) throw new Error("This class no longer exists.");
    const status = nextClassStatus(target.status);
    await prisma.class.update({ where: { id: classId }, data: { status } });
    revalidateClassLifecycle(classId);
    return { error: null, success: `${target.name} is now ${status === ClassStatus.ACTIVE ? "active" : "inactive"}. No class data was removed.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not change this class's status.", success: null };
  }
}

export async function purgeAdminClass(_previousState: AdminClassFormState, formData: FormData): Promise<AdminClassFormState> {
  try {
    await assertAdminCanManageClasses();
    const classId = Number(readTrimmed(formData, "classId"));
    const confirmation = readTrimmed(formData, "confirmation");
    if (!Number.isInteger(classId) || classId <= 0) throw new Error("Choose a valid class to purge.");

    const result = await prisma.$transaction(async (tx) => {
      // Re-read and validate the protected fields inside the destructive transaction.
      const target = await tx.class.findUnique({ where: { id: classId }, select: { name: true, status: true } });
      if (!target) throw new Error("This class no longer exists.");
      if (!classCanBePurged(target.status)) throw new Error("Make this class inactive before permanently purging it.");
      if (!classPurgeConfirmationMatches(confirmation, target.name)) {
        throw new Error(`Confirmation did not match. Type DELETE or the exact class name (${target.name}).`);
      }

      const assignmentWhere = { classId };
      const feedbackWhere = { assignment: assignmentWhere };
      const submissionWhere = { assignment: assignmentWhere };
      const counts = {
        enrollments: await tx.classEnrollment.count({ where: { classId } }),
        assignments: await tx.homeworkAssignment.count({ where: assignmentWhere }),
        submissions: await tx.submission.count({ where: submissionWhere }),
        answers: await tx.submissionAnswer.count({ where: { submission: submissionWhere } }),
        feedback: await tx.participantFeedback.count({ where: feedbackWhere }),
      };

      // Delete class-owned rows explicitly, deepest first. User and curriculum-library
      // rows are intentionally absent; assignment source references point outward.
      await tx.emailNotification.deleteMany({ where: { assignment: assignmentWhere } });
      await tx.feedbackFollowUpAction.deleteMany({ where: { participantFeedback: feedbackWhere } });
      await tx.questionFeedback.deleteMany({ where: { participantFeedback: feedbackWhere } });
      await tx.participantFeedback.deleteMany({ where: feedbackWhere });
      await tx.feedbackImport.deleteMany({ where: { assignment: assignmentWhere } });
      await tx.submissionAnswer.deleteMany({ where: { submission: submissionWhere } });
      await tx.submission.deleteMany({ where: submissionWhere });
      await tx.homeworkQuestion.deleteMany({ where: { assignment: assignmentWhere } });
      await tx.homeworkAssignment.deleteMany({ where: assignmentWhere });
      await tx.classEnrollment.deleteMany({ where: { classId } });
      await tx.class.delete({ where: { id: classId } });
      return { name: target.name, counts };
    });

    revalidateClassLifecycle(classId);
    return { error: null, success: `${result.name} was permanently purged with ${result.counts.enrollments} enrolments, ${result.counts.assignments} assignments, ${result.counts.submissions} submissions, ${result.counts.answers} answers, and ${result.counts.feedback} feedback records.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error.";
    return { error: message.startsWith("Confirmation") || message.includes("inactive") || message.includes("no longer exists") ? message : `The class could not be safely purged. Nothing was removed. ${message}`, success: null };
  }
}
