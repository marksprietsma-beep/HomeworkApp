"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { getCurrentUserState } from "../../lib/auth";
import { hashPassword } from "../../lib/passwords";
import { prisma } from "../../lib/prisma";
import { canManageClassRoster } from "../../lib/permissions";
import { applyStudentPasswordReset, canAccessStudentManagement, existingAccountEnrollmentError, resettableStudentWhere } from "../../lib/student-management";
import { generateTemporaryPassword } from "../../lib/temporary-password";

export type StudentRosterActionState = { error: string | null; success: string | null };
export const initialStudentRosterActionState: StudentRosterActionState = { error: null, success: null };

export type PasswordResetActionState = {
  error: string | null;
  temporaryPassword: string | null;
  studentName: string | null;
};
export const initialPasswordResetActionState: PasswordResetActionState = {
  error: null,
  temporaryPassword: null,
  studentName: null,
};

async function requireManagedClass(classId: number) {
  const { selectedUser } = await getCurrentUserState();
  if (!selectedUser || !canAccessStudentManagement(selectedUser)) throw new Error("Staff access is required.");
  if (!Number.isInteger(classId) || classId < 1) throw new Error("Choose a class.");
  const classItem = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, teacherId: true } });
  if (!classItem || !canManageClassRoster(selectedUser, classItem.teacherId)) {
    throw new Error("You do not have permission to manage that class roster.");
  }
  return classItem;
}

function refreshStudentViews(classId: number) {
  revalidatePath("/students");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/");
}

export async function enrollStudentByEmail(
  _state: StudentRosterActionState,
  formData: FormData,
): Promise<StudentRosterActionState> {
  try {
    const classId = Number(formData.get("classId"));
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Enter the student's school email.");
    const classItem = await requireManagedClass(classId);
    const account = await prisma.user.findUnique({
      where: { email },
      select: { id: true, displayName: true, role: true, accountStatus: true },
    });
    if (!account) {
      throw new Error("No account uses that email. Use this class's CSV import to securely create and enrol new students.");
    }
    const eligibilityError = existingAccountEnrollmentError(account);
    if (eligibilityError) throw new Error(eligibilityError);
    const existing = await prisma.classEnrollment.findUnique({ where: { classId_studentId: { classId, studentId: account.id } } });
    if (existing) return { error: null, success: `${account.displayName} is already enrolled in ${classItem.name}.` };
    await prisma.classEnrollment.create({ data: { classId, studentId: account.id } });
    refreshStudentViews(classId);
    return { error: null, success: `${account.displayName} was enrolled in ${classItem.name}. Their password was not changed.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not enrol this student.", success: null };
  }
}

export async function removeStudentEnrollment(
  _state: StudentRosterActionState,
  formData: FormData,
): Promise<StudentRosterActionState> {
  try {
    const classId = Number(formData.get("classId"));
    const studentId = Number(formData.get("studentId"));
    const classItem = await requireManagedClass(classId);
    if (!Number.isInteger(studentId) || studentId < 1) throw new Error("Choose an enrolled student.");
    const student = await prisma.user.findFirst({ where: { id: studentId, role: UserRole.STUDENT }, select: { displayName: true } });
    if (!student) throw new Error("That student account no longer exists.");
    const removed = await prisma.classEnrollment.deleteMany({ where: { classId, studentId } });
    if (!removed.count) throw new Error("That student is not enrolled in this class.");
    refreshStudentViews(classId);
    return { error: null, success: `${student.displayName} was removed from ${classItem.name}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove this enrolment.", success: null };
  }
}

export async function resetStudentPassword(
  _state: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  try {
    const { selectedUser } = await getCurrentUserState();
    if (!selectedUser || !canAccessStudentManagement(selectedUser)) {
      throw new Error("Staff access is required.");
    }
    if (formData.get("confirmation") !== "RESET_PASSWORD") {
      throw new Error("Confirm the password reset before continuing.");
    }

    const studentId = Number(formData.get("studentId"));
    if (!Number.isInteger(studentId) || studentId < 1) throw new Error("Choose a student account.");
    const student = await prisma.user.findFirst({
      where: resettableStudentWhere(selectedUser, studentId),
      select: { id: true, displayName: true },
    });
    if (!student) throw new Error("You do not have permission to reset that student account.");

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await prisma.$transaction(async (tx) => {
      await applyStudentPasswordReset(tx, student.id, passwordHash);
    });

    revalidatePath("/students");
    return { error: null, temporaryPassword, studentName: student.displayName };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not reset this password.",
      temporaryPassword: null,
      studentName: null,
    };
  }
}
