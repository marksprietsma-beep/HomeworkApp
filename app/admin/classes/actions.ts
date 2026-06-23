"use server";

import { AccountStatus, ClassStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { canManageClasses } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";

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
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  if (!canManageClasses(selectedUser)) {
    throw new Error("Class management is only available to ADMIN users.");
  }
  return selectedUser;
}

async function assertActiveTeacher(teacherId: number) {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new Error("Choose an active teacher for this class.");
  }
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: UserRole.TEACHER, accountStatus: AccountStatus.ACTIVE },
    select: { id: true, displayName: true },
  });
  if (!teacher) {
    throw new Error("Choose an existing active TEACHER as class teacher.");
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
