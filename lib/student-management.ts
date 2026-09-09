import { AccountStatus, Prisma, UserRole, type UserRole as UserRoleValue } from "@prisma/client";

export type StudentManagementViewer = { id: number; role: UserRoleValue };

export function canAccessStudentManagement(viewer: StudentManagementViewer | null | undefined) {
  return viewer?.role === UserRole.ADMIN || viewer?.role === UserRole.TEACHER;
}

/** Builds the database-level visibility boundary for the staff student directory. */
export function studentDirectoryWhere(
  viewer: StudentManagementViewer,
  search = "",
): Prisma.UserWhereInput {
  const term = search.trim();
  return {
    role: UserRole.STUDENT,
    ...(viewer.role === UserRole.TEACHER
      ? { classEnrollments: { some: { class: { teacherId: viewer.id } } } }
      : {}),
    ...(term
      ? {
          OR: [
            { displayName: { contains: term } },
            { email: { contains: term } },
            { yearGroup: { contains: term } },
          ],
        }
      : {}),
  };
}

export function manageableClassesWhere(viewer: StudentManagementViewer): Prisma.ClassWhereInput {
  return viewer.role === UserRole.ADMIN ? {} : { teacherId: viewer.id };
}

/** Limits password resets to student accounts inside the staff member's management scope. */
export function resettableStudentWhere(
  viewer: StudentManagementViewer,
  studentId: number,
): Prisma.UserWhereInput {
  return {
    id: studentId,
    role: UserRole.STUDENT,
    ...(viewer.role === UserRole.TEACHER
      ? { classEnrollments: { some: { class: { teacherId: viewer.id } } } }
      : viewer.role === UserRole.ADMIN
        ? {}
        : { id: -1 }),
  };
}

export function existingAccountEnrollmentError(account: {
  role: UserRoleValue;
  accountStatus: AccountStatus;
}) {
  if (account.role !== UserRole.STUDENT) {
    return `That email belongs to a ${account.role} account. Its role cannot be changed here.`;
  }
  if (account.accountStatus !== AccountStatus.ACTIVE) {
    return "That student account is disabled. Ask an administrator to review it in Manage users.";
  }
  return null;
}
