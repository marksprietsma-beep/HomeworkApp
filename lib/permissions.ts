import { AccountStatus, UserRole } from "@prisma/client";

export type RoleBearingUser = {
  role: UserRole;
};

export type ClassTeacherCandidate = RoleBearingUser & {
  accountStatus: AccountStatus;
};

export function hasRole(user: RoleBearingUser | null | undefined, role: UserRole) {
  return user?.role === role;
}

export function isAdmin(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.ADMIN);
}

export function isTeacher(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.TEACHER);
}

export function isStudent(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.STUDENT);
}

export function canManageUsers(user: RoleBearingUser | null | undefined) {
  return isAdmin(user);
}

export function canManageClasses(user: RoleBearingUser | null | undefined) {
  return isAdmin(user);
}

export function canManageClassRoster(
  user: (RoleBearingUser & { id: number }) | null | undefined,
  teacherId: number,
) {
  return Boolean(user && (isAdmin(user) || (isTeacher(user) && user.id === teacherId)));
}

export function canActAsClassTeacher<T extends RoleBearingUser>(
  user: T | null | undefined,
): user is T {
  return isTeacher(user) || isAdmin(user);
}

export function isEligibleClassTeacher(
  user: ClassTeacherCandidate | null | undefined,
): user is ClassTeacherCandidate {
  return Boolean(
    user &&
      user.accountStatus === AccountStatus.ACTIVE &&
      canActAsClassTeacher(user),
  );
}

export function canTeachClass(
  user: (RoleBearingUser & { id: number }) | null | undefined,
  teacherId: number,
) {
  if (!user) {
    return false;
  }

  return canActAsClassTeacher(user) && user.id === teacherId;
}

export function canSubmitAssignedWork(user: RoleBearingUser | null | undefined) {
  return isStudent(user);
}
